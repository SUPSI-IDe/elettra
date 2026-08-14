import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE_ERROR_KIND,
  DeleteResponseError,
  readDeleteResponse,
} from "../src/api/delete-response.js";
import {
  DELETION_BLOCKER_TYPES,
  guardProtectedDeletion,
} from "../src/utils/protected-delete.js";
import {
  findOptimizationRunBlockersForShifts,
  hasReliableShiftIds,
  loadOptimizationRunsForShiftDependencyCheck,
  prepareShiftDeletion,
  resolveShiftDeleteFailure,
  resolveShiftIdsFromRun,
  runReferencesAnyShift,
} from "../src/utils/shift-deletion.js";

const EN = {
  "shifts.delete_blocked_intro":
    "The selected shift(s) cannot be deleted because they are still used by:",
  "shifts.delete_blocked_footer":
    "Delete the related feasibility evaluations first and then try again.",
  "shifts.delete_dependency_check_failed":
    "ELETTRA could not verify whether the selected shift(s) are in use. Please try again.",
  "protected_delete.blocked_item_named": '{typeLabel} "{name}"',
  "protected_delete.blocked_item_id": "{typeLabel} (ID: {id})",
  "protected_delete.blocker_type.optimization_run": "Feasibility evaluation",
  "delete_error.blocked": "Unable to delete: this resource is still in use.",
  "delete_error.generic": "Unable to delete resource.",
};

const IT = {
  ...EN,
  "shifts.delete_blocked_intro":
    "Il/i turno/i selezionato/i non può/possono essere eliminato/i perché è/sono ancora utilizzato/i da:",
  "protected_delete.blocker_type.optimization_run": "Valutazione di fattibilità",
};

const translate = (dict) => (key, params = {}) => {
  let text = dict[key] ?? key;
  Object.entries(params).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, String(value));
  });
  return text;
};

const tEn = translate(EN);
const tIt = translate(IT);

const listRuns = [
  { id: "run-1", name: "Evaluation X" },
  { id: "run-2", name: "Evaluation Y" },
  { id: "run-3", name: "Irrelevant" },
];

const detailedRuns = [
  {
    id: "run-1",
    name: "Evaluation X",
    input_params: { shift_ids: ["shift-a", "shift-extra"] },
  },
  {
    id: "run-2",
    name: "Evaluation Y",
    input_params: { shift_ids: ["shift-c"] },
  },
  {
    id: "run-3",
    name: "Irrelevant",
    input_params: { shift_ids: ["shift-other"] },
  },
];

test("resolveShiftIdsFromRun reads input_params.shift_ids", () => {
  assert.deepEqual(
    resolveShiftIdsFromRun({
      input_params: { shift_ids: ["shift-a", "shift-b"] },
    }),
    ["shift-a", "shift-b"]
  );
});

test("findOptimizationRunBlockersForShifts returns no blockers for unused shift", () => {
  assert.deepEqual(
    findOptimizationRunBlockersForShifts(detailedRuns, ["shift-unused"]),
    []
  );
});

test("findOptimizationRunBlockersForShifts returns one blocker for one run", () => {
  assert.deepEqual(findOptimizationRunBlockersForShifts(detailedRuns, ["shift-c"]), [
    {
      type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
      id: "run-2",
      name: "Evaluation Y",
    },
  ]);
});

test("findOptimizationRunBlockersForShifts returns all runs referencing a shift", () => {
  const blockers = findOptimizationRunBlockersForShifts(detailedRuns, ["shift-a"]);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].name, "Evaluation X");
});

test("findOptimizationRunBlockersForShifts handles one run with multiple shifts", () => {
  assert.equal(
    findOptimizationRunBlockersForShifts(detailedRuns, ["shift-extra"]).length,
    1
  );
});

test("findOptimizationRunBlockersForShifts blocks when any selected shift is referenced", () => {
  const blockers = findOptimizationRunBlockersForShifts(detailedRuns, [
    "shift-unused",
    "shift-c",
  ]);
  assert.equal(blockers.length, 1);
});

test("findOptimizationRunBlockersForShifts aggregates blockers across selected shifts", () => {
  const blockers = findOptimizationRunBlockersForShifts(detailedRuns, [
    "shift-a",
    "shift-c",
  ]);
  assert.equal(blockers.length, 2);
});

test("findOptimizationRunBlockersForShifts deduplicates duplicate run records", () => {
  const duplicates = [
    detailedRuns[0],
    { ...detailedRuns[0], name: "Evaluation X copy" },
  ];
  assert.equal(
    findOptimizationRunBlockersForShifts(duplicates, ["shift-a"]).length,
    1
  );
});

test("findOptimizationRunBlockersForShifts handles missing run names", () => {
  assert.deepEqual(
    findOptimizationRunBlockersForShifts(
      [{ id: "run-9", input_params: { shift_ids: ["shift-a"] } }],
      ["shift-a"]
    ),
    [{ type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN, id: "run-9" }]
  );
});

test("findOptimizationRunBlockersForShifts ignores unrelated runs", () => {
  const blockers = findOptimizationRunBlockersForShifts(detailedRuns, ["shift-other"]);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].id, "run-3");
});

test("runReferencesAnyShift normalizes numeric shift ids", () => {
  const selected = new Set(["42"]);
  assert.equal(
    runReferencesAnyShift({ input_params: { shift_ids: [42] } }, selected),
    true
  );
});

test("hasReliableShiftIds is false for lightweight list items", () => {
  assert.equal(hasReliableShiftIds({ id: "run-1", name: "Evaluation X" }), false);
});

test("loadOptimizationRunsForShiftDependencyCheck fetches required details", async () => {
  const fetched = [];
  const hydrated = await loadOptimizationRunsForShiftDependencyCheck({
    runs: listRuns,
    fetchOptimizationRunDetail: async (runId) => {
      fetched.push(runId);
      return detailedRuns.find((run) => run.id === runId) ?? null;
    },
    concurrency: 2,
  });

  assert.deepEqual(fetched.sort(), ["run-1", "run-2", "run-3"]);
  assert.equal(hydrated.length, 3);
  assert.equal(resolveShiftIdsFromRun(hydrated[0]).length, 2);
});

test("loadOptimizationRunsForShiftDependencyCheck skips detail when shift ids are already reliable", async () => {
  let fetchCount = 0;
  const hydrated = await loadOptimizationRunsForShiftDependencyCheck({
    runs: detailedRuns,
    fetchOptimizationRunDetail: async () => {
      fetchCount += 1;
      return {};
    },
  });

  assert.equal(fetchCount, 0);
  assert.equal(hydrated.length, 3);
});

test("loadOptimizationRunsForShiftDependencyCheck deduplicates detail requests", async () => {
  const fetchCounts = new Map();
  await loadOptimizationRunsForShiftDependencyCheck({
    runs: [listRuns[0], listRuns[0], listRuns[0]],
    fetchOptimizationRunDetail: async (runId) => {
      fetchCounts.set(runId, (fetchCounts.get(runId) ?? 0) + 1);
      return detailedRuns[0];
    },
  });

  assert.equal(fetchCounts.get("run-1"), 1);
});

test("loadOptimizationRunsForShiftDependencyCheck fails safe on detail fetch failure", async () => {
  await assert.rejects(
    () =>
      loadOptimizationRunsForShiftDependencyCheck({
        runs: listRuns,
        fetchOptimizationRunDetail: async (runId) => {
          if (runId === "run-2") {
            throw new Error("network down");
          }
          return detailedRuns.find((run) => run.id === runId);
        },
      }),
    /network down/
  );
});

test("loadOptimizationRunsForShiftDependencyCheck fails safe on malformed detail", async () => {
  await assert.rejects(
    () =>
      loadOptimizationRunsForShiftDependencyCheck({
        runs: [{ id: "run-1", name: "Evaluation X" }],
        fetchOptimizationRunDetail: async () => null,
      }),
    /Invalid optimization run detail/
  );
});

test("prepareShiftDeletion fails safe when list fetch throws", async () => {
  const messages = [];
  const result = await prepareShiftDeletion({
    selectedShiftIds: ["shift-a"],
    fetchAllOptimizationRuns: async () => {
      throw new Error("list failed");
    },
    fetchOptimizationRunDetail: async () => ({}),
    showFlash: (message) => messages.push(message),
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "dependency_check_failed");
  assert.match(messages[0], /could not verify/i);
});

test("prepareShiftDeletion blocks before confirm/delete", async () => {
  const result = await prepareShiftDeletion({
    selectedShiftIds: ["shift-a"],
    fetchAllOptimizationRuns: async () => listRuns,
    fetchOptimizationRunDetail: async (runId) =>
      detailedRuns.find((run) => run.id === runId),
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "blocked");
});

test("prepareShiftDeletion allows deletion when no blockers exist", async () => {
  const result = await prepareShiftDeletion({
    selectedShiftIds: ["shift-unused"],
    fetchAllOptimizationRuns: async () => listRuns,
    fetchOptimizationRunDetail: async (runId) =>
      detailedRuns.find((run) => run.id === runId),
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, true);
});

test("prepareShiftDeletion uses supplied translate for non-English wording", async () => {
  const messages = [];
  await prepareShiftDeletion({
    selectedShiftIds: ["shift-c"],
    fetchAllOptimizationRuns: async () => listRuns,
    fetchOptimizationRunDetail: async (runId) =>
      detailedRuns.find((run) => run.id === runId),
    showFlash: (message) => messages.push(message),
    translate: tIt,
  });

  assert.match(messages[0], /turno\/i selezionato/i);
  assert.match(messages[0], /Valutazione di fattibilità "Evaluation Y"/);
});

test("resolveShiftDeleteFailure formats structured 409 blockers", () => {
  const error = new DeleteResponseError("Still referenced.", {
    status: 409,
    kind: DELETE_ERROR_KIND.BLOCKED,
    blockers: [
      {
        type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
        name: "Morning route",
      },
    ],
  });

  const resolved = resolveShiftDeleteFailure(error, tEn);
  assert.match(resolved.message, /shift\(s\) cannot be deleted/i);
  assert.match(resolved.message, /Morning route/);
});

test("resolveShiftDeleteFailure falls back for 409 without blockers", () => {
  const error = new DeleteResponseError("Still referenced.", {
    status: 409,
    kind: DELETE_ERROR_KIND.BLOCKED,
    blockers: [],
  });

  assert.equal(resolveShiftDeleteFailure(error, tEn).message, "Still referenced.");
});

test("resolveShiftDeleteFailure returns generic message for server failures", () => {
  const error = new DeleteResponseError("Database unavailable", {
    status: 503,
    kind: DELETE_ERROR_KIND.FAILURE,
  });

  assert.equal(resolveShiftDeleteFailure(error, tEn).message, "Database unavailable");
});

test("readDeleteResponse success behavior unchanged for shift deletes", async () => {
  const response = new Response(null, { status: 204 });
  await assert.deepEqual(await readDeleteResponse(response), { deleted: true });
});

test("guardProtectedDeletion with shift blockers prevents confirm/delete path", () => {
  let confirmReached = false;
  let deleteReached = false;

  const { blocked } = guardProtectedDeletion({
    blockers: [
      {
        type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
        name: "Evaluation X",
      },
    ],
    showFlash: () => {},
    translate: tEn,
    introKey: "shifts.delete_blocked_intro",
    footerKey: "shifts.delete_blocked_footer",
  });

  if (!blocked) {
    confirmReached = true;
    deleteReached = true;
  }

  assert.equal(blocked, true);
  assert.equal(confirmReached, false);
  assert.equal(deleteReached, false);
});

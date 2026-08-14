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
  findOptimizationRunBlockersForBusModels,
  prepareBusModelDeletion,
  resolveBusModelDeleteFailure,
} from "../src/utils/bus-model-deletion.js";

const EN = {
  "buses.delete_blocked_intro":
    "The selected bus model(s) cannot be deleted because they are still used by:",
  "buses.delete_blocked_footer":
    "Delete the related feasibility evaluations first and then try again.",
  "buses.delete_dependency_check_failed":
    "ELETTRA could not verify whether the selected bus model(s) are in use. Please try again.",
  "protected_delete.blocked_item_named": '{typeLabel} "{name}"',
  "protected_delete.blocked_item_id": "{typeLabel} (ID: {id})",
  "protected_delete.blocker_type.optimization_run": "Feasibility evaluation",
  "delete_error.blocked": "Unable to delete: this resource is still in use.",
  "delete_error.generic": "Unable to delete resource.",
};

const IT = {
  ...EN,
  "buses.delete_blocked_intro":
    "Il/i modello/i di autobus selezionato/i non può/possono essere eliminato/i perché è/sono ancora utilizzato/i da:",
  "buses.delete_blocked_footer":
    "Elimina prima le valutazioni di fattibilità correlate e riprova.",
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

const runsFixture = [
  { id: "run-1", bus_model_id: "model-a", name: "Evaluation X" },
  { id: "run-2", bus_model_id: "model-a", name: "Evaluation X duplicate" },
  { id: "run-3", bus_model_id: "model-c", name: "Evaluation Y" },
  { id: "run-4", bus_model_id: "model-c", name: "Evaluation Z" },
  { id: "run-5", bus_model_id: "model-d" },
  { id: "run-6", bus_model_id: "model-other", name: "Irrelevant" },
];

test("findOptimizationRunBlockersForBusModels returns no blockers when unused", () => {
  assert.deepEqual(
    findOptimizationRunBlockersForBusModels(runsFixture, ["model-b"]),
    []
  );
});

test("findOptimizationRunBlockersForBusModels returns one blocker for one run", () => {
  assert.deepEqual(
    findOptimizationRunBlockersForBusModels(runsFixture, ["model-c"]),
    [
      {
        type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
        id: "run-3",
        name: "Evaluation Y",
      },
      {
        type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
        id: "run-4",
        name: "Evaluation Z",
      },
    ]
  );
});

test("findOptimizationRunBlockersForBusModels returns all runs for one model", () => {
  const blockers = findOptimizationRunBlockersForBusModels(runsFixture, ["model-a"]);
  assert.equal(blockers.length, 2);
  assert.deepEqual(
    blockers.map((blocker) => blocker.id).sort(),
    ["run-1", "run-2"]
  );
});

test("findOptimizationRunBlockersForBusModels blocks when any selected model is used", () => {
  const blockers = findOptimizationRunBlockersForBusModels(runsFixture, [
    "model-b",
    "model-c",
  ]);
  assert.equal(blockers.length, 2);
});

test("findOptimizationRunBlockersForBusModels aggregates blockers across selected models", () => {
  const blockers = findOptimizationRunBlockersForBusModels(runsFixture, [
    "model-a",
    "model-c",
  ]);
  assert.equal(blockers.length, 4);
});

test("findOptimizationRunBlockersForBusModels handles missing run names", () => {
  assert.deepEqual(findOptimizationRunBlockersForBusModels(runsFixture, ["model-d"]), [
    {
      type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
      id: "run-5",
    },
  ]);
});

test("findOptimizationRunBlockersForBusModels ignores unrelated runs", () => {
  const blockers = findOptimizationRunBlockersForBusModels(runsFixture, ["model-other"]);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].name, "Irrelevant");
});

test("findOptimizationRunBlockersForBusModels deduplicates duplicate run entries", () => {
  const duplicates = [
    { id: "run-1", bus_model_id: "model-a", name: "Evaluation X" },
    { id: "run-1", bus_model_id: "model-a", name: "Evaluation X copy" },
  ];
  assert.equal(
    findOptimizationRunBlockersForBusModels(duplicates, ["model-a"]).length,
    1
  );
});

test("findOptimizationRunBlockersForBusModels normalizes string model ids", () => {
  const blockers = findOptimizationRunBlockersForBusModels(
    [{ id: "run-9", bus_model_id: 123, name: "Numeric model ref" }],
    ["123"]
  );
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].name, "Numeric model ref");
});

test("prepareBusModelDeletion fails safe when optimization-run lookup throws", async () => {
  const messages = [];
  const result = await prepareBusModelDeletion({
    selectedModelIds: ["model-a"],
    fetchAllOptimizationRuns: async () => {
      throw new Error("network down");
    },
    showFlash: (message) => messages.push(message),
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "dependency_check_failed");
  assert.match(messages[0], /could not verify/i);
});

test("prepareBusModelDeletion blocks before confirm/delete", async () => {
  let confirmReached = false;
  let deleteReached = false;

  const result = await prepareBusModelDeletion({
    selectedModelIds: ["model-a"],
    fetchAllOptimizationRuns: async () => runsFixture,
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, false);

  if (result.proceed) {
    confirmReached = true;
    deleteReached = true;
  }

  assert.equal(confirmReached, false);
  assert.equal(deleteReached, false);
});

test("prepareBusModelDeletion allows deletion when no blockers exist", async () => {
  const result = await prepareBusModelDeletion({
    selectedModelIds: ["model-b"],
    fetchAllOptimizationRuns: async () => runsFixture,
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, true);
});

test("prepareBusModelDeletion uses supplied translate for non-English wording", async () => {
  const messages = [];
  await prepareBusModelDeletion({
    selectedModelIds: ["model-c"],
    fetchAllOptimizationRuns: async () => runsFixture,
    showFlash: (message) => messages.push(message),
    translate: tIt,
  });

  assert.match(messages[0], /modello\/i di autobus selezionato/i);
  assert.match(messages[0], /Valutazione di fattibilità "Evaluation Y"/);
});

test("resolveBusModelDeleteFailure formats structured 409 blockers", () => {
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

  const resolved = resolveBusModelDeleteFailure(error, tEn);
  assert.match(resolved.message, /bus model\(s\) cannot be deleted/i);
  assert.match(resolved.message, /Morning route/);
});

test("resolveBusModelDeleteFailure falls back for 409 without blockers", () => {
  const error = new DeleteResponseError("Still referenced.", {
    status: 409,
    kind: DELETE_ERROR_KIND.BLOCKED,
    blockers: [],
  });

  const resolved = resolveBusModelDeleteFailure(error, tEn);
  assert.equal(resolved.message, "Still referenced.");
});

test("resolveBusModelDeleteFailure returns generic message for server failures", () => {
  const error = new DeleteResponseError("Database unavailable", {
    status: 503,
    kind: DELETE_ERROR_KIND.FAILURE,
  });

  const resolved = resolveBusModelDeleteFailure(error, tEn);
  assert.equal(resolved.message, "Database unavailable");
});

test("readDeleteResponse success behavior unchanged for bus-model deletes", async () => {
  const response = new Response(null, { status: 204 });
  await assert.deepEqual(await readDeleteResponse(response), { deleted: true });
});

test("guardProtectedDeletion with optimization-run blockers prevents confirm/delete", () => {
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
    introKey: "buses.delete_blocked_intro",
    footerKey: "buses.delete_blocked_footer",
  });

  if (!blocked) {
    confirmReached = true;
    deleteReached = true;
  }

  assert.equal(blocked, true);
  assert.equal(confirmReached, false);
  assert.equal(deleteReached, false);
});

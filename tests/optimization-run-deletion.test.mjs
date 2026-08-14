import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE_ERROR_KIND,
  DeleteResponseError,
} from "../src/api/delete-response.js";
import {
  DELETION_BLOCKER_TYPES,
  guardProtectedDeletion,
} from "../src/utils/protected-delete.js";
import {
  findYearlyAnalysisBlockersForRuns,
  prepareOptimizationRunDeletion,
  resolveOptimizationRunDeleteFailure,
} from "../src/utils/optimization-run-deletion.js";

const EN = {
  "simulation.delete_blocked_intro":
    "The selected feasibility evaluation(s) cannot be deleted because they are still used by:",
  "simulation.delete_blocked_footer":
    "Delete the related yearly analysis/analyses first and then try again.",
  "simulation.delete_dependency_check_failed":
    "ELETTRA could not verify whether the selected feasibility evaluation(s) are in use. Please try again.",
  "protected_delete.blocked_item_named": '{typeLabel} "{name}"',
  "protected_delete.blocked_item_id": "{typeLabel} (ID: {id})",
  "protected_delete.blocked_item_type_only": "{typeLabel}",
  "protected_delete.blocker_type.yearly_analysis": "Yearly analysis",
  "delete_error.blocked": "Unable to delete: this resource is still in use.",
};

const IT = {
  ...EN,
  "simulation.delete_blocked_intro":
    "La/le valutazione/i di fattibilità selezionata/e non può/possono essere eliminata/e perché è/sono ancora utilizzata/e da:",
  "simulation.delete_blocked_footer":
    "Elimina prima l'analisi annuale o le analisi annuali correlate e riprova.",
  "protected_delete.blocker_type.yearly_analysis": "Analisi annuale",
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

const analysesFixture = [
  { id: "ya-1", optimization_run_id: "run-a", name: "Analysis X" },
  { id: "ya-2", optimization_run_id: "run-a", name: "Duplicate X" },
  { id: "ya-3", optimization_run_id: "run-c", name: "Analysis Y" },
  { id: "ya-4", optimization_run_id: "run-d" },
  { id: "ya-5", optimization_run_id: "run-other", name: "Irrelevant" },
];

test("findYearlyAnalysisBlockersForRuns returns no blockers when nothing references selected runs", () => {
  assert.deepEqual(findYearlyAnalysisBlockersForRuns(analysesFixture, ["run-b"]), []);
});

test("findYearlyAnalysisBlockersForRuns returns one blocker for a referenced run", () => {
  assert.deepEqual(findYearlyAnalysisBlockersForRuns(analysesFixture, ["run-c"]), [
    {
      type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
      id: "ya-3",
      name: "Analysis Y",
    },
  ]);
});

test("findYearlyAnalysisBlockersForRuns returns all yearly analyses referencing the same run", () => {
  const blockers = findYearlyAnalysisBlockersForRuns(analysesFixture, ["run-a"]);
  assert.equal(blockers.length, 2);
  assert.deepEqual(
    blockers.map((blocker) => blocker.id).sort(),
    ["ya-1", "ya-2"]
  );
});

test("findYearlyAnalysisBlockersForRuns deduplicates duplicate analysis entries", () => {
  const duplicateList = [
    { id: "ya-1", optimization_run_id: "run-a", name: "Analysis X" },
    { id: "ya-1", optimization_run_id: "run-a", name: "Analysis X copy" },
  ];
  assert.equal(findYearlyAnalysisBlockersForRuns(duplicateList, ["run-a"]).length, 1);
});

test("findYearlyAnalysisBlockersForRuns blocks when any selected run is referenced", () => {
  const blockers = findYearlyAnalysisBlockersForRuns(analysesFixture, [
    "run-b",
    "run-c",
  ]);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].name, "Analysis Y");
});

test("findYearlyAnalysisBlockersForRuns aggregates distinct blockers for multi-select", () => {
  const blockers = findYearlyAnalysisBlockersForRuns(analysesFixture, [
    "run-a",
    "run-c",
  ]);
  assert.equal(blockers.length, 3);
  assert.deepEqual(
    blockers.map((blocker) => blocker.name).sort(),
    ["Analysis X", "Analysis Y", "Duplicate X"]
  );
});

test("findYearlyAnalysisBlockersForRuns handles missing analysis names", () => {
  assert.deepEqual(findYearlyAnalysisBlockersForRuns(analysesFixture, ["run-d"]), [
    {
      type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
      id: "ya-4",
    },
  ]);
});

test("findYearlyAnalysisBlockersForRuns ignores unrelated yearly analyses", () => {
  const blockers = findYearlyAnalysisBlockersForRuns(analysesFixture, ["run-other"]);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].name, "Irrelevant");
});

test("prepareOptimizationRunDeletion fails safe when lookup throws", async () => {
  const messages = [];
  const result = await prepareOptimizationRunDeletion({
    selectedRunIds: ["run-a"],
    fetchAllYearlyAnalyses: async () => {
      throw new Error("network down");
    },
    showFlash: (message) => messages.push(message),
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "dependency_check_failed");
  assert.equal(messages.length, 1);
  assert.match(messages[0], /could not verify/i);
});

test("prepareOptimizationRunDeletion blocks deletion before confirm/delete", async () => {
  let confirmed = false;
  let deleted = false;

  const result = await prepareOptimizationRunDeletion({
    selectedRunIds: ["run-c"],
    fetchAllYearlyAnalyses: async () => analysesFixture,
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "blocked");

  if (result.proceed) {
    confirmed = true;
    deleted = true;
  }

  assert.equal(confirmed, false);
  assert.equal(deleted, false);
});

test("prepareOptimizationRunDeletion allows deletion when no blockers exist", async () => {
  const result = await prepareOptimizationRunDeletion({
    selectedRunIds: ["run-b"],
    fetchAllYearlyAnalyses: async () => analysesFixture,
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, true);
  assert.deepEqual(result.blockers, []);
});

test("prepareOptimizationRunDeletion uses the supplied translate function for active language", async () => {
  const messages = [];
  await prepareOptimizationRunDeletion({
    selectedRunIds: ["run-c"],
    fetchAllYearlyAnalyses: async () => analysesFixture,
    showFlash: (message) => messages.push(message),
    translate: tIt,
  });

  assert.match(messages[0], /valutazione.*fattibilità selezionata/i);
  assert.match(messages[0], /Analisi annuale "Analysis Y"/);
});

test("resolveOptimizationRunDeleteFailure formats structured 409 blockers", () => {
  const error = new DeleteResponseError("Still referenced.", {
    status: 409,
    kind: DELETE_ERROR_KIND.BLOCKED,
    blockers: [
      {
        type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
        name: "Winter case",
      },
    ],
  });

  const resolved = resolveOptimizationRunDeleteFailure(error, tEn);
  assert.equal(resolved.kind, DELETE_ERROR_KIND.BLOCKED);
  assert.match(resolved.message, /selected feasibility evaluation/i);
  assert.match(resolved.message, /Winter case/);
});

test("resolveOptimizationRunDeleteFailure falls back when 409 has no structured blockers", () => {
  const error = new DeleteResponseError("Still referenced.", {
    status: 409,
    kind: DELETE_ERROR_KIND.BLOCKED,
    blockers: [],
  });

  const resolved = resolveOptimizationRunDeleteFailure(error, tEn);
  assert.equal(resolved.message, "Still referenced.");
});

test("resolveOptimizationRunDeleteFailure preserves generic server failure classification", () => {
  const error = new DeleteResponseError("Method Not Allowed", {
    status: 405,
    kind: DELETE_ERROR_KIND.FAILURE,
  });

  const resolved = resolveOptimizationRunDeleteFailure(error, tEn);
  assert.equal(resolved.kind, DELETE_ERROR_KIND.FAILURE);
  assert.equal(resolved.message, undefined);
});

test("guardProtectedDeletion with blockers prevents reaching confirm/delete flow", () => {
  let confirmReached = false;
  let deleteReached = false;

  const { blocked } = guardProtectedDeletion({
    blockers: [
      {
        type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
        name: "Analysis X",
      },
    ],
    showFlash: () => {},
    translate: tEn,
    introKey: "simulation.delete_blocked_intro",
    footerKey: "simulation.delete_blocked_footer",
  });

  if (!blocked) {
    confirmReached = true;
    deleteReached = true;
  }

  assert.equal(blocked, true);
  assert.equal(confirmReached, false);
  assert.equal(deleteReached, false);
});

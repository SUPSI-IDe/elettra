import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatBatchDeletionFeedback,
  formatBatchDeletionSummary,
  settleBatchDeletion,
} from "../src/utils/batch-delete.js";

const translate = (key, params = {}) => {
  const messages = {
    "common.delete_partial":
      "Deleted {deleted} of {total}; {failed} failed.",
    "common.delete_none": "None of {total} could be deleted.",
  };
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replace(`{${name}}`, String(value)),
    messages[key] ?? key
  );
};

test("settleBatchDeletion waits for every deletion and preserves item order", async () => {
  const attempted = [];
  const result = await settleBatchDeletion(["a", "b", "c"], async (id) => {
    attempted.push(id);
    if (id === "b") throw new Error("still referenced");
    return { deleted: true, id };
  });

  assert.deepEqual(attempted.sort(), ["a", "b", "c"]);
  assert.equal(result.total, 3);
  assert.equal(result.succeededCount, 2);
  assert.equal(result.failedCount, 1);
  assert.deepEqual(result.succeeded.map(({ item }) => item), ["a", "c"]);
  assert.equal(result.failed[0].item, "b");
  assert.match(result.failed[0].reason.message, /referenced/);
});

test("settleBatchDeletion handles an empty selection", async () => {
  let called = false;
  const result = await settleBatchDeletion([], () => {
    called = true;
  });

  assert.equal(called, false);
  assert.deepEqual(result, {
    total: 0,
    succeeded: [],
    failed: [],
    succeededCount: 0,
    failedCount: 0,
  });
});

test("settleBatchDeletion validates its arguments", async () => {
  await assert.rejects(() => settleBatchDeletion(null, async () => {}), /array/);
  await assert.rejects(() => settleBatchDeletion([], null), /function/);
});

test("partial deletion summary reports successful and failed counts", () => {
  assert.equal(
    formatBatchDeletionSummary(
      { total: 4, succeededCount: 3, failedCount: 1 },
      translate
    ),
    "Deleted 3 of 4; 1 failed."
  );
});

test("all-failed deletion feedback retains the first actionable error", () => {
  const result = {
    total: 2,
    succeededCount: 0,
    failedCount: 2,
    failed: [{ item: "a", reason: new Error("Analysis A still uses it") }],
  };

  assert.equal(
    formatBatchDeletionFeedback(result, translate, (error) => error.message),
    "None of 2 could be deleted.\nAnalysis A still uses it"
  );
});

test("successful deletion produces no failure summary", () => {
  assert.equal(
    formatBatchDeletionSummary(
      { total: 2, succeededCount: 2, failedCount: 0 },
      translate
    ),
    ""
  );
});

test("every multi-row delete page uses settled deletion and refreshes its view", async () => {
  const pages = [
    ["../src/pages/Fleet/Buses/buses.js", /triggerPartialLoad\("buses"\)/],
    ["../src/pages/Fleet/Custom Stops/custom-stops.js", /await reload\(\)/],
    ["../src/pages/Fleet/Shifts/shifts.js", /await loadShifts\(\)/],
    ["../src/pages/Simulation/Runs/simulation-runs.js", /await loadRuns\(\)/],
    [
      "../src/pages/Simulation/YearlyAnalysis/yearly-analysis-runs.js",
      /await loadAnalyses\(\)/,
    ],
  ];

  for (const [relativePath, refreshPattern] of pages) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /settleBatchDeletion\(/, relativePath);
    assert.match(source, refreshPattern, relativePath);
    assert.doesNotMatch(
      source,
      /Promise\.all\([^)]*\.map\([^)]*delete(?:BusModel|Depot|Shift|OptimizationRun|YearlyAnalysis)/s,
      relativePath
    );
  }
});

test("partial and failed deletion feedback exists in every locale", async () => {
  const { translations } = await import("../src/i18n/translations.js");
  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const key of ["common.delete_partial", "common.delete_none"]) {
      assert.ok(dictionary[key]?.trim(), `${locale}.${key}`);
    }
  }
});

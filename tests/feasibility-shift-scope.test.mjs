import assert from "node:assert/strict";
import test from "node:test";

import {
  hasShiftSelection,
  matchesPredictionRunShift,
  matchesShiftRecord,
  normalizeShiftSelection,
  resolvePredictionRunShiftIds,
  resolvePredictionRunShiftNames,
  scopePredictionRunsByShift,
} from "../src/utils/feasibility-shift-scope.js";

const run = (id, shiftId, packs, overrides = {}) => ({
  id,
  shift_id: shiftId,
  contextual_parameters: { num_battery_packs: packs },
  ...overrides,
});

test("normalizes the current shift without accepting blank identifiers", () => {
  assert.deepEqual(
    normalizeShiftSelection({
      selectedShiftId: "  shift-a  ",
      selectedShiftName: " Morning ",
    }),
    { shiftId: "shift-a", shiftName: "Morning" },
  );
  assert.deepEqual(
    normalizeShiftSelection({ selectedShiftId: " ", shiftId: 42 }),
    { shiftId: "42", shiftName: "" },
  );
  assert.equal(hasShiftSelection({ selectedShiftId: "  " }), false);
  assert.equal(hasShiftSelection({ shiftName: "Morning" }), true);
});

test("matches a shift record by authoritative identifier", () => {
  assert.equal(
    matchesShiftRecord(
      { shift_id: "shift-a", shift_name: "Morning" },
      "map-key",
      { selectedShiftId: "shift-a", selectedShiftName: "Morning" },
    ),
    true,
  );
  assert.equal(
    matchesShiftRecord(
      { shift_id: "shift-b", shift_name: "Morning" },
      "shift-a",
      { selectedShiftId: "shift-a", selectedShiftName: "Morning" },
    ),
    false,
  );
});

test("uses a battery-result map key only when the record has no explicit identifier", () => {
  assert.equal(
    matchesShiftRecord(
      { shift_name: "Morning" },
      "shift-a",
      { selectedShiftId: "shift-a" },
    ),
    true,
  );
  assert.equal(
    matchesShiftRecord(
      { shift_id: "shift-b" },
      "shift-a",
      { selectedShiftId: "shift-a" },
    ),
    false,
  );
});

test("uses names only for a genuinely name-only selection", () => {
  assert.equal(
    matchesShiftRecord(
      { shift_id: "shift-b", shift_name: "Same name" },
      "",
      { selectedShiftId: "shift-a", selectedShiftName: "Same name" },
    ),
    false,
  );
  assert.equal(
    matchesShiftRecord(
      { shift_name: "Legacy shift" },
      "",
      { selectedShiftName: "Legacy shift" },
    ),
    true,
  );
});

test("an unscoped view accepts every shift record", () => {
  for (const record of [undefined, null, {}, { shift_id: "a" }]) {
    assert.equal(matchesShiftRecord(record, "", {}), true);
  }
});

test("prediction identity prefers a direct physical shift over aggregate context", () => {
  const prediction = {
    shift_id: "shift-a",
    shift_ids: ["shift-a", "shift-b"],
    summary: { shift_id: "shift-b" },
    contextual_parameters: { shift_ids: ["shift-a", "shift-b"] },
  };

  assert.deepEqual(resolvePredictionRunShiftIds(prediction), ["shift-a"]);
  assert.equal(
    matchesPredictionRunShift(prediction, { selectedShiftId: "shift-a" }),
    true,
  );
  assert.equal(
    matchesPredictionRunShift(prediction, { selectedShiftId: "shift-b" }),
    false,
  );
});

test("recognizes singular prediction identifiers in legacy locations", () => {
  const variants = [
    { shiftId: "a" },
    { summary: { shift_id: "a" } },
    { summary: { shiftId: "a" } },
    { contextual_parameters: { shift_id: "a" } },
    { contextual_parameters: { shiftId: "a" } },
  ];

  for (const prediction of variants) {
    assert.deepEqual(resolvePredictionRunShiftIds(prediction), ["a"]);
    assert.equal(
      matchesPredictionRunShift(prediction, { selectedShiftId: "a" }),
      true,
    );
  }
});

test("rejects aggregate prediction runs from a physical-shift view", () => {
  const prediction = {
    shift_ids: ["shift-a", "shift-b", "shift-a", " "],
  };

  assert.deepEqual(resolvePredictionRunShiftIds(prediction), ["shift-a", "shift-b"]);
  assert.equal(
    matchesPredictionRunShift(prediction, { selectedShiftId: "shift-a" }),
    false,
  );
  assert.equal(matchesPredictionRunShift(prediction, {}), true);
});

test("never lets an equal name override a different prediction shift identifier", () => {
  const prediction = {
    shift_id: "shift-b",
    shift_name: "Same name",
  };

  assert.equal(
    matchesPredictionRunShift(prediction, {
      selectedShiftId: "shift-a",
      selectedShiftName: "Same name",
    }),
    false,
  );
});

test("supports unambiguous name-only legacy prediction runs", () => {
  const prediction = { summary: { shift_name: "Legacy morning" } };

  assert.deepEqual(resolvePredictionRunShiftNames(prediction), ["Legacy morning"]);
  assert.equal(
    matchesPredictionRunShift(prediction, {
      selectedShiftName: "Legacy morning",
    }),
    true,
  );
});

test("rejects aggregate name-only predictions from one shift", () => {
  const prediction = {
    shift_names: ["Morning", "Evening", "Morning"],
  };

  assert.deepEqual(resolvePredictionRunShiftNames(prediction), ["Morning", "Evening"]);
  assert.equal(
    matchesPredictionRunShift(prediction, { selectedShiftName: "Morning" }),
    false,
  );
});

test("a selected shift with no prediction match produces an empty scope", () => {
  const predictions = [run("morning", "morning", 8)];

  assert.deepEqual(
    scopePredictionRunsByShift(predictions, { selectedShiftId: "evening" }),
    [],
  );
});

test("scopes and orders only the selected shift predictions", () => {
  const predictions = [
    run("evening-12", "evening", 12),
    run("morning-8", "morning", 8),
    run("evening-6", "evening", 6),
    run("unknown", "evening", "invalid"),
  ];

  assert.deepEqual(
    scopePredictionRunsByShift(predictions, { selectedShiftId: "evening" })
      .map(({ id }) => id),
    ["evening-6", "evening-12", "unknown"],
  );
});

test("an unscoped prediction view keeps all runs while sorting a copy", () => {
  const predictions = [
    run("twelve", "evening", 12),
    run("six", "morning", 6),
  ];
  const snapshot = structuredClone(predictions);

  assert.deepEqual(
    scopePredictionRunsByShift(predictions).map(({ id }) => id),
    ["six", "twelve"],
  );
  assert.deepEqual(predictions, snapshot);
});

test("malformed prediction collections and entries fail closed", () => {
  for (const predictions of [undefined, null, {}, "invalid"]) {
    assert.deepEqual(
      scopePredictionRunsByShift(predictions, { selectedShiftId: "shift-a" }),
      [],
    );
  }
  assert.deepEqual(
    scopePredictionRunsByShift([null, {}, { shift_id: "shift-b" }], {
      selectedShiftId: "shift-a",
    }),
    [],
  );
});

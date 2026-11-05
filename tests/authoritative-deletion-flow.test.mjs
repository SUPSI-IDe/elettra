import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const read = (path) => readFile(new URL(path, import.meta.url), "utf8");


test("fleet deletion flows call the authoritative DELETE endpoint directly", async () => {
  const [buses, customStops, shifts] = await Promise.all([
    read("../src/pages/Fleet/Buses/buses.js"),
    read("../src/pages/Fleet/Custom Stops/custom-stops.js"),
    read("../src/pages/Fleet/Shifts/shifts.js"),
  ]);

  assert.doesNotMatch(buses, /prepareBusModelDeletion/);
  assert.doesNotMatch(customStops, /prepareCustomStopDeletion/);
  assert.doesNotMatch(shifts, /prepareShiftDeletion/);

  assert.match(buses, /settleBatchDeletion\(selectedIds, deleteBusModel\)/);
  assert.match(customStops, /settleBatchDeletion\(ids, deleteDepot\)/);
  assert.match(shifts, /settleBatchDeletion\(ids, deleteShift\)/);

  for (const source of [buses, customStops, shifts]) {
    assert.match(source, /confirm\(/);
    assert.doesNotMatch(source, /fetchAllOptimizationRuns/);
  }
});

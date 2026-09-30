import assert from "node:assert/strict";
import test from "node:test";
import { selectOptimizationReferences, optimizationVerificationStatus } from "../src/utils/optimization-references.js";

const variants = (shift = "s") => Array.from({length: 7}, (_, i) => ({
  id: `${shift}-${i+10}`, shift_id: shift, status: "completed", contextual_parameters: {num_battery_packs: i+10},
}));

test("seven variants stay available while selecting one stable reference", () => {
  const runs = variants();
  assert.deepEqual(selectOptimizationReferences(runs, ["s"], "joint"), {s: "s-16"});
  assert.deepEqual(selectOptimizationReferences([...runs].reverse(), ["s"], "battery_only"), {s: "s-16"});
  assert.equal(runs.length, 7);
});
test("charging-only requires an explicit physical battery", () => {
  assert.throws(() => selectOptimizationReferences(variants(), ["s"], "charging_only"));
  assert.throws(() => selectOptimizationReferences(variants(), ["s"], "charging_only", 9));
  assert.deepEqual(selectOptimizationReferences(variants(), ["s"], "charging_only", 12), {s: "s-12"});
});
test("two shifts remain two references", () => {
  assert.deepEqual(selectOptimizationReferences([...variants("a"), ...variants("b")], ["a", "b"], "joint"), {a: "a-16", b: "b-16"});
});
test("historical duplicate results cannot be described as verified", () => {
  assert.equal(optimizationVerificationStatus({results: {per_bus_summary: [{shift_id: "s"}, {shift_id: "s"}]}}), "duplicate_physical_shifts");
  assert.equal(optimizationVerificationStatus({results: {electrification_feasible: true}}), "unverified");
});

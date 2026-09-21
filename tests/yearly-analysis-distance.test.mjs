import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYearlyDistanceSliderBounds,
  parseYearlyDistanceKm,
  resolveYearlyDistanceKm,
} from "../src/pages/Simulation/YearlyAnalysis/yearly-analysis-distance.js";

const SAVED_YEARLY_DISTANCE_KM = 54_139.184;

test("missing or non-positive yearly distances do not become slider overrides", () => {
  for (const value of [null, undefined, "", "   ", 0, "0", -1, NaN, Infinity, true, false]) {
    assert.equal(parseYearlyDistanceKm(value), null, String(value));
  }
});

test("the initial HP and diesel-heater states use the saved annual distance", () => {
  for (const heatingType of ["heat-pump", "diesel-heater"]) {
    assert.equal(
      resolveYearlyDistanceKm(null, SAVED_YEARLY_DISTANCE_KM),
      SAVED_YEARLY_DISTANCE_KM,
      heatingType,
    );
  }
});

test("a deliberate slider selection overrides the saved annual distance", () => {
  assert.equal(
    resolveYearlyDistanceKm("30000", SAVED_YEARLY_DISTANCE_KM),
    30_000,
  );
});

test("resetting the slider restores the saved annual distance", () => {
  const selectedDistance = resolveYearlyDistanceKm(30_000, SAVED_YEARLY_DISTANCE_KM);
  assert.equal(selectedDistance, 30_000);

  const resetDistance = resolveYearlyDistanceKm(null, SAVED_YEARLY_DISTANCE_KM);
  assert.equal(resetDistance, SAVED_YEARLY_DISTANCE_KM);
});

test("the first valid backend distance is used as the fallback", () => {
  assert.equal(
    resolveYearlyDistanceKm(null, null, 0, "54139.184", 60_000),
    SAVED_YEARLY_DISTANCE_KM,
  );
});

test("the standard saved case receives the expected positive slider bounds", () => {
  assert.deepEqual(buildYearlyDistanceSliderBounds(SAVED_YEARLY_DISTANCE_KM), {
    min: 30_000,
    max: 100_000,
    step: 1,
  });
});

test("short annual distances never create a zero slider bound", () => {
  const bounds = buildYearlyDistanceSliderBounds(5_000);
  assert.ok(bounds.min > 0);
  assert.ok(bounds.min < 5_000);
  assert.ok(bounds.max > 5_000);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnnualCo2DisplayMetrics,
  convertEmissionIndicatorForDisplay,
} from "../src/utils/emissions-display.js";

test("annual CO2 converts backend grams to tonnes and grams per kilometre", () => {
  const metrics = buildAnnualCo2DisplayMetrics(7_672_736.1152, 54_139.184);
  assert.ok(Math.abs(metrics.totalTonnes - 7.6727361152) < 1e-12);
  assert.ok(Math.abs(metrics.gramsPerKm - 141.722419) < 1e-6);
});

test("annual CO2 metrics reject missing and invalid distance values", () => {
  assert.deepEqual(buildAnnualCo2DisplayMetrics(null, 54_139.184), {
    totalTonnes: null,
    gramsPerKm: null,
  });
  assert.equal(buildAnnualCo2DisplayMetrics(1_000_000, 0).gramsPerKm, null);
});

test("known emission indicators use explicit annual display units", () => {
  assert.deepEqual(convertEmissionIndicatorForDisplay("gwp100a", 8_159_874), {
    value: 8.159874,
    unit: "t/year",
    decimals: 1,
  });
  assert.deepEqual(convertEmissionIndicatorForDisplay("nox", 5_773_875), {
    value: 5.773875,
    unit: "kg/year",
    decimals: 1,
  });
  assert.deepEqual(convertEmissionIndicatorForDisplay("pm10", 733_401), {
    value: 0.733401,
    unit: "kg/year",
    decimals: 2,
  });
  assert.deepEqual(convertEmissionIndicatorForDisplay("primaryEnergy", 630_000), {
    value: 630,
    unit: "GJ/year",
    decimals: 1,
  });
});

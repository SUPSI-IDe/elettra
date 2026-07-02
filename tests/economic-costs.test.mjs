import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiscountedProjectedCostTrend,
  computeEquivalentAnnualCost,
} from "../src/utils/economic-costs.js";

const finalLifetimeSaving = (yearly) => {
  const last = yearly.at(-1);
  return last.diesel - last.electric;
};

test("discounted projected trend final savings react to the discount rate", () => {
  const base = {
    horizonYears: 20,
    dieselBusCapexChf: 350_000,
    dieselAnnualOpex: 85_000,
    dieselBusReplacementCostByYear: { 10: 350_000 },
    electricBusCapexChf: 620_000,
    electricAnnualOpex: 38_000,
    electricBusReplacementCostByYear: { 12: 460_000 },
    batteryReplacementCostByYear: { 8: 160_000, 16: 160_000 },
  };

  const savingAt3 = finalLifetimeSaving(
    buildDiscountedProjectedCostTrend({ ...base, discountRate: 0.03 })
  );
  const savingAt10 = finalLifetimeSaving(
    buildDiscountedProjectedCostTrend({ ...base, discountRate: 0.10 })
  );

  assert.notEqual(Math.round(savingAt3), Math.round(savingAt10));
});

test("discounted projected trend discounts increments before accumulating", () => {
  const yearly = buildDiscountedProjectedCostTrend({
    horizonYears: 2,
    discountRate: 0.10,
    dieselBusCapexChf: 100,
    dieselAnnualOpex: 11,
    dieselBusReplacementCostByYear: { 2: 121 },
    electricBusCapexChf: 50,
    electricAnnualOpex: 0,
    electricBusReplacementCostByYear: {},
    batteryReplacementCostByYear: {},
  });

  const final = yearly.at(-1);
  assert.equal(Math.round(final.diesel), 219);
  assert.equal(final.electric, 50);
});

test("equivalent annual cost remains monotonic in the rate", () => {
  const principal = 500_000;
  const lifetimeYears = 12;

  const eacAt3 = computeEquivalentAnnualCost(principal, 0.03, lifetimeYears);
  const eacAt10 = computeEquivalentAnnualCost(principal, 0.10, lifetimeYears);

  assert.ok(eacAt10 > eacAt3);
});

test("annual OPEX changes still move the projected trend", () => {
  const base = {
    horizonYears: 20,
    discountRate: 0.03,
    dieselBusCapexChf: 350_000,
    dieselAnnualOpex: 85_000,
    dieselBusReplacementCostByYear: {},
    electricBusCapexChf: 620_000,
    electricAnnualOpex: 38_000,
    electricBusReplacementCostByYear: {},
    batteryReplacementCostByYear: {},
  };

  const baseline = buildDiscountedProjectedCostTrend(base).at(-1).electric;
  const higherOpex = buildDiscountedProjectedCostTrend({
    ...base,
    electricAnnualOpex: 48_000,
  }).at(-1).electric;

  assert.ok(higherOpex > baseline);
});

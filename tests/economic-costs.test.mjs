import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiscountedProjectedCostTrend,
  computeEquivalentAnnualCost,
  computeLinearResidualValue,
  computeScheduleResidualValue,
} from "../src/utils/economic-costs.js";

const finalLifetimeSaving = (yearly) => {
  const last = yearly.at(-1);
  return last.diesel - last.electric;
};

const lifecycleSaving = (yearly) =>
  yearly.lifecycle?.lifecycleSaving ?? finalLifetimeSaving(yearly);

const assertSeriesNonDecreasing = (yearly, key) => {
  for (let index = 1; index < yearly.length; index += 1) {
    assert.ok(
      yearly[index][key] + 1e-6 >= yearly[index - 1][key],
      `${key} decreases at index ${index}`
    );
  }
};

// Mirrors the page-level exclusive replacement schedule (`year < horizon`):
// a replacement landing exactly at the horizon belongs to the next lifecycle.
const recurringReplacementYears = (lifetime, horizon) => {
  const years = [];
  for (let year = lifetime; year < horizon; year += lifetime) years.push(year);
  return years;
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

test("lifecycle trend horizon equals the e-bus lifespan", () => {
  const ebusLifespan = 12;
  const yearly = buildDiscountedProjectedCostTrend({
    horizonYears: ebusLifespan,
    discountRate: 0.03,
    dieselBusCapexChf: 350_000,
    dieselAnnualOpex: 85_000,
    electricBusCapexChf: 620_000,
    electricAnnualOpex: 38_000,
  });

  assert.equal(yearly.at(-1).year, ebusLifespan);
});

test("full e-bus replacement exactly at the horizon is excluded", () => {
  const ebusLifespan = 12;
  const replacementYears = recurringReplacementYears(ebusLifespan, ebusLifespan);
  assert.deepEqual(replacementYears, []);

  const yearly = buildDiscountedProjectedCostTrend({
    horizonYears: ebusLifespan,
    discountRate: 0,
    electricBusCapexChf: 620_000,
    electricAnnualOpex: 0,
    electricBusReplacementCostByYear: replacementYears.reduce((acc, y) => {
      acc[y] = 460_000;
      return acc;
    }, {}),
  });

  // No replacement jump: the e-bus curve stays at the initial CAPEX.
  assert.equal(yearly.at(-1).electric, 620_000);
});

test("diesel replacement before the horizon is included", () => {
  const horizon = 12;
  const dieselLifespan = 10;
  const replacementYears = recurringReplacementYears(dieselLifespan, horizon);
  assert.deepEqual(replacementYears, [10]);

  const withReplacement = buildDiscountedProjectedCostTrend({
    horizonYears: horizon,
    discountRate: 0,
    dieselBusCapexChf: 350_000,
    dieselAnnualOpex: 0,
    dieselBusReplacementCostByYear: { 10: 350_000 },
  }).at(-1).diesel;

  const withoutReplacement = buildDiscountedProjectedCostTrend({
    horizonYears: horizon,
    discountRate: 0,
    dieselBusCapexChf: 350_000,
    dieselAnnualOpex: 0,
  }).at(-1).diesel;

  assert.ok(withReplacement > withoutReplacement);
  assert.equal(withReplacement, 700_000);
});

test("linear residual value uses straight-line depreciation", () => {
  // Diesel bought at year 10, 10-yr life, 12-yr horizon → 8 yr remaining.
  assert.equal(
    computeLinearResidualValue({
      purchaseCost: 350_000,
      lifetimeYears: 10,
      purchaseYear: 10,
      horizonYears: 12,
    }),
    350_000 * (8 / 10)
  );

  // E-bus bought at year 0, 12-yr life, 12-yr horizon → fully consumed.
  assert.equal(
    computeLinearResidualValue({
      purchaseCost: 620_000,
      lifetimeYears: 12,
      purchaseYear: 0,
      horizonYears: 12,
    }),
    0
  );
});

test("schedule residual credits the latest purchase strictly before the horizon", () => {
  // Diesel purchased at years 0 and 10; only the year-10 unit has residual.
  assert.equal(
    computeScheduleResidualValue({
      purchaseCost: 350_000,
      lifetimeYears: 10,
      purchaseYears: [0, 10],
      horizonYears: 12,
    }),
    350_000 * (8 / 10)
  );

  // E-bus purchased only at year 0 with life == horizon → no residual.
  assert.equal(
    computeScheduleResidualValue({
      purchaseCost: 620_000,
      lifetimeYears: 12,
      purchaseYears: [0],
      horizonYears: 12,
    }),
    0
  );

  // A purchase exactly at the horizon belongs to the next lifecycle → ignored.
  assert.equal(
    computeScheduleResidualValue({
      purchaseCost: 100,
      lifetimeYears: 5,
      purchaseYears: [12],
      horizonYears: 12,
    }),
    0
  );
});

test("residual value does not reduce the plotted gross cumulative trend", () => {
  const horizon = 12;
  const rate = 0.03;
  const base = {
    horizonYears: horizon,
    discountRate: rate,
    dieselBusCapexChf: 350_000,
    dieselAnnualOpex: 85_000,
    dieselBusReplacementCostByYear: { 10: 350_000 },
    electricBusCapexChf: 620_000,
    electricAnnualOpex: 38_000,
  };

  const noResidual = buildDiscountedProjectedCostTrend(base).at(-1).diesel;
  const residual = computeScheduleResidualValue({
    purchaseCost: 350_000,
    lifetimeYears: 10,
    purchaseYears: [0, 10],
    horizonYears: horizon,
  });
  const withResidual = buildDiscountedProjectedCostTrend({
    ...base,
    dieselResidualValue: residual,
  });

  assert.equal(withResidual.at(-1).diesel, noResidual);
  assertSeriesNonDecreasing(withResidual, "diesel");
  assertSeriesNonDecreasing(withResidual, "electric");
});

test("residual value is credited only in net lifecycle economics", () => {
  const horizon = 12;
  const rate = 0.03;
  const base = {
    horizonYears: horizon,
    discountRate: rate,
    dieselBusCapexChf: 350_000,
    dieselAnnualOpex: 85_000,
    dieselBusReplacementCostByYear: { 10: 350_000 },
    electricBusCapexChf: 620_000,
    electricAnnualOpex: 38_000,
  };

  const noResidual = buildDiscountedProjectedCostTrend(base);
  const residual = computeScheduleResidualValue({
    purchaseCost: 350_000,
    lifetimeYears: 10,
    purchaseYears: [0, 10],
    horizonYears: horizon,
  });
  const withResidual = buildDiscountedProjectedCostTrend({
    ...base,
    dieselResidualValue: residual,
  });

  assert.equal(withResidual.at(-1).diesel, noResidual.at(-1).diesel);
  assert.ok(withResidual.lifecycle.netFinalDiesel < withResidual.lifecycle.grossFinalDiesel);

  const expectedCredit = residual / Math.pow(1 + rate, horizon);
  assert.ok(Math.abs(withResidual.lifecycle.dieselDiscountedResidual - expectedCredit) < 1e-6);
  assert.ok(
    Math.abs(
      withResidual.lifecycle.lifecycleSaving -
        (noResidual.lifecycle.lifecycleSaving - expectedCredit)
    ) < 1e-6
  );
});

test("residual credit still lets the discount rate move lifecycle saving", () => {
  const horizon = 12;
  const build = (rate) =>
    lifecycleSaving(buildDiscountedProjectedCostTrend({
      horizonYears: horizon,
      discountRate: rate,
      dieselBusCapexChf: 350_000,
      dieselAnnualOpex: 85_000,
      dieselBusReplacementCostByYear: { 10: 350_000 },
      dieselResidualValue: computeScheduleResidualValue({
        purchaseCost: 350_000,
        lifetimeYears: 10,
        purchaseYears: [0, 10],
        horizonYears: horizon,
      }),
      electricBusCapexChf: 620_000,
      electricAnnualOpex: 38_000,
      batteryReplacementCostByYear: { 8: 160_000 },
      electricResidualValue: computeScheduleResidualValue({
        purchaseCost: 160_000,
        lifetimeYears: 8,
        purchaseYears: [0, 8],
        horizonYears: horizon,
      }),
    }));

  assert.notEqual(Math.round(build(0.03)), Math.round(build(0.10)));
});

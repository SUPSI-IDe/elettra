import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYearlyCapitalModel,
  recurringReplacementYears,
} from "../src/utils/yearly-analysis-capital.js";

const crf = (rate, lifetime) => {
  if (rate === 0) return 1 / lifetime;
  const growth = (1 + rate) ** lifetime;
  return rate * growth / (growth - 1);
};

test("annualizes every fleet component over its own useful life", () => {
  const rate = 0.03;
  const model = buildYearlyCapitalModel({
    annualizationRate: rate,
    horizonYears: 12,
    vehicleCount: 2,
    electricBusCostPerVehicleChf: 800_000,
    batteryCostPerVehicleChf: 60_000,
    sharedInfrastructureCostChf: 300_000,
    dieselBusCostPerVehicleChf: 500_000,
    busLifetimeYears: 12,
    batteryLifetimeYears: 8,
    infrastructureLifetimeYears: 15,
    dieselBusLifetimeYears: 10,
    electricAnnualOpex: 128_734,
    dieselAnnualOpex: 248_371,
  });

  assert.equal(model.electric.initialCostChf, 2_020_000);
  assert.equal(model.diesel.initialCostChf, 1_000_000);
  assert.ok(Math.abs(
    model.components.electricBus.annualizedCostChfPerYear -
      1_600_000 * crf(rate, 12),
  ) < 1e-6);
  assert.ok(Math.abs(
    model.components.battery.annualizedCostChfPerYear -
      120_000 * crf(rate, 8),
  ) < 1e-6);
  assert.ok(Math.abs(
    model.components.chargingInfrastructure.annualizedCostChfPerYear -
      300_000 * crf(rate, 15),
  ) < 1e-6);
  assert.ok(Math.abs(
    model.components.dieselBus.annualizedCostChfPerYear -
      1_000_000 * crf(rate, 10),
  ) < 1e-6);
  assert.equal(Math.round(model.electric.annualizedCostChfPerYear), 202_964);
  assert.equal(Math.round(model.diesel.annualizedCostChfPerYear), 117_231);
  assert.equal(
    Math.round(
      248_371 + model.diesel.annualizedCostChfPerYear -
        128_734 - model.electric.annualizedCostChfPerYear,
    ),
    33_903,
  );
});

test("replacement schedules, curve jumps and residual values use the same components", () => {
  const rate = 0.03;
  const model = buildYearlyCapitalModel({
    annualizationRate: rate,
    horizonYears: 12,
    vehicleCount: 2,
    electricBusCostPerVehicleChf: 800_000,
    batteryCostPerVehicleChf: 60_000,
    sharedInfrastructureCostChf: 300_000,
    dieselBusCostPerVehicleChf: 500_000,
    busLifetimeYears: 12,
    batteryLifetimeYears: 8,
    infrastructureLifetimeYears: 15,
    dieselBusLifetimeYears: 10,
    electricAnnualOpex: 128_734,
    dieselAnnualOpex: 248_371,
  });

  assert.deepEqual(model.components.electricBus.replacementYears, []);
  assert.deepEqual(model.components.battery.replacementYears, [8]);
  assert.deepEqual(model.components.chargingInfrastructure.replacementYears, []);
  assert.deepEqual(model.components.dieselBus.replacementYears, [10]);
  const yearEight = model.yearly.filter((point) => point.year === 8);
  const yearTen = model.yearly.filter((point) => point.year === 10);
  assert.equal(yearEight.length, 2);
  assert.equal(yearTen.length, 2);
  assert.ok(Math.abs(
    yearEight[1].electric - yearEight[0].electric -
      120_000 / (1 + rate) ** 8,
  ) < 1e-6);
  assert.ok(Math.abs(
    yearTen[1].diesel - yearTen[0].diesel -
      1_000_000 / (1 + rate) ** 10,
  ) < 1e-6);
  assert.equal(model.components.battery.residualValueChf, 60_000);
  assert.equal(
    model.components.chargingInfrastructure.residualValueChf,
    60_000,
  );
  assert.equal(model.components.dieselBus.residualValueChf, 800_000);
  assert.equal(model.lifecycle.electricResidualValue, 120_000);
  assert.equal(model.lifecycle.dieselResidualValue, 800_000);
});

test("zero-rate annualization remains additive and component-specific", () => {
  const model = buildYearlyCapitalModel({
    annualizationRate: 0,
    horizonYears: 12,
    electricBusCostPerVehicleChf: 1_200,
    batteryCostPerVehicleChf: 800,
    sharedInfrastructureCostChf: 1_500,
    dieselBusCostPerVehicleChf: 1_000,
    busLifetimeYears: 12,
    batteryLifetimeYears: 8,
    infrastructureLifetimeYears: 15,
    dieselBusLifetimeYears: 10,
  });
  assert.equal(model.components.electricBus.annualizedCostChfPerYear, 100);
  assert.equal(model.components.battery.annualizedCostChfPerYear, 100);
  assert.equal(
    model.components.chargingInfrastructure.annualizedCostChfPerYear,
    100,
  );
  assert.equal(model.components.dieselBus.annualizedCostChfPerYear, 100);
  assert.equal(model.electric.annualizedCostChfPerYear, 300);
  assert.equal(model.diesel.annualizedCostChfPerYear, 100);
});

test("shared infrastructure is replaced and credited independently on longer horizons", () => {
  const model = buildYearlyCapitalModel({
    annualizationRate: 0,
    horizonYears: 20,
    sharedInfrastructureCostChf: 1_500,
    busLifetimeYears: 20,
    batteryLifetimeYears: 20,
    infrastructureLifetimeYears: 15,
    dieselBusLifetimeYears: 20,
  });
  assert.deepEqual(
    model.components.chargingInfrastructure.replacementYears,
    [15],
  );
  assert.equal(
    model.components.chargingInfrastructure.replacementPresentValueChf,
    1_500,
  );
  assert.equal(
    model.components.chargingInfrastructure.residualValueChf,
    1_000,
  );
  const replacementPoints = model.yearly.filter((point) => point.year === 15);
  assert.equal(replacementPoints.length, 2);
  assert.equal(
    replacementPoints[1].electric - replacementPoints[0].electric,
    1_500,
  );
});

test("replacements exactly at the analysis horizon belong to the next lifecycle", () => {
  assert.deepEqual(recurringReplacementYears(12, 12), []);
  assert.deepEqual(recurringReplacementYears(8, 12), [8]);
  assert.deepEqual(recurringReplacementYears(5, 20), [5, 10, 15]);
  assert.deepEqual(recurringReplacementYears(0, 20), []);
  assert.deepEqual(recurringReplacementYears(5, null), []);
});

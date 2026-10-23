import assert from "node:assert/strict";
import test from "node:test";

import { resolveYearlyEconomicAssumptions } from "../src/utils/yearly-analysis-cost-assumptions.js";

test("resolves the configured vehicle assumptions for every supported bus length", () => {
  const expected = new Map([
    [9, { dieselEfficiencyLPerKm: 0.34, dieselMaintPerKm: 0.30, electricMaintPerKm: 0.30 }],
    [12, { dieselEfficiencyLPerKm: 0.42, dieselMaintPerKm: 0.37, electricMaintPerKm: 0.35 }],
    [18, { dieselEfficiencyLPerKm: 0.55, dieselMaintPerKm: 0.45, electricMaintPerKm: 0.40 }],
  ]);

  for (const [busLengthM, vehicleAssumptions] of expected) {
    assert.deepEqual(
      resolveYearlyEconomicAssumptions({ busLengthM }),
      {
        energyPricePerKwh: 0.20,
        fuelPricePerL: 1.85,
        ...vehicleAssumptions,
        annualizationRate: 0.03,
        dieselHeatingMaintenanceFactor: 0,
      },
    );
  }
});

test("uses the frontend bus parameters even when backend coefficients disagree", () => {
  const resolved = resolveYearlyEconomicAssumptions({
    busLengthM: 18,
    backendAssumptions: {
      energy_price_per_kwh: 0.24,
      fuel_cost_per_l: 1.91,
      diesel_comparator_consumption_l_per_km: 0.5518,
      diesel_comparator_maint_cost_per_km_chf: 0.50,
      electric_maint_cost_per_km_chf: 0.2846,
      interest_rate: 0.04,
      diesel_heating_maintenance_factor: 0.15,
    },
  });

  assert.deepEqual(resolved, {
    energyPricePerKwh: 0.24,
    fuelPricePerL: 1.91,
    dieselEfficiencyLPerKm: 0.55,
    dieselMaintPerKm: 0.45,
    electricMaintPerKm: 0.40,
    annualizationRate: 0.04,
    dieselHeatingMaintenanceFactor: 0.15,
  });
});

test("applies user overrides consistently without mutating the shared base", () => {
  const baseAssumptions = resolveYearlyEconomicAssumptions({
    busLengthM: 18,
    backendAssumptions: {
      energy_price_per_kwh: 0.24,
      fuel_cost_per_l: 1.91,
      interest_rate: 0.04,
      diesel_heating_maintenance_factor: 0.15,
    },
  });
  const snapshot = structuredClone(baseAssumptions);

  const overridden = resolveYearlyEconomicAssumptions({
    busLengthM: 18,
    baseAssumptions,
    overrides: {
      energyPricePerKwh: "0.31",
      fuelCostPerL: 2.05,
      dieselEfficiency: 0.61,
      dieselMaintCost: 0.52,
      electricMaintCost: 0.43,
      interestRate: 0,
    },
  });

  assert.deepEqual(overridden, {
    energyPricePerKwh: 0.31,
    fuelPricePerL: 2.05,
    dieselEfficiencyLPerKm: 0.61,
    dieselMaintPerKm: 0.52,
    electricMaintPerKm: 0.43,
    annualizationRate: 0,
    dieselHeatingMaintenanceFactor: 0.15,
  });
  assert.deepEqual(baseAssumptions, snapshot);
});

test("null reset values restore the shared assumptions", () => {
  const baseAssumptions = resolveYearlyEconomicAssumptions({
    busLengthM: 18,
    backendAssumptions: {
      energy_price_per_kwh: 0.24,
      fuel_cost_per_l: 1.91,
      interest_rate: 0.04,
    },
  });
  const reset = resolveYearlyEconomicAssumptions({
    busLengthM: 18,
    baseAssumptions,
    overrides: {
      energyPricePerKwh: null,
      fuelCostPerL: null,
      dieselEfficiency: null,
      dieselMaintCost: null,
      electricMaintCost: null,
      interestRate: null,
    },
  });

  assert.deepEqual(reset, baseAssumptions);
});

test("invalid and missing values fall back deterministically to the 12 metre defaults", () => {
  for (const busLengthM of [null, undefined, "", "unknown", 15]) {
    const resolved = resolveYearlyEconomicAssumptions({
      busLengthM,
      backendAssumptions: {
        energy_price_per_kwh: "invalid",
        fuel_cost_per_l: Number.NaN,
        interest_rate: Number.POSITIVE_INFINITY,
        diesel_heating_maintenance_factor: "invalid",
      },
      overrides: {
        dieselEfficiency: "invalid",
        dieselMaintCost: Number.NaN,
        electricMaintCost: Number.POSITIVE_INFINITY,
      },
    });
    assert.deepEqual(resolved, {
      energyPricePerKwh: 0.20,
      fuelPricePerL: 1.85,
      dieselEfficiencyLPerKm: 0.42,
      dieselMaintPerKm: 0.37,
      electricMaintPerKm: 0.35,
      annualizationRate: 0.03,
      dieselHeatingMaintenanceFactor: 0,
    });
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileYearlyOperatingCosts,
  resolveYearlyOperatingActivity,
} from "../src/utils/yearly-analysis-operating-costs.js";

const rawLca = {
  vehicles: [
    { shift_id: "morning", annual_km: 60_000, diesel_heating_liters: 1_200 },
    { shift_id: "morning", annual_km: 10_000, diesel_heating_liters: 200 },
    { shift_id: "evening", annual_km: 40_000, diesel_heating_liters: 0 },
  ],
};

test("resolves exact fleet and per-shift diesel-heating activity", () => {
  assert.deepEqual(resolveYearlyOperatingActivity(rawLca), {
    dataAvailable: true,
    source: "lca_vehicles",
    shiftId: null,
    vehicleCount: 3,
    annualDistanceKm: 110_000,
    dieselHeatingLiters: 1_400,
    issue: null,
  });
  assert.deepEqual(resolveYearlyOperatingActivity(rawLca, "morning"), {
    dataAvailable: true,
    source: "lca_vehicles",
    shiftId: "morning",
    vehicleCount: 2,
    annualDistanceKm: 70_000,
    dieselHeatingLiters: 1_400,
    issue: null,
  });
  assert.deepEqual(resolveYearlyOperatingActivity(rawLca, "evening"), {
    dataAvailable: true,
    source: "lca_vehicles",
    shiftId: "evening",
    vehicleCount: 1,
    annualDistanceKm: 40_000,
    dieselHeatingLiters: 0,
    issue: null,
  });
});

test("missing, unknown, malformed and negative activity stays unavailable", () => {
  assert.equal(resolveYearlyOperatingActivity(null).dataAvailable, false);
  assert.equal(
    resolveYearlyOperatingActivity(rawLca, "unknown").issue,
    "shift_vehicle_activity_unavailable",
  );
  for (const vehicle of [
    { shift_id: "x", annual_km: null, diesel_heating_liters: 1 },
    { shift_id: "x", annual_km: 1, diesel_heating_liters: null },
    { shift_id: "x", annual_km: -1, diesel_heating_liters: 1 },
    { shift_id: "x", annual_km: 1, diesel_heating_liters: -1 },
  ]) {
    const activity = resolveYearlyOperatingActivity({ vehicles: [vehicle] }, "x");
    assert.equal(activity.dataAvailable, false);
    assert.equal(activity.issue, "vehicle_operating_activity_incomplete");
  }
});

const cost = ({ distance, dcEnergy, electric, diesel, heatingFuel = 0, heatingMaint = 0 }) => ({
  yearlyDistanceKm: distance,
  yearlyEnergyKwh: dcEnergy,
  yearlyGridEnergyKwh: dcEnergy / 0.94,
  yearlyChargingLossesKwh: dcEnergy / 0.94 - dcEnergy,
  electric: {
    energyOpex: electric - distance * 0.4 - heatingFuel - heatingMaint,
    maintOpex: distance * 0.4,
    dieselHeatingFuelOpex: heatingFuel,
    dieselHeatingMaintOpex: heatingMaint,
    totalOpex: electric,
  },
  diesel: {
    fuelOpex: diesel - distance * 0.45,
    maintOpex: distance * 0.45,
    totalOpex: diesel,
  },
});

test("reconciles General with the exact sum of multiple shift OPEX channels", () => {
  const morning = cost({
    distance: 100_824.6998180805,
    dcEnergy: 170_037.46275370274,
    electric: 76_508.25,
    diesel: 148_296.30,
    heatingFuel: 900,
    heatingMaint: 450,
  });
  const evening = cost({
    distance: 68_039.72394037398,
    dcEnergy: 117_545.61315404146,
    electric: 52_225.75,
    diesel: 100_074.70,
    heatingFuel: 300,
    heatingMaint: 250,
  });
  const general = cost({
    distance: morning.yearlyDistanceKm + evening.yearlyDistanceKm,
    dcEnergy: morning.yearlyEnergyKwh + evening.yearlyEnergyKwh,
    electric: morning.electric.totalOpex + evening.electric.totalOpex,
    diesel: morning.diesel.totalOpex + evening.diesel.totalOpex,
    heatingFuel: 1_200,
    heatingMaint: 700,
  });

  const reconciliation = reconcileYearlyOperatingCosts(general, [morning, evening]);
  assert.equal(reconciliation.status, "consistent");
  assert.equal(reconciliation.shiftCount, 2);
  assert.equal(reconciliation.metrics.electricTotalOpexChf.shiftSum, 128_734);
  assert.equal(reconciliation.metrics.dieselTotalOpexChf.shiftSum, 248_371);
  assert.ok(Object.values(reconciliation.metrics).every((metric) => metric.consistent));
});

test("accepts floating-point noise but reports a material mismatch", () => {
  const shift = cost({ distance: 10, dcEnergy: 20, electric: 8, diesel: 12 });
  const noisyGeneral = structuredClone(shift);
  noisyGeneral.electric.totalOpex += 1e-9;
  assert.equal(
    reconcileYearlyOperatingCosts(noisyGeneral, [shift]).status,
    "consistent",
  );

  const mismatchedGeneral = structuredClone(shift);
  mismatchedGeneral.electric.totalOpex += 1;
  const mismatch = reconcileYearlyOperatingCosts(mismatchedGeneral, [shift]);
  assert.equal(mismatch.status, "inconsistent");
  assert.equal(mismatch.issue, "general_shift_operating_cost_mismatch");
  assert.equal(mismatch.metrics.electricTotalOpexChf.delta, 1);
});

test("reports incomplete General, shifts and metrics without inventing values", () => {
  const complete = cost({ distance: 10, dcEnergy: 20, electric: 8, diesel: 12 });
  assert.deepEqual(reconcileYearlyOperatingCosts(null, [complete]), {
    status: "unavailable",
    shiftCount: 1,
    issue: "general_costs_unavailable",
    metrics: {},
  });
  assert.equal(
    reconcileYearlyOperatingCosts(complete, [null]).issue,
    "shift_costs_incomplete",
  );
  const incomplete = structuredClone(complete);
  incomplete.diesel.totalOpex = null;
  assert.equal(
    reconcileYearlyOperatingCosts(complete, [incomplete]).issue,
    "metric_unavailable:dieselTotalOpexChf",
  );

  const dieselHeatedGeneral = structuredClone(complete);
  dieselHeatedGeneral.assumptions = { yearlyDieselHeatingLiters: 100 };
  assert.equal(
    reconcileYearlyOperatingCosts(dieselHeatedGeneral, [complete]).issue,
    "shift_diesel_heating_activity_unavailable",
  );
});

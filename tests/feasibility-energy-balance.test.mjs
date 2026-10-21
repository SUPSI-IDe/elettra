import assert from "node:assert/strict";
import test from "node:test";

import {
  ENERGY_BALANCE_TOLERANCE_KWH,
  buildShiftEnergyBalance,
} from "../src/utils/feasibility-energy-balance.js";

test("includes planned charging in the mean energy balance used by 40501", () => {
  const balance = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: 560,
    plannedChargingEnergyKwh: 84.09071430017156,
    q05DemandKwh: 421.93161965366676,
    meanDemandKwh: 644.0907143001715,
    q50DemandKwh: 660.9017375791142,
    q95DemandKwh: 832.072908043959,
    meanScheduleFeasible: true,
    minimumSocKwh: 160,
    minimumAllowedSocKwh: 160,
    maximumSocKwh: 720,
    maximumAllowedSocKwh: 720,
    minimumSocFraction: 0.2,
    maximumSocFraction: 0.9,
  });

  assert.equal(balance.usesPlannedCharging, true);
  assert.ok(Math.abs(balance.operationalEnergyKwh - 644.0907143001715) < 1e-9);
  assert.equal(balance.meanCovered, true);
  assert.equal(balance.meanEnergyCovered, true);
  assert.equal(balance.marginKwh, 0);
  assert.equal(balance.minimumSocReserveKwh, 0);
  assert.equal(balance.minimumSocCovered, true);
  assert.equal(balance.maximumSocHeadroomKwh, 0);
  assert.equal(balance.maximumSocCovered, true);
  assert.equal(balance.minimumSocFraction, 0.2);
  assert.equal(balance.maximumSocFraction, 0.9);
  assert.equal(balance.q05Covered, true);
  assert.equal(balance.q50Covered, false);
  assert.equal(balance.q95Covered, false);
});

test("applies a numerical tolerance at the operational-energy boundary", () => {
  const covered = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: 500,
    plannedChargingEnergyKwh: 100,
    meanDemandKwh: 600 + ENERGY_BALANCE_TOLERANCE_KWH / 2,
  });
  const exceeded = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: 500,
    plannedChargingEnergyKwh: 100,
    meanDemandKwh: 600 + ENERGY_BALANCE_TOLERANCE_KWH * 2,
  });

  assert.equal(covered.meanEnergyCovered, true);
  assert.equal(covered.marginKwh, 0);
  assert.equal(exceeded.meanEnergyCovered, false);
  assert.ok(exceeded.marginKwh < 0);
});

test("treats an explicit zero charge as a complete operational balance", () => {
  const balance = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: "420",
    plannedChargingEnergyKwh: "0",
    meanDemandKwh: 411.6,
  });

  assert.equal(balance.chargingDataAvailable, true);
  assert.equal(balance.usesPlannedCharging, false);
  assert.equal(balance.operationalEnergyKwh, 420);
  assert.ok(Math.abs(balance.marginKwh - 8.4) < 1e-9);
  assert.equal(balance.meanCovered, true);
});

test("does not invent zero charging for a historical result", () => {
  const balance = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: 420,
    meanDemandKwh: 430,
    meanScheduleFeasible: true,
  });

  assert.equal(balance.chargingDataAvailable, false);
  assert.equal(balance.operationalEnergyKwh, null);
  assert.equal(balance.comparisonEnergyKwh, 420);
  assert.equal(balance.marginKwh, null);
  assert.equal(balance.meanEnergyCovered, false);
  assert.equal(balance.meanCovered, true);
  assert.equal(balance.meanDecisionUsesOptimizedSchedule, true);
});

test("uses the optimized schedule as the authority for the mean decision", () => {
  const backendInfeasible = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: 500,
    plannedChargingEnergyKwh: 100,
    meanDemandKwh: 550,
    meanScheduleFeasible: false,
  });
  const fallback = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: 500,
    plannedChargingEnergyKwh: 100,
    meanDemandKwh: 550,
  });

  assert.equal(backendInfeasible.meanEnergyCovered, true);
  assert.equal(backendInfeasible.meanCovered, false);
  assert.equal(fallback.meanCovered, true);
  assert.equal(fallback.meanDecisionUsesOptimizedSchedule, false);
});

test("rejects malformed and negative energy values without hiding valid fields", () => {
  const balance = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: -1,
    plannedChargingEnergyKwh: "bad",
    q05DemandKwh: 100,
    meanDemandKwh: Number.NaN,
    q50DemandKwh: "",
    q95DemandKwh: 200,
    minimumSocKwh: 10,
    minimumAllowedSocKwh: -5,
    maximumSocKwh: "bad",
    maximumAllowedSocKwh: -10,
    minimumSocFraction: -0.2,
    maximumSocFraction: "bad",
  });

  assert.equal(balance.usableBatteryEnergyKwh, null);
  assert.equal(balance.plannedChargingEnergyKwh, null);
  assert.equal(balance.canEvaluateEnergy, false);
  assert.equal(balance.canEvaluateQuantiles, false);
  assert.equal(balance.q05DemandKwh, 100);
  assert.equal(balance.q95DemandKwh, 200);
  assert.equal(balance.minimumSocReserveKwh, null);
  assert.equal(balance.maximumSocHeadroomKwh, null);
  assert.equal(balance.minimumSocFraction, null);
  assert.equal(balance.maximumSocFraction, null);
});

test("reports independent reserve against both SOC limits", () => {
  const balance = buildShiftEnergyBalance({
    usableBatteryEnergyKwh: 350,
    minimumSocKwh: 110,
    minimumAllowedSocKwh: 100,
    maximumSocKwh: 440,
    maximumAllowedSocKwh: 450,
    minimumSocFraction: 0.2,
    maximumSocFraction: 0.9,
  });

  assert.equal(balance.minimumSocReserveKwh, 10);
  assert.equal(balance.minimumSocCovered, true);
  assert.equal(balance.maximumSocHeadroomKwh, 10);
  assert.equal(balance.maximumSocCovered, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  buildYearlyEmissionsExport,
  deriveScaledEmissionsState,
} from "../src/pages/Simulation/YearlyAnalysis/yearly-analysis-emissions.js";

const BASE_DISTANCE_KM = 54_139.184;
const SELECTED_DISTANCE_KM = 30_000;

const indicator = (total, unit, direct = 0, energyChain = total - direct) => ({
  unit,
  direct,
  energyChain,
  total,
});

const buildDieselHeatingState = () => ({
  status: "done",
  isDieselHeating: true,
  yearlyDistanceKm: BASE_DISTANCE_KM,
  yearlyImpact: { yearly_distance_km: BASE_DISTANCE_KM },
  electricYearly: {
    gwp100a: indicator(8_159_874.3384, "g CO2-eq", 460_000),
    nox: indicator(5_773_875, "mg NO2-eq", 600_000),
    pm10: indicator(733_401, "mg PM10", 12_000),
    primaryEnergy: indicator(632_000, "MJ", 0),
    primaryEnergyNonRenewable: indicator(181_000, "MJ", 0),
  },
  electricOnlyYearly: {
    gwp100a: indicator(7_596_854, "g CO2-eq", 0),
    nox: indicator(4_748_000, "mg NO2-eq", 0),
    pm10: indicator(712_000, "mg PM10", 0),
    primaryEnergy: indicator(623_000, "MJ", 0),
    primaryEnergyNonRenewable: indicator(172_000, "MJ", 0),
  },
  dieselHeatingYearly: {
    gwp100a: indicator(563_020.3384, "g CO2-eq", 460_000),
    nox: indicator(1_025_875, "mg NO2-eq", 600_000),
    pm10: indicator(21_401, "mg PM10", 12_000),
    primaryEnergy: indicator(9_000, "MJ", 0),
    primaryEnergyNonRenewable: indicator(9_000, "MJ", 0),
  },
  dieselYearly: {
    gwp100a: indicator(77_538_463.587, "g CO2-eq", 54_810_000),
    nox: indicator(114_962_400, "mg NO2-eq", 25_260_000),
    pm10: indicator(2_446_000, "mg PM10", 0),
    primaryEnergy: indicator(670_000, "MJ", 0),
    primaryEnergyNonRenewable: indicator(645_000, "MJ", 0),
  },
  emissionsMetadata: {
    auxiliaryHeatingType: "diesel",
    yearlyDhLiters: 187.565,
    yearlyDhFuelKwh: 1_852.582,
    yearlyElectricKwh: 59_350.425,
    electricConsumptionKwhPer100km: 109.625,
  },
  structured: {
    indicators: [
      {
        key: "gwp100a",
        ebus_total: 8_159_874.3384,
        diesel_comparator: 77_538_463.587,
        delta_vs_diesel: 69_378_589.2486,
        normalized_ebus_per_km: 150.72,
      },
    ],
    savings: {
      items: [
        {
          key: "gwp100a",
          ebus_display: 8.159874,
          diesel_display: 77.538464,
          saved_display: 69.37859,
          saved_percent: 89.48,
        },
      ],
    },
    lifecycleBreakdown: {
      unit: "g CO2-eq/year",
      ebus: {
        phases: { direct: 460_000, energyChain: 3_820_000 },
        electric_side: 7_596_854,
        diesel_heating: 563_020.3384,
        phase_sum: 8_159_874.3384,
        total: 8_159_874.3384,
      },
      diesel_comparator: {
        phases: { direct: 54_810_000, energyChain: 11_950_000 },
        phase_sum: 77_538_463.587,
        total: 77_538_463.587,
      },
    },
    primaryEnergyBreakdown: {
      unit: "MJ/year",
      display_unit: "GJ/year",
      ebus: { renewable: 451_000, non_renewable: 181_000, total: 632_000 },
      diesel_comparator: {
        renewable: 25_000,
        non_renewable: 645_000,
        total: 670_000,
      },
    },
    mixedCaseDecomposition: {
      yearly_electric_kwh: 59_350.425,
      yearly_diesel_heating_liters: 187.565,
      yearly_diesel_heating_fuel_kwh: 1_852.582,
      electric_kwh_per_100km: 109.625,
      indicators: {
        gwp100a: {
          electric_side: 7_596_854,
          diesel_heating: 563_020.3384,
          total: 8_159_874.3384,
        },
      },
    },
    assumptions: {
      yearly_distance_km: BASE_DISTANCE_KM,
      yearly_electric_kwh: 59_350.425,
      yearly_diesel_heating_liters: 187.565,
    },
    dataCompleteness: { status: "complete" },
    scopeCompleteness: { status: "partial" },
  },
});

test("distance scaling updates every annual emissions channel and preserves intensities", () => {
  const source = buildDieselHeatingState();
  const scaled = deriveScaledEmissionsState(
    source,
    BASE_DISTANCE_KM,
    SELECTED_DISTANCE_KM,
  );
  const factor = SELECTED_DISTANCE_KM / BASE_DISTANCE_KM;

  assert.equal(scaled.baseYearlyDistanceKm, BASE_DISTANCE_KM);
  assert.equal(scaled.yearlyDistanceKm, SELECTED_DISTANCE_KM);
  assert.equal(scaled.distanceOverrideApplied, true);
  assert.ok(Math.abs(scaled.distanceScaleFactor - factor) < 1e-12);
  assert.ok(Math.abs(scaled.electricYearly.gwp100a.total - 8_159_874.3384 * factor) < 1e-6);
  assert.ok(Math.abs(scaled.electricOnlyYearly.gwp100a.total - 7_596_854 * factor) < 1e-6);
  assert.ok(Math.abs(scaled.dieselHeatingYearly.gwp100a.total - 563_020.3384 * factor) < 1e-6);
  assert.ok(Math.abs(scaled.dieselYearly.gwp100a.total - 77_538_463.587 * factor) < 1e-6);
  assert.ok(Math.abs(scaled.structured.lifecycleBreakdown.ebus.electric_side - 7_596_854 * factor) < 1e-6);
  assert.ok(Math.abs(scaled.structured.lifecycleBreakdown.ebus.phase_sum - 8_159_874.3384 * factor) < 1e-6);
  assert.ok(Math.abs(scaled.structured.lifecycleBreakdown.diesel_comparator.phase_sum - 77_538_463.587 * factor) < 1e-6);
  assert.ok(Math.abs(scaled.structured.primaryEnergyBreakdown.ebus.total - 632_000 * factor) < 1e-6);
  assert.equal(scaled.structured.indicators[0].normalized_ebus_per_km, 150.72);
  assert.equal(scaled.structured.mixedCaseDecomposition.electric_kwh_per_100km, 109.625);
});

test("a reset state retains the original annual values", () => {
  const source = buildDieselHeatingState();
  const reset = deriveScaledEmissionsState(source, BASE_DISTANCE_KM, null);
  assert.equal(reset.yearlyDistanceKm, BASE_DISTANCE_KM);
  assert.equal(reset.distanceScaleFactor, 1);
  assert.equal(reset.distanceOverrideApplied, false);
  assert.equal(reset.electricYearly.gwp100a.total, source.electricYearly.gwp100a.total);
});

test("version 2 export separates mixed-case components without duplicate totals", () => {
  const scaled = deriveScaledEmissionsState(
    buildDieselHeatingState(),
    BASE_DISTANCE_KM,
    SELECTED_DISTANCE_KM,
  );
  const exported = buildYearlyEmissionsExport(scaled, {
    auxiliaryHeatingType: "diesel",
  });

  assert.equal(exported.schemaVersion, 2);
  assert.deepEqual(exported.distance, {
    sourceYearlyDistance_km: BASE_DISTANCE_KM,
    selectedYearlyDistance_km: SELECTED_DISTANCE_KM,
    scaleFactor: 0.554127,
    overrideApplied: true,
  });
  assert.equal(exported.auxiliaryHeatingType, "diesel");
  assert.equal(Object.hasOwn(exported.indicators.gwp100a, "electric"), false);
  assert.equal(Object.hasOwn(exported.indicators.gwp100a, "diesel"), false);
  assert.equal(exported.indicators.gwp100a.ebus.total, 4.522);
  assert.equal(
    exported.indicators.gwp100a.ebus.components.electricSide.total,
    4.21,
  );
  assert.equal(
    exported.indicators.gwp100a.ebus.components.dieselHeating.total,
    0.312,
  );
  assert.equal(exported.indicators.gwp100a.dieselComparator.total, 42.966);
  assert.equal(exported.primaryEnergyBreakdown.unit, "GJ/year");
});

test("full-electric and HP exports do not acquire diesel-heater components", () => {
  for (const heatingType of ["electric", "heat_pump"]) {
    const state = buildDieselHeatingState();
    state.isDieselHeating = false;
    state.electricOnlyYearly = null;
    state.dieselHeatingYearly = null;
    const exported = buildYearlyEmissionsExport(
      deriveScaledEmissionsState(state, BASE_DISTANCE_KM, BASE_DISTANCE_KM),
      { auxiliaryHeatingType: heatingType },
    );
    assert.equal(exported.auxiliaryHeatingType, heatingType);
    assert.equal(Object.hasOwn(exported.indicators.gwp100a.ebus, "components"), false);
  }
});

test("the yearly-analysis template contains the primary-energy rendering slots", async () => {
  const template = await readFile(
    new URL(
      "../src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.html",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(template, /data-role="ya-env-primary-energy-section"/);
  assert.match(template, /data-role="ya-env-primary-energy"/);
  assert.match(template, /data-role="ya-env-primary-energy-legend"/);
});

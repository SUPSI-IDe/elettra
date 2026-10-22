import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGeneralSharedCostContext,
  buildOperatingCostExport,
} from "../src/utils/yearly-analysis-cost-scope.js";

test("General keeps charging infrastructure as one unallocated shared investment", () => {
  const context = buildGeneralSharedCostContext({
    config: {
      fixedConfiguration: {
        battery: { packs: 12 },
        infrastructure: {
          totalInstallationCostChf: 250_000,
          stations: [{
            status: "installed",
            selected: true,
            slots: 2,
            installationCostChf: 999_999,
          }],
        },
      },
    },
  }, {
    cost: 400_000,
    battery_pack_cost: 10_000,
  });

  assert.equal(context.scope, "general_shared");
  assert.equal(context.allocation, "not_allocated_to_shifts");
  assert.deepEqual(context.chargingInfrastructure, {
    shared: true,
    investmentChf: 250_000,
  });
  assert.deepEqual(context.vehicleUnitReference, {
    fleetVehicleCount: null,
    fleetInvestmentChf: null,
    busCostPerVehicleChf: 400_000,
    commonBatteryPacks: 12,
    batteryPackCostChf: 10_000,
    batteryCostPerBusChf: 120_000,
    referenceUnitInvestmentChf: 520_000,
  });
});

test("General sums active station investments when the stored total is absent", () => {
  const context = buildGeneralSharedCostContext({
    config: {
      fixedConfiguration: {
        infrastructure: {
          stations: [
            { status: "installed", slots: 2, installationCostChf: 200_000 },
            { status: "fixed", slots: 1, installationCostChf: 50_000 },
            { status: "candidate", slots: 4, installationCostChf: 900_000 },
          ],
        },
      },
    },
  });

  assert.equal(context.chargingInfrastructure.investmentChf, 250_000);
  assert.equal(context.vehicleUnitReference.referenceUnitInvestmentChf, null);
});

test("General preserves unavailable shared and unit investments without inventing zeroes", () => {
  const context = buildGeneralSharedCostContext();
  assert.equal(context.chargingInfrastructure.investmentChf, null);
  assert.equal(context.vehicleUnitReference.busCostPerVehicleChf, null);
  assert.equal(context.vehicleUnitReference.batteryCostPerBusChf, null);
  assert.equal(context.vehicleUnitReference.fleetInvestmentChf, null);
});

test("General does not export stale optimized infrastructure when its result is unavailable", () => {
  const context = buildGeneralSharedCostContext({
    config: {
      fixedConfiguration: {
        infrastructure: {
          decision: "optimized",
          dataAvailable: true,
          resultAvailable: false,
          totalInstallationCostChf: 250_000,
        },
      },
    },
  });
  assert.equal(context.chargingInfrastructure.investmentChf, null);
});

test("shift export contains OPEX and strips every capital field", () => {
  const operating = buildOperatingCostExport({
    assumptions: { energyPrice_CHFPerKwh: 0.2 },
    electric: {
      energyOPEX_CHF: 10_000,
      maintenanceOPEX_CHF: 2_000,
      dieselHeatingFuelOPEX_CHF: 500,
      dieselHeatingMaintOPEX_CHF: 100,
      totalOPEX_CHF: 12_600,
      CAPEX_CHF: 900_000,
      annualizedCAPEX_CHF: 100_000,
      totalAnnual_CHF: 112_600,
    },
    diesel: {
      fuelOPEX_CHF: 20_000,
      maintenanceOPEX_CHF: 3_000,
      totalOPEX_CHF: 23_000,
      CAPEX_CHF: 400_000,
      annualizedCAPEX_CHF: 50_000,
      totalAnnual_CHF: 73_000,
    },
    annualSaving_CHF: -39_600,
    breakEvenYear: null,
    yearlyEnergy_kWh: 50_000,
    yearlyBusEnergyDC_kWh: 50_000,
    yearlyGridEnergy_kWh: 53_191.5,
    yearlyChargingLosses_kWh: 3_191.5,
    yearlyDistance_km: 20_000,
    scenarioCosts: [{ label: "Cold" }],
    projectedCostTrend: [{ year: 0, electric_CHF: 900_000 }],
  });

  assert.equal(operating.scope, "shift_operating");
  assert.equal(operating.includesSharedCapital, false);
  assert.equal(operating.electric.totalOPEX_CHF, 12_600);
  assert.equal(operating.electric.operatingCostPerKm_CHF, 0.63);
  assert.equal(operating.diesel.operatingCostPerKm_CHF, 1.15);
  assert.equal(operating.annualOperatingSaving_CHF, 10_400);
  assert.deepEqual(operating.scenarioCosts, [{ label: "Cold" }]);
  assert.equal("CAPEX_CHF" in operating.electric, false);
  assert.equal("totalAnnual_CHF" in operating.electric, false);
  assert.equal("projectedCostTrend" in operating, false);
  assert.equal("breakEvenYear" in operating, false);
});

test("operating export handles zero distance, zero costs, and missing input", () => {
  assert.equal(buildOperatingCostExport(null), null);
  const operating = buildOperatingCostExport({
    electric: { totalOPEX_CHF: 0 },
    diesel: { totalOPEX_CHF: 0 },
    yearlyDistance_km: 0,
  });
  assert.equal(operating.electric.operatingCostPerKm_CHF, null);
  assert.equal(operating.diesel.operatingCostPerKm_CHF, null);
  assert.equal(operating.annualOperatingSaving_CHF, 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyShiftCapitalAllocation,
  buildGeneralSharedCostContext,
  buildOperatingCostExport,
  resolveShiftCapitalAllocationBasis,
} from "../src/utils/yearly-analysis-cost-scope.js";

test("General keeps charging infrastructure as one shared investment with an analytical allocation rule", () => {
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
  assert.equal(context.allocation, "annual_dc_energy_share");
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

const activityFeatures = {
  results: {
    shiftResults: [
      {
        shiftId: "morning",
        yearlyTotals: { totalEnergyKwh: 30_000, distanceKm: 20_000 },
      },
      {
        shiftId: "evening",
        yearlyTotals: { totalEnergyKwh: 70_000, distanceKm: 40_000 },
      },
    ],
  },
};

test("CAPEX allocation uses the exact annual DC energy exposed by Emissions", () => {
  const rawLca = {
    energy_boundary: { dc_kwh: 100_000 },
    vehicles: [
      { shift_id: "morning", dc_kwh: 80_000, annual_km: 25_000 },
      { shift_id: "evening", dc_kwh: 20_000, annual_km: 10_000 },
    ],
  };
  const allocation = resolveShiftCapitalAllocationBasis(
    activityFeatures,
    "morning",
    rawLca,
  );
  assert.equal(allocation.method, "annual_dc_energy");
  assert.equal(allocation.source, "emissions");
  assert.equal(allocation.shiftAnnualDcEnergyKwh, 80_000);
  assert.equal(allocation.totalAnnualDcEnergyKwh, 100_000);
  assert.equal(allocation.share, 0.8);
});

test("CAPEX allocation sums duplicate LCA vehicle rows for the same shift", () => {
  const rawLca = {
    energy_boundary: { dc_kwh: 100_000 },
    vehicles: [
      { shift_id: "morning", dc_kwh: 25_000, annual_km: 10_000 },
      { shift_id: "morning", dc_kwh: 15_000, annual_km: 5_000 },
      { shift_id: "evening", dc_kwh: 60_000, annual_km: 30_000 },
    ],
  };
  const morning = resolveShiftCapitalAllocationBasis({}, "morning", rawLca);
  const evening = resolveShiftCapitalAllocationBasis({}, "evening", rawLca);
  assert.equal(morning.shiftAnnualDcEnergyKwh, 40_000);
  assert.equal(morning.share, 0.4);
  assert.equal(evening.share, 0.6);
  assert.equal(morning.share + evening.share, 1);
});

test("saved annual analysis energy is used while Emissions is unavailable", () => {
  const allocation = resolveShiftCapitalAllocationBasis(
    activityFeatures,
    "evening",
  );
  assert.equal(allocation.method, "annual_dc_energy");
  assert.equal(allocation.source, "annual_analysis");
  assert.equal(allocation.share, 0.7);
});

test("an inconsistent Emissions total is rejected in favor of saved annual energy", () => {
  const allocation = resolveShiftCapitalAllocationBasis(
    activityFeatures,
    "morning",
    {
      energy_boundary: { dc_kwh: 999_999 },
      vehicles: [
        { shift_id: "morning", dc_kwh: 80_000, annual_km: 25_000 },
        { shift_id: "evening", dc_kwh: 20_000, annual_km: 10_000 },
      ],
    },
  );
  assert.equal(allocation.source, "annual_analysis");
  assert.equal(allocation.share, 0.3);
});

test("annual distance is only a fallback when every annual energy source is unusable", () => {
  const noEnergy = structuredClone(activityFeatures);
  noEnergy.results.shiftResults[0].yearlyTotals.totalEnergyKwh = null;
  noEnergy.results.shiftResults[1].yearlyTotals.totalEnergyKwh = null;
  const allocation = resolveShiftCapitalAllocationBasis(
    noEnergy,
    "morning",
    {
      vehicles: [
        { shift_id: "morning", dc_kwh: null, annual_km: 10_000 },
        { shift_id: "evening", dc_kwh: null, annual_km: 30_000 },
      ],
    },
  );
  assert.equal(allocation.method, "annual_distance");
  assert.equal(allocation.source, "emissions");
  assert.equal(allocation.share, 0.25);
  assert.equal(allocation.shiftAnnualDcEnergyKwh, null);
});

test("allocation is unavailable for unknown shifts or without complete activity", () => {
  assert.equal(
    resolveShiftCapitalAllocationBasis(activityFeatures, "unknown"),
    null,
  );
  assert.equal(
    resolveShiftCapitalAllocationBasis({
      results: {
        shiftResults: [
          { shiftId: "morning", yearlyTotals: {} },
          { shiftId: "evening", yearlyTotals: {} },
        ],
      },
    }, "morning"),
    null,
  );
});

const referenceCosts = () => ({
  assumptions: { annualizationRate: 0 },
  electric: {
    totalOpex: 100,
    capex: 600,
    capexPv: 800,
    capexAnnual: 80,
    totalAnnual: 180,
    busLifetime: 10,
  },
  diesel: {
    totalOpex: 200,
    capex: 300,
    capexAnnual: 30,
    totalAnnual: 230,
  },
  yearly: [
    { year: 0, electric: 600, diesel: 300 },
    { year: 1, electric: 700, diesel: 500 },
    { year: 2, electric: 800, diesel: 700 },
  ],
});

test("allocated shift costs scale only capital and keep the shift OPEX exact", () => {
  const allocated = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy",
    source: "emissions",
    shiftId: "morning",
    share: 0.25,
    shiftAnnualDcEnergyKwh: 25_000,
    totalAnnualDcEnergyKwh: 100_000,
  }, { infrastructureInvestmentChf: 200 });

  assert.equal(allocated.electric.totalOpex, 100);
  assert.equal(allocated.diesel.totalOpex, 200);
  assert.equal(allocated.electric.capex, 200);
  assert.equal(allocated.electric.capexPv, 250);
  assert.equal(allocated.diesel.capex, 75);
  assert.equal(allocated.capitalAllocation.electric.allocatedInfrastructureCapexChf, 50);
  assert.deepEqual(allocated.yearly, [
    { year: 0, electric: 200, diesel: 75 },
    { year: 1, electric: 300, diesel: 275 },
    { year: 2, electric: 400, diesel: 475 },
  ]);
  assert.equal(allocated.breakEvenYear, 1.25);
});

test("allocated CAPEX across all shifts reconciles to the one shared basis", () => {
  const morning = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy", source: "emissions", shiftId: "morning", share: 0.25,
  }, { infrastructureInvestmentChf: 200 });
  const evening = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy", source: "emissions", shiftId: "evening", share: 0.75,
  }, { infrastructureInvestmentChf: 200 });
  assert.equal(morning.electric.capex + evening.electric.capex, 800);
  assert.equal(morning.diesel.capex + evening.diesel.capex, 300);
});

test("missing infrastructure remains explicit and does not invent a zero investment", () => {
  const allocated = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy",
    source: "annual_analysis",
    shiftId: "morning",
    share: 0.25,
  });
  assert.equal(allocated.capitalAllocation.infrastructureIncluded, false);
  assert.equal(
    allocated.capitalAllocation.electric.sharedInfrastructureCapexChf,
    null,
  );
  assert.equal(
    allocated.capitalAllocation.electric.allocatedInfrastructureCapexChf,
    null,
  );
  assert.equal(allocated.electric.capex, 150);
});

test("invalid or absent allocation basis leaves cost data untouched", () => {
  const costs = referenceCosts();
  assert.equal(applyShiftCapitalAllocation(costs, null), costs);
  assert.equal(applyShiftCapitalAllocation(costs, { share: -0.1 }), costs);
  assert.equal(applyShiftCapitalAllocation(costs, { share: 1.1 }), costs);
});

test("allocated capital is exported without reintroducing full shared CAPEX", () => {
  const exported = buildOperatingCostExport({
    electric: { totalOPEX_CHF: 100 },
    diesel: { totalOPEX_CHF: 200 },
    yearlyDistance_km: 1_000,
    capitalAllocation: { method: "annual_dc_energy", share: 0.25 },
    breakEvenYear: 4.5,
    projectedCostTrend: [{ year: 0, electric_CHF: 200, diesel_CHF: 75 }],
  });
  assert.equal(exported.includesSharedCapital, false);
  assert.equal(exported.includesAllocatedSharedCapital, true);
  assert.deepEqual(exported.capitalAllocation, {
    method: "annual_dc_energy",
    share: 0.25,
  });
  assert.equal(exported.breakEvenYear, 4.5);
  assert.equal(exported.projectedCostTrend.length, 1);
});

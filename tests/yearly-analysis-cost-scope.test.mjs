import assert from "node:assert/strict";
import test from "node:test";

import {
  applyGeneralFleetCapital,
  applyShiftCapitalAllocation,
  buildGeneralSharedCostContext,
  buildOperatingCostExport,
  resolveFleetVehicleScope,
  resolveShiftCapitalAllocationBasis,
} from "../src/utils/yearly-analysis-cost-scope.js";

test("General keeps charging infrastructure as one shared investment with an analytical allocation rule", () => {
  const context = buildGeneralSharedCostContext({
    config: {
      fixedConfiguration: {
        fleet: {
          dataAvailable: true,
          source: "optimization_per_bus_summary",
          vehicleCount: 2,
          vehicleCountByShift: { morning: 1, evening: 1 },
        },
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
    fleetVehicleCount: 2,
    fleetInvestmentChf: 1_040_000,
    busCostPerVehicleChf: 400_000,
    commonBatteryPacks: 12,
    batteryPackCostChf: 10_000,
    batteryCostPerBusChf: 120_000,
    referenceUnitInvestmentChf: 520_000,
  });
  assert.deepEqual(context.fleetCapital, {
    dataAvailable: true,
    source: "optimization_per_bus_summary",
    scope: "general",
    shiftId: null,
    vehicleCount: 2,
    fleetVehicleCount: 2,
    issue: null,
    busInvestmentChf: 800_000,
    batteryInvestmentChf: 240_000,
    vehicleAndBatteryInvestmentChf: 1_040_000,
    totalInitialInvestmentChf: 1_290_000,
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
  assert.equal("capitalScope" in operating, false);
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

const generalVehicleScope = (vehicleCount = 2) => ({
  dataAvailable: true,
  source: "optimization_per_bus_summary",
  scope: "general",
  shiftId: null,
  vehicleCount,
  fleetVehicleCount: vehicleCount,
  issue: null,
});

const shiftVehicleScope = (shiftId, vehicleCount = 1, fleetVehicleCount = 2) => ({
  dataAvailable: true,
  source: "optimization_per_bus_summary",
  scope: "shift",
  shiftId,
  vehicleCount,
  fleetVehicleCount,
  issue: null,
});

test("General scales complete vehicle capital and counts shared infrastructure once", () => {
  const scoped = applyGeneralFleetCapital(
    referenceCosts(),
    generalVehicleScope(2),
    { infrastructureInvestmentChf: 200 },
  );

  assert.equal(scoped.electric.totalOpex, 100);
  assert.equal(scoped.diesel.totalOpex, 200);
  assert.equal(scoped.electric.capex, 1_400);
  assert.equal(scoped.electric.capexPv, 1_800);
  assert.equal(scoped.electric.capexAnnual, 180);
  assert.equal(scoped.electric.totalAnnual, 280);
  assert.equal(scoped.diesel.capex, 600);
  assert.equal(scoped.diesel.capexAnnual, 60);
  assert.equal(scoped.diesel.totalAnnual, 260);
  assert.equal(scoped.annualSaving, -20);
  assert.deepEqual(scoped.yearly, [
    { year: 0, electric: 1_400, diesel: 600 },
    { year: 1, electric: 1_500, diesel: 800 },
    { year: 2, electric: 1_600, diesel: 1_000 },
  ]);
  assert.equal(scoped.capitalScope.vehicleCount, 2);
  assert.equal(scoped.capitalScope.includedInfrastructureChf, 200);
});

test("two-bus joint economics reproduce fleet, replacement and diesel totals", () => {
  const rate = 0.03;
  const crf = (lifetime) => {
    const growth = (1 + rate) ** lifetime;
    return rate * growth / (growth - 1);
  };
  const unitBatteryReplacementPv = 60_000 / (1 + rate) ** 8;
  const electricUnitCapexPv = 860_000 + unitBatteryReplacementPv;
  const costs = {
    assumptions: { annualizationRate: rate },
    electric: {
      totalOpex: 109_246.70349443496,
      capex: 860_000,
      capexPv: electricUnitCapexPv,
      capexAnnual: electricUnitCapexPv * crf(12),
      totalAnnual: electricUnitCapexPv * crf(12) + 109_246.70349443496,
      busCost: 800_000,
      totalBatteryCost: 60_000,
      batteryReplacementPv: unitBatteryReplacementPv,
      busLifetime: 12,
    },
    diesel: {
      totalOpex: 256_814.08159032854,
      capex: 500_000,
      capexAnnual: 500_000 * crf(10),
      totalAnnual: 500_000 * crf(10) + 256_814.08159032854,
    },
    yearly: [],
  };

  const general = applyGeneralFleetCapital(
    costs,
    generalVehicleScope(2),
    { infrastructureInvestmentChf: 300_000 },
  );
  assert.equal(general.electric.capex, 2_020_000);
  assert.ok(Math.abs(general.electric.capexPv - 2_114_729.108117672) < 1e-6);
  assert.ok(Math.abs(general.electric.batteryReplacementPv - 94_729.10811767226) < 1e-6);
  assert.ok(Math.abs(general.electric.capexAnnual - 212_450.0964118803) < 1e-6);
  assert.ok(Math.abs(general.electric.totalAnnual - 321_696.7999063153) < 1e-6);
  assert.equal(general.diesel.capex, 1_000_000);
  assert.ok(Math.abs(general.diesel.totalAnnual - 374_044.5881954881) < 1e-6);
  assert.ok(Math.abs(general.annualSaving - 52_347.78828917282) < 1e-6);

  const shift = applyShiftCapitalAllocation(costs, {
    method: "annual_dc_energy",
    source: "emissions",
    shiftId: "40501",
    share: 0.591263802,
  }, {
    infrastructureInvestmentChf: 300_000,
    vehicleScope: shiftVehicleScope("40501"),
  });
  assert.ok(Math.abs(shift.electric.capex - 1_037_379.1406) < 1e-6);
  assert.equal(shift.diesel.capex, 500_000);
  assert.ok(
    Math.abs(
      shift.capitalAllocation.electric.allocatedInfrastructureCapexChf -
        177_379.1406,
    ) < 1e-6,
  );
});

test("replacement jumps and lifecycle residuals scale with vehicles, not OPEX", () => {
  const costs = referenceCosts();
  costs.electric.batteryReplacementPv = 40;
  costs.yearly[2].electric = 850;
  costs.lifecycle = {
    horizonYears: 2,
    grossFinalElectric: 850,
    grossFinalDiesel: 700,
    electricResidualValue: 100,
    dieselResidualValue: 50,
    electricDiscountedResidual: 100,
    dieselDiscountedResidual: 50,
  };
  const scoped = applyGeneralFleetCapital(
    costs,
    generalVehicleScope(2),
    { infrastructureInvestmentChf: 200 },
  );
  assert.equal(scoped.yearly[2].electric, 1_700);
  assert.equal(scoped.electric.batteryReplacementPv, 80);
  assert.equal(scoped.lifecycle.grossFinalElectric, 1_700);
  assert.equal(scoped.lifecycle.grossFinalDiesel, 1_000);
  assert.equal(scoped.lifecycle.electricResidualValue, 200);
  assert.equal(scoped.lifecycle.dieselResidualValue, 100);
  assert.equal(scoped.lifecycle.netFinalElectric, 1_500);
  assert.equal(scoped.lifecycle.netFinalDiesel, 900);
});

test("break-even is recomputed after vehicle and infrastructure scoping", () => {
  const costs = referenceCosts();
  costs.diesel.totalOpex = 500;
  costs.yearly = [
    { year: 0, electric: 600, diesel: 300 },
    { year: 1, electric: 700, diesel: 800 },
  ];
  const scoped = applyShiftCapitalAllocation(costs, {
    method: "annual_dc_energy",
    source: "annual_analysis",
    shiftId: "morning",
    share: 0.25,
  }, {
    infrastructureInvestmentChf: 200,
    vehicleScope: shiftVehicleScope("morning"),
  });
  assert.equal(scoped.breakEvenYear, 0.875);
});

test("shift costs keep owned vehicles whole and allocate only infrastructure", () => {
  const allocated = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy",
    source: "emissions",
    shiftId: "morning",
    share: 0.25,
    shiftAnnualDcEnergyKwh: 25_000,
    totalAnnualDcEnergyKwh: 100_000,
  }, {
    infrastructureInvestmentChf: 200,
    vehicleScope: shiftVehicleScope("morning"),
  });

  assert.equal(allocated.electric.totalOpex, 100);
  assert.equal(allocated.diesel.totalOpex, 200);
  assert.equal(allocated.electric.capex, 650);
  assert.equal(allocated.electric.capexPv, 850);
  assert.equal(allocated.electric.capexAnnual, 85);
  assert.equal(allocated.diesel.capex, 300);
  assert.equal(allocated.capitalAllocation.electric.allocatedInfrastructureCapexChf, 50);
  assert.equal(allocated.capitalAllocation.electric.ownedVehicleAndBatteryCapexChf, 600);
  assert.equal(allocated.capitalAllocation.diesel.ownedVehicleCapexChf, 300);
  assert.deepEqual(allocated.yearly, [
    { year: 0, electric: 650, diesel: 300 },
    { year: 1, electric: 750, diesel: 500 },
    { year: 2, electric: 850, diesel: 700 },
  ]);
  assert.equal(allocated.breakEvenYear, null);
});

test("complete shift CAPEX reconciles exactly to General", () => {
  const general = applyGeneralFleetCapital(
    referenceCosts(),
    generalVehicleScope(2),
    { infrastructureInvestmentChf: 200 },
  );
  const morning = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy", source: "emissions", shiftId: "morning", share: 0.25,
  }, {
    infrastructureInvestmentChf: 200,
    vehicleScope: shiftVehicleScope("morning"),
  });
  const evening = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy", source: "emissions", shiftId: "evening", share: 0.75,
  }, {
    infrastructureInvestmentChf: 200,
    vehicleScope: shiftVehicleScope("evening"),
  });
  assert.equal(morning.electric.capex + evening.electric.capex, general.electric.capex);
  assert.equal(morning.electric.capexPv + evening.electric.capexPv, general.electric.capexPv);
  assert.equal(morning.diesel.capex + evening.diesel.capex, general.diesel.capex);
  assert.equal(
    morning.capitalAllocation.electric.allocatedInfrastructureCapexChf +
      evening.capitalAllocation.electric.allocatedInfrastructureCapexChf,
    200,
  );
});

test("a shift can own multiple physical vehicles without scaling its OPEX", () => {
  const allocated = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy",
    source: "annual_analysis",
    shiftId: "morning",
    share: 0.25,
  }, {
    infrastructureInvestmentChf: 200,
    vehicleScope: shiftVehicleScope("morning", 2, 3),
  });
  assert.equal(allocated.electric.capex, 1_250);
  assert.equal(allocated.diesel.capex, 600);
  assert.equal(allocated.electric.totalOpex, 100);
  assert.equal(allocated.diesel.totalOpex, 200);
});

test("missing infrastructure invalidates full CAPEX instead of inventing zero", () => {
  const allocated = applyShiftCapitalAllocation(referenceCosts(), {
    method: "annual_dc_energy",
    source: "annual_analysis",
    shiftId: "morning",
    share: 0.25,
  }, { vehicleScope: shiftVehicleScope("morning") });
  assert.equal(allocated.capitalAllocation, undefined);
  assert.equal(allocated.electric.capex, null);
  assert.equal(allocated.diesel.capex, null);
  assert.equal(
    allocated.capitalScope.issue,
    "infrastructure_investment_unavailable",
  );
});

test("missing fleet or allocation data invalidates CAPEX but preserves exact OPEX", () => {
  const missingFleet = applyGeneralFleetCapital(referenceCosts(), {
    dataAvailable: false,
    scope: "general",
    issue: "missing_per_bus_summary",
  });
  assert.equal(missingFleet.electric.totalOpex, 100);
  assert.equal(missingFleet.diesel.totalOpex, 200);
  assert.equal(missingFleet.electric.capex, null);
  assert.equal(missingFleet.diesel.capex, null);
  assert.equal(missingFleet.capitalScope.issue, "missing_per_bus_summary");

  const missingInfrastructure = applyGeneralFleetCapital(
    referenceCosts(),
    generalVehicleScope(),
  );
  assert.equal(missingInfrastructure.electric.totalOpex, 100);
  assert.equal(missingInfrastructure.electric.capex, null);
  assert.equal(
    missingInfrastructure.capitalScope.issue,
    "infrastructure_investment_unavailable",
  );

  const incompleteInputs = referenceCosts();
  incompleteInputs.capitalInputs = {
    dataAvailable: false,
    busCostAvailable: true,
    batteryPackCostAvailable: false,
    batteryPackCountAvailable: true,
    dieselCapexAvailable: true,
  };
  const missingVehicleCost = applyGeneralFleetCapital(
    incompleteInputs,
    generalVehicleScope(),
    { infrastructureInvestmentChf: 200 },
  );
  assert.equal(missingVehicleCost.electric.totalOpex, 100);
  assert.equal(missingVehicleCost.electric.capex, null);
  assert.equal(
    missingVehicleCost.capitalScope.issue,
    "vehicle_capital_inputs_unavailable",
  );

  for (const basis of [null, { share: -0.1 }, { share: 1.1 }]) {
    const unavailable = applyShiftCapitalAllocation(
      referenceCosts(),
      basis,
      {
        infrastructureInvestmentChf: 200,
        vehicleScope: shiftVehicleScope("morning"),
      },
    );
    assert.equal(unavailable.electric.totalOpex, 100);
    assert.equal(unavailable.electric.capex, null);
    assert.equal(
      unavailable.capitalScope.issue,
      "infrastructure_allocation_unavailable",
    );
  }
});

test("resolves General and shift vehicle counts and rejects inconsistent snapshots", () => {
  const features = {
    config: {
      fixedConfiguration: {
        fleet: {
          dataAvailable: true,
          source: "optimization_per_bus_summary",
          vehicleCount: 3,
          vehicleCountByShift: { morning: 2, evening: 1 },
        },
      },
    },
  };
  assert.deepEqual(resolveFleetVehicleScope(features), {
    dataAvailable: true,
    source: "optimization_per_bus_summary",
    scope: "general",
    shiftId: null,
    vehicleCount: 3,
    fleetVehicleCount: 3,
    issue: null,
  });
  assert.equal(resolveFleetVehicleScope(features, "morning").vehicleCount, 2);
  assert.equal(
    resolveFleetVehicleScope(features, "unknown").issue,
    "shift_vehicle_count_unavailable",
  );

  features.config.fixedConfiguration.fleet.vehicleCount = 4;
  assert.equal(
    resolveFleetVehicleScope(features).issue,
    "inconsistent_shift_vehicle_counts",
  );
});

test("allocated capital is exported without reintroducing full shared CAPEX", () => {
  const exported = buildOperatingCostExport({
    electric: { totalOPEX_CHF: 100 },
    diesel: { totalOPEX_CHF: 200 },
    yearlyDistance_km: 1_000,
    capitalScope: {
      scope: "shift",
      vehicleCount: 2,
      vehicleAndBatteryCAPEX_CHF: 1_200,
    },
    capitalAllocation: {
      method: "annual_dc_energy",
      share: 0.25,
      vehicleCount: 2,
      electric: {
        ownedVehicleAndBatteryCAPEX_CHF: 1_200,
        allocatedInfrastructureCAPEX_CHF: 50,
      },
    },
    breakEvenYear: 4.5,
    projectedCostTrend: [{ year: 0, electric_CHF: 200, diesel_CHF: 75 }],
  });
  assert.equal(exported.includesSharedCapital, false);
  assert.equal(exported.includesAllocatedSharedCapital, true);
  assert.deepEqual(exported.capitalScope, {
    scope: "shift",
    vehicleCount: 2,
    vehicleAndBatteryCAPEX_CHF: 1_200,
  });
  assert.deepEqual(exported.capitalAllocation, {
    method: "annual_dc_energy",
    share: 0.25,
    vehicleCount: 2,
    electric: {
      ownedVehicleAndBatteryCAPEX_CHF: 1_200,
      allocatedInfrastructureCAPEX_CHF: 50,
    },
  });
  assert.equal(exported.breakEvenYear, 4.5);
  assert.equal(exported.projectedCostTrend.length, 1);
});

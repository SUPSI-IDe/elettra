import {
  DEFAULT_CHARGING_INFRASTRUCTURE_LIFETIME_YEARS,
  DEFAULT_DIESEL_BUS_LIFETIME_YEARS,
} from "../config/economic-defaults.js";
import { buildYearlyCapitalModel } from "./yearly-analysis-capital.js";

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "" ||
      (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const sumFinite = (values = []) => {
  const finite = values
    .map(toFiniteNumber)
    .filter((value) => value !== null);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) : null;
};

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const groupAnnualActivity = (rows = [], {
  idKey,
  energyKey,
  distanceKey,
} = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const grouped = new Map();
  for (const row of rows) {
    const shiftId = text(row?.[idKey]);
    if (!shiftId) return [];
    const energy = toFiniteNumber(row?.[energyKey]);
    const distance = toFiniteNumber(row?.[distanceKey]);
    const current = grouped.get(shiftId) ?? {
      shiftId,
      annualDcEnergyKwh: 0,
      annualDistanceKm: 0,
      energyComplete: true,
      distanceComplete: true,
    };
    if (energy === null || energy < 0) current.energyComplete = false;
    else current.annualDcEnergyKwh += energy;
    if (distance === null || distance < 0) current.distanceComplete = false;
    else current.annualDistanceKm += distance;
    grouped.set(shiftId, current);
  }
  return [...grouped.values()];
};

const buildActivityAllocation = (rows, shiftId, kind, source) => {
  const field = kind === "annual_dc_energy"
    ? "annualDcEnergyKwh"
    : "annualDistanceKm";
  const completenessField = kind === "annual_dc_energy"
    ? "energyComplete"
    : "distanceComplete";
  if (!rows.length || rows.some((row) => !row[completenessField])) return null;
  const selected = rows.find((row) => row.shiftId === text(shiftId));
  if (!selected) return null;
  const total = rows.reduce((sum, row) => sum + row[field], 0);
  if (!(total > 0)) return null;
  return {
    method: kind,
    source,
    shiftId: selected.shiftId,
    share: selected[field] / total,
    shiftAnnualDcEnergyKwh:
      kind === "annual_dc_energy" ? selected.annualDcEnergyKwh : null,
    totalAnnualDcEnergyKwh:
      kind === "annual_dc_energy" ? total : null,
    shiftAnnualDistanceKm:
      kind === "annual_distance" ? selected.annualDistanceKm : null,
    totalAnnualDistanceKm:
      kind === "annual_distance" ? total : null,
  };
};

/**
 * Resolves the analytical share used to attribute common CAPEX to one shift.
 * The parameterized LCA is authoritative because its `dc_kwh` values are the
 * annual DC consumption displayed in Emissions. Saved yearly outcomes provide
 * the same physical quantity while Emissions is unavailable. Annual distance
 * is used only when neither source contains a complete positive energy basis.
 */
export const resolveShiftCapitalAllocationBasis = (
  features = {},
  shiftId = "",
  rawLca = null,
) => {
  const lcaRows = groupAnnualActivity(rawLca?.vehicles, {
    idKey: "shift_id",
    energyKey: "dc_kwh",
    distanceKey: "annual_km",
  });
  const analysisRows = groupAnnualActivity(
    Array.isArray(features?.results?.shiftResults)
      ? features.results.shiftResults.map((shift) => ({
          shiftId: shift?.shiftId,
          annualDcEnergyKwh: shift?.yearlyTotals?.totalEnergyKwh,
          annualDistanceKm: shift?.yearlyTotals?.distanceKm,
        }))
      : [],
    {
      idKey: "shiftId",
      energyKey: "annualDcEnergyKwh",
      distanceKey: "annualDistanceKm",
    },
  );
  let lcaEnergyAllocation = buildActivityAllocation(
    lcaRows,
    shiftId,
    "annual_dc_energy",
    "emissions",
  );
  const displayedLcaTotal = toFiniteNumber(rawLca?.energy_boundary?.dc_kwh);
  if (lcaEnergyAllocation) {
    const summedTotal = lcaEnergyAllocation.totalAnnualDcEnergyKwh;
    const tolerance = Math.max(1e-6, Math.abs(displayedLcaTotal ?? 0) * 1e-6);
    if (
      displayedLcaTotal === null ||
      displayedLcaTotal <= 0 ||
      Math.abs(summedTotal - displayedLcaTotal) > tolerance
    ) {
      lcaEnergyAllocation = null;
    } else {
      lcaEnergyAllocation = {
        ...lcaEnergyAllocation,
        share:
          lcaEnergyAllocation.shiftAnnualDcEnergyKwh / displayedLcaTotal,
        totalAnnualDcEnergyKwh: displayedLcaTotal,
      };
    }
  }

  return (
    lcaEnergyAllocation ??
    buildActivityAllocation(analysisRows, shiftId, "annual_dc_energy", "annual_analysis") ??
    buildActivityAllocation(lcaRows, shiftId, "annual_distance", "emissions") ??
    buildActivityAllocation(analysisRows, shiftId, "annual_distance", "annual_analysis") ??
    null
  );
};

const unavailableCapital = (costs, scope, issue) => ({
  ...costs,
  capitalComponents: null,
  electric: {
    ...costs?.electric,
    capex: null,
    capexPv: null,
    capexAnnual: null,
    totalAnnual: null,
  },
  diesel: {
    ...costs?.diesel,
    capex: null,
    capexAnnual: null,
    totalAnnual: null,
  },
  annualSaving: null,
  breakEvenYear: null,
  yearly: [],
  lifecycle: null,
  capitalScope: {
    scope,
    dataAvailable: false,
    vehicleCount: null,
    issue,
  },
});

const positiveInteger = (value) => {
  const numeric = toFiniteNumber(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

/** Resolve and validate the fleet count frozen from optimizer per-bus rows. */
export const resolveFleetVehicleScope = (features = {}, shiftId = null) => {
  const fleet = features?.config?.fixedConfiguration?.fleet;
  const normalizedShiftId = text(
    shiftId ??
    features?.results?.selectedShiftId ??
    features?.meta?.selectedShiftId,
  );
  const unavailable = (issue) => ({
    dataAvailable: false,
    source: text(fleet?.source) || null,
    scope: normalizedShiftId ? "shift" : "general",
    shiftId: normalizedShiftId || null,
    vehicleCount: null,
    fleetVehicleCount: null,
    issue,
  });

  if (!fleet || fleet.dataAvailable !== true) {
    return unavailable(text(fleet?.issue) || "fleet_vehicle_count_unavailable");
  }
  const fleetVehicleCount = positiveInteger(fleet.vehicleCount);
  const byShift = fleet.vehicleCountByShift;
  if (!fleetVehicleCount || !byShift || typeof byShift !== "object" || Array.isArray(byShift)) {
    return unavailable("invalid_fleet_vehicle_count");
  }
  const shiftCounts = Object.values(byShift).map(positiveInteger);
  if (
    shiftCounts.length === 0 ||
    shiftCounts.some((count) => count === null) ||
    shiftCounts.reduce((sum, count) => sum + count, 0) !== fleetVehicleCount
  ) {
    return unavailable("inconsistent_shift_vehicle_counts");
  }
  const vehicleCount = normalizedShiftId
    ? positiveInteger(byShift[normalizedShiftId])
    : fleetVehicleCount;
  if (!vehicleCount) return unavailable("shift_vehicle_count_unavailable");
  return {
    dataAvailable: true,
    source: text(fleet.source) || "optimization_per_bus_summary",
    scope: normalizedShiftId ? "shift" : "general",
    shiftId: normalizedShiftId || null,
    vehicleCount,
    fleetVehicleCount,
    issue: null,
  };
};

const applyVehicleCapitalScope = (
  costs,
  vehicleScope,
  infrastructureChf,
  infrastructureLifetimeYears =
    DEFAULT_CHARGING_INFRASTRUCTURE_LIFETIME_YEARS,
) => {
  if (!costs || typeof costs !== "object") return costs;
  if (!vehicleScope?.dataAvailable) {
    return unavailableCapital(
      costs,
      vehicleScope?.scope ?? "general",
      vehicleScope?.issue ?? "fleet_vehicle_count_unavailable",
    );
  }
  const vehicleCount = positiveInteger(vehicleScope.vehicleCount);
  if (!vehicleCount) {
    return unavailableCapital(costs, vehicleScope.scope, "invalid_vehicle_count");
  }
  if (costs?.capitalInputs && costs.capitalInputs.dataAvailable !== true) {
    return unavailableCapital(
      costs,
      vehicleScope.scope,
      "vehicle_capital_inputs_unavailable",
    );
  }

  const electricUnitCapex = toFiniteNumber(costs?.electric?.capex) ?? 0;
  const dieselUnitCapex = toFiniteNumber(costs?.diesel?.capex) ?? 0;
  const infrastructure = toFiniteNumber(infrastructureChf) ?? 0;
  const rate = toFiniteNumber(costs?.assumptions?.annualizationRate) ?? 0;
  const electricTotalOpex = toFiniteNumber(costs?.electric?.totalOpex) ?? 0;
  const dieselTotalOpex = toFiniteNumber(costs?.diesel?.totalOpex) ?? 0;
  const batteryUnitCost =
    toFiniteNumber(costs?.electric?.totalBatteryCost) ?? 0;
  const busUnitCost =
    toFiniteNumber(costs?.electric?.busCost) ??
    Math.max(0, electricUnitCapex - batteryUnitCost);
  const busLifetime = toFiniteNumber(costs?.electric?.busLifetime);
  const batteryLifetime =
    toFiniteNumber(costs?.electric?.batteryLifetime) ?? busLifetime;
  const dieselLifetime =
    toFiniteNumber(costs?.diesel?.busLifetime) ??
    DEFAULT_DIESEL_BUS_LIFETIME_YEARS;
  const infrastructureLifetime =
    (toFiniteNumber(infrastructureLifetimeYears) ?? 0) > 0
      ? toFiniteNumber(infrastructureLifetimeYears)
      : DEFAULT_CHARGING_INFRASTRUCTURE_LIFETIME_YEARS;
  const capitalModel = buildYearlyCapitalModel({
    annualizationRate: rate,
    horizonYears: busLifetime,
    vehicleCount,
    electricBusCostPerVehicleChf: busUnitCost,
    batteryCostPerVehicleChf: batteryUnitCost,
    sharedInfrastructureCostChf: infrastructure,
    dieselBusCostPerVehicleChf: dieselUnitCapex,
    busLifetimeYears: busLifetime,
    batteryLifetimeYears: batteryLifetime,
    infrastructureLifetimeYears: infrastructureLifetime,
    dieselBusLifetimeYears: dieselLifetime,
    electricAnnualOpex: electricTotalOpex,
    dieselAnnualOpex: dieselTotalOpex,
  });
  const electricCapex = capitalModel.electric.initialCostChf;
  const electricCapexPv =
    capitalModel.electric.initialAndReplacementPresentValueChf;
  const dieselCapex = capitalModel.diesel.initialCostChf;
  const electricCapexAnnual =
    capitalModel.electric.annualizedCostChfPerYear;
  const dieselCapexAnnual = capitalModel.diesel.annualizedCostChfPerYear;
  const electricTotalAnnual = electricCapexAnnual + electricTotalOpex;
  const dieselTotalAnnual = dieselCapexAnnual + dieselTotalOpex;
  const yearly = capitalModel.yearly;
  const scopedBreakEvenYear = capitalModel.breakEvenYear;

  return {
    ...costs,
    capitalComponents: capitalModel.components,
    electric: {
      ...costs.electric,
      capex: electricCapex,
      capexPv: electricCapexPv,
      capexAnnual: electricCapexAnnual,
      totalAnnual: electricTotalAnnual,
      vehicleCount,
      fleetBusCost: busUnitCost * vehicleCount,
      fleetBatteryCost:
        batteryUnitCost * vehicleCount,
      batteryReplacementPv:
        capitalModel.components.battery.replacementPresentValueChf,
      batteryReplacementYears:
        capitalModel.components.battery.replacementYears,
    },
    diesel: {
      ...costs.diesel,
      capex: dieselCapex,
      capexAnnual: dieselCapexAnnual,
      totalAnnual: dieselTotalAnnual,
      vehicleCount,
    },
    annualSaving: dieselTotalAnnual - electricTotalAnnual,
    breakEvenYear: scopedBreakEvenYear,
    yearly,
    lifecycle: capitalModel.lifecycle,
    capitalScope: {
      ...vehicleScope,
      dataAvailable: true,
      infrastructureInvestmentChf: infrastructureChf,
      includedInfrastructureChf: infrastructure,
      infrastructureLifetimeYears:
        capitalModel.components.chargingInfrastructure.lifetimeYears,
      infrastructureAnnualizedCostChfPerYear:
        capitalModel.components.chargingInfrastructure.annualizedCostChfPerYear,
      electricVehicleAndBatteryCapexChf: electricUnitCapex * vehicleCount,
      electricInitialCapexChf: electricCapex,
      dieselVehicleCapexChf: dieselCapex,
      breakEvenYear: scopedBreakEvenYear,
    },
  };
};

/** Apply complete fleet CAPEX while counting shared infrastructure once. */
export const applyGeneralFleetCapital = (
  costs,
  vehicleScope,
  {
    infrastructureInvestmentChf = null,
    infrastructureLifetimeYears =
      DEFAULT_CHARGING_INFRASTRUCTURE_LIFETIME_YEARS,
  } = {},
) => {
  if (!vehicleScope?.dataAvailable || !positiveInteger(vehicleScope.vehicleCount)) {
    return applyVehicleCapitalScope(
      costs,
      vehicleScope,
      0,
      infrastructureLifetimeYears,
    );
  }
  const infrastructure = toFiniteNumber(infrastructureInvestmentChf);
  if (infrastructure === null) {
    return unavailableCapital(
      costs,
      "general",
      "infrastructure_investment_unavailable",
    );
  }
  return applyVehicleCapitalScope(
    costs,
    vehicleScope,
    infrastructure,
    infrastructureLifetimeYears,
  );
};

/**
 * Keep the complete vehicle and battery CAPEX owned by a shift. Only the
 * shared charging infrastructure is attributed by annual activity.
 */
export const applyShiftCapitalAllocation = (
  costs,
  basis,
  {
    infrastructureInvestmentChf = null,
    infrastructureLifetimeYears =
      DEFAULT_CHARGING_INFRASTRUCTURE_LIFETIME_YEARS,
    vehicleScope = null,
  } = {},
) => {
  if (!costs || typeof costs !== "object") return costs;
  if (!vehicleScope?.dataAvailable) {
    return unavailableCapital(
      costs,
      vehicleScope?.scope ?? "shift",
      vehicleScope?.issue ?? "shift_vehicle_count_unavailable",
    );
  }
  const infrastructure = toFiniteNumber(infrastructureInvestmentChf);
  if (infrastructure === null) {
    return unavailableCapital(
      costs,
      "shift",
      "infrastructure_investment_unavailable",
    );
  }
  const share = toFiniteNumber(basis?.share);
  if (!basis || share === null || share < 0 || share > 1) {
    return unavailableCapital(costs, "shift", "infrastructure_allocation_unavailable");
  }
  const allocatedInfrastructure = infrastructure * share;
  const vehicleCount = positiveInteger(vehicleScope.vehicleCount);
  const electricUnitCapex = toFiniteNumber(costs?.electric?.capex) ?? 0;
  const dieselUnitCapex = toFiniteNumber(costs?.diesel?.capex) ?? 0;
  const scoped = applyVehicleCapitalScope(
    costs,
    vehicleScope,
    allocatedInfrastructure,
    infrastructureLifetimeYears,
  );
  if (scoped?.capitalScope?.dataAvailable === false) return scoped;
  const allocation = {
    method: basis.method,
    source: basis.source,
    shiftId: basis.shiftId,
    share,
    shiftAnnualDcEnergyKwh: basis.shiftAnnualDcEnergyKwh,
    totalAnnualDcEnergyKwh: basis.totalAnnualDcEnergyKwh,
    shiftAnnualDistanceKm: basis.shiftAnnualDistanceKm,
    totalAnnualDistanceKm: basis.totalAnnualDistanceKm,
    infrastructureIncluded: true,
    vehicleCount,
    electric: {
      referenceVehicleAndBatteryCapexChf: electricUnitCapex,
      ownedVehicleAndBatteryCapexChf: electricUnitCapex * vehicleCount,
      sharedInfrastructureCapexChf: infrastructure,
      allocatedVehicleAndBatteryCapexChf: electricUnitCapex * vehicleCount,
      allocatedInfrastructureCapexChf: allocatedInfrastructure,
      allocatedInitialCapexChf: scoped.electric.capex,
      allocatedCapexWithReplacementsChf: scoped.electric.capexPv,
      allocatedAnnualizedCapexChf: scoped.electric.capexAnnual,
    },
    diesel: {
      referenceCapexChf: dieselUnitCapex,
      ownedVehicleCapexChf: dieselUnitCapex * vehicleCount,
      allocatedInitialCapexChf: scoped.diesel.capex,
      allocatedAnnualizedCapexChf: scoped.diesel.capexAnnual,
    },
    breakEvenYear: scoped.breakEvenYear,
  };
  return {
    ...scoped,
    capitalAllocation: allocation,
  };
};

/**
 * Economic context that belongs to General rather than to any one shift.
 *
 * The charging infrastructure is one shared system investment. Physical bus
 * count comes from the optimizer per-bus snapshot frozen in the analysis.
 */
export const buildGeneralSharedCostContext = (features = {}, busModelData = {}) => {
  const fixed = features?.config?.fixedConfiguration ?? {};
  const infrastructure = fixed?.infrastructure ?? null;
  const infrastructureAvailable = Boolean(
    infrastructure &&
    infrastructure?.dataAvailable !== false &&
    (infrastructure?.decision === "fixed" || infrastructure?.resultAvailable !== false),
  );
  const stations = Array.isArray(infrastructure?.stations)
    ? infrastructure.stations
    : [];
  const activeStations = stations.filter((station) =>
    station?.selected === true ||
    (["fixed", "installed", "configured"].includes(station?.status) &&
      (toFiniteNumber(station?.slots) ?? 0) > 0));
  const infrastructureInvestmentChf = infrastructureAvailable
    ? toFiniteNumber(infrastructure?.totalInstallationCostChf) ??
      sumFinite(activeStations.map((station) => station?.installationCostChf))
    : null;
  const storedInfrastructureLifetime = toFiniteNumber(
    infrastructure?.lifetimeYears ?? infrastructure?.lifetime_years,
  );
  const infrastructureLifetimeYears =
    storedInfrastructureLifetime !== null && storedInfrastructureLifetime > 0
      ? storedInfrastructureLifetime
      : DEFAULT_CHARGING_INFRASTRUCTURE_LIFETIME_YEARS;

  const packs =
    toFiniteNumber(fixed?.battery?.packs) ??
    toFiniteNumber(features?.results?.optimizedPacks);
  const packCostChf = toFiniteNumber(busModelData?.battery_pack_cost);
  const batteryCostPerBusChf = packs !== null && packCostChf !== null
    ? packs * packCostChf
    : null;
  const busCostPerVehicleChf = toFiniteNumber(busModelData?.cost);
  const referenceUnitInvestmentChf =
    busCostPerVehicleChf !== null && batteryCostPerBusChf !== null
      ? busCostPerVehicleChf + batteryCostPerBusChf
      : null;
  const fleetScope = resolveFleetVehicleScope(features);
  const fleetVehicleCount = fleetScope.dataAvailable
    ? fleetScope.vehicleCount
    : null;
  const fleetBusInvestmentChf =
    fleetVehicleCount !== null && busCostPerVehicleChf !== null
      ? fleetVehicleCount * busCostPerVehicleChf
      : null;
  const fleetBatteryInvestmentChf =
    fleetVehicleCount !== null && batteryCostPerBusChf !== null
      ? fleetVehicleCount * batteryCostPerBusChf
      : null;
  const fleetInvestmentChf =
    fleetVehicleCount !== null && referenceUnitInvestmentChf !== null
      ? fleetVehicleCount * referenceUnitInvestmentChf
      : null;
  const totalInitialInvestmentChf =
    fleetInvestmentChf !== null && infrastructureInvestmentChf !== null
      ? fleetInvestmentChf + infrastructureInvestmentChf
      : null;

  return {
    scope: "general_shared",
    allocation: "annual_dc_energy_share",
    chargingInfrastructure: {
      shared: true,
      investmentChf: infrastructureInvestmentChf,
      lifetimeYears: infrastructureLifetimeYears,
    },
    fleetCapital: {
      ...fleetScope,
      busInvestmentChf: fleetBusInvestmentChf,
      batteryInvestmentChf: fleetBatteryInvestmentChf,
      vehicleAndBatteryInvestmentChf: fleetInvestmentChf,
      totalInitialInvestmentChf,
    },
    vehicleUnitReference: {
      fleetVehicleCount,
      fleetInvestmentChf,
      busCostPerVehicleChf,
      commonBatteryPacks: packs,
      batteryPackCostChf: packCostChf,
      batteryCostPerBusChf,
      referenceUnitInvestmentChf,
    },
  };
};

/**
 * Keeps exact operating values and exports the already-scoped capital model.
 */
export const buildOperatingCostExport = (costs, scope = "shift_operating") => {
  if (!costs || typeof costs !== "object") return null;

  const electric = costs.electric ?? {};
  const diesel = costs.diesel ?? {};
  const electricTotal = toFiniteNumber(electric.totalOPEX_CHF);
  const dieselTotal = toFiniteNumber(diesel.totalOPEX_CHF);
  const yearlyDistanceKm = toFiniteNumber(costs.yearlyDistance_km);

  return {
    scope,
    includesSharedCapital: false,
    includesAllocatedSharedCapital: Boolean(costs.capitalAllocation),
    ...(costs.capitalAllocation &&
    costs.capitalScope &&
    typeof costs.capitalScope === "object"
      ? { capitalScope: costs.capitalScope }
      : {}),
    assumptions: costs.assumptions ?? {},
    electric: {
      energyOPEX_CHF: toFiniteNumber(electric.energyOPEX_CHF),
      maintenanceOPEX_CHF: toFiniteNumber(electric.maintenanceOPEX_CHF),
      dieselHeatingFuelOPEX_CHF: toFiniteNumber(electric.dieselHeatingFuelOPEX_CHF),
      dieselHeatingMaintOPEX_CHF: toFiniteNumber(electric.dieselHeatingMaintOPEX_CHF),
      totalOPEX_CHF: electricTotal,
      operatingCostPerKm_CHF:
        electricTotal !== null && yearlyDistanceKm !== null && yearlyDistanceKm > 0
          ? electricTotal / yearlyDistanceKm
          : null,
    },
    diesel: {
      fuelOPEX_CHF: toFiniteNumber(diesel.fuelOPEX_CHF),
      maintenanceOPEX_CHF: toFiniteNumber(diesel.maintenanceOPEX_CHF),
      totalOPEX_CHF: dieselTotal,
      operatingCostPerKm_CHF:
        dieselTotal !== null && yearlyDistanceKm !== null && yearlyDistanceKm > 0
          ? dieselTotal / yearlyDistanceKm
          : null,
    },
    annualOperatingSaving_CHF:
      electricTotal !== null && dieselTotal !== null
        ? dieselTotal - electricTotal
        : null,
    ...(costs.capitalAllocation && typeof costs.capitalAllocation === "object"
      ? {
          capitalAnnualization: costs.capitalAnnualization ?? null,
          capitalAllocation: costs.capitalAllocation,
          breakEvenYear: toFiniteNumber(costs.breakEvenYear),
          projectedCostTrend: Array.isArray(costs.projectedCostTrend)
            ? costs.projectedCostTrend
            : [],
        }
      : {}),
    yearlyEnergy_kWh: toFiniteNumber(costs.yearlyEnergy_kWh),
    yearlyBusEnergyDC_kWh: toFiniteNumber(costs.yearlyBusEnergyDC_kWh),
    yearlyGridEnergy_kWh: toFiniteNumber(costs.yearlyGridEnergy_kWh),
    yearlyChargingLosses_kWh: toFiniteNumber(costs.yearlyChargingLosses_kWh),
    yearlyDistance_km: yearlyDistanceKm,
    scenarioCosts: Array.isArray(costs.scenarioCosts) ? costs.scenarioCosts : [],
  };
};

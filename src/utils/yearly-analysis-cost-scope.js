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

const equivalentAnnualCost = (principal, rate, lifetimeYears) => {
  const capex = toFiniteNumber(principal);
  const lifetime = toFiniteNumber(lifetimeYears);
  const annualRate = toFiniteNumber(rate);
  if (capex === null || capex <= 0 || lifetime === null || lifetime <= 0) return 0;
  if (annualRate === null || annualRate <= 0) return capex / lifetime;
  const growth = Math.pow(1 + annualRate, lifetime);
  return capex * ((annualRate * growth) / (growth - 1));
};

const discountedOpexThroughYear = (annualOpex, rate, year) => {
  const cost = toFiniteNumber(annualOpex) ?? 0;
  const annualRate = toFiniteNumber(rate) ?? 0;
  const horizon = Math.max(0, Math.floor(toFiniteNumber(year) ?? 0));
  let total = 0;
  for (let current = 1; current <= horizon; current += 1) {
    total += cost / (annualRate > 0 ? Math.pow(1 + annualRate, current) : 1);
  }
  return total;
};

const scopeProjectedTrend = (costs, vehicleCount, infrastructureChf) => {
  const yearly = Array.isArray(costs?.yearly) ? costs.yearly : [];
  const rate = toFiniteNumber(costs?.assumptions?.annualizationRate) ?? 0;
  const electricOpex = toFiniteNumber(costs?.electric?.totalOpex) ?? 0;
  const dieselOpex = toFiniteNumber(costs?.diesel?.totalOpex) ?? 0;
  const scoped = yearly.map((point) => {
    const year = Math.max(0, Math.floor(toFiniteNumber(point?.year) ?? 0));
    const electricOpexPv = discountedOpexThroughYear(electricOpex, rate, year);
    const dieselOpexPv = discountedOpexThroughYear(dieselOpex, rate, year);
    const electricCapitalPv = Math.max(
      0,
      (toFiniteNumber(point?.electric) ?? 0) - electricOpexPv,
    );
    const dieselCapitalPv = Math.max(
      0,
      (toFiniteNumber(point?.diesel) ?? 0) - dieselOpexPv,
    );
    return {
      year,
      electric:
        electricCapitalPv * vehicleCount + electricOpexPv + infrastructureChf,
      diesel: dieselCapitalPv * vehicleCount + dieselOpexPv,
    };
  });

  const lifecycle = costs?.lifecycle ?? yearly?.lifecycle;
  if (lifecycle && typeof lifecycle === "object") {
    const horizon = Math.max(
      0,
      Math.floor(toFiniteNumber(lifecycle.horizonYears) ?? 0),
    );
    const electricOpexPv = discountedOpexThroughYear(electricOpex, rate, horizon);
    const dieselOpexPv = discountedOpexThroughYear(dieselOpex, rate, horizon);
    const grossFinalElectric =
      Math.max(0, (toFiniteNumber(lifecycle.grossFinalElectric) ?? 0) - electricOpexPv) *
        vehicleCount +
      electricOpexPv +
      infrastructureChf;
    const grossFinalDiesel =
      Math.max(0, (toFiniteNumber(lifecycle.grossFinalDiesel) ?? 0) - dieselOpexPv) *
        vehicleCount +
      dieselOpexPv;
    const electricResidualValue =
      (toFiniteNumber(lifecycle.electricResidualValue) ?? 0) * vehicleCount;
    const dieselResidualValue =
      (toFiniteNumber(lifecycle.dieselResidualValue) ?? 0) * vehicleCount;
    const electricDiscountedResidual =
      (toFiniteNumber(lifecycle.electricDiscountedResidual) ?? 0) * vehicleCount;
    const dieselDiscountedResidual =
      (toFiniteNumber(lifecycle.dieselDiscountedResidual) ?? 0) * vehicleCount;
    const netFinalElectric = grossFinalElectric - electricDiscountedResidual;
    const netFinalDiesel = grossFinalDiesel - dieselDiscountedResidual;
    Object.defineProperty(scoped, "lifecycle", {
      configurable: true,
      enumerable: false,
      value: {
        horizonYears: horizon,
        grossFinalDiesel,
        grossFinalElectric,
        dieselResidualValue,
        electricResidualValue,
        dieselDiscountedResidual,
        electricDiscountedResidual,
        netFinalDiesel,
        netFinalElectric,
        lifecycleSaving: netFinalDiesel - netFinalElectric,
      },
    });
  }
  return scoped;
};

const breakEvenYear = (yearly = []) => {
  if (!Array.isArray(yearly) || yearly.length === 0) return null;
  if (yearly[0].electric <= yearly[0].diesel) return yearly[0].year;
  for (let index = 1; index < yearly.length; index += 1) {
    const previous = yearly[index - 1];
    const current = yearly[index];
    if (previous.diesel <= previous.electric && current.diesel >= current.electric) {
      const delta = (current.diesel - previous.diesel) -
        (current.electric - previous.electric);
      if (current.year === previous.year || Math.abs(delta) < 1e-9) {
        return current.year;
      }
      return previous.year + (previous.electric - previous.diesel) / delta;
    }
  }
  return null;
};

const unavailableCapital = (costs, scope, issue) => ({
  ...costs,
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
  const electricUnitCapexPv =
    toFiniteNumber(costs?.electric?.capexPv) ?? electricUnitCapex;
  const dieselUnitCapex = toFiniteNumber(costs?.diesel?.capex) ?? 0;
  const infrastructure = toFiniteNumber(infrastructureChf) ?? 0;
  const electricCapex = electricUnitCapex * vehicleCount + infrastructure;
  const electricCapexPv = electricUnitCapexPv * vehicleCount + infrastructure;
  const dieselCapex = dieselUnitCapex * vehicleCount;
  const rate = toFiniteNumber(costs?.assumptions?.annualizationRate) ?? 0;
  const electricLifetime = toFiniteNumber(costs?.electric?.busLifetime);
  const electricCapexAnnual =
    (toFiniteNumber(costs?.electric?.capexAnnual) ?? 0) * vehicleCount +
    equivalentAnnualCost(infrastructure, rate, electricLifetime);
  const dieselCapexAnnual =
    (toFiniteNumber(costs?.diesel?.capexAnnual) ?? 0) * vehicleCount;
  const electricTotalOpex = toFiniteNumber(costs?.electric?.totalOpex) ?? 0;
  const dieselTotalOpex = toFiniteNumber(costs?.diesel?.totalOpex) ?? 0;
  const electricTotalAnnual = electricCapexAnnual + electricTotalOpex;
  const dieselTotalAnnual = dieselCapexAnnual + dieselTotalOpex;
  const yearly = scopeProjectedTrend(costs, vehicleCount, infrastructure);
  const scopedBreakEvenYear = breakEvenYear(yearly);

  return {
    ...costs,
    electric: {
      ...costs.electric,
      capex: electricCapex,
      capexPv: electricCapexPv,
      capexAnnual: electricCapexAnnual,
      totalAnnual: electricTotalAnnual,
      vehicleCount,
      fleetBusCost: (toFiniteNumber(costs?.electric?.busCost) ?? 0) * vehicleCount,
      fleetBatteryCost:
        (toFiniteNumber(costs?.electric?.totalBatteryCost) ?? 0) * vehicleCount,
      batteryReplacementPv:
        (toFiniteNumber(costs?.electric?.batteryReplacementPv) ?? 0) * vehicleCount,
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
    lifecycle: yearly.lifecycle ?? null,
    capitalScope: {
      ...vehicleScope,
      dataAvailable: true,
      infrastructureInvestmentChf: infrastructureChf,
      includedInfrastructureChf: infrastructure,
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
  { infrastructureInvestmentChf = null } = {},
) => {
  if (!vehicleScope?.dataAvailable || !positiveInteger(vehicleScope.vehicleCount)) {
    return applyVehicleCapitalScope(costs, vehicleScope, 0);
  }
  const infrastructure = toFiniteNumber(infrastructureInvestmentChf);
  if (infrastructure === null) {
    return unavailableCapital(
      costs,
      "general",
      "infrastructure_investment_unavailable",
    );
  }
  return applyVehicleCapitalScope(costs, vehicleScope, infrastructure);
};

/**
 * Keep the complete vehicle and battery CAPEX owned by a shift. Only the
 * shared charging infrastructure is attributed by annual activity.
 */
export const applyShiftCapitalAllocation = (
  costs,
  basis,
  { infrastructureInvestmentChf = null, vehicleScope = null } = {},
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

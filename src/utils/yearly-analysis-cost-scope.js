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

/**
 * Economic context that belongs to General rather than to any one shift.
 *
 * The charging infrastructure is one shared system investment. Vehicle and
 * battery values are deliberately unit references: a yearly analysis does not
 * contain enough vehicle-block information to infer the number of physical
 * buses required by a group of shifts.
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

  return {
    scope: "general_shared",
    allocation: "not_allocated_to_shifts",
    chargingInfrastructure: {
      shared: true,
      investmentChf: infrastructureInvestmentChf,
    },
    vehicleUnitReference: {
      fleetVehicleCount: null,
      fleetInvestmentChf: null,
      busCostPerVehicleChf,
      commonBatteryPacks: packs,
      batteryPackCostChf: packCostChf,
      batteryCostPerBusChf,
      referenceUnitInvestmentChf,
    },
  };
};

/**
 * Removes capital fields from a cost export and keeps only values attributable
 * to operating one shift. This prevents full bus, battery, and infrastructure
 * investments from being repeated for every shift.
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
    yearlyEnergy_kWh: toFiniteNumber(costs.yearlyEnergy_kWh),
    yearlyBusEnergyDC_kWh: toFiniteNumber(costs.yearlyBusEnergyDC_kWh),
    yearlyGridEnergy_kWh: toFiniteNumber(costs.yearlyGridEnergy_kWh),
    yearlyChargingLosses_kWh: toFiniteNumber(costs.yearlyChargingLosses_kWh),
    yearlyDistance_km: yearlyDistanceKm,
    scenarioCosts: Array.isArray(costs.scenarioCosts) ? costs.scenarioCosts : [],
  };
};

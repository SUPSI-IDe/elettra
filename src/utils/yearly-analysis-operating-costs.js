const toFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

/**
 * Read annual diesel-heating activity from the exact physical vehicle rows
 * exposed by the parameterized LCA endpoint. Missing rows remain unavailable;
 * they are never converted into an invented zero-consumption case.
 */
export const resolveYearlyOperatingActivity = (rawLca, shiftId = null) => {
  const vehicles = Array.isArray(rawLca?.vehicles) ? rawLca.vehicles : [];
  const normalizedShiftId = text(shiftId);
  const selected = normalizedShiftId
    ? vehicles.filter((vehicle) => text(vehicle?.shift_id) === normalizedShiftId)
    : vehicles;
  if (!selected.length) {
    return {
      dataAvailable: false,
      source: "lca_vehicles",
      shiftId: normalizedShiftId || null,
      annualDistanceKm: null,
      dieselHeatingLiters: null,
      issue: normalizedShiftId ? "shift_vehicle_activity_unavailable" : "vehicle_activity_unavailable",
    };
  }

  const liters = selected.map((vehicle) =>
    vehicle?.diesel_heating_liters == null ? null : toFiniteNumber(vehicle.diesel_heating_liters * (vehicle.vehicle_count ?? 1)));
  const distances = selected.map((vehicle) =>
    vehicle?.annual_km == null ? null : toFiniteNumber(vehicle.annual_km * (vehicle.vehicle_count ?? 1)));
  if (
    liters.some((value) => value === null || value < 0) ||
    distances.some((value) => value === null || value < 0)
  ) {
    return {
      dataAvailable: false,
      source: "lca_vehicles",
      shiftId: normalizedShiftId || null,
      annualDistanceKm: null,
      dieselHeatingLiters: null,
      issue: "vehicle_operating_activity_incomplete",
    };
  }

  return {
    dataAvailable: true,
    source: "lca_vehicles",
    shiftId: normalizedShiftId || null,
    vehicleCount: selected.reduce((sum, vehicle) => sum + (vehicle.vehicle_count ?? 1), 0),
    annualDistanceKm: distances.reduce((sum, value) => sum + value, 0),
    dieselHeatingLiters: liters.reduce((sum, value) => sum + value, 0),
    issue: null,
  };
};

const METRICS = Object.freeze([
  ["yearlyDistanceKm", (costs) => costs?.yearlyDistanceKm],
  ["yearlyBusEnergyDcKwh", (costs) => costs?.yearlyEnergyKwh],
  ["yearlyGridEnergyKwh", (costs) => costs?.yearlyGridEnergyKwh],
  ["yearlyChargingLossesKwh", (costs) => costs?.yearlyChargingLossesKwh],
  ["electricEnergyOpexChf", (costs) => costs?.electric?.energyOpex],
  ["electricMaintenanceOpexChf", (costs) => costs?.electric?.maintOpex],
  ["dieselHeatingFuelOpexChf", (costs) => costs?.electric?.dieselHeatingFuelOpex ?? 0],
  ["dieselHeatingMaintenanceOpexChf", (costs) => costs?.electric?.dieselHeatingMaintOpex ?? 0],
  ["electricTotalOpexChf", (costs) => costs?.electric?.totalOpex],
  ["dieselFuelOpexChf", (costs) => costs?.diesel?.fuelOpex],
  ["dieselMaintenanceOpexChf", (costs) => costs?.diesel?.maintOpex],
  ["dieselTotalOpexChf", (costs) => costs?.diesel?.totalOpex],
]);

const comparisonTolerance = (value) =>
  Math.max(1e-6, Math.abs(value) * 1e-9);

/** Build an auditable General-vs-shifts operating-cost reconciliation. */
export const reconcileYearlyOperatingCosts = (
  generalCosts,
  shiftCosts = [],
) => {
  const shifts = Array.isArray(shiftCosts) ? shiftCosts : [];
  if (!generalCosts || !shifts.length || shifts.some((costs) => !costs)) {
    return {
      status: "unavailable",
      shiftCount: shifts.length,
      issue: !generalCosts ? "general_costs_unavailable" : "shift_costs_incomplete",
      metrics: {},
    };
  }
  const generalHeatingLiters = toFiniteNumber(
    generalCosts?.assumptions?.yearlyDieselHeatingLiters,
  ) ?? 0;
  if (
    generalHeatingLiters > 0 &&
    shifts.some((costs) => costs?.operatingActivity?.dataAvailable !== true)
  ) {
    return {
      status: "unavailable",
      shiftCount: shifts.length,
      issue: "shift_diesel_heating_activity_unavailable",
      metrics: {},
    };
  }

  const metrics = {};
  for (const [key, read] of METRICS) {
    const general = toFiniteNumber(read(generalCosts));
    const values = shifts.map((costs) => toFiniteNumber(read(costs)));
    if (general === null || values.some((value) => value === null)) {
      return {
        status: "unavailable",
        shiftCount: shifts.length,
        issue: `metric_unavailable:${key}`,
        metrics: {},
      };
    }
    const shiftSum = values.reduce((sum, value) => sum + value, 0);
    const delta = general - shiftSum;
    const tolerance = comparisonTolerance(general);
    metrics[key] = {
      general,
      shiftSum,
      delta,
      tolerance,
      consistent: Math.abs(delta) <= tolerance,
    };
  }

  const consistent = Object.values(metrics).every((metric) => metric.consistent);
  return {
    status: consistent ? "consistent" : "inconsistent",
    shiftCount: shifts.length,
    issue: consistent ? null : "general_shift_operating_cost_mismatch",
    metrics,
  };
};

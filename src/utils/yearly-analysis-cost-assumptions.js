import {
  DEFAULT_ENERGY_PRICE_PER_KWH,
  DEFAULT_FUEL_COST_PER_L,
  DEFAULT_DIESEL_HEATING_MAINTENANCE_FACTOR,
  DEFAULT_OPEX_ANNUALIZATION_RATE,
  DIESEL_CONSUMPTION_BASE,
  evalLinearModel,
  getDieselMaintenanceCostForLength,
  getElectricMaintenanceCostForLength,
} from "../config/economic-defaults.js";

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const firstFinite = (...values) => {
  for (const value of values) {
    const numeric = finiteNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
};

const dieselConsumptionForLength = (busLengthM) => {
  const length = finiteNumber(busLengthM) ?? 12;
  return Number(evalLinearModel(
    length,
    DIESEL_CONSUMPTION_BASE.intercept,
    DIESEL_CONSUMPTION_BASE.slope,
  ).toFixed(10));
};

/**
 * Resolve the economic parameters shared by General and every shift.
 *
 * Prices and the annualization rate may be frozen by the yearly-cost endpoint.
 * Maintenance parameters intentionally come from the frontend bus defaults:
 * these are the values shown by the controls and used by the feasibility
 * views. Diesel consumption keeps a frozen backend value when available and
 * otherwise uses the same continuous bus-length model. Backend OPEX totals
 * are recalculated with this resolved set, so a coefficient cannot silently
 * disagree between General and the individual shifts.
 */
export const resolveYearlyEconomicAssumptions = ({
  busLengthM,
  backendAssumptions = {},
  baseAssumptions = {},
  overrides = {},
} = {}) => ({
  energyPricePerKwh: firstFinite(
    overrides.energyPricePerKwh,
    baseAssumptions.energyPricePerKwh,
    backendAssumptions.energy_price_per_kwh,
    DEFAULT_ENERGY_PRICE_PER_KWH,
  ),
  fuelPricePerL: firstFinite(
    overrides.fuelCostPerL,
    baseAssumptions.fuelPricePerL,
    backendAssumptions.fuel_cost_per_l,
    DEFAULT_FUEL_COST_PER_L,
  ),
  dieselEfficiencyLPerKm: firstFinite(
    overrides.dieselEfficiency,
    baseAssumptions.dieselEfficiencyLPerKm,
    backendAssumptions.diesel_comparator_consumption_l_per_km,
    dieselConsumptionForLength(busLengthM),
  ),
  dieselMaintPerKm: firstFinite(
    overrides.dieselMaintCost,
    baseAssumptions.dieselMaintPerKm,
    getDieselMaintenanceCostForLength(busLengthM),
  ),
  electricMaintPerKm: firstFinite(
    overrides.electricMaintCost,
    baseAssumptions.electricMaintPerKm,
    getElectricMaintenanceCostForLength(busLengthM),
  ),
  annualizationRate: firstFinite(
    overrides.interestRate,
    baseAssumptions.annualizationRate,
    backendAssumptions.interest_rate,
    DEFAULT_OPEX_ANNUALIZATION_RATE,
  ),
  dieselHeatingMaintenanceFactor: firstFinite(
    baseAssumptions.dieselHeatingMaintenanceFactor,
    backendAssumptions.diesel_heating_maintenance_factor,
    DEFAULT_DIESEL_HEATING_MAINTENANCE_FACTOR,
  ),
});

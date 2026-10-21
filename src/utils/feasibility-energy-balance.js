export const ENERGY_BALANCE_TOLERANCE_KWH = 1e-6;

const nonNegativeFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const optionalBoolean = (value) =>
  typeof value === "boolean" ? value : null;

const normalizeNearZero = (value, tolerance) =>
  value !== null && Math.abs(value) <= tolerance ? 0 : value;

const isCovered = (availableKwh, demandKwh, tolerance) =>
  availableKwh !== null && demandKwh !== null
    ? demandKwh <= availableKwh + tolerance
    : null;

/**
 * Builds the energy balance shown for one physical shift.
 *
 * Mean feasibility comes from the optimized SOC trajectory when the backend
 * provides it. Aggregate energy remains useful for explaining that decision
 * and for indicative quantile comparisons, but cannot replace the temporal
 * optimization.
 */
export function buildShiftEnergyBalance({
  usableBatteryEnergyKwh,
  plannedChargingEnergyKwh,
  q05DemandKwh,
  meanDemandKwh,
  q50DemandKwh,
  q95DemandKwh,
  meanScheduleFeasible,
  minimumSocKwh,
  minimumAllowedSocKwh,
  toleranceKwh = ENERGY_BALANCE_TOLERANCE_KWH,
} = {}) {
  const usableBatteryEnergy = nonNegativeFiniteNumber(usableBatteryEnergyKwh);
  const plannedChargingEnergy = nonNegativeFiniteNumber(plannedChargingEnergyKwh);
  const chargingDataAvailable = plannedChargingEnergy !== null;
  const operationalEnergy =
    usableBatteryEnergy !== null && chargingDataAvailable
      ? usableBatteryEnergy + plannedChargingEnergy
      : null;
  const comparisonEnergy = operationalEnergy ?? usableBatteryEnergy;
  const q05Demand = nonNegativeFiniteNumber(q05DemandKwh);
  const meanDemand = nonNegativeFiniteNumber(meanDemandKwh);
  const q50Demand = nonNegativeFiniteNumber(q50DemandKwh);
  const q95Demand = nonNegativeFiniteNumber(q95DemandKwh);
  const scheduleFeasible = optionalBoolean(meanScheduleFeasible);
  const tolerance = nonNegativeFiniteNumber(toleranceKwh) ?? ENERGY_BALANCE_TOLERANCE_KWH;
  const meanEnergyCovered = isCovered(comparisonEnergy, meanDemand, tolerance);
  const rawMargin =
    operationalEnergy !== null && meanDemand !== null
      ? operationalEnergy - meanDemand
      : null;
  const marginKwh = normalizeNearZero(rawMargin, tolerance);
  const minimumSoc = nonNegativeFiniteNumber(minimumSocKwh);
  const minimumAllowedSoc = nonNegativeFiniteNumber(minimumAllowedSocKwh);
  const rawMinimumSocReserve =
    minimumSoc !== null && minimumAllowedSoc !== null
      ? minimumSoc - minimumAllowedSoc
      : null;
  const minimumSocReserveKwh = normalizeNearZero(rawMinimumSocReserve, tolerance);

  return {
    usableBatteryEnergyKwh: usableBatteryEnergy,
    plannedChargingEnergyKwh: plannedChargingEnergy,
    chargingDataAvailable,
    usesPlannedCharging:
      plannedChargingEnergy !== null && plannedChargingEnergy > tolerance,
    operationalEnergyKwh: operationalEnergy,
    comparisonEnergyKwh: comparisonEnergy,
    comparisonUsesOperationalEnergy: operationalEnergy !== null,
    q05DemandKwh: q05Demand,
    meanDemandKwh: meanDemand,
    q50DemandKwh: q50Demand,
    q95DemandKwh: q95Demand,
    canEvaluateEnergy: comparisonEnergy !== null,
    canEvaluateQuantiles:
      comparisonEnergy !== null &&
      q05Demand !== null &&
      meanDemand !== null &&
      q50Demand !== null &&
      q95Demand !== null,
    q05Covered: isCovered(comparisonEnergy, q05Demand, tolerance),
    meanEnergyCovered,
    q50Covered: isCovered(comparisonEnergy, q50Demand, tolerance),
    q95Covered: isCovered(comparisonEnergy, q95Demand, tolerance),
    meanScheduleFeasible: scheduleFeasible,
    meanCovered: scheduleFeasible ?? meanEnergyCovered,
    meanDecisionUsesOptimizedSchedule: scheduleFeasible !== null,
    marginKwh,
    marginPct:
      marginKwh !== null && meanDemand !== null && meanDemand > 0
        ? marginKwh / meanDemand
        : null,
    minimumSocKwh: minimumSoc,
    minimumAllowedSocKwh: minimumAllowedSoc,
    minimumSocReserveKwh,
    minimumSocCovered: isCovered(minimumSoc, minimumAllowedSoc, tolerance),
  };
}

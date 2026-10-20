// Reporting boundary only. All optimization power limits remain DC.
export const GRID_TO_BUS_EFFICIENCY = 0.94;
export const CHARGING_ENERGY_POLICY = "grid-to-bus-dc-94-v1";

const toNonNegativeFiniteNumber = value => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const nearlyEqual = (left, right) =>
  Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right));

export const gridFromDc = (value) => {
  const number = toNonNegativeFiniteNumber(value);
  if (number == null) throw new Error("Invalid DC energy/power");
  return number / GRID_TO_BUS_EFFICIENCY;
};

export const validateChargingEnergyBoundary = boundary => {
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    return { valid: false, issues: ["energy boundary must be an object"] };
  }

  const issues = [];
  const dcKwh = toNonNegativeFiniteNumber(boundary.dc_kwh);
  const gridKwh = toNonNegativeFiniteNumber(boundary.grid_kwh);
  const chargingLossesKwh = toNonNegativeFiniteNumber(boundary.charging_losses_kwh);
  const efficiency = toNonNegativeFiniteNumber(boundary.grid_to_bus_efficiency);

  if (boundary.policy !== CHARGING_ENERGY_POLICY) {
    issues.push(`energy boundary policy must be ${CHARGING_ENERGY_POLICY}`);
  }
  if (dcKwh == null) issues.push("energy boundary dc_kwh must be finite and non-negative");
  if (gridKwh == null) issues.push("energy boundary grid_kwh must be finite and non-negative");
  if (chargingLossesKwh == null) {
    issues.push("energy boundary charging_losses_kwh must be finite and non-negative");
  }
  if (efficiency == null || !nearlyEqual(efficiency, GRID_TO_BUS_EFFICIENCY)) {
    issues.push(`energy boundary grid_to_bus_efficiency must be ${GRID_TO_BUS_EFFICIENCY}`);
  }
  if (dcKwh != null && gridKwh != null) {
    if (gridKwh < dcKwh) issues.push("energy boundary grid_kwh must not be lower than dc_kwh");
    if (efficiency != null && !nearlyEqual(dcKwh, gridKwh * efficiency)) {
      issues.push("energy boundary DC and grid energy do not match the declared efficiency");
    }
  }
  if (
    dcKwh != null &&
    gridKwh != null &&
    chargingLossesKwh != null &&
    !nearlyEqual(gridKwh - dcKwh, chargingLossesKwh)
  ) {
    issues.push("energy boundary charging losses do not match grid_kwh minus dc_kwh");
  }

  return {
    valid: issues.length === 0,
    issues,
    boundary: issues.length === 0
      ? { dcKwh, gridKwh, chargingLossesKwh, gridToBusEfficiency: efficiency }
      : null,
  };
};

/**
 * Build the fixed 94% reporting boundary for a DC quantity. When a backend
 * boundary is supplied, validate it first and scale its DC/grid pair together.
 */
export const buildChargingEnergyBoundary = (
  dcEnergyKwh,
  { boundary, boundaryDcEnergyKwh } = {},
) => {
  const dcKwh = toNonNegativeFiniteNumber(dcEnergyKwh);
  if (dcKwh == null) throw new Error("Invalid DC energy/power");

  const hasBoundary =
    boundary != null &&
    !(typeof boundary === "object" && !Array.isArray(boundary) && Object.keys(boundary).length === 0);

  let gridKwh;
  if (hasBoundary) {
    const validation = validateChargingEnergyBoundary(boundary);
    if (!validation.valid) {
      throw new Error(`Invalid charging energy boundary: ${validation.issues.join("; ")}`);
    }
    const source = validation.boundary;
    if (boundaryDcEnergyKwh != null) {
      const expectedBoundaryDcKwh = toNonNegativeFiniteNumber(boundaryDcEnergyKwh);
      if (expectedBoundaryDcKwh == null || !nearlyEqual(source.dcKwh, expectedBoundaryDcKwh)) {
        throw new Error("Invalid charging energy boundary: dc_kwh does not match its source energy");
      }
    }
    if (source.dcKwh === 0 && dcKwh > 0) {
      throw new Error("Invalid charging energy boundary: a zero DC boundary cannot scale positive energy");
    }
    gridKwh = source.dcKwh === 0 ? 0 : source.gridKwh * (dcKwh / source.dcKwh);
  } else {
    gridKwh = gridFromDc(dcKwh);
  }

  return {
    policy: CHARGING_ENERGY_POLICY,
    dcKwh,
    gridKwh,
    chargingLossesKwh: gridKwh - dcKwh,
    gridToBusEfficiency: GRID_TO_BUS_EFFICIENCY,
  };
};

const asRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

const text = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

/**
 * Builds the navigation state for the two feasibility-result levels.
 *
 * The general level always references the common fleet/infrastructure model.
 * The detail level selects exactly one physical shift; an aggregate "all"
 * option is deliberately absent because it would mix distinct operations.
 */
export function buildFeasibilityViewState(feasibilityModel = {}, requestedShiftId = null) {
  const model = asRecord(feasibilityModel);
  const sourceShifts = Array.isArray(model.shifts) ? model.shifts : [];
  const shiftOptions = [];
  const seenIds = new Set();

  for (const candidate of sourceShifts) {
    const shift = asRecord(candidate);
    const shiftId = text(shift.shiftId);
    if (!shiftId || seenIds.has(shiftId)) continue;
    seenIds.add(shiftId);
    shiftOptions.push({
      shiftId,
      shiftName: text(shift.shiftName) ?? shiftId,
      shift,
    });
  }

  const requestedId = text(requestedShiftId);
  const selectedShift =
    shiftOptions.find((option) => option.shiftId === requestedId) ??
    shiftOptions[0] ??
    null;
  const fleet = asRecord(model.fleet);
  const battery = asRecord(fleet.battery);
  const infrastructure = asRecord(model.infrastructure);

  return {
    general: {
      fleet,
      battery,
      infrastructure,
      shiftCount: shiftOptions.length,
      sizingShiftNames: Array.isArray(battery.sizingShiftNames)
        ? battery.sizingShiftNames.map(text).filter(Boolean)
        : [],
      mostDemandingShiftNames: Array.isArray(battery.mostDemandingShiftNames)
        ? battery.mostDemandingShiftNames.map(text).filter(Boolean)
        : [],
    },
    shiftOptions,
    showShiftSelector: shiftOptions.length > 1,
    selectedShift,
    selectedShiftId: selectedShift?.shiftId ?? null,
    selectedShiftName: selectedShift?.shiftName ?? null,
  };
}

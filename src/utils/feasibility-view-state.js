const asRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

const text = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const finiteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const nonNegativeNumber = (value) => {
  const normalized = finiteNumber(value);
  return normalized !== null && normalized >= 0 ? normalized : null;
};

const summarizeInfrastructure = (infrastructure) => {
  const stations = Array.isArray(infrastructure.stations)
    ? infrastructure.stations.filter(
        (station) => station !== null && typeof station === "object" && !Array.isArray(station),
      )
    : [];
  const activeStations = stations.filter((station) => station.selected === true);
  const selectionComplete = infrastructure.selectionComplete === true;
  const sumWhenComplete = (field) => {
    if (!selectionComplete) return null;
    const values = activeStations.map((station) => nonNegativeNumber(station[field]));
    if (values.some((value) => value === null)) return activeStations.length ? null : 0;
    return values.reduce((total, value) => total + value, 0);
  };
  const statusCounts = {};
  for (const station of stations) {
    const status = text(station.status) ?? "configured";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  return {
    dataAvailable: infrastructure.dataAvailable === true || stations.length > 0,
    selectionComplete,
    stations,
    activeStationCount: selectionComplete ? activeStations.length : null,
    totalSlots: sumWhenComplete("slots"),
    totalPowerKw: sumWhenComplete("totalPowerKw"),
    totalInstallationCostChf: nonNegativeNumber(
      infrastructure.totalInstallationCostChf,
    ),
    statusCounts,
  };
};

const summarizeSelectedShift = (selectedShift, commonBattery) => {
  if (!selectedShift) return null;
  const shift = asRecord(selectedShift.shift);
  const battery = asRecord(shift.battery);
  const operation = asRecord(shift.operation);
  const requiredPacks =
    nonNegativeNumber(battery.requiredPacks) ??
    nonNegativeNumber(battery.optimizedPacks);
  const commonPacks = nonNegativeNumber(
    battery.commonPacks ?? commonBattery.packs,
  );
  const explicitMargin = finiteNumber(battery.commonPackMargin);
  const commonPackMargin =
    explicitMargin !== null
      ? explicitMargin
      : commonPacks !== null && requiredPacks !== null
        ? commonPacks - requiredPacks
        : null;

  return {
    shiftId: selectedShift.shiftId,
    shiftName: selectedShift.shiftName,
    battery: {
      requiredPacks,
      commonPacks,
      commonPackMargin,
      maxPhysicalPacks: nonNegativeNumber(battery.maxPhysicalPacks),
      excessPacks: nonNegativeNumber(battery.excessPacks),
      physicalFeasible:
        typeof battery.physicalFeasible === "boolean"
          ? battery.physicalFeasible
          : null,
      feasibilityStatus: text(battery.feasibilityStatus),
      isSizing: battery.isSizing === true,
    },
    operation: {
      minSocKwh: nonNegativeNumber(operation.minSocKwh),
      maxSocKwh: nonNegativeNumber(operation.maxSocKwh),
      totalChargedKwh: nonNegativeNumber(operation.totalChargedKwh),
      numChargingSessions: nonNegativeNumber(operation.numChargingSessions),
    },
  };
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
  const infrastructureSummary = summarizeInfrastructure(infrastructure);
  const selectedShiftSummary = summarizeSelectedShift(selectedShift, battery);

  return {
    general: {
      fleet,
      battery,
      infrastructure,
      infrastructureSummary,
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
    selectedShiftSummary,
    selectedShiftId: selectedShift?.shiftId ?? null,
    selectedShiftName: selectedShift?.shiftName ?? null,
  };
}

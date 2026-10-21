const MINUTES_PER_DAY = 24 * 60;

const asRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

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

const nonNegativeInteger = (value) => {
  const normalized = nonNegativeNumber(value);
  return normalized !== null && Number.isInteger(normalized) ? normalized : null;
};

const text = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const chronologicalEndMinute = (startMinute, endMinute, explicitDuration) => {
  if (endMinute === null) {
    return startMinute !== null && explicitDuration !== null
      ? startMinute + explicitDuration
      : null;
  }
  if (startMinute === null || endMinute > startMinute) return endMinute;
  if (endMinute === startMinute) {
    return explicitDuration !== null && explicitDuration > 0
      ? startMinute + explicitDuration
      : endMinute;
  }

  const daySteps = Math.floor((startMinute - endMinute) / MINUTES_PER_DAY) + 1;
  return endMinute + daySteps * MINUTES_PER_DAY;
};

const normalizeSession = (candidate, sourceIndex) => {
  const session = asRecord(candidate);
  const startMinute = nonNegativeInteger(session.startMinute);
  const rawEndMinute = nonNegativeInteger(session.endMinute);
  const explicitDuration = nonNegativeInteger(session.durationMinutes);
  const endMinute = chronologicalEndMinute(
    startMinute,
    rawEndMinute,
    explicitDuration,
  );
  const elapsedDuration =
    startMinute !== null && endMinute !== null
      ? endMinute - startMinute
      : null;
  const durationMinutes = elapsedDuration ?? explicitDuration;
  const energyKwh = nonNegativeNumber(session.energyKwh);
  const stationStopId = text(session.stationStopId);
  const stationName = text(session.stationName);
  const averagePowerKw =
    energyKwh !== null && durationMinutes !== null && durationMinutes > 0
      ? energyKwh * 60 / durationMinutes
      : null;

  return {
    sequence: sourceIndex + 1,
    startMinute,
    endMinute,
    durationMinutes,
    stationStopId,
    stationName,
    energyKwh,
    averagePowerKw,
    detailsComplete:
      startMinute !== null &&
      endMinute !== null &&
      durationMinutes !== null &&
      durationMinutes > 0 &&
      (stationName !== null || stationStopId !== null) &&
      energyKwh !== null,
    _sourceIndex: sourceIndex,
  };
};

/**
 * Produces a defensive view model for one shift's charging plan.
 *
 * A reported count without session rows remains distinguishable from a real
 * zero-session result. Legacy clock-only ranges that cross midnight are moved
 * to the next chronological day for display and duration calculations.
 */
export function buildFeasibilityChargingPlan(operation = {}) {
  const source = asRecord(operation);
  const reportedSessionCount = nonNegativeInteger(source.numChargingSessions);
  const sourceSessions = Array.isArray(source.chargingSessions)
    ? source.chargingSessions
    : [];
  const sessions = sourceSessions
    .filter((session) =>
      session !== null && typeof session === "object" && !Array.isArray(session),
    )
    .map(normalizeSession)
    .sort((left, right) => {
      const leftStart = left.startMinute ?? Number.POSITIVE_INFINITY;
      const rightStart = right.startMinute ?? Number.POSITIVE_INFINITY;
      return leftStart - rightStart || left._sourceIndex - right._sourceIndex;
    })
    .map(({ _sourceIndex, ...session }, index) => ({
      ...session,
      sequence: index + 1,
    }));
  const detailedSessionCount = sessions.length;
  const expectedSessionCount = reportedSessionCount ?? detailedSessionCount;
  const countsMatch =
    reportedSessionCount === null ||
    reportedSessionCount === detailedSessionCount;
  const rowsComplete = sessions.every((session) => session.detailsComplete);

  let status = "unavailable";
  if (detailedSessionCount > 0) {
    status = countsMatch && rowsComplete ? "complete" : "partial";
  } else if (reportedSessionCount === 0) {
    status = "empty";
  }

  return {
    status,
    reportedSessionCount,
    detailedSessionCount,
    expectedSessionCount,
    sessions,
  };
}

export function formatFeasibilityClockMinute(value) {
  const minute = nonNegativeInteger(value);
  if (minute === null) return null;
  const dayOffset = Math.floor(minute / MINUTES_PER_DAY);
  const minuteOfDay = minute % MINUTES_PER_DAY;
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;

  return {
    clock: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    dayOffset,
  };
}

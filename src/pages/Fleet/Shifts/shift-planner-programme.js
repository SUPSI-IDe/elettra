export const plannerTimeSeconds = (time) => {
  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(String(time ?? "").trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
};

export const plannerTime = (seconds) => {
  if (!Number.isInteger(seconds) || seconds < 0) return "";
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
};

export const plannerInputTime = (value) => {
  const seconds = typeof value === "number" ? value : plannerTimeSeconds(value);
  const canonical = plannerTime(seconds);
  return canonical.endsWith(":00") ? canonical.slice(0, -3) : canonical;
};

export const plannerDisplayTime = (value) => {
  const seconds = typeof value === "number" ? value : plannerTimeSeconds(value);
  if (seconds === null) return "";
  const day = Math.floor(seconds / 86400);
  const clock = plannerInputTime(seconds % 86400);
  return day ? `${clock} (+${day})` : clock;
};

export const isDirectConnection = (from, to) => Boolean(
  from?.stopId && to?.stopId &&
  (from.stopId === to.stopId || (from.parent && from.parent === to.parent))
);

const tripStop = (trip, end) => ({
  stopId: trip?.[`${end}_stop_id`],
  parent: trip?.[`${end}_parent`],
  name: trip?.[`${end}_name`],
  kind: "terminus",
});

export const plannerDepotStop = (depot) => ({
  stopId: depot?.stop_id,
  name: depot?.name ?? depot?.label,
  kind: "depot",
});

const defaultTripArrival = (trip, earliest) => {
  const publicDeparture = plannerTimeSeconds(trip?.departure_time);
  const scheduledArrival = plannerTimeSeconds(trip?.first_arrival);
  return scheduledArrival !== null && scheduledArrival >= earliest && scheduledArrival <= publicDeparture
    ? scheduledArrival : publicDeparture;
};

export const selectPlannerTrips = (catalog, previous, usedIds, { includeOtherTermini = false } = {}) => {
  if (previous?.time == null) return [];
  const onlyDirect = previous.kind === "terminus" && !includeOtherTermini;
  return catalog
    .filter((trip) => {
      const departure = plannerTimeSeconds(trip.departure_time);
      const arrival = plannerTimeSeconds(trip.arrival_time);
      return !usedIds.has(trip.id) && departure !== null && arrival !== null &&
        departure >= previous.time && arrival >= departure;
    })
    .map((trip) => ({ trip, direct: isDirectConnection(previous, tripStop(trip, "from")) }))
    .filter(({ direct }) => !onlyDirect || direct)
    .sort((left, right) =>
      plannerTimeSeconds(left.trip.departure_time) - plannerTimeSeconds(right.trip.departure_time) ||
      plannerTimeSeconds(left.trip.arrival_time) - plannerTimeSeconds(right.trip.arrival_time) ||
      left.trip.id.localeCompare(right.trip.id));
};

export const getPlannerStart = (depotId, startTime, depots) => ({
  ...plannerDepotStop(depots.get(depotId)),
  time: plannerTimeSeconds(startTime),
});

export const evaluatePlannerStep = (step, previous, { trips, depots, depotId }, first) => {
  const trip = trips.get(step.trip_id);
  const kind = step.kind;
  const target = kind === "service" ? tripStop(trip, "from")
    : plannerDepotStop(depots.get(kind === "stay" ? step.depot_id : depotId));
  const direct = isDirectConnection(previous, target) && !step.force_transfer;
  const serviceDeparture = plannerTimeSeconds(trip?.departure_time);
  const serviceArrival = plannerTimeSeconds(trip?.arrival_time);
  const transferDeparture = step.transfer_departure != null
    ? plannerTimeSeconds(step.transfer_departure) : previous.time;
  const transferArrival = kind === "service"
    ? step.transfer_arrival != null
      ? plannerTimeSeconds(step.transfer_arrival)
      : defaultTripArrival(trip, transferDeparture + Number(!direct && previous.stopId !== target.stopId))
    : plannerTimeSeconds(step.arrival);
  const stayDeparture = plannerTimeSeconds(step.departure);
  const errors = [];

  if (!previous.stopId || !target.stopId || (kind === "service" && !trip?.to_stop_id)) {
    errors.push("missing_location");
  }
  if (previous.time === null || transferDeparture === null || transferArrival === null) {
    errors.push("time_format");
  } else if (transferDeparture < previous.time || (first && transferDeparture !== previous.time)) {
    errors.push(first ? "start_departure" : "departure_conflict");
  } else if (transferArrival < transferDeparture) {
    errors.push("transfer_conflict");
  } else if (previous.stopId && target.stopId) {
    if (!direct && previous.stopId !== target.stopId && transferArrival === transferDeparture) {
      errors.push("positive_transfer");
    } else if ((kind !== "service" || step.force_transfer) && previous.stopId === target.stopId &&
      transferArrival !== transferDeparture) {
      errors.push("same_stop_transfer");
    }
  }
  if (kind === "service" && (serviceDeparture === null || serviceArrival === null ||
      serviceArrival < serviceDeparture ||
      (transferArrival !== null && transferArrival > serviceDeparture))) {
    errors.push("service_conflict");
  }
  if (kind === "stay" && (stayDeparture === null || (transferArrival !== null && stayDeparture < transferArrival))) {
    errors.push("stay_conflict");
  }

  const next = kind === "service" ? { ...tripStop(trip, "to"), time: serviceArrival }
    : { ...target, time: kind === "stay" ? stayDeparture : transferArrival };

  return {
    step, trip, target, next, direct, errors, transferDeparture, transferArrival,
    route: !direct && previous.stopId && target.stopId ? { from: previous.stopId, to: target.stopId } : null,
    availableSeconds: transferDeparture !== null && transferArrival !== null
      ? transferArrival - transferDeparture : null,
  };
};

export const evaluatePlannerProgramme = (steps, start, context) => {
  let previous = start;
  const usedIds = new Set();
  return steps.map((step, index) => {
    const result = evaluatePlannerStep(step, previous, context, index === 0);
    if (steps[index - 1]?.kind === "return" || (step.kind === "return" && index !== steps.length - 1)) {
      result.errors.push("return_last");
    }
    if (step.kind === "service") {
      if (usedIds.has(step.trip_id)) result.errors.push("duplicate_trip");
      usedIds.add(step.trip_id);
    }
    previous = result.next;
    return result;
  });
};

export const canonicalPlannerStep = (step, evaluation) => {
  const transfer = { transfer_departure: plannerTime(evaluation.transferDeparture) };
  if (step.kind === "service") {
    return {
      kind: step.kind, trip_id: step.trip_id, ...transfer,
      transfer_arrival: plannerTime(evaluation.transferArrival),
      ...(step.force_transfer ? { force_transfer: true } : {}),
    };
  }
  if (step.kind === "stay") {
    return {
      kind: step.kind, depot_id: step.depot_id, ...transfer,
      arrival: plannerTime(evaluation.transferArrival), departure: plannerTime(evaluation.next.time),
    };
  }
  return { kind: "return", ...transfer, arrival: plannerTime(evaluation.transferArrival) };
};

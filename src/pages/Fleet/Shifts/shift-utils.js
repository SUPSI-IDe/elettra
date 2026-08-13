export const text = (value) =>
  value === null || value === undefined ? "" : String(value);

export const firstAvailable = (...values) => {
  for (const value of values) {
    const result = text(value).trim();
    if (result) {
      return result;
    }
  }
  return "";
};

export const normalizeTime = (value) => {
  const raw = firstAvailable(value);
  if (!raw) {
    return "";
  }

  if (raw.includes("T")) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const hours = String(parsed.getHours()).padStart(2, "0");
      const minutes = String(parsed.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    }
  }

  const timeMatch = raw.match(/^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hours = String(Number.parseInt(timeMatch[1], 10)).padStart(2, "0");
    const minutes = timeMatch[2];
    return `${hours}:${minutes}`;
  }

  return raw;
};

export const resolveStopNameFromTimes = (times = [], position = "first") => {
  if (!Array.isArray(times) || times.length === 0) {
    return "";
  }

  const index = position === "last" ? times.length - 1 : 0;
  const entry = times[index] ?? {};

  return firstAvailable(
    entry?.stop_name,
    entry?.stopName,
    entry?.name,
    entry?.stop?.name,
    entry?.stop?.stop_name,
    entry?.stop?.label
  );
};

export const resolveRouteLabel = (trip = {}, fallbackLabel = "") =>
  firstAvailable(
    trip?.route_label,
    trip?.routeLabel,
    trip?.route_short_name,
    trip?.routeShortName,
    trip?.route_long_name,
    trip?.routeLongName,
    trip?.route?.label,
    trip?.route?.name,
    trip?.route?.route_short_name,
    trip?.route?.route_long_name,
    trip?.route?.short_name,
    trip?.route?.long_name,
    trip?.trip_headsign,
    fallbackLabel
  );

export const resolveRouteId = (trip = {}) =>
  firstAvailable(
    trip?.route_id,
    trip?.routeId,
    trip?.route?.id,
    trip?.route?.route_id,
    trip?.trip?.route_id,
    trip?.trip?.routeId,
    trip?.trip?.route?.id,
    trip?.trip?.route?.route_id
  );

export const resolveTripId = (trip = {}) =>
  firstAvailable(trip?.trip_id, trip?.tripId, trip?.id);

// Resolves the database primary key (UUID) for a trip, used for shift API calls
export const resolveTripPk = (trip = {}) =>
  firstAvailable(
    trip?.pk,
    trip?.trip_pk,
    trip?.tripPk,
    trip?.trip?.pk,
    trip?.trip?.trip_pk
  );

const normalizeStopName = (name) => String(name ?? "").trim();

export const normalizeTrip = (trip = {}) => {
  const stopTimes =
    Array.isArray(trip?.stop_times) && trip.stop_times.length > 0
      ? trip.stop_times
      : Array.isArray(trip?.trip?.stop_times) && trip.trip.stop_times.length > 0
      ? trip.trip.stop_times
      : [];

  const stops =
    Array.isArray(trip?.stops) && trip.stops.length > 0
      ? trip.stops
      : Array.isArray(trip?.trip?.stops) && trip.trip.stops.length > 0
      ? trip.trip.stops
      : [];

  const startStop =
    trip?.start_stop ??
    trip?.startStop ??
    trip?.origin_stop ??
    trip?.originStop ??
    trip?.origin ??
    trip?.trip?.start_stop ??
    trip?.trip?.startStop ??
    {};

  const endStop =
    trip?.end_stop ??
    trip?.endStop ??
    trip?.destination_stop ??
    trip?.destinationStop ??
    trip?.destination ??
    trip?.trip?.end_stop ??
    trip?.trip?.endStop ??
    {};

  // Preserve the original UUID id, use trip_id for GTFS identifier
  const originalId = firstAvailable(trip?.id, trip?.trip?.id);
  const tripId = firstAvailable(trip?.trip_id, trip?.tripId, trip?.id);
  const routeId = resolveRouteId(trip);

  const startName = firstAvailable(
    trip?.start_stop_name,
    trip?.startStopName,
    startStop?.name,
    startStop?.label,
    startStop?.stop_name,
    startStop?.stop?.name,
    resolveStopNameFromTimes(stopTimes, "first"),
    resolveStopNameFromTimes(stops, "first")
  );

  const endName = firstAvailable(
    trip?.end_stop_name,
    trip?.endStopName,
    endStop?.name,
    endStop?.label,
    endStop?.stop_name,
    endStop?.stop?.name,
    resolveStopNameFromTimes(stopTimes, "last"),
    resolveStopNameFromTimes(stops, "last")
  );

  const departureTime = normalizeTime(
    firstAvailable(
      trip?.departure_time,
      trip?.departureTime,
      trip?.start_time,
      trip?.startTime,
      trip?.time,
      trip?.trip?.departure_time,
      trip?.trip?.departureTime,
      trip?.trip?.start_time,
      trip?.trip?.startTime,
      stopTimes[0]?.departure_time,
      stopTimes[0]?.departureTime
    )
  );

  const arrivalTime = normalizeTime(
    firstAvailable(
      trip?.arrival_time,
      trip?.arrivalTime,
      trip?.end_time,
      trip?.endTime,
      trip?.trip?.arrival_time,
      trip?.trip?.arrivalTime,
      trip?.trip?.end_time,
      trip?.trip?.endTime,
      stopTimes[stopTimes.length - 1]?.arrival_time,
      stopTimes[stopTimes.length - 1]?.arrivalTime
    )
  );

  const routeLabel = resolveRouteLabel(trip);

  // Preserve day_of_week from the trip data
  const dayOfWeek = firstAvailable(
    trip?.day_of_week,
    trip?.dayOfWeek,
    trip?.service_day,
    trip?.serviceDay,
    trip?.trip?.day_of_week,
    trip?.trip?.dayOfWeek,
    trip?.trip?.service_day,
    trip?.trip?.serviceDay
  );

  return {
    ...trip,
    id: originalId || tripId,
    trip_id: tripId,
    route_id: routeId,
    route_label: routeLabel,
    day_of_week: dayOfWeek || trip?.day_of_week,
    start_stop_name: startName,
    end_stop_name: endName,
    departure_time: departureTime,
    arrival_time: arrivalTime || departureTime,
  };
};

export const evaluateTripEligibility = ({
  trip,
  selectedTripIds = new Set(),
  lastTripEndTime = null,
  lastTripEndStop = null,
  shiftStartTime = null,
  shiftEndTime = null,
} = {}) => {
  const normalized = normalizeTrip(trip);
  const id = resolveTripId(normalized);

  if (!id) {
    return { valid: false, reason: "missing_id", trip: normalized };
  }

  if (selectedTripIds.has(id)) {
    return { valid: false, reason: "selected", trip: normalized };
  }

  const departure =
    normalized?.departure_time ?? normalized?.departureTime ?? "";
  const arrival =
    normalized?.arrival_time ??
    normalized?.arrivalTime ??
    normalized?.departure_time ??
    normalized?.departureTime ??
    "";
  const startStop = normalizeStopName(
    normalized?.start_stop_name ?? normalized?.startStopName ?? ""
  );
  const endStop = normalizeStopName(lastTripEndStop);
  const hasSelectedTrips = selectedTripIds.size > 0;

  if (shiftStartTime && departure && departure < shiftStartTime) {
    return {
      valid: false,
      reason: "before_shift_start",
      trip: normalized,
      departure,
      boundary: shiftStartTime,
    };
  }

  if (shiftEndTime && arrival && arrival > shiftEndTime) {
    return {
      valid: false,
      reason: "after_shift_end",
      trip: normalized,
      arrival,
      boundary: shiftEndTime,
    };
  }

  if (hasSelectedTrips && endStop && startStop && startStop !== endStop) {
    return {
      valid: false,
      reason: "location_mismatch",
      trip: normalized,
      startStop,
      endStop,
    };
  }

  if (hasSelectedTrips && lastTripEndTime && departure && departure < lastTripEndTime) {
    return {
      valid: false,
      reason: "overlap",
      trip: normalized,
      departure,
      boundary: lastTripEndTime,
    };
  }

  return { valid: true, reason: null, trip: normalized };
};

export const getEligibleScheduledTrips = ({
  trips = [],
  selectedTripIds = new Set(),
  lastTripEndTime = null,
  lastTripEndStop = null,
  shiftStartTime = null,
  shiftEndTime = null,
} = {}) =>
  (Array.isArray(trips) ? trips : [])
    .map((trip) =>
      evaluateTripEligibility({
        trip,
        selectedTripIds,
        lastTripEndTime,
        lastTripEndStop,
        shiftStartTime,
        shiftEndTime,
      })
    )
    .filter((result) => result.valid)
    .map((result) => result.trip);

export const readShiftTripsFromStructure = (shift = {}) => {
  const structure = Array.isArray(shift?.structure) ? shift.structure : [];
  if (structure.length === 0) {
    return [];
  }

  return structure
    .map((item = {}) => {
      const trip = item?.trip ?? {};
      // Preserve the database UUID from item.trip_id as the 'id' field
      // This is critical for API calls (elevation, stops, etc.)
      const dbUuid = item?.trip_id;
      const combined = { ...item, ...trip, trip, id: dbUuid };
      const normalized = normalizeTrip(combined);
      return normalized.trip_id ? normalized : null;
    })
    .filter(Boolean);
};

// Build the payload used to duplicate a shift.
//
// The shift detail (GET /shifts/{id}) exposes its trips through `structure`,
// where each item's `trip_id` is the trip's database UUID (the value the
// create endpoint expects in `trip_ids`).  Items are ordered here by
// `sequence_number` so the copy preserves the original trip order even if the
// API returns the structure unsorted.  `busId` uses the same fallbacks as the
// create/edit form so nested `bus` payloads are handled too.
export const buildDuplicateShiftPayload = (
  shift = {},
  { copySuffix = "", untitledLabel = "" } = {}
) => {
  const baseName = text(shift?.name).trim() || untitledLabel;
  const name = `${baseName} ${copySuffix}`.trim();

  const busId = firstAvailable(
    shift?.bus_id,
    shift?.busId,
    shift?.bus?.id,
    shift?.bus?.bus_id
  );

  const structure = Array.isArray(shift?.structure) ? shift.structure : [];
  const tripIds = structure
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftSeq = Number(left.item?.sequence_number);
      const rightSeq = Number(right.item?.sequence_number);
      const leftHas = Number.isFinite(leftSeq);
      const rightHas = Number.isFinite(rightSeq);
      if (leftHas && rightHas && leftSeq !== rightSeq) {
        return leftSeq - rightSeq;
      }
      if (leftHas && !rightHas) return -1;
      if (!leftHas && rightHas) return 1;
      return left.index - right.index;
    })
    .map(({ item = {} }) => text(item?.trip_id ?? item?.tripId ?? "").trim())
    .filter((value) => value.length > 0);

  return { name, busId, tripIds };
};

export const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export const getNextDay = (day) => {
  const index = DAYS_OF_WEEK.findIndex((d) => d.value === day?.toLowerCase());
  if (index === -1) return null;
  return DAYS_OF_WEEK[(index + 1) % 7].value;
};

export const parseTimeToMinutes = (time) => {
  const match = /^\s*(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

export const formatMinutes = (value) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  const hours = Math.max(0, Math.min(23, Math.floor(value / 60)));
  const minutes = Math.max(0, Math.min(59, Math.round(value % 60)));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const computeTimeBounds = (trips = []) => {
  const departures = trips
    .map((trip = {}) => parseTimeToMinutes(trip?.departure_time))
    .filter((value) => Number.isFinite(value));
  const arrivals = trips
    .map((trip = {}) => parseTimeToMinutes(trip?.arrival_time))
    .filter((value) => Number.isFinite(value));

  const earliest = departures.length ? Math.min(...departures) : null;
  const latest = arrivals.length ? Math.max(...arrivals) : null;

  return { earliest, latest };
};

const extractStopDbId = (stopTime) => text(stopTime?.id).trim();

export const findLoadedDepotByStopDbId = (stopDbId, loadedDepots = []) => {
  const candidate = text(stopDbId).trim();
  if (!candidate) {
    return null;
  }
  return (
    loadedDepots.find((depot) => text(depot?.stop_id).trim() === candidate) ??
    null
  );
};

const findLoadedDepotByName = (name, loadedDepots = []) => {
  const candidate = text(name).trim();
  if (!candidate) {
    return null;
  }
  const normalized = candidate.toLowerCase();
  return (
    loadedDepots.find(
      (depot) => text(depot?.name ?? depot?.label).trim().toLowerCase() === normalized
    ) ?? null
  );
};

const isGtfsServiceLeg = (leg = {}) => {
  const gtfsTripId = text(leg?.gtfs_trip_id).trim();
  return gtfsTripId.length > 0 && !gtfsTripId.startsWith("depot-");
};

const isTransferAuxLeg = (leg = {}) => {
  const gtfsTripId = text(leg?.gtfs_trip_id).trim();
  if (!gtfsTripId.startsWith("depot-")) {
    return false;
  }
  const start = text(leg?.start_stop_name).trim();
  const end = text(leg?.end_stop_name).trim();
  return Boolean(start && end && start !== end);
};

export const mergeStructureWithInfoTrips = (structure = [], infoTrips = []) => {
  const infoById = new Map(
    (Array.isArray(infoTrips) ? infoTrips : [])
      .filter((trip) => text(trip?.id).trim())
      .map((trip) => [text(trip.id), trip])
  );

  return (Array.isArray(structure) ? structure : [])
    .map((item, index) => {
      const tripDbId = text(item?.trip_id ?? item?.tripId ?? "");
      const info = infoById.get(tripDbId) ?? {};
      const stopTimes =
        Array.isArray(item?.stop_times) && item.stop_times.length > 0 ?
          item.stop_times
        : Array.isArray(item?.trip?.stop_times) && item.trip.stop_times.length > 0 ?
          item.trip.stop_times
        : [];

      return {
        ...item,
        trip_db_id: tripDbId,
        sequence_number: item?.sequence_number ?? index + 1,
        gtfs_trip_id: text(info?.trip_id ?? info?.tripId ?? ""),
        start_stop_name: text(
          info?.start_stop_name ?? info?.startStopName ?? ""
        ),
        end_stop_name: text(info?.end_stop_name ?? info?.endStopName ?? ""),
        stop_times: stopTimes,
      };
    })
    .sort((left, right) => {
      const leftSeq = Number(left?.sequence_number);
      const rightSeq = Number(right?.sequence_number);
      if (Number.isFinite(leftSeq) && Number.isFinite(rightSeq) && leftSeq !== rightSeq) {
        return leftSeq - rightSeq;
      }
      return 0;
    });
};

const selectOutboundDepotLeg = (legs = []) => {
  const firstServiceLeg = legs.find(isGtfsServiceLeg);
  if (!firstServiceLeg) {
    return null;
  }

  const firstServiceSeq = Number(firstServiceLeg.sequence_number);
  const firstServiceStartId = extractStopDbId(firstServiceLeg.stop_times?.[0]);
  const candidates = legs.filter(
    (leg) =>
      isTransferAuxLeg(leg) &&
      Number(leg.sequence_number) < firstServiceSeq
  );
  if (!candidates.length) {
    return null;
  }

  const bySequenceDesc = [...candidates].sort(
    (left, right) => Number(right.sequence_number) - Number(left.sequence_number)
  );
  const connectsToFirstService = (leg) => {
    const lastStop = leg.stop_times?.[leg.stop_times.length - 1];
    const outboundEndId = extractStopDbId(lastStop);
    return Boolean(firstServiceStartId && outboundEndId === firstServiceStartId);
  };

  if (connectsToFirstService(bySequenceDesc[0])) {
    return bySequenceDesc[0];
  }
  return bySequenceDesc.find(connectsToFirstService) ?? null;
};

const selectReturnDepotLeg = (legs = []) => {
  const lastServiceLeg = [...legs].reverse().find(isGtfsServiceLeg);
  if (!lastServiceLeg) {
    return null;
  }

  const lastServiceSeq = Number(lastServiceLeg.sequence_number);
  const lastServiceEndId = extractStopDbId(
    lastServiceLeg.stop_times?.[lastServiceLeg.stop_times.length - 1]
  );
  const candidates = legs.filter(
    (leg) =>
      isTransferAuxLeg(leg) &&
      Number(leg.sequence_number) > lastServiceSeq
  );
  if (!candidates.length) {
    return null;
  }

  const bySequenceAsc = [...candidates].sort(
    (left, right) => Number(left.sequence_number) - Number(right.sequence_number)
  );
  const connectsFromLastService = (leg) => {
    const returnStartId = extractStopDbId(leg.stop_times?.[0]);
    return Boolean(lastServiceEndId && returnStartId === lastServiceEndId);
  };

  if (connectsFromLastService(bySequenceAsc[0])) {
    return bySequenceAsc[0];
  }
  return bySequenceAsc.find(connectsFromLastService) ?? null;
};

const resolveDepotIdFromLegSide = (leg, side, loadedDepots = []) => {
  if (!leg) {
    return "";
  }

  const stopTimes = Array.isArray(leg.stop_times) ? leg.stop_times : [];
  if (!stopTimes.length) {
    return "";
  }

  const stopTime =
    side === "start" ? stopTimes[0] : stopTimes[stopTimes.length - 1];
  const depot = findLoadedDepotByStopDbId(extractStopDbId(stopTime), loadedDepots);
  if (depot?.id) {
    return text(depot.id);
  }

  const fallbackName =
    side === "start" ?
      text(leg.start_stop_name).trim()
    : text(leg.end_stop_name).trim();
  const byName = findLoadedDepotByName(fallbackName, loadedDepots);
  return byName?.id ? text(byName.id) : "";
};

export const resolveDepotPrefillFromStructure = ({
  shift = {},
  shiftInfo = null,
  loadedDepots = [],
} = {}) => {
  const legs = mergeStructureWithInfoTrips(
    shift?.structure,
    shiftInfo?.trips
  );
  const outboundLeg = selectOutboundDepotLeg(legs);
  const returnLeg = selectReturnDepotLeg(legs);

  return {
    startDepotId: resolveDepotIdFromLegSide(outboundLeg, "start", loadedDepots),
    endDepotId: resolveDepotIdFromLegSide(returnLeg, "end", loadedDepots),
  };
};

export const resolveShiftDepotIds = ({
  shift = {},
  shiftInfo = null,
  loadedDepots = [],
} = {}) => {
  const explicitStartDepotId = firstAvailable(
    shift?.start_depot_id,
    shift?.startDepotId,
    shift?.start_depot?.id,
    shift?.startDepot?.id
  );
  const explicitEndDepotId = firstAvailable(
    shift?.end_depot_id,
    shift?.endDepotId,
    shift?.end_depot?.id,
    shift?.endDepot?.id
  );
  const inferred = resolveDepotPrefillFromStructure({
    shift,
    shiftInfo,
    loadedDepots,
  });

  return {
    startDepotId: explicitStartDepotId || inferred.startDepotId,
    endDepotId: explicitEndDepotId || inferred.endDepotId,
  };
};

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

  return {
    ...trip,
    id: originalId || tripId,
    trip_id: tripId,
    route_id: routeId,
    route_label: routeLabel,
    start_stop_name: startName,
    end_stop_name: endName,
    departure_time: departureTime,
    arrival_time: arrivalTime || departureTime,
  };
};

export const readShiftTripsFromStructure = (shift = {}) => {
  const structure = Array.isArray(shift?.structure) ? shift.structure : [];
  if (structure.length === 0) {
    return [];
  }

  return structure
    .map((item = {}) => {
      const trip = item?.trip ?? {};
      const combined = { ...item, ...trip, trip };
      const normalized = normalizeTrip(combined);
      return normalized.trip_id ? normalized : null;
    })
    .filter(Boolean);
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

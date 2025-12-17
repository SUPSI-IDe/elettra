import { authHeaders, API_ROOT } from "./client";

const GTFS_ROUTES_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-routes/`;
const GTFS_DAYS_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-days/`;
const GTFS_TRIPS_BY_ROUTE_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-trips/by-route/`;
const GTFS_STOPS_BY_TRIP_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-stops/by-trip/`;

export const fetchRoutes = async ({
  skip = 0,
  limit = 100,
  gtfs_year,
  gtfs_file_date,
} = {}) => {
  const headers = authHeaders();
  const params = new URLSearchParams();
  params.set("skip", String(skip));
  params.set("limit", String(limit));
  if (gtfs_year !== undefined && gtfs_year !== null) {
    params.set("gtfs_year", String(gtfs_year));
  }
  if (gtfs_file_date) {
    params.set("gtfs_file_date", gtfs_file_date);
  }
  const query = params.toString();
  const url = query ? `${GTFS_ROUTES_PATH}?${query}` : GTFS_ROUTES_PATH;

  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load routes.";
    throw new Error(message);
  }
  return payload;
};

export const fetchServiceDays = async () => {
  const headers = authHeaders();
  const response = await fetch(GTFS_DAYS_PATH, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load service days.";
    throw new Error(message);
  }
  return payload;
};

export const fetchTripsByRoute = async ({
  routeId,
  dayOfWeek,
  status = "gtfs",
} = {}) => {
  if (!routeId) {
    throw new Error("Missing routeId");
  }
  if (!dayOfWeek) {
    throw new Error("Missing dayOfWeek");
  }
  const headers = authHeaders();
  const params = new URLSearchParams();
  params.set("day_of_week", dayOfWeek);
  if (status) {
    params.set("status", status);
  }
  const query = params.toString();
  const url = `${GTFS_TRIPS_BY_ROUTE_PATH}${encodeURIComponent(routeId)}${
    query ? `?${query}` : ""
  }`;

  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load trips.";
    throw new Error(message);
  }
  return payload;
};

export const fetchStopsByTripId = async (tripId) => {
  if (!tripId) {
    throw new Error("Missing tripId");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${GTFS_STOPS_BY_TRIP_PATH}${encodeURIComponent(tripId)}`,
    {
      method: "GET",
      headers,
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load stops for trip.";
    throw new Error(message);
  }
  return payload;
};

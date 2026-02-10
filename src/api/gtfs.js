import { authHeaders, API_ROOT } from "./client";

const AGENCIES_PATH = `${API_ROOT}/api/v1/agency/agencies/`;
const GTFS_ROUTES_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-routes/`;
const GTFS_ROUTES_BY_AGENCY_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-routes/by-agency/`;
const GTFS_DAYS_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-days/`;
const GTFS_TRIPS_BY_ROUTE_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-trips/by-route/`;
const GTFS_STOPS_BY_TRIP_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-stops/by-trip/`;

export const fetchAgencies = async ({ skip = 0, limit = 500 } = {}) => {
  const params = new URLSearchParams();
  params.set("skip", String(skip));
  params.set("limit", String(limit));
  const query = params.toString();
  const url = query ? `${AGENCIES_PATH}?${query}` : AGENCIES_PATH;

  // No auth required for listing agencies during registration
  const response = await fetch(url, { method: "GET" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load agencies.";
    throw new Error(message);
  }
  return payload;
};

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

export const fetchRoutesByAgency = async (agencyId, { skip = 0, limit = 100 } = {}) => {
  if (!agencyId) {
    throw new Error("Missing agencyId");
  }
  const headers = authHeaders();
  const params = new URLSearchParams();
  params.set("skip", String(skip));
  params.set("limit", String(limit));
  const query = params.toString();
  const url = `${GTFS_ROUTES_BY_AGENCY_PATH}${encodeURIComponent(agencyId)}${query ? `?${query}` : ""}`;

  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load routes for agency.";
    throw new Error(message);
  }
  return payload;
};

export const fetchRoutesByAgencyWithVariant1 = async (agencyId) => {
  if (!agencyId) {
    throw new Error("Missing agencyId");
  }
  const headers = authHeaders();
  const url = `${GTFS_ROUTES_BY_AGENCY_PATH}${encodeURIComponent(agencyId)}/with-variant-1`;

  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load routes with variants for agency.";
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

const GTFS_ELEVATION_PATH = `${API_ROOT}/api/v1/gtfs/elevation-profile/by-trip/`;
const GTFS_VARIANTS_PATH = `${API_ROOT}/api/v1/gtfs/variants/`;

export const fetchElevationByTripId = async (tripId) => {
  if (!tripId) {
    throw new Error("Missing tripId");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${GTFS_ELEVATION_PATH}${encodeURIComponent(tripId)}`,
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
      "Unable to load elevation profile.";
    throw new Error(message);
  }
  return payload;
};

export const fetchVariantsByRoute = async (routeId) => {
  if (!routeId) {
    throw new Error("Missing routeId");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${GTFS_VARIANTS_PATH}by-route/${encodeURIComponent(routeId)}`,
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
      "Unable to load route variants.";
    throw new Error(message);
  }
  return payload;
};

export const fetchVariant = async (routeId, variantNum) => {
  if (!routeId) {
    throw new Error("Missing routeId");
  }
  if (variantNum === undefined || variantNum === null) {
    throw new Error("Missing variantNum");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${GTFS_VARIANTS_PATH}${encodeURIComponent(routeId)}/${encodeURIComponent(variantNum)}`,
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
      "Unable to load route variant.";
    throw new Error(message);
  }
  return payload;
};

const GTFS_CALENDAR_BY_TRIP_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-calendar/by-trip/`;
const GTFS_TRIPS_PATH = `${API_ROOT}/api/v1/gtfs/gtfs-trips/`;

/**
 * Fetch a single trip by its ID (UUID)
 * Returns trip details including route_id
 */
export const fetchTripById = async (tripId) => {
  if (!tripId) {
    throw new Error("Missing tripId");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${GTFS_TRIPS_PATH}${encodeURIComponent(tripId)}`,
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
      "Unable to load trip.";
    throw new Error(message);
  }
  return payload;
};

export const fetchCalendarByTripId = async (tripId) => {
  if (!tripId) {
    throw new Error("Missing tripId");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${GTFS_CALENDAR_BY_TRIP_PATH}${encodeURIComponent(tripId)}`,
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
      "Unable to load calendar for trip.";
    throw new Error(message);
  }
  return payload;
};

const AUX_TRIP_PATH = `${API_ROOT}/api/v1/gtfs/aux-trip`;

/**
 * Create an auxiliary trip (deadhead/depot trip)
 * Used for depot → first stop and last stop → depot segments
 * 
 * @param {Object} params
 * @param {string} params.departureStopId - The departure stop ID (GTFS stop ID)
 * @param {string} params.arrivalStopId - The arrival stop ID (GTFS stop ID)
 * @param {string} params.departureTime - Departure time (HH:MM:SS format)
 * @param {string} params.arrivalTime - Arrival time (HH:MM:SS format)
 * @param {string} params.routeId - Route ID (required)
 * @param {string} [params.status] - Trip status (e.g., "depot", "transfer")
 * @returns {Promise<Object>} The created auxiliary trip
 */
export const createAuxiliaryTrip = async ({
  departureStopId,
  arrivalStopId,
  departureTime,
  arrivalTime,
  routeId,
  status = "depot",
} = {}) => {
  if (!departureStopId) {
    throw new Error("Missing departureStopId for auxiliary trip");
  }
  if (!arrivalStopId) {
    throw new Error("Missing arrivalStopId for auxiliary trip");
  }
  if (!departureTime) {
    throw new Error("Missing departureTime for auxiliary trip");
  }
  if (!routeId) {
    throw new Error("Missing routeId for auxiliary trip");
  }
  
  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };
  
  // Ensure times are in HH:MM:SS format
  const formatTime = (t) => {
    if (!t) return null;
    const cleaned = String(t).trim();
    // If already HH:MM:SS, return as-is
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(cleaned)) return cleaned;
    // If HH:MM, add :00
    if (/^\d{1,2}:\d{2}$/.test(cleaned)) return `${cleaned}:00`;
    return cleaned;
  };
  
  const body = {
    departure_stop_id: departureStopId,
    arrival_stop_id: arrivalStopId,
    departure_time: formatTime(departureTime),
    arrival_time: formatTime(arrivalTime) || formatTime(departureTime),
    route_id: routeId,
    status,
  };
  
  console.debug("[AUX-TRIP] Creating auxiliary trip with payload:", body);
  
  const response = await fetch(AUX_TRIP_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to create auxiliary trip.";
    console.error("[AUX-TRIP] Failed to create auxiliary trip:", message, payload);
    throw new Error(message);
  }
  console.debug("[AUX-TRIP] Created auxiliary trip:", payload);
  return payload;
};


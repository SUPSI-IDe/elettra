import { authHeaders, API_ROOT } from "./client";
import {
  buildPaginationParams,
  fetchAllPages,
  normalizePaginatedResponse,
} from "./pagination";
import { createShiftIndex } from "./shift-index";

const SHIFTS_PATH = `${API_ROOT}/api/v1/user/shifts/`;

/**
 * Fetch a page of the current user's shifts.
 *
 * The list endpoint returns the lightweight `ShiftListItemRead` schema
 * (id, name, bus_id, trip_count) wrapped in the standard paginated
 * envelope.  When the full structure (trips/stops) is needed, call
 * `fetchShiftById`.  Existing `bus_id`/`user_id` filters are preserved.
 *
 * @param {{ skip?: number, limit?: 20 | 50 | 100, busId?: string, userId?: string }} [params]
 */
export const fetchShifts = async ({
  skip = 0,
  limit = 20,
  busId = "",
  userId = "",
} = {}) => {
  const headers = authHeaders();
  const { skip: normalizedSkip, limit: normalizedLimit } = buildPaginationParams(
    skip,
    limit
  );
  const params = new URLSearchParams();
  params.set("skip", String(normalizedSkip));
  params.set("limit", String(normalizedLimit));
  if (busId) {
    params.set("bus_id", busId);
  }
  if (userId) {
    params.set("user_id", userId);
  }
  const query = params.toString();
  const url = query ? `${SHIFTS_PATH}?${query}` : SHIFTS_PATH;

  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load shifts.";
    throw new Error(message);
  }
  return normalizePaginatedResponse(payload, normalizedSkip, normalizedLimit);
};

/**
 * Fetch every shift accessible to the current user by iterating through
 * all pages of `fetchShifts`.  Optional filters (`busId`, `userId`) are
 * forwarded to each page request.
 */
export const fetchAllShifts = ({ busId = "", userId = "" } = {}) =>
  fetchAllPages((params) => fetchShifts({ ...params, busId, userId }));

const shiftIndex = createShiftIndex({ fetchAll: () => fetchAllShifts() });

/**
 * Partitions shift ids into the ones worth fetching and the ones the user's
 * shift list proves are gone. See `shift-index.js`.
 */
export const screenShiftIds = (ids) => shiftIndex.screen(ids);

export const invalidateShiftIndex = () => shiftIndex.invalidate();

export const fetchShiftById = async (shiftId) => {
  if (!shiftId) {
    throw new Error("Missing shiftId");
  }
  const headers = authHeaders();
  const response = await fetch(`${SHIFTS_PATH}${encodeURIComponent(shiftId)}`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load shift.";
    throw new Error(message);
  }
  return payload;
};

/**
 * Fetch detailed shift info including route and day of week information
 * Endpoint: GET /api/v1/user/shifts/{shift_id}/info
 */
export const fetchShiftInfo = async (shiftId) => {
  if (!shiftId) {
    throw new Error("Missing shiftId");
  }
  const headers = authHeaders();
  const response = await fetch(`${SHIFTS_PATH}${encodeURIComponent(shiftId)}/info`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load shift info.";
    throw new Error(message);
  }
  return payload;
};

export const fetchShiftYearlyDistance = async (
  shiftId,
  { recurrence = "daily" } = {}
) => {
  if (!shiftId) {
    throw new Error("Missing shiftId");
  }
  const headers = authHeaders();
  const params = new URLSearchParams();
  if (recurrence) {
    params.set("recurrence", recurrence);
  }
  const query = params.toString();
  const response = await fetch(
    `${SHIFTS_PATH}${encodeURIComponent(shiftId)}/yearly-distance${query ? `?${query}` : ""}`,
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
      "Unable to load shift yearly distance.";
    throw new Error(message);
  }
  return payload;
};

const toTripIds = (tripIds) =>
  Array.isArray(tripIds) ? tripIds.filter(Boolean).map(String) : [];

export const createShift = async ({ name, busId, tripIds, startTime, endTime, startDepotId, endDepotId } = {}) => {
  shiftIndex.invalidate();
  if (!name) {
    throw new Error("Missing name");
  }
  if (!busId) {
    throw new Error("Missing busId");
  }
  const trips = toTripIds(tripIds);
  if (!trips.length) {
    throw new Error("At least one trip is required.");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    name,
    bus_id: busId,
    trip_ids: trips,
  };

  // Include optional depot and time fields if provided
  if (startTime) {
    body.start_time = startTime;
  }
  if (endTime) {
    body.end_time = endTime;
  }
  if (startDepotId) {
    body.start_depot_id = startDepotId;
  }
  if (endDepotId) {
    body.end_depot_id = endDepotId;
  }

  const response = await fetch(SHIFTS_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to create shift.";
    throw new Error(message);
  }
  return payload;
};

export const updateShift = async (shiftId, { name, busId, tripIds, startTime, endTime, startDepotId, endDepotId } = {}) => {
  shiftIndex.invalidate();
  if (!shiftId) {
    throw new Error("Missing shiftId");
  }
  if (!name) {
    throw new Error("Missing name");
  }
  if (!busId) {
    throw new Error("Missing busId");
  }
  const trips = toTripIds(tripIds);
  if (!trips.length) {
    throw new Error("At least one trip is required.");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    name,
    bus_id: busId,
    trip_ids: trips,
  };

  // Include optional depot and time fields if provided
  if (startTime) {
    body.start_time = startTime;
  }
  if (endTime) {
    body.end_time = endTime;
  }
  if (startDepotId) {
    body.start_depot_id = startDepotId;
  }
  if (endDepotId) {
    body.end_depot_id = endDepotId;
  }

  const response = await fetch(`${SHIFTS_PATH}${encodeURIComponent(shiftId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to update shift.";
    throw new Error(message);
  }
  return payload;
};

export const deleteShift = async (shiftId) => {
  shiftIndex.invalidate();
  if (!shiftId) {
    throw new Error("Missing shiftId");
  }
  const headers = authHeaders();
  const response = await fetch(`${SHIFTS_PATH}${encodeURIComponent(shiftId)}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to delete shift.";
    throw new Error(message);
  }
  return true;
};

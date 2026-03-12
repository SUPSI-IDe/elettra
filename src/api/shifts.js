import { authHeaders, API_ROOT } from "./client";

const SHIFTS_PATH = `${API_ROOT}/api/v1/user/shifts/`;

export const fetchShifts = async ({
  skip = 0,
  limit = 100,
  busId = "",
  userId = "",
} = {}) => {
  const headers = authHeaders();
  const params = new URLSearchParams();
  params.set("skip", String(skip));
  params.set("limit", String(limit));
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
  return payload;
};

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

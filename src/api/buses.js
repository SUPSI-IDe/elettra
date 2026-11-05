import { authHeaders, API_ROOT } from "./client";
import { buildPaginationParams, fetchAllLegacyPages } from "./pagination";

const BUSES_PATH = `${API_ROOT}/api/v1/user/buses/`;


export const fetchBuses = async ({ skip = 0, limit = 100 } = {}) => {
  const headers = authHeaders();
  const { skip: normalizedSkip, limit: normalizedLimit } = buildPaginationParams(
    skip,
    limit
  );
  const url = `${BUSES_PATH}?skip=${encodeURIComponent(
    String(normalizedSkip)
  )}&limit=${encodeURIComponent(String(normalizedLimit))}`;
  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load buses.";
    throw new Error(message);
  }
  return payload;
};

export const fetchAllBuses = () =>
  fetchAllLegacyPages((params) => fetchBuses(params));

export const fetchBusById = async (busId) => {
  if (!busId) {
    throw new Error("Missing busId");
  }
  const headers = authHeaders();
  const response = await fetch(`${BUSES_PATH}${encodeURIComponent(busId)}`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load bus.";
    throw new Error(message);
  }
  return payload;
};

export const createBus = async ({
  name,
  busModelId,
  userId,
  description = "",
  specs = {},
} = {}) => {
  if (!name) {
    throw new Error("Missing name");
  }
  if (!busModelId) {
    throw new Error("Missing busModelId");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    name,
    bus_model_id: busModelId,
    description,
    specs: typeof specs === "object" && specs !== null ? specs : {},
  };

  if (userId) {
    body.user_id = userId;
  }

  const response = await fetch(BUSES_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to create bus.";
    throw new Error(message);
  }
  return payload;
};

export const updateBus = async (
  busId,
  { name, busModelId, userId, specs = {} } = {}
) => {
  if (!busId) {
    throw new Error("Missing busId");
  }
  if (!name) {
    throw new Error("Missing name");
  }
  if (!busModelId) {
    throw new Error("Missing busModelId");
  }
  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };
  const body = {
    name,
    bus_model_id: busModelId,
    specs: typeof specs === "object" && specs !== null ? specs : {},
  };
  if (userId) {
    body.user_id = userId;
  }
  const response = await fetch(`${BUSES_PATH}${encodeURIComponent(busId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to update bus.";
    throw new Error(message);
  }
  return payload;
};

export const deleteBus = async (busId) => {
  if (!busId) {
    throw new Error("Missing busId");
  }
  const headers = authHeaders();
  const response = await fetch(`${BUSES_PATH}${encodeURIComponent(busId)}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to delete bus.";
    throw new Error(message);
  }
  return true;
};

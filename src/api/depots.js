import { authHeaders } from "./client";

const DEPOTS_PATH = "/api/v1/user/depots/";

export const fetchDepots = async ({ skip = 0, limit = 100 } = {}) => {
  const headers = authHeaders();
  const url = `${DEPOTS_PATH}?skip=${encodeURIComponent(
    String(skip)
  )}&limit=${encodeURIComponent(String(limit))}`;

  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load custom stops.";
    throw new Error(message);
  }

  return payload;
};

export const fetchDepotById = async (depotId) => {
  if (!depotId) {
    throw new Error("Missing depotId");
  }
  const headers = authHeaders();
  const response = await fetch(`${DEPOTS_PATH}${encodeURIComponent(depotId)}`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load depot.";
    throw new Error(message);
  }
  return payload;
};

export const createDepot = async ({
  name,
  address,
  userId,
  latitude = 0,
  longitude = 0,
  features = {},
} = {}) => {
  if (!name) {
    throw new Error("Missing name");
  }
  if (!address) {
    throw new Error("Missing address");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    name,
    address,
    latitude,
    longitude,
    features: typeof features === "object" && features !== null ? features : {},
  };

  if (userId) {
    body.user_id = userId;
  }

  const response = await fetch(DEPOTS_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to create custom stop.";
    throw new Error(message);
  }
  return payload;
};

export const updateDepot = async (
  depotId,
  { name, address, latitude = 0, longitude = 0, features = {} } = {}
) => {
  if (!depotId) {
    throw new Error("Missing depotId");
  }
  if (!name) {
    throw new Error("Missing name");
  }
  if (!address) {
    throw new Error("Missing address");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    name,
    address,
    latitude,
    longitude,
    features: typeof features === "object" && features !== null ? features : {},
  };

  const response = await fetch(`${DEPOTS_PATH}${encodeURIComponent(depotId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to update custom stop.";
    throw new Error(message);
  }
  return payload;
};

export const deleteDepot = async (depotId) => {
  if (!depotId) {
    throw new Error("Missing depotId");
  }
  const headers = authHeaders();
  const response = await fetch(`${DEPOTS_PATH}${encodeURIComponent(depotId)}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to delete custom stop.";
    throw new Error(message);
  }
  return true;
};

import { authHeaders } from "./client";

const BUS_MODELS_PATH = "/api/v1/user/bus-models/";
const BUSES_PATH = "/api/v1/user/buses/";

export const fetchBusModels = async ({ skip = 0, limit = 100 } = {}) => {
  const headers = authHeaders();

  const url = `${BUS_MODELS_PATH}?skip=${encodeURIComponent(
    String(skip)
  )}&limit=${encodeURIComponent(String(limit))}`;

  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load bus models.";
    throw new Error(message);
  }

  return payload;
};

export const fetchBusModelById = async (modelId) => {
  if (!modelId) {
    throw new Error("Missing modelId");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${BUS_MODELS_PATH}${encodeURIComponent(modelId)}`,
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
      "Unable to load bus model.";
    throw new Error(message);
  }
  return payload;
};

export const createBusModel = async ({
  name,
  manufacturer,
  description = "",
  specs = {},
  userId,
} = {}) => {
  if (!name) {
    throw new Error("Missing name");
  }
  if (!manufacturer) {
    throw new Error("Missing manufacturer");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    name,
    manufacturer,
    description,
    specs: typeof specs === "object" && specs !== null ? specs : {},
  };

  if (userId) {
    body.user_id = userId;
  }

  const response = await fetch(BUS_MODELS_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to create bus model.";
    throw new Error(message);
  }
  return payload;
};

export const updateBusModel = async (
  modelId,
  { name, manufacturer, description = "", specs = {}, userId } = {}
) => {
  if (!modelId) {
    throw new Error("Missing modelId");
  }
  if (!name) {
    throw new Error("Missing name");
  }
  if (!manufacturer) {
    throw new Error("Missing manufacturer");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    name,
    manufacturer,
    description,
    specs: typeof specs === "object" && specs !== null ? specs : {},
  };

  if (userId) {
    body.user_id = userId;
  }

  const response = await fetch(
    `${BUS_MODELS_PATH}${encodeURIComponent(modelId)}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to update bus model.";
    throw new Error(message);
  }
  return payload;
};

export const deleteBusModel = async (modelId) => {
  if (!modelId) {
    throw new Error("Missing modelId");
  }
  const headers = authHeaders();
  const response = await fetch(
    `${BUS_MODELS_PATH}${encodeURIComponent(modelId)}`,
    {
      method: "DELETE",
      headers,
    }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to delete bus model.";
    throw new Error(message);
  }
  return true;
};

export const fetchBuses = async ({ skip = 0, limit = 100 } = {}) => {
  const headers = authHeaders();
  const url = `${BUSES_PATH}?skip=${encodeURIComponent(
    String(skip)
  )}&limit=${encodeURIComponent(String(limit))}`;
  const response = await fetch(url, { method: "GET", headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to load buses.";
    throw new Error(message);
  }
  return payload;
};

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

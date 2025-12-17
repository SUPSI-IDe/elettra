import { authHeaders, API_ROOT } from "./client";

const BUS_MODELS_PATH = `${API_ROOT}/api/v1/user/bus-models/`;

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

import { authHeaders, API_ROOT } from "./client";

const ENV_PATH = `${API_ROOT}/api/v1/environmental`;

export const fetchShiftYearlyImpact = async (
  shiftId,
  { recurrence = "daily", passengers, customDays } = {}
) => {
  if (!shiftId) {
    throw new Error("Missing shiftId");
  }
  const headers = authHeaders();
  const params = new URLSearchParams();
  if (recurrence) params.set("recurrence", recurrence);
  if (passengers != null) params.set("passengers", String(passengers));
  if (customDays != null) params.set("custom_days", String(customDays));
  const query = params.toString();
  const response = await fetch(
    `${ENV_PATH}/shifts/${encodeURIComponent(shiftId)}/yearly-impact${query ? `?${query}` : ""}`,
    { method: "GET", headers }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load shift yearly environmental impact.";
    throw new Error(message);
  }
  return payload;
};

export const fetchLcaVehicles = async () => {
  const headers = authHeaders();
  const response = await fetch(`${ENV_PATH}/vehicles`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load LCA vehicles.";
    throw new Error(message);
  }
  return payload;
};

export const fetchVehicleImpact = async (vehicleId, queryParams = {}) => {
  if (!vehicleId) {
    throw new Error("Missing vehicleId");
  }
  const headers = authHeaders();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (value != null) params.set(key, String(value));
  }
  const query = params.toString();
  const response = await fetch(
    `${ENV_PATH}/vehicles/${encodeURIComponent(vehicleId)}/impact${query ? `?${query}` : ""}`,
    { method: "GET", headers }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load vehicle environmental impact.";
    throw new Error(message);
  }
  return payload;
};

export const fetchElectricityMixes = async () => {
  const headers = authHeaders();
  const response = await fetch(`${ENV_PATH}/electricity-mixes`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load electricity mixes.";
    throw new Error(message);
  }
  return payload;
};

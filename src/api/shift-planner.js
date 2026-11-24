import { API_ROOT, authHeaders } from "./client.js";
import { invalidateShiftIndex } from "./shifts.js";

const path = `${API_ROOT}/api/v1/user/shift-planner`;

const request = async (endpoint, { method = "GET", body, signal } = {}) => {
  const headers = authHeaders();
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${path}${endpoint}`, {
    method, headers, signal, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).filter(Boolean).join(" ")
      : typeof detail === "string" ? detail : detail?.message;
    const error = new Error(message || "");
    error.status = response.status;
    throw error;
  }
  return data;
};

export const fetchPlannerCatalog = (routeId, weekday, { signal } = {}) =>
  request(`/catalog?${new URLSearchParams({ route_id: routeId, weekday })}`, { signal });

export const fetchPlannerRoute = (fromStopId, toStopId, { signal } = {}) =>
  request(`/route?${new URLSearchParams({ from_stop_id: fromStopId, to_stop_id: toStopId })}`, { signal });

export const fetchPlannerProgramme = (shiftId, { signal } = {}) =>
  request(`/programmes/${encodeURIComponent(shiftId)}`, { signal });

export const savePlannerProgramme = async (body, { shiftId, signal } = {}) => {
  const result = await request(shiftId ? `/programmes/${encodeURIComponent(shiftId)}` : "/programmes", {
    method: shiftId ? "PUT" : "POST", body, signal,
  });
  invalidateShiftIndex();
  return result;
};

// getRandomValues is also available when the app is used over HTTP.
export const newPlannerRequestId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
};

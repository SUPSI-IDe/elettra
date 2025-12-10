import { API_ROOT } from "../config";

export const readAccessToken = () =>
  localStorage.getItem("access_token") ||
  (import.meta.env.VITE_TEST_PASSWORD ?? "");

export const authHeaders = () => {
  const token = readAccessToken();
  const headers = { accept: "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export { API_ROOT };

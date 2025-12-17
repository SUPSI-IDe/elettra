import { authHeaders, API_ROOT } from "./client";

const CURRENT_USER_PATH = `${API_ROOT}/auth/me`;

export const fetchCurrentUser = async () => {
  const headers = authHeaders();

  if (!headers.Authorization) {
    throw new Error("Missing access token.");
  }

  const response = await fetch(CURRENT_USER_PATH, {
    method: "GET",
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load current user.";
    throw new Error(message);
  }

  return payload;
};

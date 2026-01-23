import { authHeaders, API_ROOT } from "./client";

const CURRENT_USER_PATH = `${API_ROOT}/auth/me`;
const PASSWORD_PATH = `${API_ROOT}/auth/me/password`;
const AGENCIES_PATH = `${API_ROOT}/api/v1/agency/agencies`;

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

export const changePassword = async (currentPassword, newPassword) => {
  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  if (!headers.Authorization) {
    throw new Error("Missing access token.");
  }

  const response = await fetch(PASSWORD_PATH, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to change password.";
    throw new Error(message);
  }

  return payload;
};

export const fetchAgencyById = async (agencyId) => {
  if (!agencyId) {
    return null;
  }

  const headers = authHeaders();

  if (!headers.Authorization) {
    return null;
  }

  try {
    const response = await fetch(`${AGENCIES_PATH}/${agencyId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return payload;
  } catch {
    return null;
  }
};

import { API_ROOT } from "./client";

export const authenticate = async (email, password) => {
  const response = await fetch(`${API_ROOT}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Unable to authenticate.";

    throw new Error(message);
  }

  return payload;
};

export const registerUser = async ({ full_name, email, password, company_id }) => {
  const requestBody = {
    full_name,
    email,
    password,
    company_id,
  };
  
  const response = await fetch(`${API_ROOT}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ?? payload?.detail ?? "Registration failed.";

    throw new Error(message);
  }

  return payload;
};


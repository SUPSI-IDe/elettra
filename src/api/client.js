import { API_ROOT } from "../config";

export const readAccessToken = () =>
  localStorage.getItem("access_token") || "";

export const authHeaders = () => {
  const token = readAccessToken();
  const headers = { accept: "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

let authRedirectHandlerInstalled = false;

export const installAuthRedirectHandler = (onUnauthorized) => {
  if (authRedirectHandlerInstalled || typeof onUnauthorized !== "function") {
    return;
  }

  const nativeFetch = globalThis.fetch?.bind(globalThis);
  if (!nativeFetch) {
    return;
  }

  globalThis.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input?.url ?? "");
    const headers = new Headers(
      init?.headers ??
        (input instanceof Request ? input.headers : undefined) ??
        undefined
    );

    if (
      url.startsWith(API_ROOT) &&
      headers.has("Authorization") &&
      (response.status === 401 || response.status === 403)
    ) {
      onUnauthorized();
    }

    return response;
  };

  authRedirectHandlerInstalled = true;
};

export { API_ROOT };

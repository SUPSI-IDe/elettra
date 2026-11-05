import { API_ROOT } from "../config.js";

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

export const shouldRedirectUnauthorizedResponse = ({
  url,
  headers,
  status,
  apiRoot = API_ROOT,
}) =>
  String(url).startsWith(apiRoot) &&
  headers instanceof Headers &&
  headers.has("Authorization") &&
  status === 401;

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

    if (shouldRedirectUnauthorizedResponse({
      url,
      headers,
      status: response.status,
    })) {
      onUnauthorized();
    }

    return response;
  };

  authRedirectHandlerInstalled = true;
};

export { API_ROOT };

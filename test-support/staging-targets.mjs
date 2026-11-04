export const STAGING_TARGETS = Object.freeze({
  frontendUrl: "http://127.0.0.1:55558",
  backendUrl: "http://127.0.0.1:9005",
  databaseHost: "127.0.0.1",
  databasePort: 9004,
});

const TARGET_ENV = Object.freeze({
  ELETTRA_TEST_FRONTEND_URL: STAGING_TARGETS.frontendUrl,
  ELETTRA_TEST_BACKEND_URL: STAGING_TARGETS.backendUrl,
});

function requireExactTarget(environment, name, expected) {
  const configured = (environment[name] || expected).replace(/\/$/, "");
  if (configured !== expected) {
    throw new Error(
      `${name} must be exactly ${expected} for ELETTRA tests; got ${configured}`,
    );
  }
  return configured;
}

export function resolveStagingTargets(environment = process.env) {
  const frontendUrl = requireExactTarget(
    environment,
    "ELETTRA_TEST_FRONTEND_URL",
    TARGET_ENV.ELETTRA_TEST_FRONTEND_URL,
  );
  const backendUrl = requireExactTarget(
    environment,
    "ELETTRA_TEST_BACKEND_URL",
    TARGET_ENV.ELETTRA_TEST_BACKEND_URL,
  );
  const browserApiRoot = environment.VITE_API_ROOT || "";
  if (browserApiRoot !== "") {
    throw new Error(
      "VITE_API_ROOT must be empty during tests so API calls cannot bypass the staging proxy.",
    );
  }
  const proxyTarget = environment.VITE_API_PROXY_TARGET || backendUrl;
  if (proxyTarget.replace(/\/$/, "") !== backendUrl) {
    throw new Error(
      `VITE_API_PROXY_TARGET must be exactly ${backendUrl} for ELETTRA tests; got ${proxyTarget}`,
    );
  }
  return Object.freeze({ ...STAGING_TARGETS, frontendUrl, backendUrl });
}

import { defineConfig, devices } from "@playwright/test";
import { resolveStagingTargets } from "./test-support/staging-targets.mjs";

const stagingTargets = resolveStagingTargets();

// The browser source suite is served by Vite so it can import individual
// modules. Any request not fulfilled by a test mock is forced to the staging
// backend; an already-running server with unknown proxy settings is rejected.
process.env.ELETTRA_TEST_FRONTEND_URL = stagingTargets.frontendUrl;
process.env.ELETTRA_TEST_BACKEND_URL = stagingTargets.backendUrl;
process.env.VITE_API_ROOT = "";
process.env.VITE_API_PROXY_TARGET = stagingTargets.backendUrl;
process.env.ELETTRA_E2E_VERSION = "test";

const defaultStorageState = {
  cookies: [],
  origins: [
    {
      origin: "http://127.0.0.1:9010",
      localStorage: [
        {
          name: "elettra.usageNotice.dismissed.v1",
          value: "true",
        },
      ],
    },
  ],
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 4,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:9010/elettra/",
    storageState: defaultStorageState,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:9010/elettra/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

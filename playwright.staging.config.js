import { defineConfig, devices } from "@playwright/test";
import { resolveStagingTargets } from "./test-support/staging-targets.mjs";

const stagingTargets = resolveStagingTargets();

export default defineConfig({
  testDir: "./tests/staging",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `${stagingTargets.frontendUrl}/elettra/`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "staging-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

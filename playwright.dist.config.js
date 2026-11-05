import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/dist",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:9010/elettra/",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "dist-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1",
    url: "http://127.0.0.1:9010/elettra/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

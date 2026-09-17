import { defineConfig, devices } from "@playwright/test";


export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 4,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:9010/elettra/",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:9010/elettra/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

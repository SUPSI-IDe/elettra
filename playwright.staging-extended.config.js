import { defineConfig, devices } from '@playwright/test';
import { resolveStagingTargets } from './test-support/staging-targets.mjs';

const targets = resolveStagingTargets();
const localBundle = process.env.ELETTRA_EXTENDED_LOCAL_BUNDLE === '1';
const applicationURL = localBundle ? 'http://127.0.0.1:9010/elettra/' : targets.frontendUrl + '/elettra/';
export default defineConfig({
  testDir: './tests/staging-extended',
  testMatch: '**/rc3-*.spec.js',
  outputDir: './test-results/staging-extended',
  fullyParallel: false,
  workers: 2,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: applicationURL,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  ...(localBundle ? { webServer: {
    // Build in this environment too: .env.production otherwise supplies a
    // production API root before preview has a chance to proxy to staging.
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: applicationURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_ROOT: '', VITE_API_PROXY_TARGET: targets.backendUrl },
  } } : {}),
  projects: [
    { name: 'staging-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'staging-mobile', use: { ...devices['Pixel 5'] } },
  ],
});

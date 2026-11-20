import { defineConfig, devices } from '@playwright/test';
import { resolveStagingTargets } from './test-support/staging-targets.mjs';

const targets = resolveStagingTargets();
export default defineConfig({
  testDir: './tests/staging-extended',
  testMatch: '**/rc3-*.spec.js',
  outputDir: './test-results/staging-extended',
  fullyParallel: false,
  workers: 2,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: targets.frontendUrl + '/elettra/',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'staging-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'staging-mobile', use: { ...devices['Pixel 5'] } },
  ],
});

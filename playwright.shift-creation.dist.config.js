import { defineConfig, devices } from '@playwright/test';
import base from './playwright.dist.config.js';

export default defineConfig({
  ...base,
  testDir: './tests',
  testMatch: ['**/e2e/shift-stay-adjustment.spec.js', '**/dist/shift-api-origin.spec.js'],
  grep: /creation |\b0000 |the local production shift table/,
  projects: [...base.projects, { name: 'dist-firefox', use: { ...devices['Desktop Firefox'] } }],
});

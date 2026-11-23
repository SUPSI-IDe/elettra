import { defineConfig, devices } from '@playwright/test';
import base from './playwright.dist.config.js';

export default defineConfig({
  ...base,
  testDir: './tests',
  testMatch: ['**/e2e/shift-stay-editor.spec.js', '**/dist/shift-api-origin.spec.js'],
  grepInvert: /the fourth step appears only when a stay is requested/,
  workers: 2,
  projects: [...base.projects, { name: 'dist-firefox', use: { ...devices['Desktop Firefox'] } }, { name: 'dist-mobile', use: { ...devices['Pixel 5'] } }],
});

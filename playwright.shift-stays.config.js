import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: ['shift-depot-stays.spec.js', 'shift-stay-adjustment.spec.js', 'shift-stay-editor.spec.js'],
  projects: [...base.projects, { name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
});

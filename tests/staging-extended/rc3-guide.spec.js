import { readFileSync } from 'node:fs';
import { browserApplicationOrigin } from '../../test-support/browser-application-target.mjs';
import { registerGuideLayoutTests } from '../../test-support/guide-layout-scenarios.js';
import { test, expect } from '@playwright/test';
import { resolveStagingTargets } from '../../test-support/staging-targets.mjs';

const targets = resolveStagingTargets();
const frontendVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
test.beforeEach(async ({ context, baseURL }) => {
  const origin = browserApplicationOrigin(baseURL);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.fallback() : route.abort('blockedbyclient');
  });
});

registerGuideLayoutTests(test, expect);

test('deployed application reports RC and real staging backend on desktop and mobile', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true'));
  await page.goto('./#about');
  await expect(page.locator('[data-role="frontend-version"]')).toHaveText('v' + frontendVersion);
  await expect(page.locator('[data-role="backend-version"]')).toHaveText('v1.7.0');
  expect(errors).toEqual([]);
});

test('protected staging APIs reject anonymous requests through the frontend proxy', async ({ request }) => {
  for (const path of ['/auth/me', '/api/v1/user/shifts/', '/api/v1/gtfs/datasets']) {
    const response = await request.get(targets.frontendUrl + path);
    expect([401, 403]).toContain(response.status());
  }
  const invalid = await request.post(targets.frontendUrl + '/auth/login', { data: {} });
  expect(invalid.status()).toBe(422);
});

import { test, expect } from '@playwright/test';
import { resolveStagingTargets } from '../../test-support/staging-targets.mjs';

const targets = resolveStagingTargets();
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === targets.frontendUrl ? route.fallback() : route.abort('blockedbyclient');
  });
});

for (const language of ['en', 'it', 'de', 'fr']) {
  test(`cold deep link remains at yearly after delayed screenshots load in ${language}`, async ({ page }, info) => {
    await page.addInitScript(lang => localStorage.setItem('elettra_lang', lang), language);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let delayedImages = 0;
    await page.route(/\.png(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      delayedImages++;
      await gate;
      await route.fulfill({ response });
    });
    const metrics = () => page.locator('#yearly > h2').evaluate(el => ({
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
      viewport: innerHeight,
      scrollY,
    }));
    try {
      await page.goto('./guide/#yearly', { waitUntil: 'domcontentloaded' });
      const heading = page.locator('#yearly > h2');
      await expect(heading).toBeInViewport();
      await expect.poll(() => delayedImages).toBeGreaterThan(0);
      const before = await metrics();
      release();
      await page.waitForLoadState('networkidle');
      await info.attach('anchor-positions', { body: JSON.stringify({ before, after: await metrics(), delayedImages }), contentType: 'application/json' });
      await page.screenshot({ path: info.outputPath('guide-anchor.png'), fullPage: false });
      await expect(heading).toBeInViewport();
      await page.locator('header [data-guide-ui="backToApp"]').click();
      await expect(page.locator('.landing-page')).toBeVisible();
    } finally { release(); }
  });
}

test('deployed application reports RC and real staging backend on desktop and mobile', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true'));
  await page.goto('./#about');
  await expect(page.locator('[data-role="frontend-version"]')).toHaveText('v1.2.0-rc.3');
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

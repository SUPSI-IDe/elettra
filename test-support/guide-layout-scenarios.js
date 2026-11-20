import { browserApplicationOrigin } from './browser-application-target.mjs';

export function registerGuideLayoutTests(test, expect) {
  test.use({ reducedMotion: 'reduce' });
  for (const language of ['en', 'it', 'de', 'fr']) {
    test(`cold deep link remains at yearly after delayed screenshots load in ${language}`, async ({ page, baseURL }, info) => {
      const origin = browserApplicationOrigin(baseURL);
      await page.context().route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.fallback() : route.abort('blockedbyclient'));
      // Returning to the application checks its version even when no backend is running.
      await page.route('**/api/v1/version', route => route.fulfill({ json: { version: 'guide-test' } }));
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
        top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom,
        viewport: innerHeight, scrollY,
      }));
      try {
        await page.goto('./guide/#yearly', { waitUntil: 'domcontentloaded' });
        const heading = page.locator('#yearly > h2');
        await expect(heading).toBeInViewport();
        // Check the served guide, including the production bundle, documents both annual export paths.
        await expect(page.locator('#yearly')).toContainText('JSON');
        await expect(page.locator('#results')).toContainText('JSON');
        await expect(page.locator('#results')).toContainText(/(?:schema|Schema|schéma) 1/);
        await expect(page.locator('#results')).toContainText('Mean');
        await expect(page.locator('#results')).toContainText('Aggregate Q95');
        await expect(page.locator('#yearly')).toContainText(/(?:schema|Schema|schéma) 4/);
        await expect(page.locator('#yearly')).toContainText(/(?:schema|Schema|schéma) 3/);
        await expect.poll(() => delayedImages).toBeGreaterThan(0);
        const before = await metrics();
        release();
        await page.waitForLoadState('networkidle');
        await info.attach('anchor-positions', { body: JSON.stringify({ before, after: await metrics(), delayedImages }), contentType: 'application/json' });
        await expect(heading).toBeInViewport();
        for (const nextLanguage of ['de', 'fr', 'it', 'en']) {
          await page.locator('#guide-language').selectOption(nextLanguage);
          await expect(heading).toBeInViewport();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.locator('header [data-guide-ui="backToApp"]').click();
        await expect(page.locator('.landing-page')).toBeVisible();
      } finally { release(); }
    });
  }
}

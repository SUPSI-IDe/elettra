import { test, expect, configure, edition } from '../../test-support/shift-composer-fixture.js';
import { browserApplicationOrigin } from '../../test-support/browser-application-target.mjs';
test.beforeEach(async ({ context, baseURL }) => {
  const frontendUrl = browserApplicationOrigin(baseURL);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === frontendUrl ? route.fallback() : route.abort('blockedbyclient');
  });
});

for (const status of [409, 422, 503]) {
  test(`deployed composer preserves a translated draft after save ${status} and retries once`, async ({ page, composer }, info) => {
    let saves = 0;
    const state = await composer({ application: true, respond: ({ path, method }) => {
      if (method === 'POST' && path.endsWith('/shifts/') && ++saves === 1)
        return { status, json: { detail: 'Staging save rejected <b>keep draft</b>' } };
    } });
    await configure(page);
    await page.locator('[data-action="add-trip"]').first().click();
    await page.locator('[data-action="composer-next"]').click();
    const itinerary = await page.locator('.composer-itinerary').innerText();
    for (const language of ['it', 'de', 'fr', 'en']) {
      await page.locator('.language-select').selectOption(language);
      await expect(page.locator('.composer-itinerary')).toHaveText(itinerary);
      await expect(page.locator('form.shift-composer')).toHaveAttribute('data-composer-step', 'review');
    }
    await page.locator('[type="submit"]').click();
    await expect(page.locator('[data-role="feedback"]')).toContainText('Staging save rejected <b>keep draft</b>');
    await expect(page.locator('[data-role="feedback"] b')).toHaveCount(0);
    await expect(page.locator('[type="submit"]')).toBeEnabled();
    await expect(page.locator('.composer-itinerary')).toHaveText(itinerary);
    await page.screenshot({ path: info.outputPath('save-rejected.png'), fullPage: true });
    const first = state.writes.filter(write => write.path.endsWith('/shifts/'))[0];
    expect(first.body.gtfs_dataset).toEqual(edition);
    expect(first.body.trip_ids).toHaveLength(3);
    expect(first.body.trip_ids[1]).toBe('db-1');
    await page.locator('[type="submit"]').click();
    await expect(page.locator('section.shifts')).toBeVisible();
    expect(state.writes.filter(write => write.path.endsWith('/shifts/'))).toHaveLength(2);
    expect(state.writes.filter(write => write.path.endsWith('/aux-trip'))).toHaveLength(4);
    expect(saves).toBe(2);
  });
}

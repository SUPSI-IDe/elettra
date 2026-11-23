import { test, expect, configure, language } from '../../test-support/shift-composer-fixture.js';

test('narrow translated review keeps actions readable and the timeline scrollable by keyboard', async ({ page, composer, isMobile }, testInfo) => {
  await page.setViewportSize({ width: isMobile ? 393 : 640, height: 850 });
  await composer();
  await configure(page);
  await page.locator('[data-action="add-trip"]').first().click();
  await page.locator('[data-action="composer-next"]').click();
  for (const lang of ['en', 'de', 'fr', 'it']) {
    await language(page, lang);
    for (const button of await page.locator('.form-actions button:visible').all()) {
      const size = await button.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      expect(size.scroll, `${lang} button text fits`).toBeLessThanOrEqual(size.client + 1);
      const box = await button.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    }
    await expect(page.locator('.composer-pan-hint')).toBeVisible();
  }
  const timeline = page.locator('[data-role="shift-timeline"]');
  const chart = await timeline.locator('svg').boundingBox();
  expect(chart.width).toBeGreaterThanOrEqual(720);
  expect(await timeline.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await timeline.focus();
  await timeline.press('ArrowRight');
  await expect.poll(() => timeline.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('translated-mobile-review.png'), fullPage: true });
});

for (const [label, trips] of [['object', {}], ['string', 'invalid'], ['null entry', [null]], ['numeric entry', [42]]]) {
  test(`malformed edit trip metadata (${label}) blocks writes without an uncaught error`, async ({ page, composer }) => {
    const state = await composer({ edit: true, respond: ({ path }) => path.endsWith('/info')
      ? { json: { trips, route_id: 'line', days_of_week: ['monday'] } } : undefined });
    await expect(page.locator('[data-role="feedback"]')).toHaveAttribute('data-tone', 'error');
    await expect(page.locator('[type="submit"]')).toBeDisabled();
    await page.locator('form').evaluate(element => element.requestSubmit());
    expect(state.writes).toEqual([]);
  });
}

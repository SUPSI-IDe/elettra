import { test, expect, configure } from '../../test-support/shift-composer-fixture.js';

test('the production Add vehicle block button opens a usable editor from the list', async ({ page, composer }) => {
  const state = await composer({ application: true, entry: 'shifts' });
  await page.locator('[data-action="add-shift"]').click();
  await expect(page.locator('.shift-composer')).toHaveAttribute('data-composer-step', 'setup');
  await configure(page);
  await page.locator('[data-action="add-trip"]').first().click();
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('.composer-itinerary li')).toHaveCount(1);
  expect(state.writes).toEqual([]);
});

test('an open tab recovers Add vehicle block after a deployment removed its lazy editor asset', async ({ page, composer }) => {
  let attempts = 0;
  const navigations = [];
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
  await page.route('**/assets/shift-form-*.js', route => ++attempts === 1
    ? route.fulfill({ status: 404, body: 'Old deployment asset removed' }) : route.continue());
  const state = await composer({ application: true, entry: 'shifts' });
  await page.locator('[data-action="add-shift"]').click();
  await expect(page.locator('.shift-composer')).toHaveAttribute('data-composer-step', 'setup', { timeout: 10000 });
  expect(attempts).toBe(2);
  expect(navigations.filter(url => url.endsWith('#shift-form')).length).toBeGreaterThanOrEqual(1);
  await configure(page);
  await expect(page.locator('[data-action="add-trip"]').first()).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('a persistently missing editor asset shows a retry action instead of a reload loop', async ({ page, composer }) => {
  let attempts = 0;
  await page.route('**/assets/shift-form-*.js', route => {
    attempts++;
    return route.fulfill({ status: 404, body: 'Asset still unavailable' });
  });
  const state = await composer({ application: true, entry: 'shifts' });
  await page.locator('[data-action="add-shift"]').click();
  await expect(page.locator('.page-load-error')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible();
  expect(attempts).toBe(2);
  expect(state.writes).toEqual([]);
});

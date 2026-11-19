import { test, expect, configure, deferred } from '../../test-support/shift-composer-fixture.js';

test('Add vehicle block opens from the list, survives cancel and opens again', async ({ page, composer }) => {
  const state = await composer({ application: true, entry: 'shifts' });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator('[data-action="add-shift"]').click();
    await expect(page.locator('.shift-composer')).toHaveAttribute('data-composer-step', 'setup');
    await configure(page);
    await page.locator('[data-action="add-trip"]').first().click();
    await page.locator('[data-action="composer-next"]').click();
    await expect(page.locator('.composer-itinerary li')).toHaveCount(1);
    await page.locator('[data-action="cancel"]').click();
    await expect(page.locator('section.shifts')).toBeVisible();
  }
  expect(state.writes).toEqual([]);
});

test('Add remains usable while the shift list is loading', async ({ page, composer }) => {
  const gate = deferred();
  const state = await composer({ application: true, entry: 'shifts', respond: async ({ path, method }) => {
    if (method === 'GET' && path.endsWith('/shifts/')) { await gate.promise; return { json: [] }; }
  } });
  try {
    await page.locator('[data-action="add-shift"]').click();
    await expect(page.locator('.shift-composer')).toHaveAttribute('data-composer-step', 'setup');
  } finally { gate.resolve(); }
  await configure(page);
  await expect(page.locator('[data-action="add-trip"]').first()).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('the translated list opens Add after changing language and a double click', async ({ page, composer }) => {
  const state = await composer({ application: true, entry: 'shifts' });
  await page.locator('.language-select').selectOption('it');
  const add = page.locator('[data-action="add-shift"]');
  await expect(add).toHaveText('Aggiungi');
  await add.dblclick();
  await expect(page.locator('.shift-composer')).toHaveAttribute('data-composer-step', 'setup');
  await configure(page);
  await expect(page.locator('[data-action="add-trip"]').first()).toBeVisible();
  expect(state.writes).toEqual([]);
});

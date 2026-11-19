import { test, expect, configure, language, deferred } from '../../test-support/shift-composer-fixture.js';
import { translations } from '../../src/i18n/translations.js';
import { defineShiftValidationLanguageTests } from '../../test-support/shift-validation-language-scenarios.js';

test.use({ locale: 'en-US' });
defineShiftValidationLanguageTests();

test('an open validation error changes language during editing and clears after correction', async ({ page, composer }) => {
  const state = await composer({ edit: true });
  await page.locator('[data-composer-step="setup"]').click();
  await page.locator('#shift-name').fill('');
  await page.locator('[data-composer-step="review"]').click();
  for (const lang of ['it', 'de', 'fr', 'en']) {
    await language(page, lang);
    expect(await page.locator('#shift-name').evaluate(input => input.validationMessage)).toBe(translations[lang]['shifts.validation_name_required']);
    await expect(page.locator('[data-role="feedback"]')).toHaveText(translations[lang]['shifts.validation_name_required']);
    await expect(page.locator('#shift-bus')).toHaveValue('bus');
  }
  await page.locator('#shift-name').fill('Corrected shift');
  await expect(page.locator('[data-role="feedback"]')).toBeHidden();
  await page.locator('[data-composer-step="review"]').click();
  await expect(page.locator('.composer-itinerary li')).toHaveCount(1);
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes[2].method).toBe('PUT');
});

test('bulk action notices translate without changing the programme or undo history', async ({ page, composer }) => {
  await composer({ application: true });
  await configure(page);
  await page.locator('[data-action="add-all-trips"]').click();
  for (const lang of ['it', 'de', 'fr', 'en']) {
    await page.locator('.language-select').selectOption(lang);
    await expect(page.locator('[data-role="feedback"]')).toHaveText(translations[lang]['shifts.bulk_added_trips'].replace('{count}', '3'));
    await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(3);
  }
  await page.locator('[data-action="remove-all-trips"]').click();
  for (const lang of ['it', 'de', 'fr', 'en']) {
    await page.locator('.language-select').selectOption(lang);
    await expect(page.locator('[data-role="feedback"]')).toHaveText(translations[lang]['shifts.bulk_removed_trips'].replace('{count}', '3'));
  }
  await page.locator('[data-action="undo-trips"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(3);
});

test('trip window warnings follow the language with all parameters resolved', async ({ page, composer }) => {
  await composer({ application: true });
  await configure(page);
  await page.locator('[data-action="add-trip"]').first().click();
  await page.locator('[data-composer-step="setup"]').click();
  await page.locator('#shift-end-time').fill('08:30');
  await page.locator('[data-composer-step="review"]').click();
  for (const lang of ['it', 'de', 'fr', 'en']) {
    await page.locator('.language-select').selectOption(lang);
    await expect(page.locator('[data-role="feedback"]')).toContainText(translations[lang]['shifts.trip_arrives_after'].split('{')[0]);
    await expect(page.locator('[data-role="feedback"]')).toContainText('08:30');
    await expect(page.locator('[data-role="feedback"]')).not.toContainText(/\{\w+\}/);
  }
});

test('saving progress preserves its current operation when the language changes', async ({ page, composer }) => {
  const gate = deferred();
  const state = await composer({ application: true, respond: async ({ path, state }) => {
    if (path.endsWith('/aux-trip') && state.writes.length === 1) await gate.promise;
  } });
  await configure(page);
  await page.locator('[data-action="add-trip"]').first().click();
  await page.locator('[data-action="composer-next"]').click();
  await page.locator('[type="submit"]').click();
  try {
    await expect.poll(() => state.writes.length).toBe(1);
    for (const lang of ['it', 'de', 'fr', 'en']) {
      await page.locator('.language-select').selectOption(lang);
      await expect(page.locator('[data-role="shift-progress-message"]')).toHaveText(translations[lang]['shifts.fetching_stops_first']);
      await expect(page.locator('[data-role="feedback"]')).toHaveText(translations[lang]['shifts.fetching_stops_first']);
    }
  } finally { gate.resolve(); }
  await expect.poll(() => state.writes.length).toBe(3);
});

test('an incomplete depot response has a localized error that follows the selected language', async ({ page, composer }) => {
  await composer({ application: true, respond: ({ path }) => path.endsWith('/aux-trip')
    ? { status: 202, json: { elevation_job: { status: 'pending' } } } : undefined });
  await configure(page);
  await page.locator('[data-action="add-trip"]').first().click();
  await page.locator('[data-action="composer-next"]').click();
  await page.locator('[type="submit"]').click();
  await expect(page.locator('[data-role="feedback"]')).toHaveAttribute('data-tone', 'error');
  for (const lang of ['it', 'de', 'fr', 'en']) {
    await page.locator('.language-select').selectOption(lang);
    await expect(page.locator('[data-role="feedback"]')).toContainText(translations[lang]['shifts.auxiliary_response_invalid']);
    await expect(page.locator('[data-role="feedback"]')).not.toContainText('missing trip.id');
  }
});

test('a trip loading error stays visible and changes language with the filters', async ({ page, composer }) => {
  const state = await composer({ application: true, respond: ({ path }) => path.includes('/gtfs-trips/by-route/')
    ? { status: 503, json: { detail: 'Backend detail' } } : undefined });
  await configure(page);
  await expect(page.locator('[data-role="scheduled-trips-empty"]')).toContainText('Backend detail');
  const reads = [...state.reads];
  for (const lang of ['it', 'de', 'fr', 'en']) {
    await page.locator('.language-select').selectOption(lang);
    await expect(page.locator('[data-role="scheduled-trips-empty"]')).toContainText(translations[lang]['shifts.unable_to_load_trips']);
  }
  expect(state.reads).toEqual(reads);
});

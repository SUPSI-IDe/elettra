import { test, expect, deferred, language } from '../../test-support/shift-composer-fixture.js';
import { defineShiftSelectLanguageTest } from '../../test-support/shift-select-language-scenarios.js';
import { translations } from '../../src/i18n/translations.js';

defineShiftSelectLanguageTest();
defineShiftSelectLanguageTest({ edit: true });

test('dropdowns use the active language when their catalogue finishes loading later', async ({ page, composer }) => {
  const gate = deferred();
  await composer({ datasetGate: gate, awaitInit: false });
  try {
    await expect(page.locator('#scheduled-trips-day option')).toHaveCount(8);
    await language(page, 'de');
    await expect(page.locator('#scheduled-trips-day option[value="monday"]')).toHaveText('Montag');
    await expect(page.locator('[data-role="gtfs-dataset-summary"]')).toHaveText(translations.de['gtfs.loading']);
  } finally { gate.resolve(); }
  await page.waitForFunction(() => window.qaComposerReady);
  await expect(page.locator('#shift-gtfs-dataset option').first()).toContainText('Datei');
  await expect(page.locator('#scheduled-trips-line option[value="line"]')).toHaveText('Linie 1');
  await language(page, 'fr');
  await expect(page.locator('#scheduled-trips-day option[value="monday"]')).toHaveText('Lundi');
  await expect(page.locator('#shift-gtfs-dataset option').first()).toContainText('fichier');
  await expect(page.locator('#scheduled-trips-line option[value="line"]')).toHaveText('Ligne 1');
});

for (const failure of ['empty', 'unavailable']) {
  test(`${failure} timetable status follows the language alongside the dropdowns`, async ({ page, composer }) => {
    const state = await composer({ datasets: [], respond: ({ path }) => failure === 'unavailable' && path.endsWith('/datasets')
      ? { status: 503, json: { detail: 'Timetable unavailable' } } : undefined });
    for (const lang of ['it', 'de', 'fr', 'en']) {
      await language(page, lang);
      await expect(page.locator('[data-role="gtfs-dataset-summary"]')).toHaveText(translations[lang][failure === 'empty' ? 'gtfs.no_datasets' : 'gtfs.load_error']);
      await expect(page.locator('#scheduled-trips-day option[value="monday"]')).toHaveText(translations[lang]['simulation.day_monday']);
    }
    expect(state.writes).toEqual([]);
  });
}

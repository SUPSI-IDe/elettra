import { test, expect, configure } from './shift-composer-fixture.js';
import { translations } from '../src/i18n/translations.js';

const fields = [
  ['shift-name', 'validation_name_required'],
  ['shift-bus', 'validation_bus_required'],
  ['shift-start-depot', 'validation_start_depot_required'],
  ['shift-start-time', 'validation_start_time_required'],
  ['shift-end-depot', 'validation_end_depot_required'],
  ['shift-end-time', 'validation_end_time_required'],
];

export const defineShiftValidationLanguageTests = () => {
  for (const lang of ['it', 'de', 'fr', 'en']) {
    test(`${lang} localizes native validation on every setup field for both step buttons`, async ({ page, composer }) => {
      const state = await composer({ application: true });
      await configure(page, { name: 'Draft survives validation', chooseTrips: false });
      await page.locator('.language-select').selectOption(lang);
      for (const step of ['compose', 'review']) for (const [id, key] of fields) {
        const field = page.locator(`#${id}`);
        const original = await field.inputValue();
        const isSelect = await field.evaluate(input => input.tagName === 'SELECT');
        if (isSelect) await field.selectOption(''); else await field.fill('');
        await page.locator(`[data-composer-step="${step}"]`).click();
        const message = translations[lang][`shifts.${key}`];
        await expect(field).toBeFocused();
        expect(await field.evaluate(input => input.validationMessage)).toBe(message);
        await expect(field).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('[data-role="feedback"]')).toHaveText(message);
        await expect(page.locator('form')).toHaveAttribute('data-composer-step', 'setup');
        if (isSelect) await field.selectOption(original); else await field.fill(original);
        expect(await field.evaluate(input => input.validationMessage)).toBe('');
        await expect(field).not.toHaveAttribute('aria-invalid', 'true');
      }
      const name = page.locator('#shift-name');
      await name.fill('   ');
      await page.locator('[data-action="composer-next"]').click();
      expect(await name.evaluate(input => input.validationMessage)).toBe(translations[lang]['shifts.validation_name_required']);
      await name.fill('Draft survives validation');
      const time = page.locator('#shift-start-time');
      await time.fill('07:30:30');
      await page.locator('[data-action="composer-next"]').click();
      expect(await time.evaluate(input => input.validationMessage)).toBe(translations[lang]['shifts.validation_time_invalid']);
      await time.fill('07:30');
      expect(await time.evaluate(input => input.validationMessage)).toBe('');
      expect(await page.locator('html').getAttribute('lang')).toBe(lang);
      await page.locator('[data-action="composer-next"]').click();
      await page.locator('#scheduled-trips-line').selectOption('line');
      await page.locator('#scheduled-trips-day').selectOption('monday');
      await page.locator('[data-action="add-trip"]').first().click();
      await page.locator('[data-action="composer-next"]').click();
      await page.locator('[type="submit"]').click();
      await expect.poll(() => state.writes.length).toBe(3);
      expect(state.writes[2].body.name).toBe('Draft survives validation');
      expect(state.writes[2].body.trip_ids).toEqual(['created-1', 'db-1', 'created-2']);
      await expect(page.locator('section.shifts [data-role="flash"]')).toHaveText(translations[lang]['shifts.shift_created']);
      const nextLanguage = lang === 'it' ? 'de' : 'it';
      await page.locator('.language-select').selectOption(nextLanguage);
      await expect(page.locator('section.shifts [data-role="flash"]')).toHaveText(translations[nextLanguage]['shifts.shift_created']);
    });
  }
};

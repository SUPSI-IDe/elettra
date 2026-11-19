import { test, expect, configure, language } from './shift-composer-fixture.js';
import { translations } from '../src/i18n/translations.js';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const defineShiftSelectLanguageTest = ({ edit = false } = {}) => {
  test(`${edit ? 'edit' : 'create'} translates every dropdown in place and saves the unchanged programme`, async ({ page, composer }) => {
    const state = await composer({ edit, application: !edit,
      models: [
        { id: 'model', user_id: 'user', specs: { vehicle_reference_key: 'midi_electric_bus_9m' } },
        { id: 'standard', user_id: 'user', specs: JSON.stringify({ size: '13m' }) },
        { id: 'articulated', user_id: 'user', specs: { size: '18m' } },
        { id: 'custom', user_id: 'user', name: 'CityRunner ABC' },
      ],
      depots: [{ id: 'depot', user_id: 'user', name: 'Main depot', stop_id: 'depot-stop' }, { id: 'unnamed-depot', user_id: 'user' }],
      respond: ({ path }) => path.includes('/gtfs-routes/') ? { json: [
        { id: 'line', route_short_name: '1' },
        { id: 'named', route_long_name: 'Night service' },
        { id: 'unnamed' },
      ] } : undefined,
    });
    if (!edit) {
      await configure(page);
      await page.locator('[data-action="add-trip"]').first().click();
    }
    await page.locator('#composer-search').fill('09:');
    await expect(page.locator('[data-action="add-trip"]').first()).toBeVisible();
    const snapshot = () => page.locator('form').evaluate(form => Array.from(form.querySelectorAll('input, select'))
      .map(input => [input.id, input.value, input.disabled]));
    const before = await snapshot();
    const reads = [...state.reads];
    await page.evaluate(() => { window.originalMondayOption = document.querySelector('#scheduled-trips-day option[value="monday"]'); });
    for (const lang of ['it', 'de', 'fr', 'en']) {
      if (edit) await language(page, lang);
      else await page.locator('.language-select').selectOption(lang);
      const dict = translations[lang];
      await expect(page.locator('#scheduled-trips-day option')).toHaveText([
        dict['shifts.filter_all_days'], ...days.map(day => dict[`simulation.day_${day}`]),
      ]);
      for (const [id, key] of [
        ['shift-bus', 'shifts.placeholder_bus_model'],
        ['shift-start-depot', 'shifts.select_depot'],
        ['shift-end-depot', 'shifts.select_depot'],
        ['scheduled-trips-line', 'shifts.filter_all_lines'],
      ]) await expect(page.locator(`#${id} option[value=""]`)).toHaveText(dict[key]);
      for (const [model, key] of [
        ['model', 'buses.vehicle_category_midi_9m'],
        ['standard', 'buses.vehicle_category_standard_12_13m'],
        ['articulated', 'buses.vehicle_category_articulated_18m'],
      ]) await expect(page.locator(`#shift-bus option[data-bus-model-id="${model}"]`)).toHaveText(dict[key]);
      await expect(page.locator('#shift-bus option[data-bus-model-id="custom"]')).toHaveText('CityRunner ABC');
      await expect(page.locator('#scheduled-trips-line option[value="line"]')).toHaveText(`${dict['shifts.filter_line']} 1`);
      await expect(page.locator('#scheduled-trips-line option[value="named"]')).toHaveText(`${dict['shifts.filter_line']} Night service`);
      await expect(page.locator('#scheduled-trips-line option[value="unnamed"]')).toHaveText(
        `${dict['shifts.filter_line']} ${dict['shifts.route_fallback'].replace('{id}', 'unnamed')}`);
      for (const id of ['shift-start-depot', 'shift-end-depot']) {
        await expect(page.locator(`#${id} option[value="unnamed-depot"]`)).toHaveText(dict['shifts.depot_fallback'].replace('{id}', 'unnamed-depot'));
        await expect(page.locator(`#${id} option[value="depot"]`)).toHaveText('Main depot');
      }
      if (!edit) for (const option of await page.locator('#shift-gtfs-dataset option').all()) {
        await expect(option).toContainText(` · ${dict['gtfs.file']} `);
      }
      await expect(page.locator('#scheduled-trips-day option:checked')).toHaveText(dict['simulation.day_monday']);
      expect(await snapshot()).toEqual(before);
      expect(await page.evaluate(() => window.originalMondayOption === document.querySelector('#scheduled-trips-day option[value="monday"]'))).toBe(true);
      await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(1);
      await expect(page.locator('form')).toHaveAttribute('data-composer-step', 'compose');
      expect(state.reads).toEqual(reads);
    }
    await page.locator('[data-action="composer-next"]').click();
    await expect(page.locator('.composer-itinerary li')).toHaveCount(1);
    await expect(page.locator('.composer-summary')).toContainText('Main depot');
    await page.locator('[type="submit"]').click();
    await expect.poll(() => state.writes.length).toBe(3);
    expect(state.writes[2].method).toBe(edit ? 'PUT' : 'POST');
    expect(state.writes[2].body.trip_ids).toEqual(['created-1', 'db-1', 'created-2']);
    expect(state.writes[2].body.start_time).toBe('07:30');
    expect(state.writes[2].body.end_time).toBe('12:00');
  });
};

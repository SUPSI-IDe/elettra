import { readFileSync } from 'node:fs';
import { test, expect, configure, language, edition } from '../../test-support/shift-composer-fixture.js';
import { translations } from '../../src/i18n/translations.js';

const data = JSON.parse(readFileSync(new URL('../../test-support/shift-40507-weekday.json', import.meta.url)));
const movements = data.shiftInfo.trips.map(trip => ({ ...trip, route_id: 'line' }));
const trips = movements.filter(trip => !trip.trip_id.startsWith('depot-'));
const stops = new Map(data.shift.structure.map(leg => [leg.trip_id, leg.stop_times]));
const depot = { ...data.depots[0], id: 'depot', user_id: 'user' };

const options = (edit = false) => ({ edit, trips, depots: [depot], respond: ({ path, method }) => {
  if (path.includes('/gtfs-stops/by-trip/')) return { json: stops.get(path.split('/').at(-1))?.map(stop => ({ ...stop, stop_lat: 46, stop_lon: 9 })) };
  if (path.endsWith('/shifts/old/info')) return { json: { trips: movements, route_id: 'line', days_of_week: ['monday'] } };
  if (path.endsWith('/shifts/old') && method === 'GET') return { json: { ...data.shift, id: 'old', name: '40507_weekday', bus_id: 'bus', gtfs_datasets: [edition] } };
} });

test('40507 edit retains its intermediate stay and all 22 UUIDs on a metadata-only save', async ({ page, composer }, testInfo) => {
  const state = await composer(options(true));
  await expect(page.locator('[data-role="stay-editor-entry"]')).toContainText('09:43 – 16:02');
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(18);
  await expect(page.locator('[data-action="select-period"]')).toHaveCount(0);
  await language(page, 'it');
  await page.locator('[data-action="edit-stays"]').click();
  await expect(page.locator('#editor-stay-0-arrivalTime')).toHaveValue('09:43');
  await expect(page.locator('#editor-stay-0-departureTime')).toHaveValue('16:02');
  await page.screenshot({ path: testInfo.outputPath('40507-stay.png'), fullPage: true });
  await page.locator('[data-action="editor-cancel"]').click();
  await page.locator('[data-composer-step="setup"]').click();
  await page.locator('#shift-name').fill('40507_weekday aggiornato');
  await page.locator('[data-composer-step="review"]').click();
  await expect(page.locator('.composer-itinerary__stay')).toContainText('09:43 – 16:02');
  await expect(page.locator('.timeline__depot-dwell')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('40507-review.png'), fullPage: true });
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].method).toBe('PUT');
  expect(state.writes[0].body.trip_ids).toEqual(data.shift.structure.map(leg => leg.trip_id));
});

test('create inserts an intermediate depot stay and saves four connections in order', async ({ page, composer }) => {
  const state = await composer(options());
  await configure(page, { name: '40507 recreated', start: '06:54', end: '00:20' });
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(18);
  await page.locator('#stay-after-trip').selectOption(trips[3].id);
  await page.locator('[data-action="add-stay"]').click();
  await page.locator('#stay-0-arrivalTime').fill('09:43');
  await page.locator('#stay-0-arrivalTime').press('Enter');
  await page.locator('#stay-0-departureTime').fill('16:02');
  await page.locator('#stay-0-departureTime').press('Enter');
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('.composer-itinerary__stay')).toContainText('09:43 – 16:02');
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(5);
  const saved = state.writes.at(-1).body.trip_ids;
  expect([saved[0], saved[5], saved[6], saved.at(-1)]).toEqual(['created-1', 'created-2', 'created-3', 'created-4']);
  expect(saved.filter(id => !id.startsWith('created-'))).toEqual(trips.map(trip => trip.id));
});

test('create aligns Italian stay fields on desktop and stacks them in order on mobile', async ({ page, composer }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await composer({ application: true, entry: 'shift-form' });
  await page.locator('.language-select').selectOption('it');
  await configure(page);
  await page.locator('[data-action="add-trip"]').first().click();
  await page.locator('[data-action="add-stay"]').click();

  const grid = page.locator('.depot-stay-fields');
  const stopLabel = grid.locator('label[for="stay-0-depot"]');
  await expect(stopLabel).toHaveText('Fermata personalizzata');
  // Reproduce the wrapped label regardless of the installed or loaded font.
  await page.addStyleTag({ content: 'label[for="stay-0-depot"] { max-inline-size: min-content; }' });

  const fields = ['depot', 'arrivalTime', 'arrivalTime-day', 'departureTime', 'departureTime-day'];
  const controls = fields.map(field => `#stay-0-${field}`);
  for (const selector of controls) await expect(grid.locator(selector)).toBeVisible();
  const measure = () => grid.locator(controls.join(', ')).evaluateAll(elements => Object.fromEntries(elements.map(element => {
    const { left, top, bottom } = element.getBoundingClientRect();
    return [element.id.slice('stay-0-'.length), { left, top, bottom }];
  })));

  const desktop = await measure();
  const [stop, arrival, departure] = [desktop.depot, desktop.arrivalTime, desktop.departureTime];
  expect(arrival.left).toBeGreaterThan(stop.left);
  expect(departure.left).toBeGreaterThan(arrival.left);
  expect(Math.abs(stop.top - arrival.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(departure.top - arrival.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktop['arrivalTime-day'].top - desktop['departureTime-day'].top)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await measure();
  for (const [index, field] of fields.entries()) {
    expect(Math.abs(mobile[field].left - mobile.depot.left), field).toBeLessThanOrEqual(1);
    if (index > 0) expect(mobile[field].top, field).toBeGreaterThanOrEqual(mobile[fields[index - 1]].bottom);
  }
});

test('a new period permits a different terminus; removing the stay restores continuity validation and Undo', async ({ page, composer }) => {
  const morning = trips[3], afternoon = { ...trips[4], start_stop_name: 'Different terminus' };
  const state = await composer({ trips: [morning, afternoon], depots: [{ id: 'depot', user_id: 'user', name: 'Punto di interscambio', stop_id: 'custom-stop', features: { type: 'hub' } }] });
  await configure(page, { start: '06:54', end: '00:20' });
  await page.locator('[data-action="add-trip"]').first().click();
  await expect(page.locator('[data-action="add-trip"]')).toHaveCount(0);
  await page.locator('[data-action="add-stay"]').click();
  await expect(page.getByLabel('Custom stop', { exact: true }).locator('option:checked')).toHaveText('Punto di interscambio');
  await page.locator('#stay-0-arrivalTime').fill('09:43');
  await page.locator('#stay-0-arrivalTime').press('Enter');
  await page.locator('#stay-0-departureTime').fill('16:02');
  await page.locator('#stay-0-departureTime').press('Enter');
  await page.locator('[data-action="add-trip"]').click();
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('[data-composer-panel="review"]')).toBeVisible();
  await page.locator('[data-action="composer-back"]').click();
  await page.locator('[data-action="remove-stay"]').click();
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText('Different terminus');
  await page.locator('[data-action="undo-trips"]').click();
  await expect(page.locator('[data-role="depot-stay"]')).toHaveCount(1);
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('[data-composer-panel="review"]')).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('an incomplete edit stays in preview and cannot change the saved programme', async ({ page, composer }) => {
  const state = await composer(options(true));
  await page.locator('[data-action="edit-stays"]').click();
  await page.locator('#editor-stay-0-departureTime').fill('');
  await expect(page.locator('[data-action="editor-apply"]')).toBeDisabled();
  await expect(page.locator('[type="submit"]')).toBeHidden();
  await page.locator('[data-action="editor-cancel"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(18);
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('.composer-itinerary__stay')).toContainText('09:43 – 16:02');
  expect(state.writes).toEqual([]);
});

test('multiple overnight stays retain explicit service days and save six connections', async ({ page, composer }) => {
  const night = [
    { ...trips[0], departure_time: '23:00', arrival_time: '23:30', start_stop_name: 'A', end_stop_name: 'B' },
    { ...trips[1], departure_time: '24:20', arrival_time: '24:50', start_stop_name: 'C', end_stop_name: 'D' },
    { ...trips[2], departure_time: '25:30', arrival_time: '26:00', start_stop_name: 'E', end_stop_name: 'F' },
  ];
  const state = await composer({ trips: night });
  await configure(page, { start: '22:50', end: '02:20' });
  const addTrip = trip => page.locator(`[data-role="scheduled-trips-body"] tr[data-trip-id="${trip.trip_id}"] [data-action="add-trip"]`).click();
  const next = page.locator('[data-action="composer-next"]');
  await addTrip(night[0]);
  const addStay = async (index, arrival, departure, arrivalDay) => {
    await page.locator('[data-action="add-stay"]').click();
    const row = page.locator('[data-role="depot-stay"]').nth(index);
    const setTime = async (field, clock, offset) => {
      const time = row.locator(`[data-stay-field="${field}"]`);
      const day = row.locator(`[data-stay-day="${field}"]`);
      await time.fill(clock);
      await time.press('Enter');
      await expect(next).toHaveAttribute('aria-busy', 'false');
      // selectOption does not move focus away from the native time editor.
      await day.focus();
      await day.selectOption(offset);
      await expect(next).toHaveAttribute('aria-busy', 'false');
      await expect(time).toHaveValue(clock);
      await expect(day).toHaveValue(offset);
    };
    await setTime('arrivalTime', arrival, arrivalDay);
    await setTime('departureTime', departure, '1');
  };
  await addStay(0, '23:40', '00:10', '0');
  await addTrip(night[1]);
  await addStay(1, '00:55', '01:20', '1');
  await addTrip(night[2]);
  await expect(page.locator('[data-action="select-period"]')).toHaveCount(3);
  for (const control of await page.locator('.depot-stay input, .depot-stay select').all()) {
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  }
  await next.click();
  await expect(page.locator('.composer-itinerary__stay')).toHaveCount(2);
  await expect(page.locator('.composer-itinerary__stay').first()).toContainText('23:40 – 24:10');
  await expect(page.locator('.composer-itinerary__stay').last()).toContainText('24:55 – 25:20');
  await expect(page.locator('.timeline__depot-dwell')).toHaveCount(2);
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(7);
  expect(state.writes.at(-1).body.trip_ids).toHaveLength(9);
  expect(state.writes.slice(0, -1).map(write => write.body.departure_time)).toEqual([
    '22:50:00', '23:30:00', '24:10:00', '24:50:00', '25:20:00', '26:00:00',
  ]);
});

test('deleting the trip before a stay reanchors it and Undo restores the full day', async ({ page, composer }) => {
  const opts = options(true);
  const state = await composer({ ...opts, application: true, entry: 'shifts', respond: args => {
    if (args.path.endsWith('/shifts/') && args.method === 'GET') {
      return { json: [{ id: 'old', name: '40507_weekday', daily_distance_km: 120 }] };
    }
    return opts.respond(args);
  } });
  await page.locator('section.shifts tr[data-id="old"] [data-row-action="edit"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(18);
  await page.locator('[data-action="remove-trip"]').nth(3).click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(17);
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('[data-composer-panel="review"]')).toBeVisible();
  await page.locator('[data-action="composer-back"]').click();
  await page.locator('[data-action="undo-trips"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(18);
  await expect(page.locator('[data-role="stay-editor-entry"]')).toContainText('09:43 – 16:02');
  expect(state.writes).toEqual([]);
});

test('a failed intermediate connection keeps the complete draft and blocks the shift write', async ({ page, composer }) => {
  const opts = options();
  const state = await composer({ ...opts, respond: args => {
    if (args.path.endsWith('/aux-trip') && args.state.writes.length === 3) return { status: 502, json: { detail: 'Intermediate routing unavailable' } };
    return opts.respond(args);
  } });
  await configure(page, { start: '06:54', end: '00:20' });
  await page.locator('[data-action="add-all-trips"]').click();
  await page.locator('#stay-after-trip').selectOption(trips[3].id);
  await page.locator('[data-action="add-stay"]').click();
  await page.locator('#stay-0-arrivalTime').fill('09:43');
  await page.locator('#stay-0-arrivalTime').press('Enter');
  await page.locator('#stay-0-departureTime').fill('16:02');
  await page.locator('#stay-0-departureTime').press('Enter');
  await page.locator('[data-action="composer-next"]').click();
  await page.locator('[type="submit"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText('Intermediate routing unavailable');
  expect(state.writes).toHaveLength(3);
  expect(state.writes.every(write => write.path.endsWith('/aux-trip'))).toBe(true);
  await expect(page.locator('.composer-itinerary__stay')).toContainText('09:43 – 16:02');
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(8);
  expect(state.writes.at(-1).body.trip_ids).toHaveLength(22);
});

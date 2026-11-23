import { test as base, expect, deferred } from '../../test-support/shift-composer-fixture.js';
import { adjustmentOptionsFor as fixtureOptions, shift0000, shift00000 } from '../../test-support/shift-stay-adjustment-fixture.js';
const adjustmentOptionsFor = (data, options = {}) => ({
  ...fixtureOptions(data, { ...options, application: true, entry: 'shifts' }), autoOpen: !options.application,
});
const adjustmentOptions = options => adjustmentOptionsFor(shift00000, options);
const test = base.extend({
  composer: async ({ composer: mount, page }, use) => {
    await use(async options => {
      if (!options.autoOpen) return mount(options);
      const state = await mount({ ...options, application: true, entry: 'shifts' });
      await page.locator('[data-id="old"] [data-row-action="edit"]').click();
      return state;
    });
  },
});
const language = (page, lang) => page.locator('.language-select').selectOption(lang);
const rows = page => page.locator('[data-role="shift-trips-body"] tr');
const preview = page => page.locator('[data-role="stay-editor-itinerary"]');
const apply = page => page.locator('[data-action="editor-apply"]');
const open = async page => {
  await page.locator('[data-action="edit-stays"]').click();
  await expect(page.locator('[data-composer-panel="stays"]')).toBeVisible();
};
const edit = async (page, arrival, departure) => {
  if (arrival !== null) await page.locator('#editor-stay-0-arrivalTime').fill(arrival);
  if (departure !== null) await page.locator('#editor-stay-0-departureTime').fill(departure);
  await expect(apply(page)).toBeEnabled();
  await expect(page.locator('.stay-editor-preview')).toHaveAttribute('aria-busy', 'false');
};

test('0000 edit: whole day, one stay preview adds a bridge, Apply and Undo are atomic', async ({ page, composer }, info) => {
  const state = await composer(adjustmentOptionsFor(shift0000, { application: true, entry: 'shifts' }));
  await page.locator('[data-id="old"] [data-row-action="edit"]').click();
  await expect(rows(page)).toHaveCount(21);
  await expect(page.locator('[data-action="select-period"]')).toHaveCount(0);
  await expect(page.locator('#stay-0-departureTime')).toHaveCount(0);
  await open(page);
  const input = page.locator('#editor-stay-0-departureTime');
  await input.evaluate(node => { window.nativeTimeInput = node; });
  await edit(page, null, '15:00');
  await expect(input).toBeFocused();
  expect(await input.evaluate(node => node === window.nativeTimeInput)).toBe(true);
  await expect(input).toHaveValue('15:00');
  await expect(preview(page).locator('li')).toHaveCount(25);
  await expect(page.locator('[data-role="stay-editor-status"]')).toHaveText('3 trips added · 0 trips excluded');
  await expect(page.locator('[data-role="stay-editor-added"]')).toContainText('15:10');
  await expect(page.locator('[data-role="stay-editor-added"]')).toContainText('15:37');
  await expect(page.locator('[data-role="stay-editor-added"]')).toContainText('15:55');
  await expect(preview(page)).toContainText('16:21');
  expect(state.writes).toEqual([]);
  await apply(page).click();
  await expect(rows(page)).toHaveCount(24);
  await expect(page.locator('[data-composer-panel="stays"]')).toBeHidden();
  await expect(page.locator('[data-role="stay-editor-entry"]')).toContainText('15:00');
  await page.screenshot({ path: info.outputPath('0000-whole-day.png'), fullPage: true });
  await page.locator('[data-action="undo-trips"]').click();
  await expect(rows(page)).toHaveCount(21);
  await expect(page.locator('[data-role="stay-editor-entry"]')).toContainText('16:00');
});

test('0000 edit: save preserves outer and morning connections and changes only the departure link', async ({ page, composer }) => {
  const state = await composer(adjustmentOptionsFor(shift0000, { application: true, entry: 'shifts' }));
  await page.locator('[data-id="old"] [data-row-action="edit"]').click();
  await open(page); await edit(page, null, '15:00'); await apply(page).click();
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('.composer-itinerary__stay')).toContainText('10:30 – 15:00');
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[0].body.departure_time).toBe('15:00:00');
  expect(state.writes[0].body.arrival_time).toBe('15:10:00');
  const ids = state.writes[1].body.trip_ids;
  expect(ids).toHaveLength(28);
  expect(ids[0]).toBe(shift0000.shift.structure[0].trip_id);
  expect(ids.at(-1)).toBe(shift0000.shift.structure.at(-1).trip_id);
  for (const trip of shift0000.shiftInfo.trips.filter(trip => trip.status === 'gtfs')) expect(ids).toContain(trip.id);
});

for (const [arrival, departure, count] of [['11:30','13:30',16], ['11:00','14:00',12], ['09:00','15:00',5]]) {
  test(`edit: widening ${arrival}–${departure} previews exclusions, shortening restores trips automatically`, async ({ page, composer }) => {
    const state = await composer(adjustmentOptions());
    await expect(rows(page)).toHaveCount(19);
    await open(page); await edit(page, arrival, departure);
    await expect(preview(page).locator('li')).toHaveCount(count + 1);
    await expect(rows(page)).toHaveCount(19);
    await apply(page).click();
    await expect(rows(page)).toHaveCount(count);
    await open(page); await edit(page, '12:00', '13:00');
    await expect(page.locator('[data-role="stay-editor-added"] li')).toHaveCount(19-count);
    await apply(page).click();
    await expect(rows(page)).toHaveCount(19);
    expect(state.writes).toEqual([]);
  });
}

test('edit: Cancel discards draft times and trips, reopening shows the committed programme', async ({ page, composer }) => {
  await composer(adjustmentOptions());
  await open(page); await edit(page, '11:30','13:30');
  await page.locator('[data-action="editor-cancel"]').click();
  await expect(rows(page)).toHaveCount(19);
  await expect(page.locator('[data-role="stay-editor-entry"]')).toContainText('12:00');
  await open(page);
  await expect(page.locator('#editor-stay-0-arrivalTime')).toHaveValue('12:00');
  await expect(page.locator('#editor-stay-0-departureTime')).toHaveValue('13:00');
});

test('edit: invalid and incomplete times stay exactly as entered and cannot be applied', async ({ page, composer }) => {
  const state = await composer(adjustmentOptions());
  await open(page);
  const input = page.locator('#editor-stay-0-arrivalTime');
  await input.fill('07:00');
  await expect(page.locator('[data-role="stay-editor-status"]')).toContainText('Times are not changed');
  await expect(apply(page)).toBeDisabled();
  await expect(input).toHaveValue('07:00');
  await input.fill('');
  await expect(page.locator('[data-role="stay-editor-status"]')).toContainText('complete both times');
  await expect(apply(page)).toBeDisabled();
  await expect(rows(page)).toHaveCount(19);
  expect(state.writes).toEqual([]);
});

test('edit: routing failure can retry while keeping the original programme intact', async ({ page, composer }) => {
  let fail = true;
  const state = await composer(adjustmentOptions({ respond: ({ path }) => path.includes('/osrm/driving-distance') && fail ? { status: 502, json: { detail: 'offline' } } : undefined }));
  await open(page);
  await page.locator('#editor-stay-0-departureTime').fill('13:30');
  await expect(page.locator('[data-role="stay-editor-status"]')).toContainText('Selected trips have been retained');
  await expect(apply(page)).toBeDisabled();
  await expect(rows(page)).toHaveCount(19);
  expect(state.writes).toEqual([]);
  fail = false;
  await page.locator('[data-action="editor-retry"]').click();
  await expect(apply(page)).toBeEnabled();
  await apply(page).click();
  await expect(rows(page)).toHaveCount(17);
});

test('edit: a late routing result cannot overwrite a newer preview or Cancel', async ({ page, composer }) => {
  const gate = deferred();
  const state = await composer(adjustmentOptions({ respond: async ({ path }) => { if (path.includes('/osrm/driving-distance')) await gate.promise; } }));
  await open(page);
  await page.locator('#editor-stay-0-departureTime').fill('14:00');
  await expect.poll(() => state.reads.some(url => url.includes('/osrm/driving-distance'))).toBe(true);
  await page.locator('#editor-stay-0-departureTime').fill('13:30');
  gate.resolve();
  await expect(apply(page)).toBeEnabled();
  await expect(preview(page).locator('li')).toHaveCount(18);
  await expect(page.locator('#editor-stay-0-departureTime')).toHaveValue('13:30');
  await page.locator('[data-action="editor-cancel"]').click();
  await expect(rows(page)).toHaveCount(19);
  await expect(page.locator('[data-role="stay-editor-entry"]')).toContainText('13:00');
});

test('edit: the fourth step appears only when a stay is requested and requires no trip anchor', async ({ page, composer }) => {
  await composer({ edit: true });
  await expect(page.locator('button[data-composer-step="stays"]')).toBeHidden();
  await expect(rows(page)).toHaveCount(1);
  await open(page);
  await expect(page.locator('button[data-composer-step="stays"]')).toBeVisible();
  await expect(page.locator('[data-composer-step="review"] > span').first()).toHaveText('4');
  await expect(page.locator('#stay-after-trip')).toHaveCount(0);
  await expect(page.locator('#editor-stay-0-depot')).toBeVisible();
  await expect(apply(page)).toBeDisabled();
  await page.locator('[data-action="editor-cancel"]').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('button[data-composer-step="stays"]')).toBeHidden();
});

test('edit: translated preview preserves draft and contains no unresolved labels', async ({ page, composer }, info) => {
  await composer(adjustmentOptions());
  await open(page); await edit(page, '11:30','13:30');
  for (const lang of ['it','de','fr','en']) {
    await language(page, lang);
    await expect(page.locator('#editor-stay-0-arrivalTime')).toHaveValue('11:30');
    await expect(preview(page).locator('li')).toHaveCount(17);
    await expect(page.locator('.stay-editor legend')).toHaveText({it:'Sosta intermedia 1',de:'Zwischenaufenthalt 1',fr:'Pause intermédiaire 1',en:'Intermediate stay 1'}[lang]);
    await expect(page.locator('[data-composer-panel="stays"]')).not.toContainText(/\{\w+\}|shifts\.editor_/);
  }
  await page.screenshot({ path: info.outputPath('stay-editor-preview.png'), fullPage: true });
});

test('edit: all existing lines participate independently of the visible route filter', async ({ page, composer }) => {
  const routeFor = trip => trip.departure_time >= '14:30' ? 'line-2' : 'line';
  const state = await composer(adjustmentOptionsFor(shift0000, { respond: ({ path }) => {
    if (path.endsWith('/shifts/old/info')) return { json: {
      ...shift0000.shiftInfo, route_id: 'line', days_of_week: ['monday'],
      trips: shift0000.shiftInfo.trips.map(trip => ({ ...trip, route_id: routeFor(trip) })),
    } };
    if (path.includes('/gtfs-trips/by-route/')) return { json: [...shift0000.shiftInfo.trips.filter(trip => trip.status === 'gtfs'), ...shift0000.candidateTrips]
      .filter(trip => path.endsWith(routeFor(trip))).map(trip => ({ ...trip, route_id: routeFor(trip) })) };
  } }));
  await open(page); await edit(page, null, '15:00');
  for (const line of ['line','line-2']) expect(state.reads.some(url => url.includes(`/by-route/${line}?`))).toBe(true);
  await expect(page.locator('[data-role="stay-editor-status"]')).toHaveText('3 trips added · 0 trips excluded');
  expect(state.writes).toEqual([]);
});

test('edit: a failed timetable load cannot silently omit candidates and supports retry', async ({ page, composer }) => {
  let fail = false;
  await composer(adjustmentOptions({ respond: ({ path }) => fail && path.includes('/gtfs-trips/by-route/') ? { status: 502, json: { detail: 'offline' } } : undefined }));
  fail = true;
  await open(page);
  await page.locator('#editor-stay-0-departureTime').fill('13:30');
  await expect(page.locator('[data-role="stay-editor-status"]')).toContainText('Unable to load');
  await expect(apply(page)).toBeDisabled();
  fail = false;
  await page.locator('[data-action="editor-retry"]').click();
  await expect(apply(page)).toBeEnabled();
});

test('edit: adding another stay derives both anchors and Undo restores the complete original day', async ({ page, composer }) => {
  const state = await composer(adjustmentOptions());
  await open(page);
  await page.locator('[data-action="editor-add-stay"]').click();
  await page.locator('#editor-stay-1-depot').selectOption(shift00000.depots.find(stop => stop.name === 'TPL Posteggio Lugano Centro').id);
  await page.locator('#editor-stay-1-arrivalTime').fill('09:30');
  await page.locator('#editor-stay-1-departureTime').fill('10:00');
  await expect(apply(page)).toBeEnabled();
  await expect(preview(page).locator('.stay-editor-pause')).toHaveCount(2);
  await expect(preview(page).locator('li')).toHaveCount(18);
  await apply(page).click();
  await expect(rows(page)).toHaveCount(16);
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('.composer-itinerary__stay')).toHaveCount(2);
  await page.locator('[data-action="composer-back"]').click();
  await page.locator('[data-action="undo-trips"]').click();
  await expect(rows(page)).toHaveCount(19);
  await expect(page.locator('[data-role="stay-editor-entry"]')).not.toContainText('09:30');
  expect(state.writes).toEqual([]);
});

test('edit: removing the last stay merges the programme and hides the fourth step', async ({ page, composer }) => {
  const state = await composer(adjustmentOptions());
  await open(page);
  await page.locator('[data-action="editor-remove-stay"]').click();
  await expect(apply(page)).toBeEnabled();
  await expect(preview(page).locator('.stay-editor-pause')).toHaveCount(0);
  await expect(preview(page).locator('li')).toHaveCount(19);
  await apply(page).click();
  await expect(rows(page)).toHaveCount(19);
  await expect(page.locator('button[data-composer-step="stays"]')).toBeHidden();
  await expect(page.locator('[data-composer-step="review"] > span').first()).toHaveText('3');
  await page.locator('[data-action="undo-trips"]').click();
  await expect(page.locator('button[data-composer-step="stays"]')).toBeVisible();
  expect(state.writes).toEqual([]);
});

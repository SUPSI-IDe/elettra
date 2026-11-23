import { test, expect, configure, language, deferred, serviceTrips } from '../../test-support/shift-composer-fixture.js';

const form = page => page.locator('form[data-form="shift-form"]');
const next = page => page.locator('[data-action="composer-next"]');
const chosen = page => page.locator('[data-role="shift-trips-body"] tr');
const add = page => page.locator('[data-action="add-trip"]');
const undo = page => page.locator('[data-action="undo-trips"]');

for (const id of ['shift-name', 'shift-bus', 'shift-start-depot', 'shift-end-depot', 'shift-start-time', 'shift-end-time']) {
  test(`setup validates and focuses missing ${id}`, async ({ page, composer }) => {
    const state = await composer();
    await configure(page, { chooseTrips: false });
    const input = page.locator(`#${id}`);
    if (id.includes('depot') || id === 'shift-bus') await input.selectOption('');
    else await input.fill('');
    await page.locator('[data-composer-step="review"]').click();
    await expect(form(page)).toHaveAttribute('data-composer-step', 'setup');
    await expect(input).toBeFocused();
    expect(state.writes).toEqual([]);
  });
}

test('late GTFS catalogue does not reset work to setup', async ({ page, composer }) => {
  const gate = deferred();
  await composer({ datasetGate: gate, awaitInit: false });
  await expect.poll(() => page.locator('#shift-bus option').count()).toBeGreaterThan(1);
  await configure(page, { chooseTrips: false });
  await next(page).click();
  // It is acceptable to wait in setup while loading or allow progress;
  // initialization must never send a user backwards after they advanced.
  const advanced = await form(page).getAttribute('data-composer-step');
  gate.resolve();
  await page.waitForFunction(() => window.qaComposerReady);
  if (advanced === 'compose') await expect(form(page)).toHaveAttribute('data-composer-step', 'compose');
});

test('missing GTFS timetable prevents progress with a visible explanation', async ({ page, composer }) => {
  await composer({ datasets: [] });
  await configure(page, { chooseTrips: false });
  await next(page).click();
  await expect(form(page)).toHaveAttribute('data-composer-step', 'setup');
  await expect(page.locator('[data-role="gtfs-dataset-summary"]')).toContainText('No GTFS timetable');
});

for (const missing of ['models', 'depots']) {
  test(`missing ${missing} cannot produce a saveable empty shift`, async ({ page, composer }) => {
    const state = await composer({ [missing]: [] });
    await next(page).click();
    await expect(form(page)).toHaveAttribute('data-composer-step', 'setup');
    await expect(page.locator('[type="submit"]')).toBeHidden();
    expect(state.writes).toEqual([]);
  });
}

test('keyboard advances setup and activates trips without submitting the shift', async ({ page, composer }) => {
  const state = await composer();
  await configure(page, { chooseTrips: false });
  await page.locator('#shift-name').press('Enter');
  await expect(form(page)).toHaveAttribute('data-composer-step', 'compose');
  await page.locator('#scheduled-trips-line').selectOption('line');
  await page.locator('#scheduled-trips-day').selectOption('monday');
  await add(page).first().focus();
  await page.keyboard.press('Enter');
  await expect(chosen(page)).toHaveCount(1);
  await page.locator('#composer-search').fill('09:10');
  await page.locator('#composer-search').press('Enter');
  await expect(form(page)).toHaveAttribute('data-composer-step', 'compose');
  expect(state.writes).toEqual([]);
});

for (const [lang, label, count, action] of [
  ['en', 'Filter by stop or time', '1 trip', 'Review & save'],
  ['it', 'Filtra una fermata o un orario', '1 corsa', 'Rivedi e salva'],
  ['de', 'Nach Haltestelle oder Uhrzeit filtern', '1 Fahrt', 'Prüfen & speichern'],
  ['fr', 'Filtrer par arrêt ou horaire', '1 trajet', 'Vérifier et enregistrer'],
]) {
  test(`${lang} updates labels, live counters and step actions without losing trips`, async ({ page, composer }) => {
    await composer();
    await configure(page);
    await add(page).first().click();
    await language(page, lang);
    await expect(page.locator('label[for="composer-search"]')).toHaveText(label);
    await expect(page.locator('[data-role="composer-count"]')).toContainText(count);
    await expect(next(page)).toHaveText(action);
    await expect(chosen(page)).toHaveCount(1);
    await next(page).click();
    await expect(page.locator('.composer-summary')).toContainText('Main depot');
  });
}

test('filter is case insensitive, supports times, has an empty state and preserves selections', async ({ page, composer }) => {
  await composer();
  await configure(page);
  await page.locator('#composer-search').fill('  aIrPoRt  ');
  await expect(add(page)).toHaveCount(2);
  await add(page).first().click();
  await page.locator('#composer-search').fill('does-not-exist');
  await expect(add(page)).toHaveCount(0);
  await expect(page.locator('[data-role="scheduled-trips-empty"]')).toBeVisible();
  await expect(page.locator('[data-action="add-all-trips"]')).toBeDisabled();
  await page.locator('#composer-search').fill('09:10');
  await expect(add(page)).toHaveCount(1);
  await page.locator('#composer-search').fill('');
  await expect(chosen(page)).toHaveCount(1);
  await expect(add(page)).toHaveCount(1);
});

test('bulk add respects the filter and undo treats the whole batch as one action', async ({ page, composer }) => {
  await composer();
  await configure(page);
  await page.locator('#composer-search').fill('Airport');
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(chosen(page)).toHaveCount(2);
  await undo(page).click();
  await expect(chosen(page)).toHaveCount(0);
  await expect(undo(page)).toBeDisabled();
  await expect(next(page)).toBeDisabled();
});

test('add/remove/undo restores chronology, availability and bulk state', async ({ page, composer }) => {
  await composer();
  await configure(page);
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(chosen(page)).toHaveCount(3);
  await chosen(page).last().locator('button').click();
  await expect(add(page)).toHaveCount(1);
  await undo(page).click();
  await expect(chosen(page)).toHaveCount(3);
  await expect(add(page)).toHaveCount(0);
  await page.locator('[data-action="remove-all-trips"]').click();
  await undo(page).click();
  await expect(chosen(page)).toHaveCount(3);
  await expect(chosen(page).first()).toContainText('08:00');
  await expect(chosen(page).last()).toContainText('10:10');
});

test('selected, overlapping, wrong-location and out-of-window trips cannot be added', async ({ page, composer }) => {
  await composer({ trips: [
    ...serviceTrips,
    { ...serviceTrips[0], id: 'early', trip_id: 'gtfs-early', departure_time: '06:00', arrival_time: '07:00' },
    { ...serviceTrips[1], id: 'overlap', trip_id: 'gtfs-overlap', departure_time: '08:30', arrival_time: '09:30' },
    { ...serviceTrips[1], id: 'late', trip_id: 'gtfs-late', departure_time: '12:00', arrival_time: '13:00' },
    { ...serviceTrips[1], id: 'wrong-stop', trip_id: 'gtfs-wrong', start_stop_name: 'Other stop' },
  ] });
  await configure(page);
  await page.locator('tr[data-trip-id="gtfs-1"] [data-action="add-trip"]').click();
  await expect(add(page)).toHaveCount(1);
  await expect(page.locator('tr[data-trip-id="gtfs-2"] [data-action="add-trip"]')).toBeVisible();
});

test('a connection can continue onto a different line and the summary retains both', async ({ page, composer }) => {
  const connection = { ...serviceTrips[1], id: 'db-other-line', trip_id: 'gtfs-other-line', route_id: 'line-2', end_stop_name: 'Park' };
  await composer({ respond: ({ path }) => path.endsWith('/by-route/line-2') ? { json: [connection] } : undefined });
  await configure(page);
  await add(page).first().click();
  await page.locator('#scheduled-trips-line').selectOption('line-2');
  await expect(page.locator('tr[data-trip-id="gtfs-other-line"]')).toBeVisible();
  await add(page).first().click();
  await next(page).click();
  await expect(page.locator('.composer-itinerary li')).toHaveCount(2);
  await expect(page.locator('.composer-itinerary')).toContainText('Park');
});

test('a late response to an old line filter never replaces the current line', async ({ page, composer }) => {
  const gate = deferred();
  await composer({ respond: async ({ path }) => {
    if (path.endsWith('/by-route/line')) { await gate.promise; return { json: serviceTrips }; }
    if (path.endsWith('/by-route/line-2')) return { json: [{ ...serviceTrips[0], id: 'new-db', trip_id: 'new-trip', start_stop_name: 'New line' }] };
  } });
  await configure(page);
  await page.locator('#scheduled-trips-line').selectOption('line-2');
  await expect(page.locator('tr[data-trip-id="new-trip"]')).toBeVisible();
  gate.resolve();
  await expect(page.locator('#scheduled-trips-line')).toHaveValue('line-2');
  await expect(add(page)).toHaveCount(1);
});

test('failed trip loading is reported as an error instead of a misleading empty list', async ({ page, composer }) => {
  await composer({ respond: ({ path }) => path.includes('/by-route/') ? { status: 503, json: { detail: 'Timetable temporarily unavailable' } } : undefined });
  await configure(page);
  await expect(page.locator('[data-role="scheduled-trips-empty"]')).toContainText('Timetable temporarily unavailable');
  await expect(add(page)).toHaveCount(0);
});

test('changing GTFS edition clears incompatible selections, the filter and undo history', async ({ page, composer }) => {
  await composer();
  await configure(page);
  await add(page).first().click();
  await page.locator('#composer-search').fill('Airport');
  await page.locator('[data-composer-step="setup"]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#shift-gtfs-dataset').selectOption('2025|2024-09-27');
  await next(page).click();
  await expect(chosen(page)).toHaveCount(0);
  await expect(undo(page)).toBeDisabled();
  await expect(page.locator('#composer-search')).toHaveValue('');
  await expect(page.locator('#scheduled-trips-line')).toHaveValue('');
});

test('cancelling a GTFS edition change retains the programme and undo history', async ({ page, composer }) => {
  await composer();
  await configure(page);
  await add(page).first().click();
  await page.locator('[data-composer-step="setup"]').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#shift-gtfs-dataset').selectOption('2025|2024-09-27');
  await next(page).click();
  await expect(chosen(page)).toHaveCount(1);
  await expect(undo(page)).toBeEnabled();
});

test('whitespace names are rejected with visible feedback', async ({ page, composer }) => {
  await composer();
  await configure(page, { name: '   ', chooseTrips: false });
  await next(page).click();
  await expect(form(page)).toHaveAttribute('data-composer-step', 'setup');
  await expect(page.locator('[data-role="feedback"]')).toBeVisible();
});

test('an unavailable edit record cannot be saved even through Enter', async ({ page, composer }) => {
  const state = await composer({ edit: true, respond: ({ path, method }) => path.endsWith('/shifts/old') && method === 'GET'
    ? { status: 500, json: { detail: 'Shift unavailable' } } : undefined });
  await expect(page.locator('[data-role="feedback"]')).toBeVisible();
  await page.locator('[data-composer-step="setup"]').click();
  await configure(page, { chooseTrips: false });
  await form(page).evaluate(element => element.requestSubmit());
  await expect(page.locator('[type="submit"]')).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('unsafe edit reconstruction blocks writes and leaves a clear error', async ({ page, composer }) => {
  const state = await composer({ edit: true, respond: ({ path }) => path.endsWith('/info') ? { status: 503, json: { detail: 'Metadata unavailable' } } : undefined });
  await expect(page.locator('[data-role="feedback"]')).toBeVisible();
  await expect(page.locator('[type="submit"]')).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('a failed final save preserves the programme and restores honest disabled controls', async ({ page, composer }) => {
  await composer({ respond: ({ path, method }) => path.endsWith('/shifts/') && method === 'POST'
    ? { status: 503, json: { detail: 'Save temporarily unavailable' } } : undefined });
  await configure(page);
  await page.locator('[data-action="add-all-trips"]').click();
  await next(page).click();
  await page.locator('[type="submit"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText('Save temporarily unavailable');
  await expect(page.locator('[data-role="shift-progress"] .shift-progress__overlay')).toBeHidden();
  await page.locator('[data-action="composer-back"]').click();
  await expect(page.locator('[data-action="add-all-trips"]')).toBeDisabled();
  await expect(chosen(page)).toHaveCount(3);
  await page.locator('[data-action="remove-all-trips"]').click();
  await undo(page).click();
  await undo(page).click();
  await expect(chosen(page)).toHaveCount(0);
});

test('save ignores duplicate submits while the first request is pending', async ({ page, composer }) => {
  const gate = deferred();
  const state = await composer({ respond: async ({ path, method }) => {
    if (path.endsWith('/aux-trip') && method === 'POST') { await gate.promise; }
  } });
  await configure(page);
  await add(page).first().click();
  await next(page).click();
  await page.locator('[type="submit"]').click();
    await expect(page.locator('[data-role="shift-progress"] .shift-progress__overlay')).toBeVisible();
  // Native disabled buttons are insufficient: Enter/requestSubmit can still
  // dispatch a submit event while a request is in flight.
  await form(page).evaluate(element => element.requestSubmit());
  gate.resolve();
  await expect.poll(() => state.writes.filter(write => write.path.endsWith('/shifts/')).length).toBe(1);
  expect(state.writes.filter(write => write.path.endsWith('/aux-trip'))).toHaveLength(2);
});

test('mobile and zoomed layouts keep controls inside the viewport', async ({ page, composer }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 640, height: 900 });
  await composer();
  await configure(page, { name: 'A very long shift name that should wrap safely' });
  await add(page).first().click();
  for (const selector of ['.composer-steps', '.form-actions', '#composer-search']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  }
  await expect(next(page)).toBeVisible();
  await next(page).click();
  await expect(page.locator('.composer-itinerary')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('review-narrow.png'), fullPage: true });
});

test('GTFS trips after midnight fit an overnight depot window', async ({ page, composer }) => {
  const state = await composer({ trips: [
    { ...serviceTrips[0], departure_time: '23:10:00', arrival_time: '24:00:00' },
    { ...serviceTrips[1], departure_time: '24:10:00', arrival_time: '25:00:00' },
  ] });
  await configure(page, { start: '23:00', end: '02:00' });
  await expect(add(page)).toHaveCount(2);
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(chosen(page)).toHaveCount(2);
  await next(page).click();
  await expect(page.locator('.composer-itinerary')).toContainText('25:00');
  await expect(page.locator('.composer-summary')).toContainText('Next day');
  await expect(page.locator('[data-role="shift-timeline"] svg')).toBeVisible();
  await expect(page.locator('[data-role="shift-timeline"]')).toContainText('24:00');
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes[1].body.arrival_time).toBe('26:00:00');
  expect(state.writes[2].body.end_time).toBe('26:00');
});

for (const failure of ['first-stops', 'last-stops', 'depot-stop']) {
  test(`save reports missing ${failure} without creating an incomplete shift`, async ({ page, composer }) => {
    const state = await composer({
      ...(failure === 'depot-stop' ? { depots: [{ id: 'depot', user_id: 'user', name: 'Main depot' }] } : {}),
      respond: ({ path }) => path.includes('/gtfs-stops/by-trip/')
        && path.endsWith(failure === 'first-stops' ? 'db-1' : failure === 'last-stops' ? 'db-3' : 'never')
        ? { json: [] } : undefined,
    });
    await configure(page);
    await page.locator('[data-action="add-all-trips"]').click();
    await next(page).click();
    await page.locator('[type="submit"]').click();
    await expect(page.locator('[data-role="feedback"]')).toBeVisible();
    await expect(page.locator('[data-role="feedback"]')).toHaveAttribute('data-tone', 'error');
    await expect(page.locator('[data-role="shift-progress"] .shift-progress__overlay')).toBeHidden();
    expect(state.writes.some(write => write.path.endsWith('/shifts/'))).toBe(false);
    expect(state.writes).toHaveLength(failure === 'last-stops' ? 1 : 0);
  });
}

test('editing an overnight shift retains clock inputs and the GTFS service-day offset', async ({ page, composer }) => {
  const nightTrips = [
    { ...serviceTrips[0], departure_time: '23:10', arrival_time: '24:00' },
    { ...serviceTrips[1], departure_time: '24:10', arrival_time: '25:00' },
  ];
  const state = await composer({ edit: true, trips: nightTrips, respond: ({ path, method }) => {
    if (path.endsWith('/shifts/old') && method === 'GET') return { json: {
      id: 'old', name: 'Night service', bus_id: 'bus', start_depot_id: 'depot', end_depot_id: 'depot',
      start_time: '23:00', end_time: '26:00', gtfs_datasets: [{ gtfs_year: 2026, gtfs_file_date: '2025-09-27' }],
      structure: [{ trip_id: 'db-1', sequence_number: 1 }, { trip_id: 'db-2', sequence_number: 2 }],
    } };
    if (path.endsWith('/info')) return { json: { trips: nightTrips, route_id: 'line', days_of_week: ['monday'] } };
  } });
  await page.locator('[data-composer-step="setup"]').click();
  await expect(page.locator('#shift-start-time')).toHaveValue('23:00');
  await expect(page.locator('#shift-end-time')).toHaveValue('02:00');
  await page.locator('[data-composer-step="review"]').click();
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes[2].method).toBe('PUT');
  expect(state.writes[2].body.end_time).toBe('26:00');
});

test('a long itinerary remains readable and can be removed and undone as one batch', async ({ page, composer }) => {
  const trips = Array.from({ length: 45 }, (_, index) => ({ ...serviceTrips[0], id: `db-long-${index}`,
    trip_id: `gtfs-long-${index}`, start_stop_name: index % 2 ? 'Airport' : 'Station', end_stop_name: index % 2 ? 'Station' : 'Airport',
    departure_time: `${String(6 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`,
    arrival_time: `${String(6 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15 + 10).padStart(2, '0')}`,
  }));
  await composer({ trips });
  await configure(page, { start: '05:00', end: '22:00' });
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(chosen(page)).toHaveCount(45);
  await next(page).click();
  await expect(page.locator('.composer-itinerary li')).toHaveCount(45);
  await page.locator('[data-action="composer-back"]').click();
  await page.locator('[data-action="remove-all-trips"]').click();
  await undo(page).click();
  await expect(chosen(page)).toHaveCount(45);
});

test('late route catalogue does not send an already advanced user backwards', async ({ page, composer }) => {
  const gate = deferred();
  await composer({ awaitInit: false, respond: async ({ path }) => {
    if (path.includes('/gtfs-routes/')) await gate.promise;
  } });
  await expect(page.locator('#shift-gtfs-dataset')).toBeEnabled();
  await configure(page, { chooseTrips: false });
  await next(page).click();
  await expect(form(page)).toHaveAttribute('data-composer-step', 'compose');
  gate.resolve();
  await page.waitForFunction(() => window.qaComposerReady);
  await expect(form(page)).toHaveAttribute('data-composer-step', 'compose');
});

test('the full application preserves a draft through language changes and saves the original programme', async ({ page, composer }) => {
  const state = await composer({ application: true });
  await configure(page, { name: 'Draft that must survive translation' });
  await add(page).first().click();
  for (const lang of ['it', 'de', 'fr', 'en']) {
    await page.locator('.language-select').selectOption(lang);
    await expect(chosen(page)).toHaveCount(1);
    await expect(form(page)).toHaveAttribute('data-composer-step', 'compose');
  }
  await next(page).click();
  await expect(page.locator('.composer-summary')).toContainText('Draft that must survive translation');
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes[2].body.name).toBe('Draft that must survive translation');
  expect(state.writes[2].body.trip_ids).toEqual(['created-1', 'db-1', 'created-2']);
});

test('a pending line change disables bulk add and filtering cannot resurrect stale candidates', async ({ page, composer }) => {
  const gate = deferred();
  await composer({ respond: async ({ path }) => {
    if (path.endsWith('/by-route/line-2')) {
      await gate.promise;
      return { json: [{ ...serviceTrips[0], id: 'new-db', trip_id: 'new-trip' }] };
    }
  } });
  await configure(page);
  await expect(add(page)).toHaveCount(3);
  await page.locator('#scheduled-trips-line').selectOption('line-2');
  await expect(page.locator('[data-action="add-all-trips"]')).toBeDisabled();
  await page.locator('#composer-search').fill('Station');
  await expect(add(page)).toHaveCount(0);
  await expect(chosen(page)).toHaveCount(0);
  gate.resolve();
  await expect(page.locator('tr[data-trip-id="new-trip"]')).toBeVisible();
  await expect(add(page)).toHaveCount(1);
});

for (const failure of ['timeout', 'gateway-html', 'malformed-success']) {
  test(`${failure} during auxiliary creation leaves a retryable, intact programme`, async ({ page, composer }) => {
    const state = await composer({ respond: async ({ route, path }) => {
      if (!path.endsWith('/aux-trip')) return;
      if (failure === 'timeout') { await route.abort('timedout'); return { handled: true }; }
      if (failure === 'gateway-html') return { status: 502, contentType: 'text/html', body: '<h1>Bad Gateway</h1>' };
      return { status: 202, json: { elevation_job: { status: 'pending' } } };
    } });
    await configure(page);
    await add(page).first().click();
    await next(page).click();
    await page.locator('[type="submit"]').click();
    await expect(page.locator('[data-role="feedback"]')).toHaveAttribute('data-tone', 'error');
    await expect(page.locator('[data-role="shift-progress"] .shift-progress__overlay')).toBeHidden();
    await expect(page.locator('[type="submit"]')).toBeEnabled();
    await expect(page.locator('.composer-itinerary li')).toHaveCount(1);
    expect(state.writes).toHaveLength(1);
  });
}

test('the current wrapped auxiliary response saves real trip IDs rather than job IDs', async ({ page, composer }) => {
  const state = await composer({ respond: ({ path, state }) => path.endsWith('/aux-trip')
    ? { status: 202, json: { trip: { id: `wrapped-${state.writes.length}` }, elevation_job: { id: 'job-not-a-trip', status: 'pending' } } }
    : undefined });
  await configure(page);
  await add(page).first().click();
  await next(page).click();
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes[2].body.trip_ids).toEqual(['wrapped-1', 'db-1', 'wrapped-2']);
});

test('untrusted names and stop labels stay text in the review and timeline', async ({ page, composer }) => {
  const unsafe = '<img src=x onerror="window.shiftXss=1">';
  await composer({ trips: [{ ...serviceTrips[0], start_stop_name: unsafe }] });
  await configure(page, { name: unsafe });
  await add(page).first().click();
  await next(page).click();
  await expect(page.locator('.composer-summary')).toContainText(unsafe);
  await expect(page.locator('.composer-itinerary')).toContainText(unsafe);
  await expect(page.locator('.composer-review img')).toHaveCount(0);
  expect(await page.evaluate(() => window.shiftXss)).toBeUndefined();
});

test('a non-blocking weather failure reports a saved shift without inviting a duplicate retry', async ({ page, composer }) => {
  const state = await composer({ application: true, respond: ({ path }) => path.includes('/pvgis-tmy/')
    ? { status: 503, json: { detail: 'Weather temporarily unavailable' } } : undefined });
  await configure(page);
  await add(page).first().click();
  await next(page).click();
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  await expect(page.locator('section.shifts')).toBeVisible();
  expect(state.writes.filter(write => write.path.endsWith('/shifts/'))).toHaveLength(1);
});

test('a failed edit save keeps undo disabled when there is no edit history', async ({ page, composer }) => {
  await composer({ edit: true, respond: ({ path, method }) => path.endsWith('/shifts/old') && method === 'PUT'
    ? { status: 503, json: { detail: 'Update temporarily unavailable' } } : undefined });
  await next(page).click();
  await page.locator('[type="submit"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText('Update temporarily unavailable');
  await page.locator('[data-action="composer-back"]').click();
  await expect(undo(page)).toBeDisabled();
  await expect(chosen(page)).toHaveCount(1);
});

test('editing a real saved structure reuses unchanged connections and regenerates the changed return', async ({ page, composer }) => {
  const outbound = { id: 'db-out', trip_id: 'depot-out', status: 'depot', start_stop_name: 'Main depot', end_stop_name: 'Station', departure_time: '07:30', arrival_time: '08:00', route_id: 'line' };
  const inbound = { id: 'db-back', trip_id: 'depot-back', status: 'depot', start_stop_name: 'Airport', end_stop_name: 'Main depot', departure_time: '09:00', arrival_time: '12:00', route_id: 'line' };
  const saved = [outbound, serviceTrips[0], inbound];
  const state = await composer({ edit: true, respond: ({ path, method }) => {
    if (path.endsWith('/shifts/old') && method === 'GET') return { json: {
      id: 'old', name: 'Morning service', bus_id: 'bus', start_depot_id: 'depot', end_depot_id: 'depot',
      gtfs_datasets: [{ gtfs_year: 2026, gtfs_file_date: '2025-09-27' }],
      structure: saved.map((trip, index) => ({ trip_id: trip.id, sequence_number: index + 1 })),
    } };
    if (path.endsWith('/info')) return { json: { trips: saved, route_id: 'line', days_of_week: ['monday'] } };
    const depotLeg = [outbound, inbound].find(trip => path.endsWith(`/by-trip/${trip.id}`));
    if (depotLeg) return { json: [
      { id: depotLeg === outbound ? 'depot-stop' : 'stop-b', stop_name: depotLeg.start_stop_name, arrival_time: depotLeg.departure_time, departure_time: depotLeg.departure_time },
      { id: depotLeg === outbound ? 'stop-a' : 'depot-stop', stop_name: depotLeg.end_stop_name, arrival_time: depotLeg.arrival_time, departure_time: depotLeg.arrival_time },
    ] };
  } });
  await expect(chosen(page)).toHaveCount(1);
  await expect(page.locator('#shift-start-time')).toHaveValue('07:30');
  await expect(page.locator('#shift-end-time')).toHaveValue('12:00');
  await expect(page.locator('[data-role="composer-next"]')).toContainText('Airport');
  await expect(page.locator('tr[data-trip-id="gtfs-2"]')).toBeVisible();
  await add(page).first().click();
  await next(page).click();
  await expect(page.locator('.composer-itinerary li')).toHaveCount(2);
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[0].body.departure_stop_id).toBe('stop-b');
  expect(state.writes[1].body.trip_ids).toEqual(['db-out', 'db-1', 'db-2', 'created-1']);
});

test('editing Monday never offers Tuesday-only services', async ({ page, composer }) => {
  const state = await composer({ edit: true, respond: ({ path, url }) => path.includes('/by-route/')
    && url.searchParams.get('day_of_week') === 'tuesday'
    ? { json: [{ ...serviceTrips[1], id: 'tuesday-db', trip_id: 'tuesday-only', departure_time: '09:30' }] }
    : undefined });
  await expect(add(page)).toHaveCount(1);
  await expect(page.locator('tr[data-trip-id="tuesday-only"]')).toHaveCount(0);
  const requestedDays = state.reads.filter(url => url.includes('/by-route/')).map(url => new URL(url).searchParams.get('day_of_week'));
  expect(requestedDays).toEqual(['monday']);
});

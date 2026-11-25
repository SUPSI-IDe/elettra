import { expect, test } from '@playwright/test';

const edition = { gtfs_year: 2026, gtfs_file_date: '2025-09-27' };
const trips = [
  { id: 'db-1', trip_id: 'gtfs-1', route_id: 'line', departure_time: '08:00:00', arrival_time: '09:00:00', start_stop_name: 'Station', end_stop_name: 'Airport', status: 'gtfs' },
  { id: 'db-2', trip_id: 'gtfs-2', route_id: 'line', departure_time: '09:10:00', arrival_time: '10:00:00', start_stop_name: 'Airport', end_stop_name: 'Station', status: 'gtfs' },
  { id: 'db-3', trip_id: 'gtfs-3', route_id: 'line', departure_time: '10:10:00', arrival_time: '11:00:00', start_stop_name: 'Station', end_stop_name: 'Harbour', status: 'gtfs' },
];

async function openComposer(page, edit = false, { failAuxAt = 0 } = {}) {
  const writes = [], unexpected = [], errors = [];
  let auxiliaryAttempts = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test');
    localStorage.setItem('elettra_lang', 'en');
    localStorage.setItem('user_gtfs_agency_id', 'agency');
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', company_id: 'company', role: 'analyst' } }));
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let json;
    if (path.endsWith('/version')) json = { version: 'test' };
    else if (path.includes('/agency/agencies/')) json = { id: 'company', gtfs_agency_id: 'agency' };
    else if (path.includes('/elevation-profile/by-trip/')) json = { records: [] };
    else if (path.endsWith('/shifts/') && request.method() === 'GET') json = [];
    else if (path.endsWith('/datasets')) json = [edition];
    else if (path.includes('/gtfs-routes/')) json = [{ id: 'line', route_short_name: '1' }];
    else if (path.includes('/gtfs-trips/by-route/')) json = trips;
    else if (path.includes('/gtfs-stops/by-trip/')) {
      const trip = trips.find(t => path.endsWith(t.id)) || trips[0];
      json = [
        { id: 'stop-a', stop_name: trip.start_stop_name, arrival_time: trip.departure_time, departure_time: trip.departure_time, stop_lat: 46, stop_lon: 9 },
        { id: 'stop-b', stop_name: trip.end_stop_name, arrival_time: trip.arrival_time, departure_time: trip.arrival_time },
      ];
    } else if (path.endsWith('/buses/')) json = [{ id: 'bus', user_id: 'user', bus_model_id: 'model' }];
    else if (path.endsWith('/bus-models/')) json = [{ id: 'model', user_id: 'user', name: 'Electric city bus' }];
    else if (path.endsWith('/depots/')) json = [{ id: 'depot', user_id: 'user', name: 'Main depot', stop_id: 'depot-stop' }];
    else if (path.includes('pvgis') || path.includes('weather')) json = [{ id: 'weather' }];
    else if (path.endsWith('/info')) json = { trips: [trips[0]], route_id: 'line', days_of_week: ['monday'] };
    else if (path.endsWith('/shifts/old') && request.method() === 'GET') json = {
      id: 'old', name: 'Morning service', bus_id: 'bus', start_depot_id: 'depot', end_depot_id: 'depot', start_time: '07:30:00', end_time: '12:00:00',
      gtfs_datasets: [edition], structure: [{ trip_id: 'db-1', sequence_number: 1 }],
    };
    else if (request.method() !== 'GET') {
      writes.push({ path, method: request.method(), body: request.postDataJSON() });
      if (path.endsWith('/aux-trip') && ++auxiliaryAttempts === failAuxAt) {
        return route.fulfill({ status: 502, json: {
          detail: 'OSRM request failed: [Errno -3] Temporary failure in name resolution',
        } });
      }
      json = { id: `created-${writes.length}` };
    } else {
      unexpected.push(path);
      return route.fulfill({ status: 500, json: { detail: `Missing mock: ${path}` } });
    }
    return route.fulfill({ json });
  });
  await page.goto('./#landing');
  await page.evaluate(async edit => {
    const root = document.createElement('div');
    root.className = 'layout-article';
    document.body.replaceChildren(root);
    root.innerHTML = await (await fetch(new URL('src/pages/Fleet/Shifts/shift-form.html', document.baseURI))).text();
    const { applyTranslations } = await import(new URL('src/i18n/index.js', document.baseURI).href);
    applyTranslations('en');
    const { initializeShiftForm } = await import(new URL('src/pages/Fleet/Shifts/shift-form.js', document.baseURI).href);
    window.cleanupComposer = await initializeShiftForm(root, edit ? { mode: 'edit', shiftId: 'old' } : {});
  }, edit);
  return { writes, unexpected, errors };
}

async function configure(page) {
  await page.locator('#shift-name').fill('Morning service');
  await page.locator('#shift-bus').selectOption('bus');
  await page.locator('#shift-start-depot').selectOption('depot');
  await page.locator('#shift-end-depot').selectOption('depot');
  await page.locator('#shift-start-time').fill('07:30');
  await page.locator('#shift-end-time').fill('12:00');
  await page.locator('[data-action="composer-next"]').click();
  await page.locator('#scheduled-trips-line').selectOption('line');
  await page.locator('#scheduled-trips-day').selectOption('monday');
}

test('compose, search, review and create a complete block with depot connections', async ({ page }, testInfo) => {
  const state = await openComposer(page);
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('#shift-name')).toBeFocused();
  await configure(page);
  await expect(page.locator('[data-action="composer-next"]')).toBeDisabled();
  await page.locator('#composer-search').fill('08:00');
  await page.locator('#composer-search').press('Enter');
  await expect(page.locator('form')).toHaveAttribute('data-composer-step', 'compose');
  await expect(page.locator('[data-action="add-trip"]')).toHaveCount(1);
  await page.locator('[data-action="add-trip"]').click();
  await page.locator('#composer-search').fill('');
  await expect(page.locator('[data-role="composer-next"]')).toContainText('Airport');
  await page.locator('[data-action="add-trip"]').first().click();
  await expect(page.locator('[data-role="composer-count"]')).toContainText('2 trips');
  await page.mouse.move(0, 0);
  await page.evaluate(() => { document.querySelector('.layout-article').scrollTop = 0; });
  await expect(page.locator('.trip-preview-row')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('compose.png'), fullPage: true });
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('.composer-itinerary li')).toHaveCount(2);
  await expect(page.locator('.composer-summary')).toContainText('Main depot');
  await page.locator('[data-action="composer-back"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(2);
  await page.locator('[data-action="composer-next"]').click();
  await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes[2].method).toBe('POST');
  expect(state.writes[2].body.trip_ids).toEqual(['created-1', 'db-1', 'db-2', 'created-2']);
  expect(state.writes[2].body.name).toBe('Morning service');
  expect(state.unexpected).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('removing a connecting trip or shrinking the time window blocks review', async ({ page }) => {
  const state = await openComposer(page);
  await configure(page);
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(3);
  await page.locator('[data-role="shift-trips-body"] tr').nth(1).locator('button').click();
  await page.locator('[data-action="undo-trips"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(3);
  await page.locator('[data-action="remove-all-trips"]').click();
  await page.locator('[data-action="undo-trips"]').click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(3);
  await page.locator('[data-role="shift-trips-body"] tr').nth(1).locator('button').click();
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText('Station');
  await expect(page.locator('[type="submit"]')).toBeHidden();
  await page.locator('[data-role="shift-trips-body"] tr').last().locator('button').click();
  await page.locator('[data-composer-step="setup"]').click();
  await page.locator('#shift-end-time').fill('08:30');
  await page.locator('[data-composer-step="review"]').click();
  await expect(page.locator('[data-role="feedback"]')).toContainText('08:30');
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test('edit opens the existing programme and saves with PUT, retaining depot times', async ({ page }) => {
  const state = await openComposer(page, true);
  await expect(page.locator('form')).toHaveAttribute('data-composer-step', 'compose');
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(1);
  await page.locator('[data-composer-step="setup"]').click();
  await expect(page.locator('#shift-start-time')).toHaveValue('07:30');
  await page.locator('#shift-name').fill('Updated service');
  await page.locator('[data-composer-step="review"]').click();
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(3);
  expect(state.writes[2].method).toBe('PUT');
  expect(state.writes[2].body.name).toBe('Updated service');
  expect(state.writes[2].body.start_time).toBe('07:30');
  expect(state.writes[2].body.end_time).toBe('12:00');
  expect(state.writes[2].body.trip_ids).toEqual(['created-1', 'db-1', 'created-2']);
  expect(state.unexpected).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const edit of [false, true]) {
  for (const failAuxAt of [1, 2]) {
    test(`${edit ? 'edit' : 'create'} retains the programme and can retry after OSRM fails on ${failAuxAt === 1 ? 'departure' : 'return'}`, async ({ page }, testInfo) => {
      if (failAuxAt === 2) testInfo.annotations.push({
        type: 'known-backend-limitation',
        description: 'Auxiliary creation and shift saving are separate transactions: a failed return can leave the already-created departure unreferenced. The UI retains the programme; atomic creation/cleanup requires a backend change.',
      });
      const state = await openComposer(page, edit, { failAuxAt });
      if (!edit) {
        await configure(page);
        await page.locator('[data-action="add-trip"]').first().click();
      }
      await page.locator('[data-composer-step="review"]').click();
      const itinerary = await page.locator('.composer-itinerary').textContent();
      await page.locator('[type="submit"]').click();
      await expect(page.locator('[data-role="feedback"]')).toContainText('Temporary failure in name resolution');
      await expect(page.locator('[data-role="shift-progress"] .shift-progress__overlay')).toBeHidden();
      await expect(page.locator('[type="submit"]')).toBeEnabled();
      await expect(page.locator('.composer-itinerary')).toHaveText(itinerary);
      expect(state.writes).toHaveLength(failAuxAt);
      expect(state.writes.every(write => write.path.endsWith('/aux-trip'))).toBe(true);
      await page.locator('[data-composer-step="setup"]').click();
      await expect(page.locator('#shift-name')).toHaveValue('Morning service');
      await expect(page.locator('#shift-start-time')).toHaveValue('07:30');
      await expect(page.locator('#shift-end-time')).toHaveValue('12:00');
      await page.locator('[data-composer-step="review"]').click();
      await page.locator('[type="submit"]').click();
      await expect.poll(() => state.writes.length).toBe(failAuxAt + 3);
      const saved = state.writes.at(-1);
      expect(saved.method).toBe(edit ? 'PUT' : 'POST');
      expect(saved.body.trip_ids).toEqual([`created-${failAuxAt + 1}`, 'db-1', `created-${failAuxAt + 2}`]);
      expect(state.unexpected).toEqual([]);
      expect(state.errors).toEqual([]);
    });
  }
}

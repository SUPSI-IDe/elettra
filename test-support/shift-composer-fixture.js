import { test as base, expect } from '@playwright/test';

export const edition = { gtfs_year: 2026, gtfs_file_date: '2025-09-27' };
export const serviceTrips = [
  { id: 'db-1', trip_id: 'gtfs-1', route_id: 'line', departure_time: '08:00:00', arrival_time: '09:00:00', start_stop_name: 'Station', end_stop_name: 'Airport', status: 'gtfs' },
  { id: 'db-2', trip_id: 'gtfs-2', route_id: 'line', departure_time: '09:10:00', arrival_time: '10:00:00', start_stop_name: 'Airport', end_stop_name: 'Station', status: 'gtfs' },
  { id: 'db-3', trip_id: 'gtfs-3', route_id: 'line', departure_time: '10:10:00', arrival_time: '11:00:00', start_stop_name: 'Station', end_stop_name: 'Harbour', status: 'gtfs' },
];
export const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

export const test = base.extend({
  composer: async ({ page }, use) => {
    const errors = [], unexpected = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(async (options = {}) => {
      const state = { writes: [], reads: [], errors, unexpected };
      await page.addInitScript(() => {
        localStorage.setItem('access_token', 'test');
        localStorage.setItem('elettra_lang', 'en');
        localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
      });
      await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', company_id: 'company', role: 'analyst' } }));
      await page.route('**/api/v1/**', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        const method = request.method();
        if (method === 'GET') state.reads.push(url.href);
        else state.writes.push({ path, method, body: request.postDataJSON() });
        const override = await options.respond?.({ route, request, url, path, method, state });
        if (override?.handled) return;
        if (override) return route.fulfill(override);
        let json;
        if (path.endsWith('/version')) json = { version: 'test' };
        else if (path.includes('/agency/agencies/')) json = { id: 'company', gtfs_agency_id: 'agency' };
        else if (path.includes('/elevation-profile/by-trip/')) json = { records: [] };
        else if (path.endsWith('/shifts/') && method === 'GET') json = [];
        else if (path.endsWith('/osrm/driving-distance')) json = { duration_seconds: 120, distance_meters: 1000 };
        else if (path.endsWith('/datasets')) {
          await options.datasetGate?.promise;
          json = options.datasets ?? [edition, { gtfs_year: 2025, gtfs_file_date: '2024-09-27' }];
        } else if (path.includes('/gtfs-routes/')) json = [{ id: 'line', route_short_name: '1' }, { id: 'line-2', route_short_name: '2' }];
        else if (path.includes('/gtfs-trips/by-route/')) json = options.trips ?? serviceTrips;
        else if (path.includes('/gtfs-stops/by-trip/')) {
          const trip = (options.trips ?? serviceTrips).find(item => path.endsWith(item.id)) || serviceTrips[0];
          json = [
            { id: 'stop-a', stop_name: trip.start_stop_name, arrival_time: trip.departure_time, departure_time: trip.departure_time, stop_lat: 46, stop_lon: 9 },
            { id: 'stop-b', stop_name: trip.end_stop_name, arrival_time: trip.arrival_time, departure_time: trip.arrival_time },
          ];
        } else if (path.endsWith('/buses/')) json = options.buses ?? [{ id: 'bus', user_id: 'user', bus_model_id: 'model' }];
        else if (path.endsWith('/bus-models/')) json = options.models ?? [{ id: 'model', user_id: 'user', name: 'Electric city bus' }];
        else if (path.endsWith('/depots/')) json = (options.depots?.map(stop => ({ latitude: 46, longitude: 9, ...stop }))) ?? [{ id: 'depot', user_id: 'user', name: 'Main depot', stop_id: 'depot-stop', latitude: 46, longitude: 9 }];
        else if (path.includes('pvgis') || path.includes('weather')) json = [{ id: 'weather' }];
        else if (path.endsWith('/shifts/old/info')) json = { trips: [serviceTrips[0]], route_id: 'line', days_of_week: ['monday'] };
        else if (path.endsWith('/shifts/old') && method === 'GET') json = {
          id: 'old', name: 'Morning service', bus_id: 'bus', start_depot_id: 'depot', end_depot_id: 'depot', start_time: '07:30:00', end_time: '12:00:00',
          gtfs_datasets: [edition], structure: [{ trip_id: 'db-1', sequence_number: 1 }],
        };
        else if ((path.endsWith('/aux-trip') || path.endsWith('/shifts/')) && method === 'POST'
          || path.endsWith('/shifts/old') && method === 'PUT') json = { id: `created-${state.writes.length}` };
        else {
          unexpected.push(`${method} ${path}`);
          return route.fulfill({ status: 500, json: { detail: `Missing mock: ${method} ${path}` } });
        }
        return route.fulfill({ json });
      });
      // Finish application navigation before mounting the isolated editor.
      if (options.application) {
        await page.goto(`./#${options.entry ?? 'shift-form'}`);
        if (options.entry === 'shifts') {
          await expect(page.locator('section.shifts')).toBeVisible();
          return state;
        }
        await expect(page.locator('.shift-composer')).toBeVisible();
        await expect.poll(() => page.locator('#scheduled-trips-line option').count()).toBeGreaterThan(1);
        return state;
      }
      await page.goto('./#home');
      await expect(page.locator('.home-page')).toBeVisible();
      await page.evaluate(async ({ edit, awaitInit }) => {
        const root = document.createElement('div');
        root.className = 'layout-article';
        document.body.replaceChildren(root);
        root.innerHTML = await (await fetch(new URL('src/pages/Fleet/Shifts/shift-form.html', document.baseURI))).text();
        const { applyTranslations } = await import(new URL('src/i18n/index.js', document.baseURI).href);
        applyTranslations('en');
        const { initializeShiftForm } = await import(new URL('src/pages/Fleet/Shifts/shift-form.js', document.baseURI).href);
        window.qaComposerReady = false;
        window.qaComposerInit = initializeShiftForm(root, edit ? { mode: 'edit', shiftId: 'old' } : {}).then(cleanup => {
          window.qaComposerCleanup = cleanup;
          window.qaComposerReady = true;
        });
        if (awaitInit) await window.qaComposerInit;
      }, { edit: options.edit || false, awaitInit: options.awaitInit !== false });
      return state;
    });
    expect(unexpected, 'Every API request must have an explicit mock').toEqual([]);
    expect(errors, 'No uncaught browser errors').toEqual([]);
  },
});
export { expect };

export async function configure(page, { name = 'Morning service', start = '07:30', end = '12:00', chooseTrips = true, depotId = 'depot' } = {}) {
  await page.locator('#shift-name').fill(name);
  await page.locator('#shift-bus').selectOption('bus');
  await page.locator('#shift-start-depot').selectOption(depotId);
  await page.locator('#shift-end-depot').selectOption(depotId);
  await page.locator('#shift-start-time').fill(start);
  await page.locator('#shift-end-time').fill(end);
  if (chooseTrips) {
    await page.locator('[data-action="composer-next"]').click();
    await page.locator('#scheduled-trips-line').selectOption('line');
    await page.locator('#scheduled-trips-day').selectOption('monday');
  }
}

export async function language(page, lang) {
  await page.evaluate(async lang => {
    const { setLanguage } = await import(new URL('src/i18n/index.js', document.baseURI).href);
    setLanguage(lang);
  }, lang);
}

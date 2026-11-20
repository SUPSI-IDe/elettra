import { test, expect, request as requestFactory } from '@playwright/test';
import { browserApplicationOrigin } from '../../test-support/browser-application-target.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolveStagingTargets } from '../../test-support/staging-targets.mjs';

const { frontendUrl, backendUrl } = resolveStagingTargets();

// All writes belong to one newly registered staging-only account. Never reuse
// an operator's credentials, bus, depot, shift or auxiliary trip for this test.
test('real staging composer creates and edits a shift with owned depot connections', async ({ page, request, baseURL }, info) => {
  const applicationOrigin = browserApplicationOrigin(baseURL);
  test.skip(info.project.name.includes('mobile'), 'One real-data transaction; responsive variants use the deterministic bundle tests.');
  test.setTimeout(150_000);
  const suffix = randomUUID();
  const name = 'RC3 QA ' + suffix;
  let token, user, bus, model, depot;
  const auxiliaryIds = new Set();
  const shiftIds = new Set();
  const responseTasks = [];
  const cleanupErrors = [];
  const steps = [];
  const cleanupRequest = await requestFactory.newContext({ timeout: 20_000 });
  const api = async (method, path, data, { direct = false } = {}) => {
    const url = (direct ? backendUrl : frontendUrl) + path;
    const response = await request.fetch(url, {
      method, data, headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    return response;
  };
  const json = async (method, path, data) => {
    const response = await api(method, path, data);
    expect(response.status(), method + ' ' + path).toBe(200);
    return response.json();
  };
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === applicationOrigin ? route.fallback() : route.abort('blockedbyclient');
  });
  // Weather is independent from saving the block and may populate a shared
  // cache. Exercise its non-blocking failure path without requesting a forecast.
  await page.route('**/api/v1/simulation/pvgis-tmy/**', route => route.fulfill({
    status: 503, json: { detail: 'Weather intentionally unavailable in staging save test' },
  }));
  page.on('response', response => {
    const method = response.request().method();
    const path = new URL(response.url()).pathname;
    if (!response.ok() || !['POST', 'PUT'].includes(method)) return;
    if (path.endsWith('/aux-trip')) responseTasks.push(response.json().then(body => {
      auxiliaryIds.add((body.trip ?? body).id);
    }));
    if (path.includes('/user/shifts/')) responseTasks.push(response.json().then(body => {
      if (body.id) shiftIds.add(body.id);
    }));
  });
  try {
    const agencies = [];
    for (let skip = 0; skip < 1000; skip += 100) {
      const batch = await json('GET', '/api/v1/agency/agencies/?limit=100&skip=' + skip);
      agencies.push(...batch);
      if (batch.length < 100) break;
    }
    const agency = agencies.find(a => /Trasporti Pubblici Luganesi/i.test(a.agency_name));
    expect(agency, 'The staging fixture requires the loaded TPL timetable').toBeTruthy();
    // Separate random byte pairs so the fixture cannot accidentally contain
    // a forbidden triple repetition or ascending three-character sequence.
    const password = 'Q!a7!' + Array.from(randomBytes(16), byte => byte.toString(16).padStart(2, '0')).join('!');
    user = await json('POST', '/auth/register', {
      company_id: agency.id, email: 'rc3-qa-' + suffix + '@example.com',
      full_name: name, password,
    });
    const login = await json('POST', '/auth/login', { email: user.email, password });
    token = login.access_token;
    expect(typeof token).toBe('string');
    steps.push('temporary account registered and authenticated');
    const datasets = await json('GET', '/api/v1/gtfs/datasets');
    const dataset = [...datasets].sort((a,b) => b.gtfs_year - a.gtfs_year || b.gtfs_file_date.localeCompare(a.gtfs_file_date))[0];
    expect(dataset).toBeTruthy();
    const routes = await json('GET', '/api/v1/gtfs/gtfs-routes/?' + new URLSearchParams({
      gtfs_year: String(dataset.gtfs_year), gtfs_file_date: dataset.gtfs_file_date, limit: '100',
    }));
    let selected, route, stops;
    for (const candidate of routes.filter(r => r.route_type === 3 || r.route_type >= 700 && r.route_type <= 719).slice(0,8)) {
      const trips = await json('GET', '/api/v1/gtfs/gtfs-trips/by-route/' + candidate.id + '?day_of_week=monday&status=gtfs');
      for (const trip of trips.slice(0,3)) {
        const edges = await json('GET', '/api/v1/gtfs/gtfs-stops/by-trip/' + trip.id);
        const start = edges[0]?.departure_time ?? edges[0]?.arrival_time;
        const end = edges.at(-1)?.arrival_time ?? edges.at(-1)?.departure_time;
        if (edges.length > 1 && start && end && start < '22:00:00' && end < '23:30:00') {
          selected = trip; route = candidate; stops = edges; break;
        }
      }
      if (selected) break;
    }
    expect(selected, 'An ordinary Monday service must be available').toBeTruthy();
    model = await json('POST', '/api/v1/user/bus-models/', {
      user_id: user.id, name, specs: {
        bus_length_m: 12, empty_weight_kg: 12000, battery_pack_size_kwh: 50,
        battery_pack_weight_kg: 300, min_battery_packs: 4, max_battery_packs: 8, max_passengers: 70,
      },
    });
    bus = await json('POST', '/api/v1/user/buses/', {
      user_id: user.id, name, bus_model_id: model.id, specs: {},
    });
    depot = await json('POST', '/api/v1/user/depots/', {
      user_id: user.id, name, latitude: Number(stops[0].stop_lat) + 0.001, longitude: Number(stops[0].stop_lon) + 0.001,
    });
    const invalid = await api('POST', '/api/v1/user/shifts/', {
      name: ' ', bus_id: bus.id, trip_ids: [selected.id], gtfs_dataset: dataset,
    });
    expect(invalid.status()).toBe(422);
    const duplicate = await api('POST', '/api/v1/user/shifts/', {
      name, bus_id: bus.id, trip_ids: [selected.id, selected.id], gtfs_dataset: dataset,
    });
    expect(duplicate.status()).toBe(422);
    const direct = await api('GET', '/api/v1/user/shifts/', undefined, { direct: true });
    const proxy = await api('GET', '/api/v1/user/shifts/');
    expect(direct.status()).toBe(200);
    expect(await proxy.json()).toEqual(await direct.json());
    steps.push('real validation rejects whitespace names and duplicate trip IDs; direct/proxy responses match');
    await page.addInitScript(token => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('elettra_lang', 'en');
      localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
    }, token);
    await page.goto('./#shift-form');
    await expect(page.locator('form.shift-composer')).toBeVisible();
    await page.locator('#shift-name').fill(name);
    await page.locator('#shift-bus').selectOption(bus.id);
    await page.locator('#shift-start-depot').selectOption(depot.id);
    await page.locator('#shift-end-depot').selectOption(depot.id);
    await page.locator('#shift-start-time').fill('00:00');
    await page.locator('#shift-end-time').fill('23:59');
    if (await page.locator('#shift-gtfs-dataset').count())
      await page.locator('#shift-gtfs-dataset').selectOption(dataset.gtfs_year + '|' + dataset.gtfs_file_date);
    await page.locator('[data-action="composer-next"]').click();
    await page.locator('#scheduled-trips-line').selectOption(route.id);
    await page.locator('#scheduled-trips-day').selectOption('monday');
    const firstOffered = page.locator('[data-action="add-trip"]').first();
    await expect(firstOffered).toBeVisible();
    const renderedId = await firstOffered.locator('xpath=ancestor::tr').getAttribute('data-trip-id');
    const offered = await json('GET', '/api/v1/gtfs/gtfs-trips/by-route/' + route.id + '?day_of_week=monday&status=gtfs');
    selected = offered.find(trip => trip.trip_id === renderedId || trip.id === renderedId);
    expect(selected, 'The offered UI trip must map to a real API record').toBeTruthy();
    await firstOffered.click();
    await page.locator('[data-action="composer-next"]').click();
    await page.locator('.language-select').selectOption('it');
    await expect(page.locator('.composer-itinerary li')).toHaveCount(1);
    const createdResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/user/shifts/'), { timeout: 90_000 });
    await page.locator('[type="submit"]').click();
    const created = await createdResponse;
    expect(created.status()).toBe(200);
    const saved = await created.json();
    shiftIds.add(saved.id);
    await expect(page.locator('section.shifts')).toBeVisible({ timeout: 20_000 });
    const persisted = await json('GET', '/api/v1/user/shifts/' + saved.id);
    expect(persisted.structure.map(t => t.trip_id)[1]).toBe(selected.id);
    expect(persisted.structure).toHaveLength(3);
    expect(persisted.gtfs_datasets.some(d => d.gtfs_year === dataset.gtfs_year && d.gtfs_file_date === dataset.gtfs_file_date)).toBe(true);
    steps.push('deployed UI saved one service trip plus two real depot connections, retaining its GTFS edition');
    const row = page.locator('tr').filter({ hasText: name });
    await row.locator('[data-row-action="edit"]').click();
    await expect(page.locator('form.shift-composer')).toHaveAttribute('data-composer-step', 'compose');
    await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(1);
    await page.locator('[data-composer-step="setup"]').click();
    await expect(page.locator('#shift-start-time')).toHaveValue('00:00');
    await expect(page.locator('#shift-end-time')).toHaveValue('23:59');
    await page.locator('#shift-name').fill(name + ' edited');
    await page.locator('[data-composer-step="review"]').click();
    const updateResponse = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname.endsWith('/user/shifts/' + saved.id), { timeout: 90_000 });
    await page.locator('[type="submit"]').click();
    expect((await updateResponse).status()).toBe(200);
    const updated = await json('GET', '/api/v1/user/shifts/' + saved.id);
    expect(updated.name).toBe(name + ' edited');
    expect(updated.structure).toHaveLength(3);
    expect(updated.structure[1].trip_id).toBe(selected.id);
    steps.push('deployed UI reopened the saved programme and persisted an edit with PUT');
    await page.screenshot({ path: info.outputPath('live-saved-shift.png'), fullPage: true });
  } finally {
    await Promise.allSettled(responseTasks);
    const remove = async (path, accepted = [200,204,404]) => {
      try {
        const response = await cleanupRequest.delete(frontendUrl + path, { headers: { Authorization: 'Bearer ' + token } });
        if (!accepted.includes(response.status())) cleanupErrors.push({ path, status: response.status() });
      } catch (error) { cleanupErrors.push({ path, error: error.message }); }
    };
    for (const id of shiftIds) await remove('/api/v1/user/shifts/' + id);
    for (const id of auxiliaryIds) await remove('/api/v1/gtfs/gtfs-trips/' + id);
    if (depot) await remove('/api/v1/user/depots/' + depot.id);
    if (bus) await remove('/api/v1/user/buses/' + bus.id);
    if (model) await remove('/api/v1/user/bus-models/' + model.id);
    if (token) await remove('/auth/me');
    await info.attach('live-api-summary', { body: JSON.stringify({ steps, createdAuxiliaryTrips: auxiliaryIds.size, createdShifts: shiftIds.size, cleanupErrors }), contentType: 'application/json' });
    await cleanupRequest.dispose();
    expect(cleanupErrors, 'All temporary staging records must be removed').toEqual([]);
  }
});

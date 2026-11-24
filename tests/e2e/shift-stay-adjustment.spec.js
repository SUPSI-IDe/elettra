import { test, expect, deferred, language, configure } from '../../test-support/shift-composer-fixture.js';
import { adjustmentOptions, adjustmentOptionsFor, shift0000, shift00000, shift00000Trips } from '../../test-support/shift-stay-adjustment-fixture.js';

const rows = page => page.locator('[data-role="shift-trips-body"] tr');
const settle = async page => {
  await expect(page.locator('[data-action="composer-next"]')).toBeEnabled();
  await expect(page.locator('[data-action="composer-next"]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-role="feedback"]')).not.toContainText('checking transfers');
};
const editStay = async (page, arrival, departure) => {
  await page.locator('#stay-0-arrivalTime').fill(arrival);
  await page.locator('#stay-0-arrivalTime').press('Enter');
  await page.locator('#stay-0-departureTime').fill(departure);
  await page.locator('#stay-0-departureTime').press('Enter');
  await settle(page);
};

test('creation uses the same automatic adjustment and saves every service period in order', async ({ page, composer }) => {
  const state = await composer(adjustmentOptions({ edit: false, application: true, entry: 'shift-form' }));
  await configure(page, { start: '08:00', end: '16:00', depotId: shift00000.depots.find(stop => stop.name === 'TPL Rimessa 1').id });
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(rows(page)).toHaveCount(19);
  await expect(page.locator('#shift-start-time')).toHaveValue('08:00');
  await expect(page.locator('#shift-end-time')).toHaveValue('16:00');
  await page.locator('#stay-after-trip').selectOption(shift00000Trips[10].id);
  await page.locator('[data-action="add-stay"]').click();
  await page.locator('#stay-0-depot').selectOption(shift00000.depots.find(stop => stop.name === 'TPL Posteggio Lugano Centro').id);
  await editStay(page, '12:00', '13:00');
  await expect(rows(page)).toHaveCount(8);
  const arrival = page.locator('#stay-0-arrivalTime');
  await arrival.evaluate(element => {
    window.creationTimeInput = element;
    window.creationTypedValue = element.value;
    element.addEventListener('input', () => { window.creationTypedValue = element.value; });
  });
  await arrival.focus();
  await arrival.press('ArrowUp');
  await page.waitForTimeout(800);
  expect(await arrival.evaluate(element => element === window.creationTimeInput)).toBe(true);
  expect(await arrival.inputValue()).toBe(await page.evaluate(() => window.creationTypedValue));
  await expect(page.locator('#stay-0-departureTime')).toHaveValue('13:00');
  await arrival.fill('11:30');
  await arrival.press('Enter');
  await settle(page);
  await page.locator('#stay-0-departureTime').fill('13:30');
  // One click from the focused time field must commit, await routing and review.
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('[data-composer-panel="review"]')).toBeVisible();
  await expect(page.locator('.composer-itinerary__stay')).toContainText('11:30 – 13:30');
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(5);
  expect(state.writes.at(-1).method).toBe('POST');
  expect(state.writes.at(-1).body.trip_ids).toHaveLength(20);
});

test('creation builds the next period after entering a stay before choosing its trips', async ({ page, composer }) => {
  const state = await composer(adjustmentOptions({ edit: false, application: true, entry: 'shift-form',
    respond: ({ path }) => path.includes('/gtfs-trips/by-route/') ? { json: path.includes('line-2')
      ? shift00000Trips.slice(11).map(trip => ({ ...trip, route_id: 'line-2' })) : shift00000Trips.slice(0, 11) } : undefined,
  }));
  await configure(page, { start: '08:00', end: '16:00', depotId: shift00000.depots.find(stop => stop.name === 'TPL Rimessa 1').id });
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(rows(page)).toHaveCount(11);
  await page.locator('[data-action="add-stay"]').click();
  await expect(rows(page)).toHaveCount(0);
  await page.locator('#stay-0-depot').selectOption(shift00000.depots.find(stop => stop.name === 'TPL Posteggio Lugano Centro').id);
  await editStay(page, '11:30', '13:00');
  await expect(page.locator('[data-action="select-period"]').first()).toContainText('10');
  await page.locator('#scheduled-trips-line').selectOption('line-2');
  await expect(page.locator('[data-action="add-all-trips"]')).toBeEnabled();
  await page.locator('[data-action="add-all-trips"]').click();
  await expect(rows(page)).toHaveCount(8);
  await page.locator('[data-action="composer-next"]').click();
  await expect(page.locator('.composer-itinerary__stay')).toContainText('11:30 – 13:00');
  await page.locator('[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(5);
  expect(state.writes.at(-1).body.trip_ids).toHaveLength(22);
});

test('transfer API rejects failed and malformed responses and aborts a timeout', async ({ page, composer }) => {
  const gate = deferred();
  let mode = 'success';
  await composer(adjustmentOptions({ respond: async ({ path }) => {
    if (!path.includes('/osrm/driving-distance')) return;
    if (mode === 'timeout') await gate.promise;
    if (mode === 'failure') return { status: 502, json: { detail: 'Routing unavailable' } };
    if (mode === 'malformed') return { json: { duration_seconds: null } };
    return { json: { duration_seconds: 60.1 } };
  } }));
  const call = timeoutMs => page.evaluate(async timeout => {
    const { fetchShiftTransferDuration } = await import(new URL('src/api/shift-routing.js', document.baseURI).href);
    try { return await fetchShiftTransferDuration({ stopId: 'stop', lat: 46, lon: 9, direction: 'to_stop' }, { timeoutMs: timeout }); }
    catch (error) { return { error: error.name }; }
  }, timeoutMs);
  expect(await call(5000)).toBe(60.1);
  for (mode of ['failure', 'malformed']) expect(await call(5000)).toEqual({ error: 'Error' });
  mode = 'timeout';
  try { expect(await call(50)).toEqual({ error: 'AbortError' }); }
  finally { gate.resolve(); }
});

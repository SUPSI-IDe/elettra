import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rebuildStayProgramme } from '../src/pages/Fleet/Shifts/shift-stay-programme.js';
import { readShiftDepotStays, splitServicePeriods, validateDepotStays } from '../src/pages/Fleet/Shifts/shift-depot-stays.js';
import { serviceMinutes } from '../src/pages/Fleet/Shifts/shift-stay-adjustment.js';
const fixture = name => JSON.parse(readFileSync(new URL(`../test-support/${name}.json`, import.meta.url)));
const data = fixture('shift-0000');
const original = readShiftDepotStays({ shift: data.shift, shiftInfo: data.shiftInfo, depots: data.depots });
const parking = data.depots.find(stop => stop.id === original.stays[0].depotId);
const bounds = { startDepotId: data.depots.find(stop => stop.name === 'TPL Rimessa 1').id, endDepotId: data.depots.find(stop => stop.name === 'TPL Rimessa 1').id, startTime: '08:00', endTime: '20:00' };
const travelMinutes = async (trip, stop, direction) => {
  if (stop.id !== parking.id) return 0; // untouched outer links are preserved from the saved programme
  const name = direction === 'to_stop' ? trip.start_stop_name : trip.end_stop_name;
  const seconds = data.routing_observations.find(item => item.name === name && item.direction === direction)?.seconds;
  assert.equal(typeof seconds, 'number');
  return Math.max(1, Math.ceil(seconds / 60));
};
const build = overrides => rebuildStayProgramme({ trips: original.trips, previousStays: original.stays, stays: original.stays,
  candidates: data.candidateTrips, depots: data.depots, existingConnections: original.connections, ...bounds, travelMinutes, ...overrides });
const verify = result => {
  assert.equal(result.status, 'ready');
  assert.equal(validateDepotStays({ ...result, depots: data.depots, ...bounds }), '');
  assert.equal(new Set(result.trips.map(trip => trip.id)).size, result.trips.length);
  for (const period of splitServicePeriods(result.trips, result.stays)) {
    for (let i = 1; i < period.trips.length; i++) {
      assert.equal(period.trips[i - 1].end_stop_name, period.trips[i].start_stop_name);
      assert.ok(serviceMinutes(period.trips[i - 1].arrival_time) <= serviceMinutes(period.trips[i].departure_time));
    }
  }
};
test('0000: restart at 15:00 adds a connected bridge and retains every original trip', async () => {
  const snapshot = structuredClone(original);
  const result = await build({ stays: [{ ...original.stays[0], departureTime: '15:00' }] });
  verify(result);
  assert.deepEqual(result.addedTrips.map(trip => trip.departure_time), ['15:10', '15:37', '15:55']);
  assert.equal(result.removedTrips.length, 0);
  assert.deepEqual(result.periods[0], splitServicePeriods(original.trips, original.stays)[0].trips);
  assert.deepEqual(original, snapshot);
});
for (const [arrival, departure] of [['10:00', '16:30'], ['09:45', '17:00'], ['10:30', '15:30'], ['10:30', '16:00']]) {
  test(`0000: general valid window ${arrival}–${departure} keeps clocks and fixed GTFS times`, async () => {
    const result = await build({ stays: [{ ...original.stays[0], arrivalTime: arrival, departureTime: departure }] });
    verify(result);
    assert.equal(result.stays[0].arrivalTime, arrival);
    assert.equal(result.stays[0].departureTime, departure);
    const pool = [...original.trips, ...data.candidateTrips];
    for (const trip of result.trips) {
      const saved = pool.find(item => item.id === trip.id);
      assert.equal(serviceMinutes(trip.departure_time), serviceMinutes(saved.departure_time));
      assert.equal(serviceMinutes(trip.arrival_time), serviceMinutes(saved.arrival_time));
    }
  });
}
test('unchanged programme requires no routing and retains all IDs and anchors', async () => {
  const result = await build({ travelMinutes: () => { throw Error('Unnecessary request'); } });
  assert.deepEqual(result.trips, original.trips);
  assert.deepEqual(result.stays, original.stays.map(stay => ({ ...stay, arrivalTime: stay.arrivalTime.slice(0,5), departureTime: stay.departureTime.slice(0,5) })));
});
for (const [arrival, departure] of [['07:00','18:00'], ['11:00','11:00'], ['13:00','12:00'], ['10:30','21:00'], ['','16:00']]) {
  test(`invalid stay ${arrival}–${departure} returns an error without clamping or mutation`, async () => {
    const stays = [{ ...original.stays[0], arrivalTime: arrival, departureTime: departure }];
    const snapshot = structuredClone(stays);
    const result = await build({ stays });
    assert.equal(result.status, 'error');
    assert.deepEqual(stays, snapshot);
  });
}
test('impossible transfer produces an explicit no-programme error', async () => {
  const result = await build({ stays: [{ ...original.stays[0], departureTime: '15:00' }], travelMinutes: async () => 10000, existingConnections: [] });
  assert.equal(result.status, 'error');
  assert.equal(result.key, 'shifts.editor_no_trips');
});
test('routing failures propagate atomically and remain retryable', async () => {
  const options = { stays: [{ ...original.stays[0], departureTime: '15:00' }] };
  await assert.rejects(build({ ...options, travelMinutes: async () => { throw Error('offline'); } }), /offline/);
  verify(await build(options));
});

const stop = { id: 'custom', stop_id: 'custom-stop', name: 'Custom stop' };
const trip = (id, start, end, from='A', to='B') => ({ id, trip_id: `gtfs-${id}`, route_id: 'route', status: 'gtfs', departure_time: start, arrival_time: end, start_stop_name: from, end_stop_name: to });
const simple = overrides => rebuildStayProgramme({ trips: [], candidates: [], previousStays: [], stays: [], depots: [stop], startDepotId: stop.id, endDepotId: stop.id, startTime: '08:00', endTime: '18:00', travelMinutes: async () => 0, ...overrides });
test('multiple stays isolate unaffected windows and infer all anchors', async () => {
  const trips = [trip('a','08:00','09:00'), trip('b','11:00','12:00','B','A'), trip('c','15:00','16:00','A','B')];
  const stays = [{ afterTripId: 'a', depotId: stop.id, arrivalTime: '09:10', departureTime: '10:00' }, { afterTripId: 'b', depotId: stop.id, arrivalTime: '12:10', departureTime: '14:00' }];
  const result = await simple({ trips, previousStays: stays, stays: [stays[0], { ...stays[1], departureTime: '13:00' }], candidates: [trip('new','13:10','13:40','B','A')] });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.periods.map(period => period.map(trip => trip.id)), [['a'],['b'],['new','c']]);
  assert.deepEqual(result.stays.map(stay => stay.afterTripId), ['a','b']);
});
test('add and remove stays: programme is rebuilt, anchors are derived and time order remains valid', async () => {
  const trips = [trip('a','08:00','09:00'), trip('b','11:00','12:00','B','A'), trip('c','15:00','16:00','A','B')];
  const added = await simple({ trips, stays: [{ depotId: stop.id, arrivalTime: '09:10', departureTime: '14:00' }] });
  assert.equal(added.status, 'ready');
  assert.deepEqual(added.trips.map(trip => trip.id), ['a','c']);
  assert.equal(added.stays[0].afterTripId, 'a');
  const removed = await simple({ trips: added.trips, previousStays: added.stays, candidates: trips });
  assert.deepEqual(removed.trips.map(trip => trip.id), ['a','b','c']);
});
test('overnight stays keep explicit service-day times beyond midnight', async () => {
  const trips = [trip('a','22:10','23:00'), trip('b','25:00','26:00')];
  const result = await simple({ trips, startTime: '22:00', endTime: '27:00', stays: [{ depotId: stop.id, arrivalTime: '23:10', departureTime: '24:30' }] });
  assert.equal(result.status, 'ready');
  assert.equal(result.stays[0].departureTime, '24:30');
  assert.deepEqual(result.trips.map(trip => trip.id), ['a','b']);
});
test('existing trips take priority over a longer alternative with more newly added trips', async () => {
  const selected = trip('saved','10:00','12:00');
  const result = await simple({ trips: [selected], stays: [{ depotId: stop.id, arrivalTime: '13:00', departureTime: '14:00' }], candidates: [trip('x','10:00','10:30','A','C'),trip('y','10:30','11:00','C','D'),trip('z','11:00','12:00','D','B'),trip('last','15:00','16:00')] });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.trips.map(trip => trip.id), ['saved','last']);
});
test('overlapping stays and missing custom-stop mapping are rejected before routing', async () => {
  const result = await simple({ stays: [{ depotId: stop.id, arrivalTime: '10:00', departureTime: '12:00' },{ depotId: stop.id, arrivalTime: '11:00', departureTime: '13:00' }], travelMinutes: () => { throw Error('Unexpected'); } });
  assert.equal(result.key, 'shifts.editor_invalid_times');
  assert.equal((await simple({ stays: [{ depotId: 'missing', arrivalTime: '10:00', departureTime: '12:00' }] })).key, 'shifts.stay_depot_required');
});

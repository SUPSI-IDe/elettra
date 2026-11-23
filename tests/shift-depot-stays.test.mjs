import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildProgrammeMovements, persistProgrammeMovements, readShiftDepotStays, splitServicePeriods, validateDepotStays } from '../src/pages/Fleet/Shifts/shift-depot-stays.js';

const fixture = JSON.parse(readFileSync(new URL('../test-support/shift-40507-weekday.json', import.meta.url)));
const load = () => readShiftDepotStays(fixture);
const settings = { depots: fixture.depots, startDepotId: fixture.depots[0].id, endDepotId: fixture.depots[0].id, startTime: '06:54', endTime: '24:20' };
const edges = async id => {
  const stops = fixture.shift.structure.find(item => item.trip_id === id).stop_times;
  return { firstStopId: stops[0].id, firstStopArrival: stops[0].arrival_time,
    lastStopId: stops.at(-1).id, lastStopDeparture: stops.at(-1).departure_time };
};

test('40507_weekday recovers 18 services, both periods and the 09:43–16:02 depot stay', () => {
  const programme = load();
  assert.equal(programme.trips.length, 18);
  assert.equal(programme.stays.length, 1);
  assert.equal(programme.stays[0].arrivalTime, '09:43');
  assert.equal(programme.stays[0].departureTime, '16:02');
  assert.deepEqual(splitServicePeriods(programme.trips, programme.stays).map(period => period.trips.length), [4, 14]);
  assert.equal(validateDepotStays({ ...settings, ...programme }), '');
});

test('unchanged round trip preserves all 22 original UUIDs and creates no auxiliary trips', async () => {
  const programme = load();
  const ids = await persistProgrammeMovements({ movements: buildProgrammeMovements({ ...settings, ...programme }),
    existingConnections: programme.connections, fetchEdges: edges,
    createConnection: () => assert.fail('Unchanged connections must be reused') });
  assert.deepEqual(ids, fixture.shift.structure.map(item => item.trip_id));
});

test('changing the intermediate departure regenerates only that connection', async () => {
  const programme = load();
  programme.stays[0].departureTime = '16:00';
  const writes = [];
  const ids = await persistProgrammeMovements({ movements: buildProgrammeMovements({ ...settings, ...programme }),
    existingConnections: programme.connections, fetchEdges: edges,
    createConnection: async request => { writes.push(request); return { id: 'new-departure' }; } });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].departureTime, '16:00');
  assert.equal(ids.length, 22);
  assert.equal(ids[6], 'new-departure');
});

test('creation persists four depot connections interleaved with the 18 services', async () => {
  const programme = load(), writes = [];
  const ids = await persistProgrammeMovements({ movements: buildProgrammeMovements({ ...settings, ...programme }), fetchEdges: edges,
    createConnection: async request => { writes.push(request); return { id: `new-${writes.length}` }; } });
  assert.equal(ids.length, 22);
  assert.deepEqual([ids[0], ids[5], ids[6], ids.at(-1)], ['new-1', 'new-2', 'new-3', 'new-4']);
  assert.deepEqual(writes.map(item => [item.departureTime, item.arrivalTime]), [
    ['06:54', '07:02:00'], ['09:36:00', '09:43'], ['16:02', '16:10:00'], ['24:13:00', '24:20'],
  ]);
});

test('removing the stay merges the periods and drops only the intermediate connections', () => {
  const programme = load();
  const movements = buildProgrammeMovements({ ...settings, ...programme, stays: [] });
  assert.equal(movements.length, 20);
  assert.equal(movements.filter(item => item.kind === 'service').length, 18);
});

for (const [field, value] of [['arrivalTime', '09:35'], ['departureTime', '09:42'], ['departureTime', '16:11'], ['departureTime', ''], ['arrivalTime', '09:36'], ['departureTime', '16:10'], ['arrivalTime', '09:99']]) {
  test(`rejects infeasible stay ${field}=${value}`, () => {
    const programme = load();
    programme.stays[0][field] = value;
    assert.equal(validateDepotStays({ ...settings, ...programme }), 'shifts.stay_times_invalid');
  });
}

test('rejects missing depots, dangling anchors, duplicate stays and empty final periods', () => {
  const programme = load();
  assert.equal(validateDepotStays({ ...settings, ...programme, depots: [] }), 'shifts.stay_depot_required');
  assert.equal(validateDepotStays({ ...settings, ...programme, stays: [{ ...programme.stays[0], afterTripId: 'missing' }] }), 'shifts.stay_invalid_anchor');
  assert.equal(validateDepotStays({ ...settings, ...programme, stays: [programme.stays[0], programme.stays[0]] }), 'shifts.stay_invalid_anchor');
  assert.equal(validateDepotStays({ ...settings, ...programme, stays: [{ ...programme.stays[0], afterTripId: programme.trips.at(-1).id }] }), 'shifts.stay_empty_period');
});

test('multiple stays support different depots and GTFS times beyond midnight', () => {
  const { trips, stays } = load();
  const extra = { afterTripId: trips.at(-2).id, depotId: 'second', arrivalTime: '23:46', departureTime: '23:48' };
  const depots = [...fixture.depots, { ...fixture.depots[0], id: 'second', name: 'Second depot' }];
  assert.equal(validateDepotStays({ ...settings, trips, stays: [...stays, extra], depots }), '');
  assert.deepEqual(splitServicePeriods(trips, [...stays, extra]).map(item => item.trips.length), [4, 13, 1]);
  const overnightTrips = trips.slice(-2).map((trip, index) => ({ ...trip,
    departure_time: index ? '25:00' : '23:30', arrival_time: index ? '25:30' : '24:00' }));
  assert.equal(validateDepotStays({ ...settings, endTime: '26:00', trips: overnightTrips,
    stays: [{ afterTripId: overnightTrips[0].id, depotId: depots[0].id, arrivalTime: '24:05', departureTime: '24:50' }] }), '');
});

test('unrecognised intermediate movements block reconstruction instead of silently dropping them', () => {
  const data = structuredClone(fixture);
  data.shiftInfo.trips.splice(6, 1);
  data.shift.structure.splice(6, 1);
  assert.throws(() => readShiftDepotStays(data), /unrecoverable_depot_stay/);
});

test('a depot pair disconnected from the adjacent service blocks safe reconstruction', () => {
  const data = structuredClone(fixture);
  data.shift.structure[5].stop_times[0].id = 'different-stop';
  assert.throws(() => readShiftDepotStays(data), /unrecoverable_depot_stay/);
});

test('connection failure propagates without returning an incomplete shift structure', async () => {
  let calls = 0;
  await assert.rejects(persistProgrammeMovements({ movements: buildProgrammeMovements({ ...settings, ...load() }), fetchEdges: edges,
    createConnection: async () => { if (++calls === 3) throw new Error('routing failed'); return { id: `new-${calls}` }; } }), /routing failed/);
  assert.equal(calls, 3);
});

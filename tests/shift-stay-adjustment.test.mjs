import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adjustStayProgramme, periodTripInsertion, planPeriodTripInsertion, serviceMinutes, serviceTime } from '../src/pages/Fleet/Shifts/shift-stay-adjustment.js';
import { createShiftTransferResolver } from '../src/pages/Fleet/Shifts/shift-transfer-routing.js';
import { readShiftDepotStays, splitServicePeriods, validateDepotStays, buildProgrammeMovements, persistProgrammeMovements } from '../src/pages/Fleet/Shifts/shift-depot-stays.js';

const fixture = JSON.parse(readFileSync(new URL('../test-support/shift-00000.json', import.meta.url)));
const load = () => readShiftDepotStays(fixture);
const fixture0000 = JSON.parse(readFileSync(new URL('../test-support/shift-0000.json', import.meta.url)));

for (const [time, removed] of [
  ['15:52:00', ['16:21']], ['16:07:00', ['16:21']],
  ['16:10:00', ['16:21', '16:40']], ['16:35:00', ['16:21', '16:40', '16:55']],
]) {
  test(`0000: choosing ${time} replaces only incompatible trips after a 15:00 restart`, () => {
    const programme = readShiftDepotStays(fixture0000);
    const period = splitServicePeriods(programme.trips, programme.stays)[1];
    const trip = fixture0000.candidateTrips.find(item => item.departure_time === time);
    const input = { trip, period, startTime: '15:00', endTime: '20:00', selectedTripIds: new Set(programme.trips.map(item => item.trip_id)) };
    const before = JSON.stringify(input);
    assert.equal(periodTripInsertion(input), -1, 'the old filter hid this alternative');
    const plan = planPeriodTripInsertion(input);
    assert.deepEqual(plan.removedTrips.map(item => item.departure_time), removed);
    assert.equal(JSON.stringify(input), before, 'planning cannot mutate the saved selection');
    const inserted = plan.trips.find(item => item.id === trip.id);
    assert.equal(serviceMinutes(inserted.departure_time), serviceMinutes(trip.departure_time));
    assert.equal(serviceMinutes(inserted.arrival_time), serviceMinutes(trip.arrival_time));
    for (let i = 1; i < plan.trips.length; i++) {
      assert(serviceMinutes(plan.trips[i - 1].arrival_time) <= serviceMinutes(plan.trips[i].departure_time));
      assert.equal(plan.trips[i - 1].end_stop_name, plan.trips[i].start_stop_name);
    }
  });
}
const settings = { depots: fixture.depots, startTime: '08:00', endTime: '16:00', index: 0 };

test('replacement plans minimize exclusions and never store UI planning metadata', () => {
  const programme = readShiftDepotStays(fixture0000);
  const period = splitServicePeriods(programme.trips, programme.stays)[1];
  const selectedTripIds = new Set(programme.trips.map(trip => trip.trip_id));
  for (const trip of fixture0000.candidateTrips) {
    const plan = planPeriodTripInsertion({ trip: { ...trip, programmeInsertion: { old: true } }, period, selectedTripIds, startTime: '15:00', endTime: '20:00' });
    if (!plan) continue;
    let minimum = period.trips.length;
    for (let left = -1; left < period.trips.length; left++) {
      for (let right = left + 1; right <= period.trips.length; right++) {
        const previous = period.trips[left], next = period.trips[right];
        if (previous && (serviceMinutes(previous.arrival_time) > serviceMinutes(trip.departure_time) || previous.end_stop_name !== trip.start_stop_name)) continue;
        if (next && (serviceMinutes(next.departure_time) < serviceMinutes(trip.arrival_time) || next.start_stop_name !== trip.end_stop_name)) continue;
        minimum = Math.min(minimum, right - left - 1);
      }
    }
    assert.equal(plan.removedTrips.length, minimum);
    assert(!('programmeInsertion' in plan.trips.find(item => item.id === trip.id)));
  }
});
const travelMinutes = async (trip, stop, direction) => fixture.routing_observations.find(item =>
  item.name === (direction === 'from_stop' ? trip.end_stop_name : trip.start_stop_name) && item.direction === direction)?.minutes ?? 2;
const request = (arrivalTime, departureTime, extra = {}) => {
  const programme = load();
  programme.stays[0] = { ...programme.stays[0], arrivalTime, departureTime };
  return { ...settings, ...programme, field: 'departureTime', travelMinutes, ...extra };
};
const invariant = (input, result) => {
  assert.equal(result.status, 'ready');
  assert.equal(validateDepotStays({ ...settings, ...input, ...result }), '');
  const periods = splitServicePeriods(result.trips, result.stays);
  assert(periods.every(period => period.trips.length > 0));
  assert.equal(new Set(result.trips.map(trip => trip.id)).size, result.trips.length);
  const original = new Map(input.trips.map(trip => [trip.id, trip]));
  for (const trip of result.trips) assert.deepEqual(trip, original.get(trip.id), 'GTFS schedules remain unchanged');
  assert.equal(result.trips.length + result.removedTrips.length, input.trips.length);
};

test('00000: widening to 11:30–13:30 excludes the three incompatible trips with real asymmetric route observations', async () => {
  const input = request('11:30', '13:30');
  const before = JSON.stringify(input);
  const result = await adjustStayProgramme(input);
  invariant(input, result);
  assert.equal(result.trips.length, 16);
  assert.deepEqual(result.removedTrips.map(trip => trip.departure_time), ['11:37', '13:10', '13:26']);
  assert.deepEqual(splitServicePeriods(result.trips, result.stays).map(period => period.trips.length), [10, 6]);
  assert.equal(result.stays[0].arrivalTime, '11:30');
  assert.equal(result.stays[0].departureTime, '13:30');
  assert.equal(JSON.stringify(input), before, 'the projection is immutable');
});

// A systematic set of requested times, including values outside the shift,
// inverted/zero intervals and exact boundaries. No particular stay is special.
for (const arrival of ['07:00', '08:17', '09:00', '10:30', '11:30', '12:00', '13:30', '15:59', '18:00']) {
  for (const departure of ['07:00', '08:18', '10:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '15:37', '16:00', '18:00']) {
    test(`adjusts general window ${arrival}–${departure} without changing GTFS trips`, async () => {
      const input = request(arrival, departure);
      const result = await adjustStayProgramme(input);
      invariant(input, result);
      const periods = splitServicePeriods(result.trips, result.stays);
      const before = periods[0].trips.at(-1), after = periods[1].trips[0], stop = input.depots.find(stop => stop.id === result.stays[0].depotId);
      assert(serviceMinutes(before.arrival_time) + await travelMinutes(before, stop, 'from_stop') <= serviceMinutes(result.stays[0].arrivalTime));
      assert(serviceMinutes(result.stays[0].departureTime) + await travelMinutes(after, stop, 'to_stop') <= serviceMinutes(after.departure_time));
    });
  }
}

test('shortening retains the reduced selection; excluded trips become insertable rather than being auto-added', async () => {
  const expanded = await adjustStayProgramme(request('11:30', '13:30'));
  const stays = [{ ...expanded.stays[0], arrivalTime: '12:00', departureTime: '13:00' }];
  const reduced = await adjustStayProgramme({ ...settings, ...expanded, stays, field: 'departureTime', travelMinutes });
  assert.equal(reduced.trips.length, 16);
  assert.deepEqual(reduced.removedTrips, []);
  let selected = [...reduced.trips];
  const toRestore = [...expanded.removedTrips];
  while (toRestore.length) {
    const periods = splitServicePeriods(selected, reduced.stays);
    let added = false;
    for (let i = 0; i < toRestore.length; i++) {
      const trip = toRestore[i];
      const periodIndex = serviceMinutes(trip.departure_time) < 12 * 60 ? 0 : 1;
      const period = periods[periodIndex];
      const slot = periodTripInsertion({ trip, period, selectedTripIds: new Set(selected.map(trip => trip.trip_id)),
        startTime: periodIndex ? '13:00' : '08:00', endTime: periodIndex ? '16:00' : '12:00' });
      if (slot < 0) continue;
      const offset = periodIndex ? periods[0].trips.length : 0;
      selected.splice(offset + slot, 0, trip);
      if (!periodIndex && slot === period.trips.length) reduced.stays[0].afterTripId = trip.id;
      toRestore.splice(i, 1);
      added = true;
      break;
    }
    assert(added, 'excluded trips can be restored through compatible insertion slots');
  }
  assert.deepEqual(selected.map(trip => trip.id), load().trips.map(trip => trip.id));
});

test('multiple stays constrain the edited stay without moving neighbouring stays', async () => {
  const programme = load();
  programme.stays.push({ afterTripId: programme.trips[14].id, depotId: programme.stays[0].depotId, arrivalTime: '14:21', departureTime: '14:22' });
  const neighbour = structuredClone(programme.stays[1]);
  programme.stays[0].departureTime = '15:30';
  const input = { ...settings, ...programme, field: 'departureTime', travelMinutes };
  const result = await adjustStayProgramme(input);
  invariant(input, result);
  assert.deepEqual(result.stays[1], neighbour);
  assert(serviceMinutes(result.stays[0].departureTime) < serviceMinutes(neighbour.arrivalTime));
  assert.equal(result.adjustedTimes[0].field, 'departureTime');
});

test('overnight clock edits infer the service day, while explicit day selections remain explicit', async () => {
  const programme = load();
  const shift = 12 * 60;
  const trips = programme.trips.map(trip => ({ ...trip,
    departure_time: serviceTime(serviceMinutes(trip.departure_time) + shift),
    arrival_time: serviceTime(serviceMinutes(trip.arrival_time) + shift) }));
  const stays = [{ ...programme.stays[0], arrivalTime: '23:30', departureTime: '01:30' }];
  const input = { ...settings, startTime: '20:00', endTime: '28:00', trips, stays, field: 'departureTime', travelMinutes };
  const result = await adjustStayProgramme(input);
  invariant(input, result);
  assert.equal(result.stays[0].departureTime, '25:30');
  const explicit = await adjustStayProgramme({ ...input, explicitDay: true });
  invariant(input, explicit);
  assert.notEqual(explicit.stays[0].departureTime, '25:30');
});

for (const value of ['', 'no-time', '12:99', '-1:00']) {
  test(`incomplete/invalid time ${JSON.stringify(value)} leaves the selected programme intact`, async () => {
    const input = request('12:00', value);
    const before = JSON.stringify(input);
    assert.equal((await adjustStayProgramme(input)).status, 'incomplete');
    assert.equal(JSON.stringify(input), before);
  });
}

test('impossible route/window and missing custom stop return specific errors without deleting trips', async () => {
  const input = request('12:00', '13:00', { travelMinutes: async () => 1000 });
  const before = JSON.stringify(input);
  assert.deepEqual(await adjustStayProgramme(input), { status: 'error', key: 'shifts.stay_no_window' });
  assert.equal(JSON.stringify(input), before);
  assert.equal((await adjustStayProgramme({ ...input, depots: [] })).key, 'shifts.stay_depot_required');
});

test('routing failures cannot return a partially removed programme', async () => {
  const input = request('11:30', '13:30', { travelMinutes: async trip => {
    if (trip.id === load().trips[5].id) throw new Error('OSRM unavailable');
    return 2;
  } });
  const before = JSON.stringify(input);
  await assert.rejects(adjustStayProgramme(input), /OSRM unavailable/);
  assert.equal(JSON.stringify(input), before);
});

test('save projection after adjustment preserves the requested stay and regenerates exactly the affected connections', async () => {
  const programme = load();
  const result = await adjustStayProgramme(request('11:30', '13:30'));
  const movements = buildProgrammeMovements({ ...settings, ...result,
    startDepotId: fixture.depots.find(stop => stop.name === 'TPL Rimessa 1').id,
    endDepotId: fixture.depots.find(stop => stop.name === 'TPL Rimessa 1').id });
  const writes = [];
  const ids = await persistProgrammeMovements({ movements, existingConnections: programme.connections,
    fetchEdges: async id => {
      const stops = fixture.shift.structure.find(leg => leg.trip_id === id).stop_times;
      return { firstStopId: stops[0].id, firstStopArrival: stops[0].arrival_time, lastStopId: stops.at(-1).id, lastStopDeparture: stops.at(-1).departure_time };
    }, createConnection: async body => { writes.push(body); return { id: `new-${writes.length}` }; } });
  assert.equal(ids.length, 20);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].arrivalTime, '11:30');
  assert.equal(writes[1].departureTime, '13:30');
});

test('transfer resolver shares concurrent routes, keeps directions distinct, rounds up and retries failures', async () => {
  let calls = 0, fail = true;
  const trip = { id: 'trip', stop_times: [{ id: 'a' }, { id: 'b' }] };
  const stop = { stop_id: 'c', latitude: 46, longitude: 9 };
  const resolve = createShiftTransferResolver({ fetchStops: () => assert.fail('Already hydrated'), fetchDuration: async () => {
    calls++;
    if (fail) throw new Error('offline');
    return 60.1;
  } });
  await assert.rejects(resolve(trip, stop, 'from_stop'), /offline/);
  fail = false;
  assert.deepEqual(await Promise.all([resolve(trip, stop, 'from_stop'), resolve(trip, stop, 'from_stop')]), [2, 2]);
  assert.equal(calls, 2);
  await resolve(trip, stop, 'to_stop');
  assert.equal(calls, 3);
  assert.equal(await resolve(trip, { stop_id: 'b' }, 'from_stop'), 0);
  assert.equal(calls, 3);
  await assert.rejects(resolve(trip, { stop_id: 'c' }, 'from_stop'), /coordinates/);
});

test('malformed routing responses are not cached as zero-minute transfers', async () => {
  for (const duration of [NaN, -1, null, undefined, '120']) {
    const resolve = createShiftTransferResolver({ fetchStops: async () => [{ id: 'a' }], fetchDuration: async () => duration });
    await assert.rejects(resolve({ id: 'trip' }, { stop_id: 'c', latitude: 46, longitude: 9 }, 'to_stop'), /Invalid routing/);
  }
});

test('adjustment limits concurrent transfer lookups to four', async () => {
  let active = 0, peak = 0;
  const result = await adjustStayProgramme(request('11:30', '13:30', { travelMinutes: async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(done => setTimeout(done, 1));
    active--; return 2;
  } }));
  assert.equal(result.status, 'ready');
  assert(peak <= 4);
});

test('editing the second of multiple stays preserves earlier periods, anchors and stay times', async () => {
  const programme = load();
  programme.stays.push({ afterTripId: programme.trips[14].id, depotId: programme.stays[0].depotId, arrivalTime: '14:21', departureTime: '14:22' });
  const earlier = structuredClone(programme.stays[0]);
  programme.stays[1].arrivalTime = '13:00';
  programme.stays[1].departureTime = '16:00';
  const input = { ...settings, ...programme, index: 1, field: 'departureTime', travelMinutes };
  const result = await adjustStayProgramme(input);
  invariant(input, result);
  assert.deepEqual(result.stays[0], earlier);
  assert.deepEqual(splitServicePeriods(result.trips, result.stays)[0].trips, splitServicePeriods(programme.trips, programme.stays)[0].trips);
  assert(result.adjustedTimes.length > 0);
});

test('new stays with an empty next period accept clock edits and normalize midnight before trip selection', async () => {
  const { trips, stays } = load();
  const selected = trips.slice(0, 1).map(trip => ({ ...trip, departure_time: '20:00', arrival_time: '20:30' }));
  const input = { ...settings, trips: selected,
    stays: [{ ...stays[0], afterTripId: selected[0].id, arrivalTime: '23:50', departureTime: '00:10' }],
    startTime: '20:00', endTime: '28:00', field: 'departureTime', travelMinutes: async () => 2 };
  const result = await adjustStayProgramme(input);
  assert.equal(result.status, 'ready');
  assert.equal(result.stays[0].departureTime, '24:10');
  assert.equal(input.stays[0].departureTime, '00:10');
});

test('creation trims the preceding period even before trips for the following period have been chosen', async () => {
  const programme = load();
  const trips = programme.trips.slice(0, 11);
  const input = { ...settings, trips, stays: [{ ...programme.stays[0], arrivalTime: '11:30', departureTime: '13:00' }], field: 'arrivalTime', travelMinutes };
  const result = await adjustStayProgramme(input);
  assert.equal(result.status, 'ready');
  assert.equal(result.trips.length, 10);
  assert.equal(result.stays[0].afterTripId, result.trips.at(-1).id);
  assert.deepEqual(result.removedTrips.map(trip => trip.departure_time), ['11:37']);
  assert.equal(validateDepotStays({ ...settings, ...result }), 'shifts.stay_empty_period');
});

test('complete intermediate pairs at the same physical stop survive save/reload with zero transfer time', async () => {
  const trips = [
    { id: 'a', trip_id: 'gtfs-a', status: 'gtfs', departure_time: '08:00', arrival_time: '09:00', start_stop_name: 'A', end_stop_name: 'Hub',
      stop_times: [{ id: 'start', arrival_time: '08:00', departure_time: '08:00' }, { id: 'hub', arrival_time: '09:00', departure_time: '09:00' }] },
    { id: 'b', trip_id: 'gtfs-b', status: 'gtfs', departure_time: '10:00', arrival_time: '11:00', start_stop_name: 'Hub', end_stop_name: 'B',
      stop_times: [{ id: 'hub', arrival_time: '10:00', departure_time: '10:00' }, { id: 'end', arrival_time: '11:00', departure_time: '11:00' }] },
  ];
  const depots = [{ id: 'custom', stop_id: 'hub', name: 'Hub' }];
  const stays = [{ afterTripId: 'a', depotId: 'custom', arrivalTime: '09:00', departureTime: '10:00' }];
  const input = { trips, stays, depots, index: 0, field: 'arrivalTime', startTime: '07:50', endTime: '11:10', travelMinutes: async () => 0 };
  const result = await adjustStayProgramme(input);
  assert.equal(validateDepotStays({ ...input, ...result }), '');
  const info = { trips: [trips[0],
    { id: 'in', trip_id: 'depot-in', status: 'depot', departure_time: '09:00', arrival_time: '09:00', start_stop_name: 'Hub', end_stop_name: 'Hub' },
    { id: 'out', trip_id: 'depot-out', status: 'depot', departure_time: '10:00', arrival_time: '10:00', start_stop_name: 'Hub', end_stop_name: 'Hub' }, trips[1]] };
  const shift = { structure: info.trips.map((trip, index) => ({ trip_id: trip.id, sequence_number: index + 1,
    stop_times: trip.stop_times || [{ id: 'hub', arrival_time: trip.departure_time, departure_time: trip.departure_time }, { id: 'hub', arrival_time: trip.arrival_time, departure_time: trip.arrival_time }] })) };
  assert.deepEqual(readShiftDepotStays({ shift, shiftInfo: info, depots }).stays, stays);
});

test('insertion rejects duplicates, overlapping trips, discontinuities and trips outside the period', () => {
  const trips = load().trips.slice(11);
  const candidate = load().trips[10];
  const base = { trip: candidate, period: { trips }, startTime: '13:00', endTime: '16:00' };
  assert.equal(periodTripInsertion(base), -1);
  const first = trips[0];
  assert.equal(periodTripInsertion({ ...base, trip: first, selectedTripIds: new Set([first.trip_id]) }), -1);
  assert.equal(periodTripInsertion({ ...base, trip: { ...first, trip_id: 'other', arrival_time: '13:30' } }), -1);
  assert.equal(periodTripInsertion({ ...base, trip: { ...first, departure_time: '13:00', arrival_time: '13:05', end_stop_name: 'Elsewhere' } }), -1);
});

test('feasible stay bounds consider every possible boundary trip when transfer durations are not monotonic', async () => {
  const { trips, stays } = load();
  const times = [['08:00', '08:10'], ['08:15', '08:20'], ['09:00', '09:10'], ['09:20', '09:30']];
  const selected = trips.slice(0, 4).map((trip, i) => ({ ...trip, departure_time: times[i][0], arrival_time: times[i][1] }));
  const input = { ...settings, trips: selected, field: 'departureTime',
    stays: [{ ...stays[0], afterTripId: selected[1].id, arrivalTime: '08:30', departureTime: '08:40' }],
    travelMinutes: async trip => trip.id === selected[0].id || trip.id === selected[3].id ? 60 : 1 };
  const result = await adjustStayProgramme(input);
  invariant(input, result);
  assert.equal(result.stays[0].arrivalTime, '08:30');
  assert.equal(result.stays[0].departureTime, '08:40');
  assert.deepEqual(result.removedTrips, []);
});

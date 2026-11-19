import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveShiftEndTime, toClockTime } from '../src/pages/Fleet/Shifts/shift-time-window.js';
import { formatMinutes, resolveShiftDepotTimes } from '../src/pages/Fleet/Shifts/shift-utils.js';

test('clock inputs preserve overnight GTFS service-day offsets in the API window', () => {
  assert.equal(resolveShiftEndTime('23:00', '02:00'), '26:00');
  assert.equal(resolveShiftEndTime('07:00', '18:30'), '18:30');
  assert.equal(resolveShiftEndTime('23:59', '00:00'), '24:00');
  assert.equal(resolveShiftEndTime('23:00', '26:00'), '26:00');
  assert.equal(resolveShiftEndTime('', '02:00'), '02:00');
  assert.equal(resolveShiftEndTime('23:00', ''), '');
});

test('saved extended-hour values round-trip through native clock inputs', () => {
  for (const [gtfs, clock] of [['26:00:00', '02:00'], ['24:00', '00:00'], ['23:59', '23:59'], ['25:30', '01:30']]) {
    assert.equal(toClockTime(gtfs), clock);
  }
  assert.equal(toClockTime(null), '');
  assert.equal(toClockTime(''), '');
  assert.equal(resolveShiftEndTime('23:00', toClockTime('26:00')), '26:00');
});

test('night timeline ticks and tooltips retain extended hours rather than repeating hour 23', () => {
  assert.equal(formatMinutes(24 * 60), '24:00');
  assert.equal(formatMinutes(25 * 60 + 30), '25:30');
  assert.equal(formatMinutes(26 * 60), '26:00');
  assert.equal(formatMinutes(23 * 60 + 59), '23:59');
});

test('the current API contract restores depot margins from the saved auxiliary legs', () => {
  const shift = { structure: [{ trip_id: 'out', sequence_number: 1 }, { trip_id: 'service', sequence_number: 2 }, { trip_id: 'back', sequence_number: 3 }] };
  const shiftInfo = { trips: [
    { id: 'out', trip_id: 'depot-out', start_stop_name: 'Depot', end_stop_name: 'Station', departure_time: '00:00:00', arrival_time: '05:00:00' },
    { id: 'service', trip_id: 'gtfs-service', start_stop_name: 'Station', end_stop_name: 'Airport', departure_time: '05:00:00', arrival_time: '05:53:00' },
    { id: 'back', trip_id: 'depot-return', start_stop_name: 'Airport', end_stop_name: 'Depot', departure_time: '05:53:00', arrival_time: '23:59:00' },
  ] };
  assert.deepEqual(resolveShiftDepotTimes({ shift, shiftInfo }), { startTime: '00:00:00', endTime: '23:59:00' });
  shiftInfo.trips[2].arrival_time = '27:00:00';
  assert.equal(resolveShiftDepotTimes({ shift, shiftInfo }).endTime, '27:00:00');
  assert.deepEqual(resolveShiftDepotTimes({ shift: {}, shiftInfo: null }), { startTime: null, endTime: null });
  for (const trips of [{}, 'invalid', [null, {}]]) {
    assert.deepEqual(resolveShiftDepotTimes({ shift, shiftInfo: { trips } }), { startTime: null, endTime: null });
  }
});

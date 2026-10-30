import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolateTripConsumption } from '../src/utils/soc-display-profile.js';

test('consumption falls during trips, preserving dwell, arrival charging and final SOC', () => {
  // 40 kWh trip, two charging minutes (+10 each), dwell, then 20 kWh trip.
  const stored = [100,100,100,100,100,70,80,80,80,80,60];
  const profile = {first_minute:480,step_minutes:1};
  const intervals = [{departure_minute:480,arrival_minute:484},
    {departure_minute:487,arrival_minute:489}];
  assert.deepEqual(interpolateTripConsumption(stored,profile,intervals,[40,20]),
    [100,90,80,70,60,70,80,80,70,60,60]);
  assert.deepEqual(stored,[100,100,100,100,100,70,80,80,80,80,60]);
});

test('overnight trips use absolute minutes and the selected profile energy', () => {
  const stored = [100,100,100,100,70];
  const profile = {first_minute:1438};
  const intervals = [{departure_minute:1438,arrival_minute:1441}];
  assert.deepEqual(interpolateTripConsumption(stored,profile,intervals,[30]),[100,90,80,70,70]);
  assert.deepEqual(interpolateTripConsumption([100,100,100,100,64],profile,intervals,[36]),[100,88,76,64,64]);
});

test('historical results or invalid intervals keep their stored curve', () => {
  const stored = [100,100,80];
  const profile = {first_minute:0};
  assert.equal(interpolateTripConsumption(stored,profile,undefined,[20]),stored);
  for (const interval of [{departure_minute:1,arrival_minute:1},
    {departure_minute:-1,arrival_minute:1},{departure_minute:0,arrival_minute:5}]) {
    assert.deepEqual(interpolateTripConsumption(stored,profile,[interval],[20]),stored);
  }
});

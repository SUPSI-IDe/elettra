import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBatteryPolicy, batteryEnergy, historicalBatteryParams, NEW_BATTERY_DEFAULTS } from '../src/utils/battery-policy.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);
const constant = (state_of_health, extra = {}) => resolveBatteryPolicy({ battery_soc_policy: 'constant_initial_usable', state_of_health, ...extra });

test('fixed residual SOC scales usable energy with SOH', () => {
  for (const [h, usable] of [[1, 250], [0.85, 212.5], [0.7, 175]]) {
    const policy = resolveBatteryPolicy({ state_of_health: h });
    const energy = batteryEnergy(500, policy);
    assert.equal(policy.min_soc, 0.4);
    assert.equal(policy.max_soc, 0.9);
    close(energy.usable_capacity_kwh, usable);
    close(energy.residual_capacity_kwh, 500 * h);
    close(energy.min_energy_kwh, 500 * h * 0.4);
    close(energy.max_energy_kwh, 500 * h * 0.9);
    assert.equal(energy.nominal_capacity_kwh, 500);
  }
});

test('constant initial usable energy lowers minimum before raising maximum', () => {
  const h70 = constant(0.7);
  close(h70.min_soc, 0.18571428571428572);
  close(h70.max_soc, 0.9);
  close(batteryEnergy(500, h70).usable_capacity_kwh, 250);
  assert.equal(h70.low_soc_warning, true);
  assert.equal(h70.preferred_max_soc_exceeded, false);
  const h60 = constant(0.6);
  close(h60.min_soc, 0.1);
  close(h60.max_soc, 0.9333333333333333);
  close(batteryEnergy(500, h60).usable_capacity_kwh, 250);
  assert.equal(h60.preferred_max_soc_exceeded, true);
  assert.throws(() => constant(0.58), /Requested usable fraction 0.5 exceeds available fraction/);
});

test('SOH 1 preserves policy parity and reference bounds', () => {
  const residual = resolveBatteryPolicy();
  const preserved = constant(1);
  for (const key of Object.keys(residual).filter(key => key !== 'battery_soc_policy')) assert.equal(preserved[key], residual[key]);
  assert.equal(preserved.reference_min_soc, 0.4);
  assert.equal(preserved.reference_max_soc, 0.9);
});

test('warning threshold and maximum ceiling use numeric tolerance', () => {
  assert.equal(resolveBatteryPolicy({ min_soc: 0.2 }).low_soc_warning, false);
  assert.equal(resolveBatteryPolicy({ min_soc: 0.19999 }).low_soc_warning, true);
  assert.equal(resolveBatteryPolicy({ min_soc: 0.2 - 0.5e-12 }).low_soc_warning, false);
  const almost = constant(0.5 / (0.85 + 0.5e-12));
  assert.equal(almost.max_soc, 0.95);
  assert.throws(() => constant(0.5 / (0.85 + 2e-12)), /exceeds available fraction/);
});

test('invalid fractions and policy names are rejected without coercion', () => {
  for (const key of ['state_of_health', 'min_soc', 'max_soc', 'allowed_min_soc', 'allowed_max_soc']) {
    for (const value of [null, NaN, Infinity, -Infinity, true, false, '0.7']) {
      assert.throws(() => resolveBatteryPolicy({ [key]: value }), new RegExp(`${key} must be a finite number`));
    }
  }
  for (const state_of_health of [0, -0.1, 1.01]) assert.throws(() => resolveBatteryPolicy({ state_of_health }), RangeError);
  for (const bounds of [{ min_soc: -0.1 }, { max_soc: 1.1 }, { min_soc: 0.9 }, { min_soc: 0.95 }, { allowed_min_soc: -0.1 }, { allowed_max_soc: 1.1 }, { allowed_min_soc: 0.95 }, { allowed_min_soc: 1 }]) assert.throws(() => resolveBatteryPolicy(bounds), RangeError);
  for (const battery_soc_policy of [null, true, false, '', 'unknown']) assert.throws(() => resolveBatteryPolicy({ battery_soc_policy }), /battery_soc_policy must be/);
  assert.throws(() => constant(1, { min_soc: 0.05 }), /inside allowed bounds/);
  assert.throws(() => constant(1, { max_soc: 0.96 }), /inside allowed bounds/);
  // Residual mode independently validates the limits without applying them.
  assert.equal(resolveBatteryPolicy({ min_soc: 0.05 }).min_soc, 0.05);
  for (const bad of [null, false, []]) assert.throws(() => resolveBatteryPolicy(bad), /params must be an object/);
});

test('energy rejects invalid nominal capacities and permits zero', () => {
  for (const value of [null, true, false, NaN, Infinity, -Infinity, '500', -1]) assert.throws(() => batteryEnergy(value, resolveBatteryPolicy()));
  assert.equal(batteryEnergy(0, constant(0.7)).usable_capacity_kwh, 0);
});

test('historical defaults fill only missing and nullish values', () => {
  const defaults = historicalBatteryParams();
  assert.deepEqual(defaults, {
    battery_soc_policy: 'residual_soc', state_of_health: 1,
    min_soc: 0.4, max_soc: 0.9, allowed_min_soc: 0.1, allowed_max_soc: 0.95,
    session_connection_minutes: 0, layover_reduction_minutes: 0,
  });
  const input = { min_soc: 0, max_soc: null, state_of_health: undefined, session_connection_minutes: 0, custom: 'kept' };
  const normalized = historicalBatteryParams(input);
  assert.equal(normalized.min_soc, 0);
  assert.equal(normalized.max_soc, 0.9);
  assert.equal(normalized.state_of_health, 1);
  assert.equal(normalized.session_connection_minutes, 0);
  assert.equal(normalized.custom, 'kept');
  assert.equal(input.max_soc, null);
  assert.equal(NEW_BATTERY_DEFAULTS.state_of_health, 0.7);
  assert.equal(NEW_BATTERY_DEFAULTS.session_connection_minutes, 1);
  assert.equal(NEW_BATTERY_DEFAULTS.layover_reduction_minutes, 0);
});

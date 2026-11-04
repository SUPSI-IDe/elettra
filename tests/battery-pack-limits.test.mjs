import test from 'node:test';
import assert from 'node:assert/strict';
import { batteryPackLimits, batteryPackValidation } from '../src/utils/battery-pack-limits.js';

test('only a complete, positive integer model range is usable', () => {
  for (const specs of [undefined, {}, { min_battery_packs: null, max_battery_packs: 16 },
    { min_battery_packs: '', max_battery_packs: 16 }, { min_battery_packs: 0, max_battery_packs: 16 },
    { min_battery_packs: 10.5, max_battery_packs: 16 }, { min_battery_packs: 17, max_battery_packs: 16 }]) {
    assert.equal(batteryPackLimits(specs), null);
  }
  assert.deepEqual(batteryPackLimits({ min_battery_packs: '10', max_battery_packs: '16' }), { min: 10, max: 16 });
  assert.deepEqual(batteryPackLimits({ min_battery_packs: 12, max_battery_packs: 12 }), { min: 12, max: 12 });
});

test('pack counts enforce both inclusive limits and reject missing or fractional values', () => {
  const limits = { min: 10, max: 16 };
  for (const value of ['10', '12', '16']) assert.equal(batteryPackValidation(value, limits), null);
  for (const value of ['', ' ', null]) assert.equal(batteryPackValidation(value, limits), 'required');
  for (const value of ['-1', '0', '9']) assert.equal(batteryPackValidation(value, limits), 'below_min');
  for (const value of ['17', '390000']) assert.equal(batteryPackValidation(value, limits), 'above_max');
  for (const value of ['12.5', 'NaN', 'Infinity', '9007199254740992']) assert.equal(batteryPackValidation(value, limits), 'integer');
  assert.equal(batteryPackValidation('12', null), 'unavailable');
  assert.equal(batteryPackValidation('12', { min: 12, max: 12 }), null);
});

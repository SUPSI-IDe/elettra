import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFleetInvestment } from '../src/utils/fleet-investment.js';

const row = (packs, overrides = {}) => ({
  shift_name: 'Block', optimized_packs: packs, selected_nominal_kwh: packs * 50,
  investment_cost_source: 'bus_model_snapshot', bus_cost_chf: 300000,
  battery_pack_cost_chf: 6000, ...overrides,
});
const run = batteries => ({bus_model_id: 'model', input_params: {shift_ids: Object.keys(batteries)},
  results: {electrification_feasible: true, battery_results: batteries}});

test('totals price each selected battery rather than multiplying the largest one', () => {
  const model = buildFleetInvestment(run({a: row(12), b: row(14)}), {id:'model',cost:999999});
  assert.deepEqual(model.totals, {packs:26,capacity:1300,busCost:600000,batteryCost:156000,totalCost:756000});
  assert.deepEqual(model.rows.map(r => r.totalCost), [372000,384000]);
  assert.equal(model.usesCurrentPrices, false);
});

test('diagnostic excess packs are not added to installed capacity or investment', () => {
  const model = buildFleetInvestment(run({a: row(16, {required_total_packs:18,excess_packs:2,optimized_kwh:900})}));
  assert.equal(model.totals.capacity,800);
  assert.equal(model.totals.batteryCost,96000);
});

test('missing stored prices remain unknown and do not produce a partial fleet total', () => {
  const model = buildFleetInvestment(run({a:row(12),b:row(14,{bus_cost_chf:null})}), {id:'model',cost:999999});
  assert.equal(model.rows[1].busCost,null);
  assert.equal(model.totals.busCost,null);
  assert.equal(model.totals.totalCost,null);
  assert.equal(model.totals.batteryCost,156000);
  assert.equal(model.missingPrices,true);
});

test('legacy shared-model results explicitly identify prices taken from the current model', () => {
  const model = buildFleetInvestment(run({a:{optimized_packs:12,optimized_kwh:600}}),
    {id:'model',cost:300000,battery_pack_cost:6000});
  assert.equal(model.rows[0].totalCost,372000);
  assert.equal(model.usesCurrentPrices,true);
  const mismatched = buildFleetInvestment(run({a:{optimized_packs:12}}),
    {id:'another-model',cost:300000,battery_pack_cost:6000});
  assert.equal(mismatched.rows[0].totalCost,null);
});

test('requested vehicle blocks missing a result are not silently left out of totals', () => {
  const evaluation = run({a:row(12)});
  evaluation.input_params.shift_ids.push('b');
  const model = buildFleetInvestment(evaluation);
  assert.equal(model.rows.length,2);
  assert.equal(model.totals.packs,null);
  assert.equal(model.totals.totalCost,null);
});

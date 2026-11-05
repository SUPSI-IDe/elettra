import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCopiedBatteryPacks, retainedEvaluationSettings, copiedPredictionParams } from '../src/utils/evaluation-duplication.js';
import { formatCostInput } from '../src/utils/number-format.js';
import { buildPredictionRunRequestBody } from '../src/api/prediction-request.js';

for (const [value, expected] of [[1.1e-13, '0'], [2.5e-13, '0'], [-1e-13, '0'], [0, '0'], [.01, '0.01'], [110000, '110000'], [123456.78, '123456.78'], [null, ''], [undefined, ''], ['', '']]) {
  test(`cost input ${value} displays ${JSON.stringify(expected)}`, () => assert.equal(formatCostInput(value), expected));
}
for (const [name, run, expected] of [
  ['explicit packs', { input_params: { fixed_battery_packs: 12 } }, 12],
  ['all reference packs', { input_params: { shift_ids: ['a', 'b'] }, results: { battery_results: { a: { reference_packs: 14 }, b: { reference_packs: 14 } } } }, 14],
  ['mixed reference packs', { results: { battery_results: { a: { reference_packs: 12 }, b: { reference_packs: 14 } } } }, null],
  ['incomplete results', { input_params: { shift_ids: ['a', 'b'] }, results: { battery_results: { a: { reference_packs: 14 } } } }, null],
  ['prediction fallback', { input_params: { shift_ids: ['a'] }, _resolved_prediction_runs: [{ shift_id: 'a', contextual_parameters: { num_battery_packs: 13 } }] }, 13],
  ['incomplete prediction fallback', { input_params: { shift_ids: ['a', 'b'] }, _resolved_prediction_runs: [{ shift_id: 'a', contextual_parameters: { num_battery_packs: 13 } }] }, null],
  ['missing values', {}, null],
  ['invalid packs', { results: { battery_results: { a: { reference_packs: 0 } } } }, null],
]) test(name, () => assert.equal(resolveCopiedBatteryPacks(run), expected));

test('copy request settings including false, zero and null, never job/results metadata', () => {
  assert.deepEqual(retainedEvaluationSettings({ state_of_health: .91, cp_slack_minutes: 0, lock_entire_dwell: false,
    battery_cost_per_kwh: null, id: 'old', results: { any: 1 }, basis_run_ids: { mean: 'old' } }),
  { state_of_health: .91, cp_slack_minutes: 0, lock_entire_dwell: false, battery_cost_per_kwh: null });
});
test('forecast copies model release and stack but not physical reference context', () => {
  const source = { model_name: 'release', prediction_stack: 'vecto-g2', external_temp_celsius: '-5.25', occupancy_percent: '35',
    auxiliary_heating_type: 'diesel', contextual_parameters: { quantiles: [.05, .5, .95], num_battery_packs: 14, total_weight_kg: 123 } };
  const params = copiedPredictionParams([source, { ...source, contextual_parameters: { ...source.contextual_parameters, num_battery_packs: 16 } }]);
  assert.deepEqual(params, { model_name: 'release', prediction_stack: 'vecto-g2', external_temp_celsius: -5.25,
    occupancy_percent: 35, auxiliary_heating_type: 'diesel', quantiles: [.05, .5, .95] });
  assert.equal(buildPredictionRunRequestBody(params).prediction_stack, 'vecto-g2');
  assert.throws(() => copiedPredictionParams([source, { ...source, model_name: 'other' }]));
});

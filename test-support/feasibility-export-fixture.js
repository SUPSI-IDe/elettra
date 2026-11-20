import { feasibilityAssessmentFixture } from './feasibility-assessment-fixture.js';
import { buildFeasibilityAssessment } from '../src/utils/feasibility-assessment.js';

export function feasibilityExportFixture({ mode = 'joint', uniform = false, paired = true, basis = 'mean' } = {}) {
  const options = feasibilityAssessmentFixture(mode);
  delete options.scope;
  const run = options.optimizationRun, params = run.input_params, results = run.results;
  const q95 = basis === 'aggregate_q95';
  run.id = q95 ? 'q95-design' : 'mean-design';
  run.name = q95 ? 'Fixture · Q95' : 'Fixture';
  run.created_at = '2026-11-20T10:00:00.000Z';
  run.completed_at = '2026-11-20T10:01:00.000Z';
  params.consumption_basis = basis;
  params.gtfs_provenance = { version: 1, shifts: Object.fromEntries(['a', 'b'].map(key => [key, [{
    gtfs_year: 2026, gtfs_file_date: '2026-01-01', valid_from: '2026-01-01', valid_to: '2026-12-31',
  }]])) };
  params.bus_model_snapshot = { id: 'model', name: 'Frozen bus', bus_length_m: 12 };
  if (paired) params.basis_run_ids = { mean: 'mean-design', aggregate_q95: 'q95-design' };
  if (q95) params.basis_source_run_id = 'mean-design';
  results.operating_assumptions = { version: 'battery-timing-v1', state_of_health: 1,
    min_soc: .4, max_soc: .9, usable_fraction_initial: .5 };
  results.installed_chargers[0].cost_breakdown = { chargers_cost_chf: q95 ? 150000 : 100000 };
  params.charging_stations = [{ stop_id: 'depot', num_slots: 2, max_power_per_slot_kw: 150,
    cost_breakdown: { chargers_cost_chf: q95 ? 150000 : 100000 } }];
  results.total_installation_cost_chf = q95 ? 150000 : 100000;
  const packs = mode === 'charging_only' ? [10, 10] : uniform ? [q95 ? 12 : 10, q95 ? 12 : 10] : q95 ? [12, 14] : [10, 12];
  options.predictionRuns.forEach(prediction => {
    prediction.status = 'completed';
    if (prediction.id.startsWith('selected')) {
      const key = prediction.shift_id, count = packs[key === 'a' ? 0 : 1];
      prediction.id = `${basis}-${key}`;
      prediction.contextual_parameters.num_battery_packs = count;
      prediction.contextual_parameters.battery_capacity_kwh = count * 50;
      results.selected_prediction_run_ids[key] = prediction.id;
    }
  });
  run.prediction_run_ids = options.predictionRuns.map(row => row.id);
  ['a', 'b'].forEach((key, index) => {
    Object.assign(results.battery_results[key], { optimized_packs: packs[index],
      required_total_packs: packs[index], optimized_kwh: packs[index] * 50 });
    results.per_bus_summary[index].optimized_packs = packs[index];
  });
  results.consumption_analysis = { status: 'available', version: 'aggregate-demand-v1',
    per_shift: Object.fromEntries(['a', 'b'].map((key, index) => [key, { status: 'available',
      statistics: { mean_total_kwh: index ? 420 : 300, q95_total_kwh: index ? 530 : 390.123456789 } }])) };
  if (q95) {
    results.per_bus_summary[0].total_charged_kwh = 150;
    results.per_bus_summary[0].charging_sessions[0].energy_kwh = 150;
  }
  return options;
}

export function feasibilityExportSnapshots(options = feasibilityExportFixture()) {
  const assessment = buildFeasibilityAssessment({ ...options, scope: 'general' });
  const shiftIds = [...new Set([...assessment.model.shifts.map(row => row.shiftId),
    ...assessment.infeasibility.rows.map(row => row.shiftId)])];
  return { assessment, shiftAssessments: shiftIds.map(scope => buildFeasibilityAssessment({ ...options, scope })) };
}

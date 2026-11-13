// These solver/demand settings have no editable field in the evaluation form.
// Copy only request settings, never saved results, job IDs or paired-run links.
const RETAINED_SETTINGS = [
  'battery_soc_policy', 'allowed_min_soc', 'allowed_max_soc', 'layover_reduction_minutes',
  'battery_sizing_mode', 'state_of_health', 'aggregate_sample_count', 'aggregate_max_samples',
  'aggregate_seed', 'aggregate_precision_kwh', 'battery_cost_per_kwh',
  'max_battery_penalty_per_kwh', 'depot_dwell_minutes_after',
  'min_session_duration_minutes', 'session_connection_minutes',
  'lock_entire_dwell', 'cp_slack_minutes', 'session_penalty_weight',
  'early_charging_weight', 'solver_name', 'max_solver_time_seconds',
  'optimization_time_budget_seconds', 'mip_rel_gap', 'mip_abs_gap',
  'feasibility_tol', 'optimality_tol',
];

export const retainedEvaluationSettings = (params = {}) => Object.fromEntries(
  RETAINED_SETTINGS.filter(key => params[key] !== undefined).map(key => [key, params[key]])
);

export function resolveCopiedBatteryPacks(run = {}) {
  const explicit = run.input_params?.fixed_battery_packs ?? run.fixed_battery_packs;
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const shifts = run.input_params?.shift_ids ?? [];
  const results = run.results?.battery_results ?? {};
  let counts = shifts.length ? shifts.map(id => results[id]?.reference_packs) : Object.values(results).map(row => row?.reference_packs);
  if (!counts.length || counts.some(value => value == null)) {
    const predictions = run._resolved_prediction_runs ?? (run._resolved_prediction_run ? [run._resolved_prediction_run] : []);
    counts = shifts.length
      ? shifts.map(id => predictions.find(prediction => prediction.shift_id === id)?.contextual_parameters?.num_battery_packs)
      : predictions.map(prediction => prediction.contextual_parameters?.num_battery_packs);
  }
  if (!counts.length || counts.some(value => !Number.isInteger(value) || value <= 0)) return null;
  return new Set(counts).size === 1 ? counts[0] : null;
}

// All selected shifts must share the conditions representable by this form.
// Do not silently use the first shift when a historical run has mixed settings.
export function copiedPredictionParams(predictions = [], savedParams) {
  if (savedParams) return { ...savedParams };
  const configs = predictions.map(prediction => Object.fromEntries(Object.entries({
    model_name: prediction.model_name,
    prediction_stack: prediction.prediction_stack,
    external_temp_celsius: prediction.external_temp_celsius == null ? undefined : Number(prediction.external_temp_celsius),
    occupancy_percent: prediction.occupancy_percent == null ? undefined : Number(prediction.occupancy_percent),
    auxiliary_heating_type: prediction.auxiliary_heating_type,
    quantiles: prediction.contextual_parameters?.quantiles,
  }).filter(([, value]) => value !== undefined)));
  if (configs.some(config => JSON.stringify(config) !== JSON.stringify(configs[0]))) {
    throw new Error('The selected shifts have different prediction settings.');
  }
  return configs[0] ?? {};
}

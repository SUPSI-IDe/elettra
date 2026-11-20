export const feasibilityAssessmentFixture = (mode = 'joint') => {
  const battery = packs => ({ optimized_packs: packs, required_total_packs: packs,
    max_physical_packs: 16, max_physical_kwh: 800, optimized_kwh: packs * 50,
    reference_packs: 16, physical_feasible: true, pack_size_kwh: 50,
    investment_cost_source: 'bus_model_snapshot', bus_cost_chf: 400000, battery_pack_cost_chf: 10000 });
  const prediction = (id, shift, packs, mean, distance) => ({ id, shift_id: shift,
    contextual_parameters: { num_battery_packs: packs, battery_capacity_kwh: packs * 50 },
    summary: { total_consumption_kwh: mean, consumption_per_km_kwh: mean / distance,
      total_distance_km: distance, total_drivetrain_kwh: mean - 40, total_auxiliary_kwh: 40,
      quantiles: { q05: mean - 30, q50: mean + 10, q95: mean + 200 } } });
  const optimizationRun = { id: 'mean-design', status: 'completed', bus_model_id: 'model',
    input_params: { mode, shift_ids: ['a', 'b'], min_soc: .4, max_soc: .9,
      fixed_battery_packs: 10, consumption_basis: 'mean' },
    results: { solver_status: 'optimal', electrification_feasible: true,
      forecast_verification: { status: 'verified' },
      battery_results: { a: battery(10), b: battery(12) },
      selected_prediction_run_ids: { a: 'selected-a', b: 'selected-b' },
      initial_reference_prediction_run_ids: { a: 'initial-a' },
      installed_chargers: [{ stop_id: 'depot', num_slots: 2, power_per_slot_kw: 150 }],
      total_installation_cost_chf: 100000,
      per_bus_summary: [
        { shift_id: 'a', optimized_packs: 10, min_soc_kwh: 205, max_soc_kwh: 450,
          total_charged_kwh: 100, num_charging_sessions: 1,
          charging_sessions: [{ stop_id: 'depot', start_minute: 1380, end_minute: 1500, energy_kwh: 100 }] },
        { shift_id: 'b', optimized_packs: 12, min_soc_kwh: 250, max_soc_kwh: 530, total_charged_kwh: 0,
          num_charging_sessions: 0, charging_sessions: [] },
      ],
    } };
  return { optimizationRun, scope: 'a', currentBusModel: { id: 'model', cost: 999999, battery_pack_cost: 99999 },
    shiftNamesById: new Map([['a', 'Same name'], ['b', 'Same name']]),
    predictionRuns: [prediction('initial-a', 'a', 16, 360, 100), prediction('selected-a', 'a', 10, 300, 100),
      prediction('selected-b', 'b', 12, 420, 120)] };
};

import { test, expect } from '@playwright/test';

const depot = '11111111-1111-4111-8111-111111111111';
const pantograph = '22222222-2222-4222-8222-222222222222';
const unusedStop = '33333333-3333-4333-8333-333333333333';
const models = {
  standard: [
    { station_type: 'depot', point_cost_chf: 110000, site_fixed_cost_chf: 250000, connection_cost_per_kw_chf: 250 },
    { station_type: 'pantograph', point_cost_chf: 430000, site_fixed_cost_chf: 320000, connection_cost_per_kw_chf: 320 },
  ],
  custom: [
    { station_type: 'depot', point_cost_chf: 123456.78, site_fixed_cost_chf: 0, connection_cost_per_kw_chf: 275.5 },
    { station_type: 'pantograph', point_cost_chf: 456789.12, site_fixed_cost_chf: 234567.89, connection_cost_per_kw_chf: 0 },
  ],
  tiny: [
    { station_type: 'depot', point_cost_chf: 1.1000000000000001e-13, site_fixed_cost_chf: 2.4999999999999994e-13, connection_cost_per_kw_chf: 250 },
    { station_type: 'pantograph', point_cost_chf: 0, site_fixed_cost_chf: 0.01, connection_cost_per_kw_chf: 0.005 },
  ],
};
const forecast = { model_name: 'saved-model-release', prediction_stack: 'vecto-g2',
  external_temp_celsius: -8.25, occupancy_percent: 35, auxiliary_heating_type: 'diesel', quantiles: [0.05, 0.25, 0.5, 0.95] };

async function fixture(page, { mode = 'joint', variant = 'custom', basis = 'mean', missing, mixedForecast = false } = {}) {
  const legacy = variant === 'legacy';
  const stations = [depot, pantograph].map((stop_id, i) => ({
    stop_id, ...(legacy && mode !== 'battery_only' ? {} : { num_slots: i + 2 }),
    max_total_power_kw: i ? 987.25 : 312.5, max_power_per_slot_kw: i ? null : 156.25,
    cost_model: legacy ? null : { ...models[variant][i], ac_dc_efficiency: .925,
      source: variant === 'standard' ? 'infras2026-calibrated-v1' : 'custom' },
    ...(legacy ? { slot_costs_chf: i ? [234567.89, 0, 45678.12] : [110000, 25000] } : {}),
  }));
  const daily = variant === 'standard';
  const original = {
    mode, shift_ids: ['shift', 'shift2'], bus_model_id: 'model',
    consumption_basis: basis, quantile_consumption: 'mean', evaluate_both_bases: true,
    prediction_run_ids: ['source-shift', 'source-shift2'],
    reference_prediction_run_ids: legacy ? null : { shift: 'source-shift', shift2: 'source-shift2' },
    prediction_params: null, auxiliary_heating_type: 'diesel',
    min_soc: .17, max_soc: .86, state_of_health: .91,
    aggregate_sample_count: 50000, aggregate_max_samples: 150000, aggregate_seed: 123456, aggregate_precision_kwh: .125,
    battery_sizing_mode: legacy ? 'per_route' : 'uniform', battery_cost_per_kwh: 321.25,
    max_battery_penalty_per_kwh: 250000.75, daily_cycle: daily, depot_peak_shaving: daily,
    depot_dwell_minutes_after: daily ? 0 : 45, min_session_duration_minutes: 4, session_connection_minutes: 2,
    lock_entire_dwell: daily, cp_slack_minutes: daily ? 0 : 3, session_penalty_weight: .025, early_charging_weight: .75,
    solver_name: 'highs', max_solver_time_seconds: 123, optimization_time_budget_seconds: 777,
    mip_rel_gap: .003, mip_abs_gap: .004, feasibility_tol: 1e-7, optimality_tol: 1e-8,
    charging_stations: stations,
  };
  const model = { id: 'model', user_id: 'user', name: 'Selected override bus', specs: {
    min_battery_packs: 10, max_battery_packs: 16, battery_pack_size_kwh: 50,
    battery_pack_cost_chf: 6000, battery_pack_weight_kg: 300, empty_weight_kg: 18000, max_passengers: 100, bus_length_m: 18,
  } };
  const shifts = ['shift', 'shift2', 'unused'].map(id => ({ id, name: id, bus_id: 'bus', structure: [] }));
  let saved = { id: 'saved', name: 'Saved evaluation', mode, status: 'completed', bus_model_id: 'model',
    created_at: '2026-01-01T12:00:00Z', input_params: structuredClone(original),
    results: { battery_results: { shift: { reference_packs: 14 }, shift2: { reference_packs: 14 } } } };
  const submissions = [], predictions = [];
  const records = new Map(['shift', 'shift2'].map(id => [`source-${id}`, {
    id: `source-${id}`, shift_id: id, bus_model_id: 'model', status: 'completed', ...forecast,
    ...(mixedForecast && id === 'shift2' ? { occupancy_percent: 70 } : {}),
    contextual_parameters: { num_battery_packs: 14, quantiles: forecast.quantiles },
  }]));
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'local-browser-test'); localStorage.setItem('elettra_lang', 'en');
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', email: 'local@example.invalid' } }));
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let data = [];
    if (path.endsWith('/version')) data = { version: 'test' };
    else if (path.endsWith('/bus-models/')) data = missing === 'model' ? [] : [model, { ...model, id: 'default-model', name: 'Assigned bus' }];
    else if (path.endsWith('/bus-models/model')) data = model;
    else if (path.endsWith('/buses/')) data = [{ id: 'bus', user_id: 'user', bus_model_id: 'default-model' }];
    else if (path.endsWith('/shifts/')) data = shifts.filter(s => missing !== s.id);
    else if (path.includes('/shifts/')) data = shifts.find(s => path.endsWith(`/${s.id}`));
    else if (path.endsWith('/simulation/charging-stops/candidates')) data = [
      { stop_id: depot, stop_name: 'Depot', is_depot: true, is_custom: true, depot_bus_count: 1 },
      { stop_id: pantograph, stop_name: 'Pantograph', is_depot: false, is_custom: true },
      { stop_id: unusedStop, stop_name: 'Unused', is_depot: false, is_custom: true },
    ].filter(s => missing !== s.stop_id);
    else if (path.endsWith('/prediction-runs/') && request.method() === 'POST') {
      const body = request.postDataJSON(); predictions.push(body);
      const ids = body.shift_ids.map(id => `copy-${predictions.length}-${id}`);
      ids.forEach((id, i) => records.set(id, { ...body, id, shift_id: body.shift_ids[i], status: 'completed' }));
      data = { prediction_run_ids: ids };
    } else if (path.includes('/prediction-runs/')) {
      if (missing === 'prediction') return route.fulfill({ status: 404, json: { detail: 'Not found' } });
      data = path.endsWith('/prediction-runs/') ? [...records.values()] : records.get(path.split('/').pop());
    } else if (path.endsWith('/optimization-runs/') && request.method() === 'POST') {
      submissions.push(request.postDataJSON());
      data = { optimization_run_id: 'pending', basis_run_ids: { mean: 'pending', aggregate_q95: 'pending-q95' } };
    } else if (path.endsWith('/optimization-runs/')) data = [missing === 'detail' ? { ...saved, input_params: undefined } : saved];
    else if (path.endsWith('/optimization-runs/saved')) {
      if (missing === 'detail') return route.fulfill({ status: 500, json: { detail: 'Unavailable' } });
      data = saved;
    } else if (path.includes('/optimization-runs/pending')) data = { id: 'pending', status: 'pending' };
    return route.fulfill({ json: data });
  });
  return {
    original, stations, submissions, predictions,
    async open() {
      await page.goto('./#simulation-runs');
      await page.getByRole('checkbox', { name: 'Select run', exact: true }).check();
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    },
    async submit() {
      await page.getByRole('button', { name: 'Start evaluation', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Start evaluation', exact: true }).click();
    },
    async repeat() {
      saved = { ...saved, name: submissions.at(-1).name, input_params: { ...submissions.at(-1), consumption_basis: basis } };
      await page.goto('./#home'); await page.reload();
    },
  };
}

for (const mode of ['battery_only', 'charging_only', 'joint']) {
  for (const variant of ['standard', 'custom', 'tiny', 'legacy']) {
    for (const basis of ['mean', 'aggregate_q95']) {
      test(`complete repeated ${basis} duplication preserves ${variant} settings in ${mode}`, async ({ page }) => {
        const f = await fixture(page, { mode, variant, basis });
        for (let copy = 1; copy <= 2; copy++) {
          await f.open();
          await expect(page.locator('#var-optimization-mode')).toHaveValue(mode);
          await expect(page.locator('#var-bus-model-override')).toHaveValue('model');
          await expect(page.locator('#var-external-temp')).toHaveValue('-8.25');
          await expect(page.locator('#var-occupancy')).toHaveValue('35');
          if (mode === 'charging_only') await expect(page.locator('[name="fixed_battery_packs"]')).toHaveValue('14');
          await page.locator('#simulation-name').fill(`Copy ${copy}`);
          await page.locator('[data-role="cost-options"] > summary').click();
          for (const station of f.stations) {
            const card = page.locator(`[data-cost-stop-id="${station.stop_id}"]`);
            await expect(card).toBeVisible();
            if (variant === 'legacy') {
              await expect(card).toContainText('Saved costs per charging point (CHF)');
              await expect(page.locator(`[data-stop-id="${station.stop_id}"] [data-field="num_slots"]`)).toHaveAttribute('readonly', '');
            } else for (const field of ['point_cost_chf', 'site_fixed_cost_chf', 'connection_cost_per_kw_chf']) {
              const v = station.cost_model[field];
              await expect(card.locator(`[data-cost-field="${field}"]`)).toHaveValue(Math.abs(v) < 1e-9 ? '0' : String(v));
            }
          }
          await f.submit();
          await expect.poll(() => f.submissions.length).toBe(copy);
          const { prediction_params, ...expected } = f.original;
          // Historical assumptions remain explicit; new policy fields preserve the historical behavior. Mean/Q95 are recalculated as a pair.
          expect(f.submissions.at(-1)).toEqual({ battery_soc_policy: 'residual_soc', allowed_min_soc: .1, allowed_max_soc: .95, layover_reduction_minutes: 0,
            ...expected, name: `Copy ${copy}`, consumption_basis: 'mean',
            prediction_run_ids: [`copy-${copy}-shift`, `copy-${copy}-shift2`],
            reference_prediction_run_ids: { shift: `copy-${copy}-shift`, shift2: `copy-${copy}-shift2` } });
          expect(f.predictions.at(-1)).toEqual({ ...forecast, shift_ids: ['shift', 'shift2'], bus_model_id: 'model',
            num_battery_packs: mode === 'charging_only' ? 14 : 16,
            contextual_parameters: expect.objectContaining({ quantiles: forecast.quantiles, num_battery_packs: mode === 'charging_only' ? 14 : 16 }) });
          await f.repeat();
        }
      });
    }
  }
}

test('editing a displayed near-zero cost to zero saves the explicit edit', async ({ page }) => {
  const f = await fixture(page, { variant: 'tiny' }); await f.open();
  await page.locator('[data-role="cost-options"] > summary').click();
  await page.locator(`[data-cost-stop-id="${depot}"] [data-cost-field="point_cost_chf"]`).fill('0');
  await f.submit(); await expect.poll(() => f.submissions.length).toBe(1);
  expect(f.submissions[0].charging_stations[0].cost_model).toEqual({ ...f.stations[0].cost_model, point_cost_chf: 0 });
});

for (const missing of ['detail', 'prediction', 'shift2', 'model', pantograph]) {
  test(`missing original ${missing} blocks a partial duplicate`, async ({ page }) => {
    const f = await fixture(page, { missing }); await f.open();
    const message = missing === 'detail' ? 'Unable to load the original evaluation.' : missing === 'prediction'
      ? 'The original forecasts are unavailable' : 'Some original vehicle blocks, bus models or charging locations are no longer available.';
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    if (!['detail', 'prediction'].includes(missing)) {
      await page.getByRole('button', { name: 'Start evaluation', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
    expect(f.submissions).toHaveLength(0); expect(f.predictions).toHaveLength(0);
  });
}

test('mixed source forecast settings are not silently replaced by the first shift', async ({ page }) => {
  const f = await fixture(page, { mixedForecast: true }); await f.open();
  await expect(page.getByText('The original forecasts are unavailable', { exact: false })).toBeVisible();
  expect(f.submissions).toHaveLength(0);
});

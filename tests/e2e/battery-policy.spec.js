import { test, expect } from '@playwright/test';

test('annual exports preserve the unrounded SOC window and recorded SOH assumptions', async ({ page }) => {
  await fixture(page);
  await page.goto('./');
  const header = await page.evaluate(async () => {
    const { buildExportPayload } = await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js');
    const assumptions = { state_of_health: .7, battery_soc_policy: 'constant_initial_usable',
      min_soc: .9-.5/.7, max_soc: .9, session_connection_minutes: 1, layover_reduction_minutes: 2 };
    return buildExportPayload({ config: { min_soc: assumptions.min_soc, max_soc: .9,
      operating_assumptions: assumptions } }, {}, {}, {}, {}, 'soh-export').header;
  });
  expect(header.socRange.min).toBe(.9-.5/.7);
  expect(header.operatingAssumptions).toMatchObject({ state_of_health: .7,
    battery_soc_policy: 'constant_initial_usable', session_connection_minutes: 1, layover_reduction_minutes: 2 });
});

const model = { id: 'model', user_id: 'user', name: '500 kWh bus', specs: {
  min_battery_packs: 10, max_battery_packs: 10, battery_pack_size_kwh: 50,
  battery_pack_cost_chf: 6000,
} };
const shift = { id: 'shift', name: 'Battery policy block', bus_id: 'bus', structure: [] };
const prediction = { id: 'prediction', shift_id: 'shift', bus_model_id: 'model', status: 'completed',
  model_name: 'saved-model', prediction_stack: 'vecto-g2', external_temp_celsius: -5,
  occupancy_percent: 100, auxiliary_heating_type: 'default',
  contextual_parameters: { num_battery_packs: 10, quantiles: [0.05, 0.25, 0.5, 0.95] },
};

async function fixture(page, { input = {}, result = false } = {}) {
  const submissions = [];
  const saved = { id: 'saved', name: 'Battery policy evaluation', status: 'completed', mode: 'battery_only',
    bus_model_id: 'model', created_at: '2026-01-01T12:00:00Z', prediction_run_ids: ['prediction'],
    input_params: { mode: 'battery_only', shift_ids: ['shift'], bus_model_id: 'model',
      prediction_run_ids: ['prediction'], min_soc: 0.4, max_soc: 0.9, ...input },
    results: { solver_status: 'optimal', electrification_feasible: true,
      electrification_summary: { status: 'feasible', num_buses: 1, num_infeasible_buses: 0, infeasible_buses: [] },
      battery_results: { shift: { shift_id: 'shift', optimized_packs: 10, max_physical_packs: 10,
        optimized_kwh: 500, max_physical_kwh: 500, selected_nominal_kwh: 500,
        physical_feasible: true, feasibility_status: 'feasible' } },
      per_bus_summary: [{ shift_id: 'shift', total_charged_kwh: 0, num_charging_sessions: 0, charging_sessions: [] }],
    },
  };
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'local-browser-test');
    localStorage.setItem('elettra_lang', 'en');
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', email: 'local@example.invalid' } }));
  // Every API request, including writes, is fulfilled locally. Nothing reaches staging.
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let data = [];
    if (path.endsWith('/version')) data = { version: 'test' };
    else if (path.endsWith('/bus-models/')) data = [model];
    else if (path.endsWith('/bus-models/model')) data = model;
    else if (path.endsWith('/buses/')) data = [{ id: 'bus', user_id: 'user', bus_model_id: 'model' }];
    else if (path.endsWith('/shifts/')) data = [shift];
    else if (path.includes('/shifts/')) data = shift;
    else if (path.endsWith('/prediction-runs/') && request.method() === 'POST') data = { prediction_run_ids: ['prediction'] };
    else if (path.endsWith('/prediction-runs/')) data = [prediction];
    else if (path.includes('/prediction-runs/')) data = prediction;
    else if (path.endsWith('/optimization-runs/') && request.method() === 'POST') {
      submissions.push(request.postDataJSON());
      data = { optimization_run_id: 'pending', basis_run_ids: { mean: 'pending', aggregate_q95: 'pending-q95' } };
    } else if (path.endsWith('/optimization-runs/')) data = [saved];
    else if (path.endsWith('/optimization-runs/saved')) data = saved;
    else if (path.includes('/optimization-runs/pending')) data = { id: 'pending', status: 'pending' };
    else if (path.endsWith('/economic/defaults')) data = {};
    return route.fulfill({ json: data });
  });
  if (result) {
    await page.goto('./');
    await page.evaluate(async () => {
      const template = await fetch('/elettra/src/pages/Simulation/Runs/simulation-results.html').then(r => r.text());
      document.body.innerHTML = template;
      const { initializeSimulationResults } = await import('/elettra/src/pages/Simulation/Runs/simulation-results.js');
      window.__cleanupBatteryPolicy = initializeSimulationResults(document, { runId: 'saved' });
    });
  }
  return { submissions, saved };
}

async function openNew(page) {
  await page.goto('./#add-simulation');
  await page.locator('#simulation-name').fill('Battery policy browser regression');
  await page.getByRole('checkbox', { name: 'Select vehicle block', exact: true }).check();
  await page.locator('#var-optimization-mode').selectOption('battery_only');
}

async function submit(page) {
  await page.getByRole('button', { name: 'Start evaluation', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start evaluation', exact: true }).click();
}

test('new evaluation defaults and battery previews cover both policies and infeasibility', async ({ page }) => {
  const { submissions } = await fixture(page);
  await openNew(page);
  for (const [id, value] of Object.entries({ 'state-of-health': '70', 'battery-policy': 'residual_soc',
    'min-soc': '40', 'max-soc': '90', 'allowed-min-soc': '10', 'allowed-max-soc': '95',
    'session-connection-minutes': '1', 'layover-reduction-minutes': '0' })) {
    await expect(page.locator(`#var-${id}`)).toHaveValue(value);
  }
  const preview = page.locator('[data-role="battery-preview"]');
  const warning = page.locator('[data-role="battery-low-warning"]');
  const error = page.locator('[data-role="battery-policy-error"]');
  await expect(preview).toContainText('40–90%');
  await expect(preview).toContainText('175 kWh');
  await page.locator('#var-battery-policy').selectOption('constant_initial_usable');
  await expect(preview).toContainText('18.57–90%');
  await expect(preview).toContainText('250 kWh');
  await expect(warning).toBeVisible();
  await page.locator('#var-state-of-health').fill('60');
  await expect(preview).toContainText('10–93.33%');
  await expect(preview).toContainText('preferred maximum SOC was increased');
  await page.locator('#var-state-of-health').fill('58');
  await expect(error).toBeVisible();
  await page.getByRole('button', { name: 'Start evaluation', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(submissions).toHaveLength(0);
  await page.locator('#var-battery-policy').selectOption('residual_soc');
  await page.locator('#var-min-soc').fill('20');
  await expect(warning).toBeHidden();
  await expect(error).toBeHidden();
  await page.locator('#var-min-soc').fill('19.999');
  await expect(warning).toBeVisible();
});

test('submission sends editable battery policy, SOC, SOH and charging time parameters', async ({ page }) => {
  const { submissions } = await fixture(page);
  await openNew(page);
  await page.locator('#var-battery-policy').selectOption('constant_initial_usable');
  for (const [id, value] of Object.entries({ 'state-of-health': '75', 'min-soc': '35', 'max-soc': '85',
    'allowed-min-soc': '12', 'allowed-max-soc': '96', 'session-connection-minutes': '3', 'layover-reduction-minutes': '4' })) {
    await page.locator(`#var-${id}`).fill(value);
  }
  await submit(page);
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ battery_soc_policy: 'constant_initial_usable', state_of_health: 0.75,
    min_soc: 0.35, max_soc: 0.85, allowed_min_soc: 0.12, allowed_max_soc: 0.96,
    session_connection_minutes: 3, layover_reduction_minutes: 4 });
});

test('duplicating a historical evaluation preserves SOH 100% and explicit zero timing', async ({ page }) => {
  const { submissions } = await fixture(page, { input: { state_of_health: 1, session_connection_minutes: 0,
    layover_reduction_minutes: 0 } });
  await page.goto('./#simulation-runs');
  await page.getByRole('checkbox', { name: 'Select run', exact: true }).check();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.locator('#var-state-of-health')).toHaveValue('100');
  await expect(page.locator('#var-battery-policy')).toHaveValue('residual_soc');
  await expect(page.locator('#var-session-connection-minutes')).toHaveValue('0');
  await expect(page.locator('#var-layover-reduction-minutes')).toHaveValue('0');
  await submit(page);
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ state_of_health: 1, battery_soc_policy: 'residual_soc',
    min_soc: 0.4, max_soc: 0.9, session_connection_minutes: 0, layover_reduction_minutes: 0 });
});

for (const policy of ['residual_soc', 'constant_initial_usable']) {
  test(`${policy} results show residual and usable energy without consumption analysis`, async ({ page }) => {
    const { saved } = await fixture(page, { result: true, input: { state_of_health: 0.7, battery_soc_policy: policy,
      allowed_min_soc: 0.1, allowed_max_soc: 0.95, session_connection_minutes: 1, layover_reduction_minutes: 0 } });
    expect(saved.results.consumption_analysis).toBeUndefined();
    const assumptions = page.locator('[data-role="battery-assumptions"]');
    await expect(assumptions).toBeVisible();
    await expect(assumptions.locator('[data-role="result-soh"]')).toHaveText('70%');
    const capacity = assumptions.locator('[data-role="battery-capacity-summary"]');
    await expect(capacity).toContainText('Initial capacity: 500 kWh');
    await expect(capacity).toContainText('Residual capacity: 350 kWh');
    await expect(capacity).toContainText(`Usable energy: ${policy === 'residual_soc' ? 175 : 250} kWh`);
    await expect(assumptions.locator('[data-role="effective-soc-window"]')).toHaveText(policy === 'residual_soc' ? '40%–90%' : '18.57%–90%');
    if (policy === 'constant_initial_usable') await expect(assumptions.locator('[data-role="result-low-soc-warning"]')).toBeVisible();
    else await expect(assumptions.locator('[data-role="result-low-soc-warning"]')).toHaveCount(0);
  });
}

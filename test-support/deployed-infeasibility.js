import { expect } from '@playwright/test';
import { browserApplicationOrigin } from './browser-application-target.mjs';

export async function openSavedInfeasibility(page, { mode = 'joint', basis = 'aggregate_q95', source = 'diagnostic', applicationURL, routeOptions = {} } = {}) {
  const frontendUrl = browserApplicationOrigin(applicationURL);
  const state = { runReads: 0 };
  const writes = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/*', route => new URL(route.request().url()).origin === frontendUrl
    ? route.fallback() : route.abort('blockedbyclient'));
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'isolated-staging-ui-fixture');
    localStorage.setItem('elettra_lang', 'en');
    localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
  });
  const critical = {
    shift_name: 'Old saved name', optimized_packs: 8, required_total_packs: 10,
    max_physical_packs: 8, max_physical_kwh: 400, optimized_kwh: 400,
    base_kwh: 300, base_packs: 6, reference_packs: 6, excess_packs: 2,
    physical_feasible: false, feasibility_status: 'infeasible_requires_excess_packs',
  };
  const saved = {
    id: 'rc3-saved', name: 'Saved infeasible evaluation', mode, status: 'completed',
    input_params: { shift_ids: ['critical'], mode, consumption_basis: basis,
      daily_cycle: true, min_soc: 0.2, max_soc: 0.9, fixed_battery_packs: 8 },
    prediction_run_ids: [],
    results: { electrification_feasible: false, solver_status: source === 'result' ? 'optimal' : 'infeasible',
      forecast_verification: { status: source === 'result' ? 'physical_limits_exceeded' : 'infeasible' },
      daily_cycle: { status: 'unverified' },
      battery_results: source === 'result' ? { critical } : {},
      infeasibility_diagnostics: source === 'diagnostic' ? {
        status: 'available', forecast_verification: { status: 'physical_limits_exceeded' },
        battery_results: { critical }, reasons: [],
      } : undefined,
    },
  };
  const before = JSON.stringify(saved);
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'fixture-user', role: 'analyst', company_id: 'fixture-company' } }));
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      writes.push({ method: request.method(), path });
      return route.fulfill({ status: 500, json: { detail: 'Viewing a saved result must never write' } });
    }
    if (path.endsWith('/optimization-runs/rc3-saved')) { state.runReads++; return route.fulfill({ json: saved }); }
    if (path.includes('/user/shifts/') && !path.endsWith('/shifts/'))
      return route.fulfill({ json: { id: 'critical', name: 'Current vehicle block', structure: [] } });
    if (path.endsWith('/version')) return route.fulfill({ json: { version: 'staging-fixture' } });
    if (path.includes('/agency/agencies/')) return route.fulfill({ json: { id: 'fixture-company', gtfs_agency_id: 'fixture' } });
    if (path.includes('/prediction-runs') || path.endsWith('/user/shifts/')) return route.fulfill({ json: [] });
    if (path.endsWith('/economic/defaults')) return route.fulfill({ json: {} });
    return route.fulfill({ status: 404, json: { detail: 'Not used by saved-result fixture' } });
  });
  await page.goto('./#home');
  await expect(page.locator('.home-page')).toBeVisible();
  await page.evaluate(routeOptions => document.dispatchEvent(new CustomEvent('partial:request', {
    detail: { slug: 'simulation-results', runId: 'rc3-saved', ...routeOptions },
  })), routeOptions);
  return Object.assign(state, { saved, before, writes, errors });
}

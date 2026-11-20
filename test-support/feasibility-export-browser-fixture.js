import { readFileSync } from 'node:fs';
import { feasibilityExportFixture } from './feasibility-export-fixture.js';
import { browserApplicationOrigin } from './browser-application-target.mjs';
import { assertFeasibilityExportReconciles } from './feasibility-export-reconciliation.js';

export const exportButton = page => page.locator('[data-action="download-feasibility-json"]');
export const exportStatus = page => page.locator('[data-role="feasibility-export-status"]');
export async function downloadedFeasibility(page) {
  const pending = page.waitForEvent('download');
  await exportButton(page).click();
  const download = await pending;
  const document = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assertFeasibilityExportReconciles(document);
  return { filename: download.suggestedFilename(), document };
}

export async function mountFeasibilityExport(page, baseURL, { mode = 'joint', language = 'en', uniform = false,
  entryRunId = 'mean-design', transform = () => {}, runResponse, predictionList, predictionResponse } = {}) {
  const mean = feasibilityExportFixture({ mode, uniform }), q95 = feasibilityExportFixture({ mode, uniform, basis: 'aggregate_q95' });
  // The visible aggregate chart needs complete cases, not only consumption statistics.
  for (const options of [mean, q95]) {
    const results = options.optimizationRun.results;
    for (const [key, detail] of Object.entries(results.consumption_analysis.per_shift)) {
      const summary = results.per_bus_summary.find(row => row.shift_id === key);
      const usable = results.battery_results[key].optimized_kwh * .5;
      detail.cases = Object.fromEntries(['mean', 'aggregate_q95'].map(basis => {
        const total = detail.statistics[basis === 'mean' ? 'mean_total_kwh' : 'q95_total_kwh'];
        const required = total - summary.total_charged_kwh;
        return [basis, { total_consumption_kwh: total, accepted_charge_kwh: summary.total_charged_kwh,
          required_usable_kwh: required, margin_kwh: usable - required,
          first_minute: 0, soc_kwh: [summary.max_soc_kwh, summary.min_soc_kwh] }];
      }));
    }
  }
  const fixtures = { mean, q95 };
  transform(fixtures);
  const runs = [mean.optimizationRun, q95.optimizationRun];
  const predictions = [...new Map([...mean.predictionRuns, ...q95.predictionRuns].map(row => [row.id, row])).values()];
  const requests = [], unexpected = [], errors = [];
  const origin = browserApplicationOrigin(baseURL);
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.fallback();
    if (url.origin === 'https://fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
    unexpected.push(url.href); return route.abort('blockedbyclient');
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    // Expected HTTP failures are controlled by individual scenario responses.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
  });
  await page.addInitScript(lang => {
    localStorage.setItem('access_token', 'feasibility-export-test');
    localStorage.setItem('elettra_lang', lang);
    localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
  }, language);
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', email: 'fixture@example.invalid', role: 'analyst' } }));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push({ method: request.method(), path });
    if (request.method() !== 'GET') { unexpected.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, json: {} }); }
    if (path === '/api/v1/version') return route.fulfill({ json: { version: 'feasibility-export-test' } });
    const run = runs.find(row => path === `/api/v1/simulation/optimization-runs/${row.id}`);
    if (run) return route.fulfill(await runResponse?.(run, requests) ?? { json: run });
    if (/\/optimization-runs\/[^/]+\/basis\/(mean|aggregate_q95)$/.test(path)) {
      const basis = path.split('/').at(-1), match = runs.find(row => row.input_params.consumption_basis === basis);
      return route.fulfill({ json: { optimization_run_id: match?.id ?? null, status: match?.status ?? 'not_calculated' } });
    }
    if (path.endsWith('/auxiliary-assumptions')) return route.fulfill({ json: { runs: [] } });
    if (path === '/api/v1/simulation/prediction-runs/') return route.fulfill({ json: predictionList ?? predictions });
    const prediction = predictions.find(row => path === `/api/v1/simulation/prediction-runs/${row.id}`);
    if (prediction) return route.fulfill(await predictionResponse?.(prediction) ?? { json: prediction });
    if (path === '/api/v1/user/bus-models/model') return route.fulfill({ json: { id: 'model', name: 'Current catalogue bus',
      specs: { ...mean.currentBusModel, bus_length_m: 12, battery_pack_size_kwh: 50, max_battery_packs: 16 } } });
    if (path === '/api/v1/user/shifts/') return route.fulfill({ json: ['a', 'b'].map(key => ({ id: key,
      name: `Block ${key.toUpperCase()}`, structure: [], gtfs_datasets: mean.optimizationRun.input_params.gtfs_provenance.shifts[key] })) });
    const info = path.match(/\/user\/shifts\/([ab])\/info$/);
    if (info) return route.fulfill({ json: { id: info[1], name: `Block ${info[1].toUpperCase()}`, structure: [] } });
    if (/\/user\/shifts\/[ab]\/yearly-distance$/.test(path)) return route.fulfill({ json: { daily_distance_km: 100, yearly_distance_km: 36500 } });
    if (path === '/api/v1/economic/defaults' || path === '/api/v1/economic/comparison') return route.fulfill({ json: {} });
    if (/\/environmental\/shifts\/[ab]\/yearly-impact$/.test(path)) return route.fulfill({ json: { yearly_impact: {}, yearly_distance_km: 36500, passengers: 1 } });
    if (path === '/api/v1/environmental/vehicles') return route.fulfill({ json: [] });
    unexpected.push(`${request.method()} ${path}`);
    return route.fulfill({ status: 500, json: { detail: 'Missing feasibility export fixture' } });
  });
  await page.goto('./#home');
  await page.locator('.home-page').waitFor();
  await page.evaluate(runId => document.dispatchEvent(new CustomEvent('partial:request', {
    detail: { slug: 'simulation-results', runId },
  })), entryRunId);
  return { ...fixtures, requests, unexpected, errors };
}

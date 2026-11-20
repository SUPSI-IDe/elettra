import { downloadedFeasibility, exportButton, exportStatus, mountFeasibilityExport } from './feasibility-export-browser-fixture.js';

export function registerFeasibilityExportTests(test, expect) {
  const assertVisibleDesign = async (page, design) => {
    for (const block of design.shifts) {
      await page.locator(`[data-action="select-result-scope"][data-shift-id="${block.shiftId}"]`).click();
      await expect(exportButton(page)).toBeHidden();
      for (const [role, value, decimals] of [
        ['predicted-consumption', block.consumption.totalKwh, 0],
        ['predicted-consumption-per-km', block.consumption.perKmKwh, 3],
        ['charged-energy', block.operation.result.totalChargedKwh, 1],
        ['min-soc', block.operation.result.minSocKwh, 1],
        ['max-soc', block.operation.result.maxSocKwh, 1],
      ]) {
        const metric = page.locator(`[data-role="feasibility-shift-${role}"] .result-metric__value`);
        await expect.poll(async () => Number((await metric.innerText()).replace(/[^0-9.-]/g, '')))
          .toBe(Number(value.toFixed(decimals)));
      }
    }
  };

  for (const mode of ['battery_only', 'charging_only', 'joint']) {
    test(`downloads the whole ${mode} evaluation through the application without starting calculations`, async ({ page, baseURL }) => {
      const fixture = await mountFeasibilityExport(page, baseURL, { mode });
      await expect(exportButton(page)).toBeEnabled();
      const { document, filename } = await downloadedFeasibility(page);
      expect(filename).toBe('feasibility-mean-design.json');
      expect(document.schemaVersion).toBe(1);
      expect(document.dataQuality.status).toBe('complete');
      expect(document.designs.map(row => row.basis.key)).toEqual(['mean', 'aggregate_q95']);
      expect(document.designs[0].shifts[0].consumption.totalKwh).toBe(300);
      expect(document.designs[1].shifts[0].consumption.totalKwh).toBe(390.123456789);
      expect(document.designs[0].general.investment.usesCurrentPrices).toBe(false);
      await expect(exportStatus(page)).toHaveAttribute('data-state', 'complete');
      await assertVisibleDesign(page, document.designs[0]);
      await page.locator('[data-role="shift-tabs"] [data-scope-kind="general"]').click();
      await page.locator('[data-role="paired-basis-switch"] select').selectOption('aggregate_q95');
      await expect(page.locator('[data-role="paired-basis-switch"] select')).toHaveValue('aggregate_q95');
      await expect(page.locator('[data-role="feasibility-fleet-battery"]')).toContainText(mode === 'charging_only' ? "1'000'000" : "1'060'000");
      const second = (await downloadedFeasibility(page)).document;
      expect(second.evaluation.entryRunId).toBe('q95-design');
      await assertVisibleDesign(page, second.designs.find(row => row.basis.key === 'aggregate_q95'));
      expect(second.designs.find(row => row.basis.key === 'mean').shifts[0].consumption.totalKwh).toBe(300);
      expect(fixture.requests.every(request => request.method === 'GET')).toBe(true);
      expect(fixture.unexpected).toEqual([]);
      expect(fixture.errors).toEqual([]);
    });
  }

  for (const mode of ['battery_only', 'charging_only', 'joint']) {
    test(`uniform ${mode} downloads survive reloading the saved evaluation`, async ({ page, baseURL }) => {
      const fixture = await mountFeasibilityExport(page, baseURL, { mode, uniform: true });
      await expect(exportButton(page)).toBeEnabled();
      const before = (await downloadedFeasibility(page)).document;
      expect(before.designs[0].general.investment.totals.packs).toBe(20);
      expect(before.designs[1].general.investment.totals.packs).toBe(mode === 'charging_only' ? 20 : 24);
      await page.reload();
      await expect(page).toHaveURL(/#simulation-results$/);
      await expect(exportButton(page)).toBeEnabled();
      const after = (await downloadedFeasibility(page)).document;
      expect(after.designs).toEqual(before.designs);
      expect(after.profiles).toEqual(before.profiles);
      expect(fixture.requests.every(row => row.method === 'GET')).toBe(true);
      expect(fixture.unexpected).toEqual([]);
      expect(fixture.errors).toEqual([]);
    });
  }

  for (const relaxed of [false, true]) {
    test(`${relaxed ? 'relaxed' : 'saved'} infeasible Q95 downloads keep diagnostics separate from physical operation`, async ({ page, baseURL }) => {
      const fixture = await mountFeasibilityExport(page, baseURL, { entryRunId: 'q95-design', transform: ({ q95 }) => {
        const results = q95.optimizationRun.results;
        results.electrification_feasible = false;
        results.forecast_verification.status = relaxed ? 'infeasible' : 'physical_limits_exceeded';
        Object.assign(results.battery_results.a, { physical_feasible: false, required_total_packs: 20 });
        if (relaxed) {
          results.infeasibility_diagnostics = { status: 'available', forecast_verification: { status: 'verified' },
            battery_results: { a: results.battery_results.a }, per_bus_summary: [results.per_bus_summary[0]] };
          delete results.battery_results.a;
        }
      } });
      await expect(exportButton(page)).toBeEnabled();
      const document = (await downloadedFeasibility(page)).document;
      const q95 = document.designs.find(row => row.basis.key === 'aggregate_q95');
      expect(q95.verdict.status).toBe('infeasible');
      const critical = q95.shifts.find(row => row.shiftId === 'a');
      expect(critical.diagnostic.scope).toBe(relaxed ? 'relaxed_diagnostic' : 'saved_infeasible_result');
      expect(critical.operation.result).toBeNull();
      expect(critical.energyBalance).toBeNull();
      expect(document.designs.find(row => row.basis.key === 'mean').verdict.status).toBe('feasible');
      await page.locator('[data-action="select-result-scope"][data-shift-id="a"]').click();
      await expect(page.locator('[data-role="feasibility-shift-min-soc"]')).toHaveCount(0);
      expect(fixture.unexpected).toEqual([]);
      expect(fixture.errors).toEqual([]);
    });
  }

  test('unavailable profiles produce a partial file and a later download retries loading', async ({ page, baseURL }) => {
    let fail = true;
    const fixture = await mountFeasibilityExport(page, baseURL, { runResponse: run =>
      run.id === 'q95-design' && fail ? { status: 503, json: { detail: 'Temporarily unavailable' } } : undefined });
    await expect(exportButton(page)).toBeEnabled();
    const first = (await downloadedFeasibility(page)).document;
    expect(first.designs).toHaveLength(1);
    expect(first.profiles[1].status).toBe('unavailable');
    expect(first.designs[0].shifts[0].consumption.totalKwh).toBe(300);
    await expect(exportStatus(page)).toHaveAttribute('data-state', 'partial');
    fail = false;
    const second = (await downloadedFeasibility(page)).document;
    expect(second.dataQuality.status).toBe('complete');
    expect(second.designs).toHaveLength(2);
    expect(fixture.requests.filter(row => row.path === '/api/v1/simulation/optimization-runs/q95-design')).toHaveLength(2);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test('a slow export keeps its click-time design when the user switches profile and clicks repeatedly', async ({ page, baseURL }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let requests = 0;
    const fixture = await mountFeasibilityExport(page, baseURL, { runResponse: async run => {
      if (run.id === 'q95-design') { requests++; await gate; }
    } });
    await expect(exportButton(page)).toBeEnabled();
    const downloads = [];
    page.on('download', value => downloads.push(value));
    const pending = page.waitForEvent('download');
    try {
      await page.evaluate(() => {
        const button = document.querySelector('[data-action="download-feasibility-json"]');
        for (let i = 0; i < 3; i++) button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await expect(exportButton(page)).toBeDisabled();
      await expect(exportButton(page)).toHaveAttribute('aria-busy', 'true');
      await expect(exportStatus(page)).toHaveAttribute('data-state', 'loading');
      await expect.poll(() => requests).toBe(1);
      await page.locator('[data-role="paired-basis-switch"] select').selectOption('aggregate_q95');
      await expect.poll(() => requests).toBe(2);
    } finally { release(); }
    const download = await pending;
    const document = JSON.parse((await import('node:fs')).readFileSync(await download.path(), 'utf8'));
    expect(document.evaluation.entryRunId).toBe('mean-design');
    expect(document.designs[0].shifts[0].consumption.totalKwh).toBe(300);
    await expect(exportButton(page)).toBeEnabled();
    expect(downloads).toHaveLength(1);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test('leaving results cancels a pending export and ignores its late response', async ({ page, baseURL }) => {
    let release, started = false, returned = false;
    const gate = new Promise(resolve => { release = resolve; });
    const fixture = await mountFeasibilityExport(page, baseURL, { runResponse: async run => {
      if (run.id === 'q95-design') { started = true; await gate; returned = true; }
    } });
    const downloads = [];
    page.on('download', value => downloads.push(value));
    await expect(exportButton(page)).toBeEnabled();
    await exportButton(page).click();
    await expect.poll(() => started).toBe(true);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('partial:request', { detail: { slug: 'home' } })));
    await expect(page.locator('.home-page')).toBeVisible();
    release();
    await expect.poll(() => returned).toBe(true);
    await page.waitForLoadState('networkidle');
    expect(downloads).toEqual([]);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test('an invalid counterpart shows an export error and allows a fresh retry', async ({ page, baseURL }) => {
    const fixture = await mountFeasibilityExport(page, baseURL, { transform: ({ q95 }) => {
      q95.optimizationRun.input_params.basis_source_run_id = 'wrong-family';
    } });
    const downloads = [];
    page.on('download', value => downloads.push(value));
    await expect(exportButton(page)).toBeEnabled();
    await exportButton(page).click();
    await expect(exportStatus(page)).toHaveAttribute('data-state', 'error');
    await expect(exportButton(page)).toBeEnabled();
    expect(downloads).toEqual([]);
    fixture.q95.optimizationRun.input_params.basis_source_run_id = 'mean-design';
    expect((await downloadedFeasibility(page)).document.dataQuality.status).toBe('complete');
    expect(fixture.unexpected).toEqual([]);
  });

  test('historical counterpart lookup only reads existing calculations', async ({ page, baseURL }) => {
    const fixture = await mountFeasibilityExport(page, baseURL, { transform: ({ mean, q95 }) => {
      delete mean.optimizationRun.input_params.basis_run_ids;
      delete q95.optimizationRun.input_params.basis_run_ids;
    } });
    await expect(exportButton(page)).toBeEnabled();
    const document = (await downloadedFeasibility(page)).document;
    expect(document.designs).toHaveLength(2);
    const lookup = fixture.requests.filter(row => row.path.includes('/basis/'));
    expect(lookup).toEqual([{ method: 'GET', path: '/api/v1/simulation/optimization-runs/mean-design/basis/aggregate_q95' }]);
    expect(fixture.requests.every(row => row.method === 'GET')).toBe(true);
    expect(fixture.unexpected).toEqual([]);
  });

  test('a failed Mean source does not hide the verified Q95 export', async ({ page, baseURL }) => {
    const fixture = await mountFeasibilityExport(page, baseURL, { entryRunId: 'q95-design', transform: ({ mean, q95 }) => {
      mean.optimizationRun.status = 'failed';
      mean.optimizationRun.results.error = 'Mean calculation failed';
      q95.optimizationRun.basis_summaries = { mean: { status: 'failed' },
        aggregate_q95: { status: 'completed', verification_status: 'verified', electrification_feasible: true } };
    } });
    await expect(exportButton(page)).toBeEnabled();
    const document = (await downloadedFeasibility(page)).document;
    expect(document.evaluation.recordedExecution.state).toBe('failed');
    expect(document.designs.find(row => row.basis.key === 'aggregate_q95').shifts[0].consumption.totalKwh).toBe(390.123456789);
    expect(document.designs.find(row => row.basis.key === 'mean').verdict.status).toBe('not_determined');
    expect(document.profiles.find(row => row.basis === 'mean').status).toBe('failed');
    await expect(exportStatus(page)).toHaveAttribute('data-state', 'partial');
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test('a wrong forecast response stays missing instead of entering the exported design', async ({ page, baseURL }) => {
    const fixture = await mountFeasibilityExport(page, baseURL, { predictionResponse: prediction =>
      prediction.id === 'aggregate_q95-a' ? { json: { ...prediction, id: 'unrelated-forecast' } } : undefined });
    await expect(exportButton(page)).toBeEnabled();
    const document = (await downloadedFeasibility(page)).document;
    expect(document.dataQuality.status).toBe('partial');
    expect(document.dataQuality.issues.some(row => row.code === 'prediction_loading_failed')).toBe(true);
    expect(document.designs[1].provenance.predictions.missingRunIds).toContain('aggregate_q95-a');
    expect(document.designs[1].sourceData.predictionRuns.some(row => row.id === 'unrelated-forecast')).toBe(false);
    expect(fixture.unexpected).toEqual([]);
  });

  test('exact forecast IDs bypass a bounded history list with at most four parallel reads', async ({ page, baseURL }) => {
    let active = 0, peak = 0;
    const fixture = await mountFeasibilityExport(page, baseURL, { predictionList: [],
      transform: ({ mean }) => {
        for (let i = 0; i < 9; i++) {
          const prediction = structuredClone(mean.predictionRuns[0]);
          prediction.id = `old-reference-${i}`;
          mean.predictionRuns.push(prediction);
          mean.optimizationRun.prediction_run_ids.push(prediction.id);
        }
      }, predictionResponse: async () => {
        peak = Math.max(peak, ++active);
        await new Promise(resolve => setTimeout(resolve, 20));
        active--;
      } });
    await expect(exportButton(page)).toBeEnabled();
    const document = (await downloadedFeasibility(page)).document;
    expect(document.dataQuality.status).toBe('complete');
    expect(document.designs[0].sourceData.predictionRuns).toHaveLength(12);
    expect(peak).toBeLessThanOrEqual(4);
    expect(fixture.requests.filter(row => row.path === '/api/v1/simulation/prediction-runs/')).toHaveLength(1);
    expect(fixture.unexpected).toEqual([]);
  });

  for (const [language, label] of Object.entries({ en: 'Download all results (JSON)', it: 'Scarica tutti i risultati (JSON)',
    de: 'Alle Ergebnisse herunterladen (JSON)', fr: 'Télécharger tous les résultats (JSON)' })) {
    test(`export controls are translated and fit the ${language} page`, async ({ page, baseURL }) => {
      const fixture = await mountFeasibilityExport(page, baseURL, { language });
      await expect(exportButton(page)).toBeEnabled();
      await expect(exportButton(page)).toHaveText(label);
      const actions = page.locator('.simulation-results-page .results-actions');
      await expect(actions.locator('[data-action="download-feasibility-json"]')).toBeVisible();
      await expect(exportButton(page).locator('svg')).toBeVisible();
      await expect(page.locator('.simulation-results-page .page-header [data-action="download-feasibility-json"]')).toHaveCount(0);
      const layout = await actions.evaluate(element => {
        const download = element.querySelector('[data-action="download-feasibility-json"]').getBoundingClientRect();
        const close = element.querySelector('[data-action="back"]').getBoundingClientRect();
        const panels = document.querySelector('.results-tab-panels').getBoundingClientRect();
        return { afterResults: download.top >= panels.bottom, beforeClose: download.right <= close.left || download.bottom <= close.top };
      });
      expect(layout).toEqual({ afterResults: true, beforeClose: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      expect(fixture.unexpected).toEqual([]);
      expect(fixture.errors).toEqual([]);
    });
  }

}

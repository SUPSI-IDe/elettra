import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { translations } from '../../src/i18n/translations.js';
const updateGuideScreenshots = process.env.UPDATE_GUIDE_SCREENSHOTS === '1';
const lcaFixture = JSON.parse(readFileSync(new URL('../fixtures/grid94-lca.json', import.meta.url), 'utf8')).base;

const expectCostOutcomes = async (page, { electric, diesel, difference }) => {
  await expect(page.locator('[data-role="fleet-tco"]')).toHaveText(electric.replace(' CHF/km', ''));
  await expect(page.locator('[data-role="diesel-tco"]')).toHaveText(diesel.replace(' CHF/km', ''));
  await expect(page.locator('[data-role="tco-difference"]')).toHaveText(difference.replace(' CHF/km', ''));
  await expect(page.locator('[data-outcome="electric-tco"] .annual-outcome__value')).toHaveText(electric.replace(' CHF/km', ''));
};

const expectSharedAssessment = async page => {
  const assessment = await page.evaluate(() => window.dashboard.getAssessment({
    scope: document.querySelector('[data-tco-scope]').value,
  }));
  for (const [role, value] of [
    ['fleet-tco', assessment.economics.electric.perKm],
    ['diesel-tco', assessment.economics.diesel.perKm],
    ['tco-difference', assessment.economics.differencePerKm],
  ]) {
    const displayed = Number((await page.locator(`[data-role="${role}"]`).textContent()).replace(/['’]/g, ''));
    expect(displayed).toBeCloseTo(value, 3);
  }
  const distance = Number((await page.locator('[data-summary="distance"] strong').textContent()).replace(/['’]/g, ''));
  expect(distance).toBe(Math.round(assessment.scopedFleet.totals.km / assessment.divisor));
  return assessment;
};

test('representative and fleet views reconcile investment and TCO, assumptions autosave with an accessible explanation', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: {} }));
  await page.goto('./');
  await page.evaluate(async () => {
    await import('/elettra/src/style.css');
    localStorage.setItem('elettra_lang', 'en');
    document.body.innerHTML = '<main id="test-annual"></main>';
    const { createYearlyFleetDashboard } = await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-fleet-dashboard.js');
    const features = {
      config: { auxiliary_heating_type: 'default', fixedConfiguration: {
        fleet: { vehicleCount: 2 },
        investment: { rows: ['a', 'b'].map(id => ({ id, packs: 14, capacity: 700, busCost: 800000, batteryCost: 84000 })) },
        infrastructure: { dataAvailable: true, stations: [{ selected: true, stopName: 'Depot', installationCostChf: 400000,
          costBreakdown: { chargers_cost_chf: 110000, site_fixed_cost_chf: 250000, site_power_cost_chf: 40000 } }] },
      } },
      results: { yearlyTotals: { distanceKm: 100000, totalEnergyKwh: 160000 }, shiftResults: [
        { shiftId: 'a', status: 'completed', yearlyTotals: { distanceKm: 80000, totalEnergyKwh: 144000 } },
        { shiftId: 'b', status: 'completed', yearlyTotals: { distanceKm: 20000, totalEnergyKwh: 16000 } },
      ] },
    };
    window.dashboard = createYearlyFleetDashboard({ features, model: { bus_length_m: 18 }, predictionRuns: [], onSave: async values => { if (window.failSave) throw Error('Offline'); window.savedTco = values; } });
    window.dashboard.mount(document.querySelector('main'), { status: 'error', error: 'Environmental service unavailable' });
  });
  await expect(page.locator('[data-tco-scope]')).toHaveValue('a');
  expect(await page.evaluate(() => {
    const snapshot = window.dashboard.getAssessment();
    snapshot.assumptions.energyPrice = 999;
    snapshot.fleet.rows[0].busCost = 0;
    const next = window.dashboard.getAssessment();
    return { scope: next.scope.kind, price: next.assumptions.energyPrice, initial: next.economics.electric.initial };
  })).toEqual({ scope: 'fleet', price: .2, initial: 2168000 });
  await expectSharedAssessment(page);
  await expect(page.locator('[data-role="annual-activity-summary"] strong')).toHaveText([
    "50'000",
    "80'000",
    "85'106",
  ]);
  await expect(page.locator('[data-role="annual-activity-summary"] .result-metric__label')).toHaveText([
    'Annual distance [km]',
    'Energy used by the buses [kWh]',
    'Electricity purchased [kWh]',
  ]);
  await expect(page.locator('[data-annual-header] .annual-summary-grid .result-metric')).toHaveCount(6);
  await expect(page.locator('[data-annual-header] .annual-outcomes')).toHaveCount(0);
  await expect(page.locator('[data-annual-header] [data-outcome="diesel-tco"], [data-annual-header] [data-outcome="tco-difference"], [data-annual-header] [data-outcome="break-even"]')).toHaveCount(0);
  await expect(page.locator('[data-annual-header] .helper-text').filter({ hasText: 'Groups keep the vehicle blocks assigned' })).toHaveCount(0);
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__label')).toHaveText('Average efficiency [kWh/km DC]');
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__value > span')).toHaveText(['Min: 0.8 (b)', 'Max: 1.8 (a)']);
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__hint')).toHaveCount(0);
  await expect(page.locator('[data-outcome="electric-tco"] .annual-outcome__label')).toHaveText('TCO [CHF/km]');
  expect(await page.locator('.annual-summary-grid > .result-metric').evaluateAll(elements => elements.map(element => element.dataset.summary ?? element.dataset.outcome))).toEqual([
    'distance', 'dc', 'grid', 'efficiency', 'electric-tco', 'climate',
  ]);
  expect(await page.locator('.annual-summary-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(
    await page.evaluate(() => innerWidth <= 700 ? 1 : 3),
  );
  expect(await page.locator('.annual-efficiency__value').evaluate(element => ({ fontWeight: getComputedStyle(element).fontWeight, whiteSpace: getComputedStyle(element).whiteSpace }))).toEqual({ fontWeight: '600', whiteSpace: 'normal' });
  expect(await page.locator('.annual-efficiency__value').evaluate((element, comparison) => getComputedStyle(element).fontSize === getComputedStyle(document.querySelector(comparison)).fontSize, '[data-outcome="electric-tco"] .annual-outcome__value')).toBe(true);
  expect(await page.locator('.annual-efficiency__value').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.locator('.annual-summary-grid > .result-metric').evaluateAll(elements => elements.every(element => getComputedStyle(element).alignItems === 'center'))).toBe(true);
  await expect(page.getByText("CHF 1'084'000", { exact: true }).first()).toBeVisible();
  await expectCostOutcomes(page, {
    electric: '2.934 CHF/km',
    diesel: '2.475 CHF/km',
    difference: '-0.459 CHF/km',
  });
  await expect(page.locator('[data-cost-break-even]')).toContainText('Not reached within the analysis horizon');
  await expect(page.locator('[data-outcome="climate"] .annual-outcome__value')).toHaveText('—');
  expect(await page.locator('[data-annual-financial] > *').evaluateAll(elements => elements.map(element =>
    element.querySelector('[data-annual-financial-summary]') ? 'results'
      : element.hasAttribute('data-annual-controls') ? 'assumptions'
        : element.querySelector('[data-annual-financial-detail]') ? 'details' : 'unknown'
  ))).toEqual(['results', 'assumptions', 'details']);
  await expect(page.locator('.annual-cost-results-card [data-cost-annual] svg')).toBeVisible();
  await expect(page.locator('.annual-cost-results-card [data-cost-cumulative] svg')).toBeVisible();
  await expect(page.locator('.annual-cost-results-card [data-tco-assumptions]')).toHaveCount(0);
  await expect(page.locator('[data-annual-controls] > [data-tco-form] > details.result-card')).toHaveCount(1);
  await expect(page.locator('.annual-cost-summary-grid .result-metric')).toHaveCount(3);
  await expect(page.locator('.annual-cost-summary-grid .result-metric__label')).toHaveText([
    'Electric bus · TCO · 12 years [CHF/km]',
    'Diesel comparator · TCO [CHF/km]',
    'Electric saving / premium [CHF/km]',
  ]);
  expect(await page.locator('.annual-cost-summary-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(
    await page.evaluate(() => innerWidth <= 700 ? 1 : 3),
  );
  const assumptionsPanel = page.locator('[data-tco-assumptions]');
  await expect(assumptionsPanel).not.toHaveAttribute('open', '');
  // Rendering before the queued native toggle event must retain the open panel.
  await assumptionsPanel.evaluate(panel => {
    panel.open = true;
    panel.closest('form').requestSubmit();
  });
  await expect(assumptionsPanel).toHaveAttribute('open', '');
  await assumptionsPanel.locator(':scope > summary').click();
  await expect(assumptionsPanel).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-assumptions-state]')).toHaveText('Initial values');
  await expect(page.locator('[data-assumptions-state]')).toHaveAttribute('data-modified', 'false');
  const initialComparisonRows = page.locator('[data-annual-financial] .annual-fleet-table').first().getByRole('row');
  await expect(initialComparisonRows).toHaveText([
    'Electric busDiesel comparator',
    "Initial investmentCHF 1'084'000CHF 500'000",
    "Annual operating costCHF 41'021CHF 73'542",
    "Equivalent annual costCHF 146'719CHF 123'773",
    "Net discounted lifetime costCHF 1'460'443CHF 1'232'032",
  ]);
  const tco = await page.locator('[data-role="fleet-tco"]').innerText();
  await page.locator('[data-tco-scope]').selectOption('fleet');
  await expect(page.locator('[data-role="annual-activity-summary"] strong')).toHaveText([
    "100'000",
    "160'000",
    "170'213",
  ]);
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__value > span')).toHaveText(['Min: 0.8 (b)', 'Max: 1.8 (a)']);
  await expect(page.getByText("CHF 2'168'000", { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-role="fleet-tco"]')).toHaveText(tco);
  await expect(page.locator('[data-outcome="electric-tco"] .annual-outcome__value')).toHaveText(tco.replace(' CHF/km', ''));
  const fleetComparisonRows = page.locator('[data-annual-financial] .annual-fleet-table').first().getByRole('row');
  await expect(fleetComparisonRows).toHaveText([
    'Electric busDiesel comparator',
    "Initial investmentCHF 2'168'000CHF 1'000'000",
    "Annual operating costCHF 82'043CHF 147'083",
    "Equivalent annual costCHF 293'438CHF 247'545",
    "Net discounted lifetime costCHF 2'920'886CHF 2'464'065",
  ]);
  await page.getByText('Charging infrastructure by location', { exact: true }).click();
  await expect(page.getByRole('row', { name: "Depot CHF 110'000 CHF 250'000 CHF 40'000 CHF 400'000" })).toBeVisible();
  await expect(page.locator('.annual-cost-summary-grid .result-metric__label').nth(1)).toContainText('[CHF/km]');
  await expect(page.locator('[data-cost-annual] svg')).toBeVisible();
  await expect(page.locator('[data-cost-cumulative] svg')).toBeVisible();
  await assumptionsPanel.locator(':scope > summary').click();
  await expect(assumptionsPanel).toHaveAttribute('open', '');
  await page.locator('input[type="number"][data-tco-input="energyPrice"]').fill('0.4');
  await expect(page.locator('[data-assumptions-state]')).toHaveText('Modified values');
  await expect(page.locator('[data-assumptions-state]')).toHaveAttribute('data-modified', 'true');
  await expectCostOutcomes(page, {
    electric: '3.275 CHF/km',
    diesel: '2.475 CHF/km',
    difference: '-0.799 CHF/km',
  });
  await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
  await expect(page.getByText('Environmental service unavailable', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Costs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save assumptions', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-save-status]')).toHaveText('Changes saved');
  expect(await page.evaluate(() => window.savedTco.energyPrice)).toBe(.4);
  const editedAssessment = await expectSharedAssessment(page);
  expect(editedAssessment.assumptions.energyPrice).toBe(.4);
  expect(editedAssessment.assumptions.annualKmByShift).toEqual({ a: 80000, b: 20000 });
  await page.getByRole('button', { name: 'Information about these assumptions', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.getByRole('tooltip')).toContainText('Costs and Emissions share the same values');
  // Autofill / embedded browsers may change a value without a change event.
  await page.locator('input[type="number"][data-tco-input="energyPrice"]').evaluate(input => { input.value = '0.25'; input.form.requestSubmit(); });
  await expect(page.locator('[data-save-status]')).toHaveText('Changes saved');
  await expectCostOutcomes(page, {
    electric: '3.019 CHF/km',
    diesel: '2.475 CHF/km',
    difference: '-0.544 CHF/km',
  });
  expect(await page.evaluate(() => window.savedTco.energyPrice)).toBe(.25);
  await page.evaluate(() => { window.failSave = true; });
  await page.locator('input[type="number"][data-tco-input="energyPrice"]').fill('0.3');
  await expect(page.locator('[data-save-status]')).toHaveText('Could not save changes');
  await expectCostOutcomes(page, {
    electric: '3.105 CHF/km',
    diesel: '2.475 CHF/km',
    difference: '-0.629 CHF/km',
  });
  expect(await page.evaluate(() => window.savedTco.energyPrice)).toBe(.25);
  await page.evaluate(() => { window.failSave = false; });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveText('Changes saved');
  expect(await page.evaluate(() => window.savedTco.energyPrice)).toBe(.3);
  // Horizontal overflow stays inside individual tables, including on mobile.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

const mountTwoBatteryGroups = async (page, { lang = 'en', example } = {}) => {
  await page.addInitScript(lang => localStorage.setItem('elettra_lang', lang), lang);
  await page.route('**/api/v1/**', route => route.fulfill({ json: {} }));
  await page.goto('./');
  await page.evaluate(async ({ template, example }) => {
    await import('/elettra/src/style.css');
    document.body.innerHTML = '<main id="test-annual"></main>';
    const { createYearlyFleetDashboard } = await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-fleet-dashboard.js');
    const features = {
      config: { auxiliary_heating_type: 'default', fixedConfiguration: {
        fleet: { vehicleCount: 2 },
        investment: { rows: [
          { id: 'long', modelName: 'TPL_18m', packs: 14, capacity: 700, busCost: 800000, batteryCost: 84000 },
          { id: 'short', modelName: 'TPL_18m', packs: 10, capacity: 500, busCost: 800000, batteryCost: 60000 },
        ] },
        infrastructure: { dataAvailable: true, stations: [{ selected: true, stopName: example?.depot ?? 'Depot', installationCostChf: 400000,
          costBreakdown: { chargers_cost_chf: 110000, site_fixed_cost_chf: 250000, site_power_cost_chf: 40000 } }] },
      } },
      results: { yearlyTotals: { distanceKm: 100000, totalEnergyKwh: 160000 }, shiftResults: [
        { shiftId: 'long', shiftName: example?.long, status: 'completed', yearlyTotals: { distanceKm: 80000, totalEnergyKwh: 144000 } },
        { shiftId: 'short', shiftName: example?.short, status: 'completed', yearlyTotals: { distanceKm: 20000, totalEnergyKwh: 16000 } },
      ] },
    };
    const makeLca = (values = {}) => {
      const raw = structuredClone(template);
      raw.vehicles = ['long', 'short'].map((id, i) => {
        const v = structuredClone(template.vehicles[0]);
        Object.assign(v, { shift_id: id, shift_ids: [id], vehicle_count: 1, bus_length_m: 18,
          battery_capacity_kwh: i ? 500 : 700, annual_km: values.annualKmByShift?.[id] ?? (i ? 20000 : 80000),
          lifetime_bus: values.bodyLife ?? 12, lifetime_battery: values.batteryLife ?? 8,
          lifetime_diesel_bus: values.dieselLife ?? 12, diesel_consumption_l_per_km: values.dieselConsumption ?? .5518 });
        v.dc_kwh = v.annual_km * (i ? .8 : 1.8);
        const factor = v.annual_km / template.vehicles[0].annual_km;
        for (const indicator of Object.values(v.indicators)) {
          for (const key of ['electricity_operation', 'diesel_heating', 'other_lifecycle', 'total', 'diesel_comparator_total']) indicator[key] *= factor;
          for (const key of ['phases', 'diesel_comparator_phases', 'diesel_heating_phases'])
            Object.keys(indicator[key]).forEach(phase => { indicator[key][phase] *= factor; });
          // Make the preview fixture react to the requested fuel consumption,
          // so the UI must display the returned comparison, not stale values.
          for (const phase of ['direct', 'energyChain'])
            indicator.diesel_comparator_phases[phase] *= v.diesel_consumption_l_per_km / .5518;
          indicator.diesel_comparator_total = Object.values(indicator.diesel_comparator_phases).reduce((sum, value) => sum + value, 0);
          indicator.saving = indicator.diesel_comparator_total - indicator.total;
        }
        return v;
      });
      raw.vehicle_count = 2; raw.annual_km = raw.vehicles.reduce((s, v) => s + v.annual_km, 0);
      const dc = raw.vehicles.reduce((s, v) => s + v.dc_kwh, 0);
      Object.assign(raw.energy_boundary, { dc_kwh: dc, grid_kwh: dc / .94, charging_losses_kwh: dc / .94 - dc });
      for (const [key, indicator] of Object.entries(raw.indicators)) {
        for (const field of ['electricity_operation', 'diesel_heating', 'other_lifecycle', 'total', 'diesel_comparator_total']) indicator[field] = raw.vehicles.reduce((s, v) => s + v.indicators[key][field], 0);
        for (const field of ['phases', 'diesel_comparator_phases', 'diesel_heating_phases'])
          Object.keys(indicator[field]).forEach(phase => { indicator[field][phase] = raw.vehicles.reduce((s, v) => s + v.indicators[key][field][phase], 0); });
        indicator.saving = indicator.diesel_comparator_total - indicator.total;
      }
      return raw;
    };
    window.previews = [];
    window.dashboard = createYearlyFleetDashboard({ features, model: { bus_length_m: 18 }, predictionRuns: [],
      onSave: async values => { window.savedTco = values; },
      onPreviewLca: async values => {
        window.previews.push(values);
        if (window.holdPreview) await new Promise(resolve => { window.releasePreview = resolve; });
        if (window.failPreview) throw Error('Preview unavailable');
        return makeLca(values);
      } });
    const incomingState = { status: 'done', rawLca: makeLca() };
    window.dashboard.mount(document.querySelector('main'), incomingState);
    // The page loader mutates its state object while starting another request.
    // That must not silently mutate the dashboard's accepted assessment.
    incomingState.status = 'error'; incomingState.rawLca = null;
  }, { template: lcaFixture, example });
};

const yearlyGuideExample = {
  en: { long: 'Block 501', short: 'Block 502', depot: 'Depot', investment: 'Annualized investment', tab: 'Emissions' },
  de: { long: 'Umlauf 501', short: 'Umlauf 502', depot: 'Depot', investment: 'Annualisierte Investition', tab: 'Emissionen' },
  fr: { long: 'Service 501', short: 'Service 502', depot: 'Dépôt', investment: 'Investissement annualisé', tab: 'Émissions' },
  it: { long: 'Turno 501', short: 'Turno 502', depot: 'Deposito', investment: 'Investimento annualizzato', tab: 'Emissioni' },
};

for (const [lang, example] of Object.entries(yearlyGuideExample)) {
  test(`capture the yearly guide screenshots in ${lang}`, async ({ page }, testInfo) => {
    test.skip(!updateGuideScreenshots || testInfo.project.name !== 'chromium',
      'Guide screenshots are generated on demand with desktop Chromium');
    await page.setViewportSize({ width: 1440, height: 1160 });
    await mountTwoBatteryGroups(page, { lang, example });
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const financialSummary = page.locator('[data-annual-financial-summary]');
    const annualCost = financialSummary.locator('[data-cost-annual]');
    await expect(annualCost.getByText(example.investment, { exact: true })).toBeVisible();
    await expect(annualCost.locator('rect[fill="#76559a"]')).toHaveCount(2);
    await expect(financialSummary.locator('[data-cost-cumulative] svg')).toBeVisible();
    await page.mouse.move(0, 0);
    await financialSummary.screenshot({
      path: `guide/images/${lang}/yearly-efficiency.png`,
      animations: 'disabled',
    });

    const emissionsTab = page.getByRole('tab', { name: example.tab, exact: true });
    await emissionsTab.click();
    await expect(emissionsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-role="ya-lca-phases"] h3'))
      .toHaveText(translations[lang]['yearly_analysis.lca_phases']);
    await expect(page.locator('.ya-lca-phase-bar__label')).toHaveCount(2);
    await expect(page.locator('[data-tco-assumptions][data-assumptions-tab="emissions"] > summary')).toBeVisible();
    await expect(page.locator('[data-outcome="efficiency"]')).toContainText(example.short);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0);
    const overview = page.locator('[data-role="ya-lca-overview"]');
    await expect(overview).toBeInViewport({ ratio: 1 });
    const { y, height } = await overview.boundingBox();
    await page.screenshot({
      path: `guide/images/${lang}/yearly-emissions.png`,
      animations: 'disabled',
      clip: { x: 0, y: 0, width: 1440, height: Math.ceil(y + height + 8) },
    });
  });
}

test('different battery groups retain duties and consumption; sliders restore diesel charts, LCA and export', async ({ page }) => {
  await mountTwoBatteryGroups(page);
  expect(await page.evaluate(() => {
    const snapshot = window.dashboard.getExportState();
    return { status: snapshot.assessment.environment.status,
      matches: snapshot.assessment.environment.matchesAssumptions,
      persistence: snapshot.persistence.status };
  })).toEqual({ status: 'done', matches: true, persistence: 'loaded' });
  await expect(page.locator('[data-tco-scope]')).toHaveValue('fleet');
  await expect(page.locator('[data-role="annual-activity-summary"] strong')).toHaveText([
    "100'000",
    "160'000",
    "170'213",
  ]);
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__value > span')).toHaveText(['Min: 0.8 (short)', 'Max: 1.8 (long)']);
  await expect(page.locator('[data-outcome="climate"] .annual-outcome__value')).toHaveText('51.77');
  await expect(page.locator('[data-outcome="climate"] .annual-outcome__hint')).toHaveText('Diesel comparator [t/year] 151.5');
  await expect(page.locator('.ya-lca-phase-bar__label')).toHaveText([
    'ELETTRA: 51.77 t CO₂-eq',
    'Diesel: 151.5 t CO₂-eq',
  ]);
  await expectCostOutcomes(page, {
    electric: '2.9 CHF/km',
    diesel: '2.475 CHF/km',
    difference: '-0.424 CHF/km',
  });
  await page.locator('[data-tco-assumptions] > summary').click();
  await expect(page.locator('[data-tco-assumptions]')).toHaveAttribute('open', '');
  await expect(page.getByRole('slider')).toHaveCount(7);
  await page.locator('[data-tco-settings] > summary').click();
  const maintenance = page.locator('[data-tco-settings] input[type="number"][data-tco-input="infrastructureMaintenanceRate"]');
  await expect(maintenance).toHaveValue('2');
  await expect(page.locator('[data-maintenance-estimate]')).toContainText("CHF 8'000");
  await maintenance.evaluate(el => { window.originalMaintenanceInput = el; });
  await maintenance.fill('2.2');
  await expect(maintenance).toHaveValue('2.2');
  expect(await maintenance.evaluate(el => window.originalMaintenanceInput === el)).toBe(true);
  await expect(page.locator('[data-maintenance-estimate]')).toContainText("CHF 8'800");
  await page.locator('input[type="number"][data-tco-input="km:long"]').fill('100000');
  await expect(page.locator('[data-summary="distance"] strong')).toHaveText("120'000");
  await expect(page.locator('[data-summary="dc"] strong')).toHaveText("196'000");
  await expect.poll(() => page.evaluate(() => window.previews.at(-1)?.annualKmByShift)).toEqual({ long: 100000, short: 20000 });
  await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
  await expect(page.locator('[data-role="ya-lca-phases"]')).toBeVisible();
  await expect(page.locator('.ya-lca-phase-bar')).toHaveCount(2);
  const emissionsAssumptions = page.locator('[data-tco-assumptions]');
  await expect(emissionsAssumptions).not.toHaveAttribute('open', '');
  await expect(emissionsAssumptions.locator('[data-assumptions-title]')).toHaveText('Activity and diesel consumption');
  expect(await page.locator('[data-role="ya-lca-phases"]').evaluate(element => element.nextElementSibling?.matches('[data-emissions-controls]'))).toBe(true);
  await emissionsAssumptions.getByRole('button', { name: 'Information about these assumptions', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.getByRole('tooltip')).toContainText('These values are shared with Costs');
  await expect(page.getByRole('tooltip')).toContainText('One mileage control per bus model and battery size');
  await expect(emissionsAssumptions.locator('.annual-assumptions__body')).not.toContainText('These values are shared with Costs');
  await expect(emissionsAssumptions.locator('.annual-assumptions__body')).not.toContainText('One mileage control per bus model and battery size');
  await expect(page.getByRole('spinbutton', { name: 'Diesel consumption (l/km)', exact: true })).toBeHidden();
  await emissionsAssumptions.locator(':scope > summary').click();
  await expect(emissionsAssumptions).toHaveAttribute('open', '');
  await expect(emissionsAssumptions.locator('.annual-assumptions__body')).toHaveCSS('display', 'flex');
  const emissionsSliderLayout = await emissionsAssumptions.evaluate(element => ({
    rangeTops: [...element.querySelectorAll('input[type="range"]')].filter(input => input.offsetParent).map(input => input.getBoundingClientRect().top),
    viewportWidth: innerWidth,
  }));
  if (emissionsSliderLayout.viewportWidth > 700) expect(emissionsSliderLayout.rangeTops).toEqual(emissionsSliderLayout.rangeTops.map(() => emissionsSliderLayout.rangeTops[0]));
  await expect(page.locator('[data-role="ya-lca-indicators"]')).toContainText('PE non-renewable');
  await page.locator('.ya-lca-details summary').click();
  await expect(page.locator('.ya-lca-details table')).toContainText('Diesel');
  await page.locator('[data-tco-scope]').selectOption('short');
  await expect(page.locator('[data-summary="distance"] strong')).toHaveText("20'000");
  await expect(page.getByText('0.8 kWh/km DC', { exact: true })).toBeVisible();
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__value')).toHaveText('0.8 (short)');
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__hint')).toHaveCount(0);
  await expect(page.locator('[data-annual-header]')).not.toContainText('500 kWh');
  await expect(page.locator('[data-outcome="climate"] .annual-outcome__value')).toHaveText('10.35');
  await expect(page.locator('[data-outcome="climate"] .annual-outcome__hint')).toHaveText('Diesel comparator [t/year] 30.3');
  await expect(page.locator('.ya-lca-phase-bar__label')).toHaveText([
    'ELETTRA: 10.35 t CO₂-eq',
    'Diesel: 30.3 t CO₂-eq',
  ]);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-lca-export]').click();
  const exported = JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8'));
  expect(exported.annual_km).toBe(20000);
  expect(exported.display_scope.shift_ids).toEqual(['short']);
  expect(exported.vehicles[0].battery_capacity_kwh).toBe(500);
  expect(exported.indicators.gwp100a.diesel_comparator_total).toBeGreaterThan(0);

  // The same controls are available in Emissions, without unrelated prices.
  await expect(page.getByRole('slider')).toHaveCount(3);
  await expect(page.locator('input[type="number"][data-tco-input="energyPrice"]')).toBeHidden();
  const dieselConsumption = page.getByRole('spinbutton', { name: 'Diesel consumption (l/km)', exact: true });
  const electricTco = await page.locator('[data-role="fleet-tco"]').textContent();
  const dieselTco = await page.locator('[data-role="diesel-tco"]').textContent();
  const previousPhaseBars = await page.locator('.ya-lca-phase-bar__label').allTextContents();
  await page.evaluate(() => { window.holdPreview = true; });
  await dieselConsumption.fill('0.65');
  await expect(page.locator('.annual-lca-refresh-status')).toHaveText('Updating…');
  await expect(page.locator('.ya-lca-phase-bar__label')).toHaveText(previousPhaseBars);
  await expect(page.locator('[data-lca-export]')).toBeDisabled();
  expect(await page.evaluate(() => {
    const assessment = window.dashboard.getAssessment({ scope: 'short' });
    return { status: assessment.environment.status, stale: assessment.environment.isStale,
      matches: assessment.environment.matchesAssumptions, consumption: assessment.assumptions.dieselConsumption };
  })).toEqual({ status: 'loading', stale: true, matches: false, consumption: .65 });
  await expect.poll(() => page.evaluate(() => window.previews.at(-1)?.dieselConsumption)).toBe(.65);
  await page.evaluate(() => { window.holdPreview = false; window.releasePreview(); });
  await expect(page.locator('.annual-lca-refresh-status')).toHaveCount(0);
  await expect(page.locator('[data-lca-export]')).toBeEnabled();
  await expect(page.locator('.ya-lca-phase-bar__label').nth(1)).not.toHaveText(previousPhaseBars[1]);
  await expect(page.locator('[data-role="fleet-tco"]')).toHaveText(electricTco);
  await expect(page.locator('[data-role="diesel-tco"]')).not.toHaveText(dieselTco);
  await expect(page.locator('[data-outcome="electric-tco"] .annual-outcome__value')).toHaveText(electricTco.replace(' CHF/km', ''));
  await expect(page.locator('[data-annual-header] [data-outcome="diesel-tco"], [data-annual-header] [data-outcome="tco-difference"]')).toHaveCount(0);
  await expect(page.locator('[data-lca-export]')).toBeVisible();
  const fuelDownload = page.waitForEvent('download');
  await page.locator('[data-lca-export]').click();
  const fuelExport = JSON.parse(readFileSync(await (await fuelDownload).path(), 'utf8'));
  expect(fuelExport.indicators.gwp100a.diesel_comparator_total).toBeGreaterThan(exported.indicators.gwp100a.diesel_comparator_total);
  expect(fuelExport.indicators.gwp100a.total).toBe(exported.indicators.gwp100a.total);

  await page.locator('input[type="number"][data-tco-input="km:short"]').fill('30000');
  await expect.poll(() => page.evaluate(() => window.previews.at(-1)?.annualKmByShift)).toEqual({ long: 100000, short: 30000 });
  await expect(page.locator('[data-summary="distance"] strong')).toHaveText("30'000");
  await expect(page.locator('[data-summary="dc"] strong')).toHaveText("24'000");
  await expect(page.locator('[data-lca-export]')).toBeVisible();
  const mileageDownload = page.waitForEvent('download');
  await page.locator('[data-lca-export]').click();
  const mileageExport = JSON.parse(readFileSync(await (await mileageDownload).path(), 'utf8'));
  expect(mileageExport.annual_km).toBe(30000);
  expect(mileageExport.display_scope.shift_ids).toEqual(['short']);
  expect(mileageExport.indicators.gwp100a.total).toBeCloseTo(fuelExport.indicators.gwp100a.total * 1.5);
  expect(mileageExport.indicators.gwp100a.diesel_comparator_total).toBeCloseTo(fuelExport.indicators.gwp100a.diesel_comparator_total * 1.5);
  await expect(page.locator('[data-save-status]')).toHaveText('Changes saved');
  expect(await page.evaluate(() => window.savedTco.annualKmByShift)).toEqual({ long: 100000, short: 30000 });
  expect(await page.evaluate(() => window.savedTco.dieselConsumption)).toBe(.65);
  const updatedAssessment = await expectSharedAssessment(page);
  expect(updatedAssessment.environment.matchesAssumptions).toBe(true);
  expect(updatedAssessment.environment.rawLca.annual_km).toBe(30000);
  expect(updatedAssessment.assumptions.annualKmByShift).toEqual({ long: 100000, short: 30000 });
  const fullFleetAssessment = await page.evaluate(() => window.dashboard.getAssessment());
  expect(fullFleetAssessment.scope.kind).toBe('fleet');
  expect(fullFleetAssessment.fleet.totals.km).toBe(130000);

  await page.getByRole('tab', { name: 'Costs', exact: true }).click();
  await expect(dieselConsumption).toHaveValue('0.65');
  await expect(page.locator('input[type="number"][data-tco-input="km:short"]')).toHaveValue('30000');
  await expect(maintenance).toHaveValue('2.2');
  await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
  await page.getByRole('button', { name: 'Reset mileage and diesel consumption', exact: true }).click();
  await expect(dieselConsumption).toHaveValue('0.5518');
  await expect(page.locator('input[type="number"][data-tco-input="km:long"]')).toHaveValue('80000');
  await expect(page.locator('input[type="number"][data-tco-input="km:short"]')).toHaveValue('20000');
  await page.getByRole('tab', { name: 'Costs', exact: true }).click();
  await expect(maintenance).toHaveValue('2.2');
  await page.getByRole('button', { name: 'Reset all parameters', exact: true }).click();
  await expect(maintenance).toHaveValue('2');
  await expect(page.locator('input[type="number"][data-tco-input="km:long"]')).toHaveValue('80000');
  await expect(page.locator('[data-assumptions-state]')).toHaveText('Initial values');
  await expect(page.locator('[data-assumptions-state]')).toHaveAttribute('data-modified', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dashboard and export use the latest API projection and recover after a failed request', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: {} }));
  await page.goto('./');
  await page.evaluate(async () => {
    const { createYearlyFleetDashboard } = await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-fleet-dashboard.js');
    const { fixtureProjectTco } = await import('/elettra/test-support/project-tco-response.js');
    localStorage.setItem('elettra_lang', 'en');
    document.body.innerHTML = '<main></main>';
    const activity = { distanceKm: 20000, totalEnergyKwh: 25000 };
    const features = { assessment_assumptions: { tco: { dieselCapex: 324414.06 } }, config: { fixedConfiguration: {
      fleet: { vehicleCount: 1 }, investment: { rows: [{ id: 'a', packs: 10, capacity: 400, busCost: 471250, batteryCost: 132000 }] },
      infrastructure: { dataAvailable: true, stations: [] },
    } }, results: { yearlyTotals: activity, shiftResults: [{ shiftId: 'a', status: 'completed', yearlyTotals: activity }] } };
    window.quotes = [];
    window.dashboard = createYearlyFleetDashboard({ features, model: { bus_length_m: 10.75 }, predictionRuns: [], onSave: async () => {},
      onProjectTco: body => new Promise((resolve, reject) => {
        window.quotes.push({ reject, reply(value) {
          const result = fixtureProjectTco(body);
          result.scopes.forEach(scope => { scope.electric.annualEquivalent = value; scope.electric.perKm = value / 20000; });
          resolve(result);
        } });
      }),
    });
    window.dashboard.mount(document.querySelector('main'), { status: 'idle' });
  });
  await expect.poll(() => page.evaluate(() => window.quotes.length)).toBe(1);
  await page.locator('[data-tco-assumptions] > summary').click();
  await page.locator('input[type="number"][data-tco-input="energyPrice"]').fill('0.37');
  await expect.poll(() => page.evaluate(() => window.quotes.length)).toBe(2);
  expect(await page.locator('[data-tco-form]').evaluate(form => form.checkValidity())).toBe(true);
  await page.evaluate(() => window.quotes[1].reject(new Error('offline')));
  await page.locator('[data-tco-retry]').waitFor();
  const failed = await page.evaluate(async () => (await window.dashboard.resolveExportState()).assessment.economics);
  expect(failed.issues).toContain('project_tco_unavailable');
  expect(failed.electric).toBeNull();
  await page.locator('[data-tco-retry]').click();
  await expect.poll(() => page.evaluate(() => window.quotes.length)).toBe(3);
  await page.evaluate(() => {
    window.exported = window.dashboard.resolveExportState();
    window.quotes[2].reply(90000);
    window.quotes[0].reply(40000);
  });
  await expect(page.locator('[data-role="fleet-tco"]')).toHaveText(/^4\.5(?:00)?$/);
  expect(await page.evaluate(async () => (await window.exported).assessment.economics.electric.annualEquivalent)).toBe(90000);
});

test('dragging the electricity price keeps the controls and costs in place while the projection updates', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: {} }));
  await page.goto('./');
  await page.evaluate(async () => {
    await import('/elettra/src/style.css');
    const { createYearlyFleetDashboard } = await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-fleet-dashboard.js');
    const { yearlyFleetConfiguration } = await import('/elettra/test-support/yearly-fleet-fixture.js');
    const { fixtureProjectTco } = await import('/elettra/test-support/project-tco-response.js');
    localStorage.setItem('elettra_lang', 'en');
    document.body.innerHTML = '<main></main>';
    window.projections = [];
    window.dashboard = createYearlyFleetDashboard({
      features: yearlyFleetConfiguration(), model: { bus_length_m: 18 }, predictionRuns: [], onSave: async () => {},
      onProjectTco: (body, signal) => new Promise((resolve, reject) => {
        const reply = () => resolve(fixtureProjectTco(body));
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        window.projections.push(reply);
        if (window.projections.length === 1) reply();
      }),
    });
    window.dashboard.mount(document.querySelector('main'), { status: 'idle' });
  });

  const tco = page.locator('[data-role="fleet-tco"]');
  const headerTco = page.locator('[data-outcome="electric-tco"] .annual-outcome__value');
  const annualCostChart = page.locator('[data-cost-annual] svg');
  const cumulativeChart = page.locator('[data-cost-cumulative] svg');
  await expect(tco).toHaveText('2.934');
  await expect(annualCostChart).toBeVisible();
  await expect(cumulativeChart).toBeVisible();
  const initial = await page.evaluate(() => window.dashboard.getExportState().assessment);

  await page.locator('[data-tco-assumptions] > summary').click();
  const slider = page.locator('input[type="range"][data-tco-input="energyPrice"]');
  await slider.evaluate(input => {
    input.scrollIntoView({ block: 'center' });
    window.draggedSlider = input;
    window.draggedForm = input.form;
  });
  await expect(slider).toBeInViewport({ ratio: 1 });
  const readPosition = () => slider.evaluate(input => {
    const { x, y, width, height } = input.getBoundingClientRect();
    const { x: formX, y: formY } = input.form.getBoundingClientRect();
    return { x, y, width, height, formX, formY, scrollY,
      sameControls: input === window.draggedSlider && input.form === window.draggedForm };
  });
  const before = await readPosition();
  const thumbFraction = await slider.evaluate(input => (input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min)));
  const dragY = before.y + before.height / 2;
  await page.mouse.move(before.x + before.width * thumbFraction, dragY);
  await page.mouse.down();
  try {
    await page.mouse.move(before.x + before.width * .7, dragY, { steps: 5 });
    await expect.poll(() => page.evaluate(() => window.projections.length)).toBeGreaterThan(1);
    expect.soft(await readPosition(), 'range, form and document position during drag').toEqual(before);
    // Supersede the request while the export is waiting on it.
    await page.evaluate(() => {
      window.exportReady = false;
      window.pendingExport = window.dashboard.resolveExportState().then(state => {
        window.exportReady = true;
        return state.assessment;
      });
    });
    await page.mouse.move(before.x + before.width * .85, dragY, { steps: 4 });
  } finally {
    await page.mouse.up();
  }
  const energyPrice = Number(await slider.inputValue());
  expect(energyPrice).toBeGreaterThan(.46);
  await expect(page.locator('input[type="number"][data-tco-input="energyPrice"]')).toHaveValue(String(energyPrice));
  expect.soft(await readPosition(), 'range, form and document position while waiting').toEqual(before);
  await expect.soft(tco).toHaveText('2.934', { timeout: 1000 });
  await expect.soft(headerTco).toHaveText('2.934', { timeout: 1000 });
  await expect.soft(annualCostChart).toBeVisible({ timeout: 1000 });
  await expect.soft(cumulativeChart).toBeVisible({ timeout: 1000 });

  const pending = await page.evaluate(() => {
    const { electric, issues } = window.dashboard.getExportState().assessment.economics;
    return { electric, issues, ready: window.exportReady };
  });
  expect(pending.electric).toBeNull();
  expect(pending.issues).toContain('project_tco_pending');
  expect(pending.ready).toBe(false);

  const exported = await page.evaluate(() => {
    window.projections.at(-1)();
    return window.pendingExport;
  });
  const addedElectricityCost = (energyPrice - initial.assumptions.energyPrice) * initial.scopedFleet.totals.grid;
  expect(exported.assumptions.energyPrice).toBe(energyPrice);
  expect(exported.economics.electric.annualEquivalent).toBeCloseTo(initial.economics.electric.annualEquivalent + addedElectricityCost, 5);
  await expect.poll(async () => Number(await tco.textContent())).toBeCloseTo(exported.economics.electric.perKm, 3);
  await expect(annualCostChart).toBeVisible();
  await expect(cumulativeChart).toBeVisible();
  expect(await readPosition(), 'range, form and document position after the projection').toEqual(before);
});

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const updateGuideScreenshots = process.env.UPDATE_GUIDE_SCREENSHOTS === '1';
const lcaFixture = JSON.parse(readFileSync(new URL('../fixtures/grid94-lca.json', import.meta.url), 'utf8')).base;

const expectCostOutcomes = async (page, { electric, diesel, difference }) => {
  await expect(page.locator('[data-role="fleet-tco"]')).toHaveText(electric.replace(' CHF/km', ''));
  await expect(page.locator('[data-role="diesel-tco"]')).toHaveText(diesel.replace(' CHF/km', ''));
  await expect(page.locator('[data-role="tco-difference"]')).toHaveText(difference.replace(' CHF/km', ''));
  await expect(page.locator('[data-outcome="electric-tco"] .annual-outcome__value')).toHaveText(electric.replace(' CHF/km', ''));
};

test('representative and fleet views reconcile investment and TCO, assumptions autosave with an accessible explanation', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: {} }));
  await page.goto('./');
  await page.evaluate(async () => {
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
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__value')).toHaveText('Min: 0.8 (b) · Max: 1.8 (a)');
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__hint')).toHaveCount(0);
  await expect(page.locator('[data-outcome="electric-tco"] .annual-outcome__label')).toHaveText('TCO [CHF/km]');
  expect(await page.locator('.annual-summary-grid > .result-metric').evaluateAll(elements => elements.map(element => element.dataset.summary ?? element.dataset.outcome))).toEqual([
    'distance', 'dc', 'grid', 'efficiency', 'electric-tco', 'climate',
  ]);
  expect(await page.locator('.annual-summary-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(
    await page.evaluate(() => innerWidth <= 700 ? 1 : 3),
  );
  expect(await page.locator('.annual-efficiency__value').evaluate(element => ({ fontWeight: getComputedStyle(element).fontWeight, whiteSpace: getComputedStyle(element).whiteSpace }))).toEqual({ fontWeight: '600', whiteSpace: 'nowrap' });
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
  await expect(page.locator('.annual-cost-results-card [data-cost-opex] svg')).toBeVisible();
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
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__value')).toHaveText('Min: 0.8 (b) · Max: 1.8 (a)');
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
  await expect(page.locator('[data-cost-opex] svg')).toBeVisible();
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

test('different battery groups retain duties and consumption; sliders restore diesel charts, LCA and export', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: {} }));
  await page.goto('./');
  await page.evaluate(async template => {
    localStorage.setItem('elettra_lang', 'en');
    document.body.innerHTML = '<main id="test-annual"></main>';
    const { createYearlyFleetDashboard } = await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-fleet-dashboard.js');
    const features = {
      config: { auxiliary_heating_type: 'default', fixedConfiguration: {
        fleet: { vehicleCount: 2 },
        investment: { rows: [
          { id: 'long', modelName: 'TPL_18m', packs: 14, capacity: 700, busCost: 800000, batteryCost: 84000 },
          { id: 'short', modelName: 'TPL_18m', packs: 10, capacity: 500, busCost: 800000, batteryCost: 60000 },
        ] },
        infrastructure: { dataAvailable: true, stations: [{ selected: true, stopName: 'Depot', installationCostChf: 400000,
          costBreakdown: { chargers_cost_chf: 110000, site_fixed_cost_chf: 250000, site_power_cost_chf: 40000 } }] },
      } },
      results: { yearlyTotals: { distanceKm: 100000, totalEnergyKwh: 160000 }, shiftResults: [
        { shiftId: 'long', status: 'completed', yearlyTotals: { distanceKm: 80000, totalEnergyKwh: 144000 } },
        { shiftId: 'short', status: 'completed', yearlyTotals: { distanceKm: 20000, totalEnergyKwh: 16000 } },
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
    window.dashboard.mount(document.querySelector('main'), { status: 'done', rawLca: makeLca() });
  }, lcaFixture);
  await expect(page.locator('[data-tco-scope]')).toHaveValue('fleet');
  await expect(page.locator('[data-role="annual-activity-summary"] strong')).toHaveText([
    "100'000",
    "160'000",
    "170'213",
  ]);
  await expect(page.locator('[data-outcome="efficiency"] .annual-outcome__value')).toHaveText('Min: 0.8 (short) · Max: 1.8 (long)');
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
  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1440, height: 1020 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'guide/images/yearly-efficiency.png' });
    await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
    await expect(page.locator('[data-role="ya-lca-phases"]')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'guide/images/yearly-emissions.png' });
    await page.getByRole('tab', { name: 'Costs', exact: true }).click();
  }
  await page.locator('[data-tco-assumptions] > summary').click();
  await expect(page.locator('[data-tco-assumptions]')).toHaveAttribute('open', '');
  await expect(page.getByRole('slider')).toHaveCount(8);
  const maintenance = page.locator('input[type="range"][data-tco-input="infrastructureMaintenanceRate"]');
  await expect(maintenance).toHaveValue('2');
  await expect(page.locator('[data-maintenance-estimate]')).toContainText("CHF 8'000");
  await maintenance.evaluate(el => { window.originalSlider = el; });
  await maintenance.focus(); await maintenance.press('ArrowRight'); await maintenance.press('ArrowRight');
  await expect(maintenance).toHaveValue('2.2');
  expect(await maintenance.evaluate(el => window.originalSlider === el)).toBe(true);
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
  const emissionsSliderLayout = await emissionsAssumptions.evaluate(element => ({
    bodyDisplay: getComputedStyle(element.querySelector('.annual-assumptions__body')).display,
    rangeTops: [...element.querySelectorAll('input[type="range"]')].filter(input => input.offsetParent).map(input => input.getBoundingClientRect().top),
    viewportWidth: innerWidth,
  }));
  expect(emissionsSliderLayout.bodyDisplay).toBe('flex');
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

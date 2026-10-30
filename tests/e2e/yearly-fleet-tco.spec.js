import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const lcaFixture = JSON.parse(readFileSync(new URL('../fixtures/grid94-lca.json', import.meta.url), 'utf8')).base;

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
  await expect(page.getByText("50'000 km", { exact: true })).toBeVisible();
  await expect(page.getByText("CHF 1'084'000", { exact: true }).first()).toBeVisible();
  const tco = await page.locator('[data-role="fleet-tco"]').innerText();
  await page.locator('[data-tco-scope]').selectOption('fleet');
  await expect(page.getByText("100'000 km", { exact: true })).toBeVisible();
  await expect(page.getByText("CHF 2'168'000", { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-role="fleet-tco"]')).toHaveText(tco);
  await page.getByText('Charging infrastructure by location', { exact: true }).click();
  await expect(page.getByRole('row', { name: "Depot CHF 110'000 CHF 250'000 CHF 40'000 CHF 400'000" })).toBeVisible();
  await expect(page.locator('[data-role="diesel-tco"]')).toContainText('CHF/km');
  await expect(page.locator('[data-cost-opex] svg')).toBeVisible();
  await expect(page.locator('[data-cost-cumulative] svg')).toBeVisible();
  await page.locator('input[type="number"][data-tco-input="energyPrice"]').fill('0.4');
  await expect(page.locator('[data-role="fleet-tco"]')).not.toHaveText(tco);
  await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
  await expect(page.getByText('Environmental service unavailable', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Costs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save assumptions', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-save-status]')).toHaveText('Changes saved');
  expect(await page.evaluate(() => window.savedTco.energyPrice)).toBe(.4);
  await page.getByRole('button', { name: 'Automatic saving', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toContainText('Costs and Emissions share the same values');
  // Autofill / embedded browsers may change a value without a change event.
  await page.locator('input[type="number"][data-tco-input="energyPrice"]').evaluate(input => { input.value = '0.25'; input.form.requestSubmit(); });
  await expect(page.locator('[data-save-status]')).toHaveText('Changes saved');
  expect(await page.evaluate(() => window.savedTco.energyPrice)).toBe(.25);
  await page.evaluate(() => { window.failSave = true; });
  await page.locator('input[type="number"][data-tco-input="energyPrice"]').fill('0.3');
  await expect(page.locator('[data-save-status]')).toHaveText('Could not save changes');
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
      onPreviewLca: async values => { window.previews.push(values); if (window.failPreview) throw Error('Preview unavailable'); return makeLca(values); } });
    window.dashboard.mount(document.querySelector('main'), { status: 'done', rawLca: makeLca() });
  }, lcaFixture);
  await expect(page.locator('[data-tco-scope]')).toHaveValue('fleet');
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
  await expect(page.getByText("120'000 km", { exact: true })).toBeVisible();
  await expect(page.getByText("196'000 kWh", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.previews.at(-1)?.annualKmByShift)).toEqual({ long: 100000, short: 20000 });
  await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
  await expect(page.locator('[data-role="ya-lca-phases"]')).toBeVisible();
  await expect(page.locator('.ya-lca-phase-bar')).toHaveCount(2);
  await expect(page.locator('[data-role="ya-lca-indicators"]')).toContainText('PE non-renewable');
  await page.locator('.ya-lca-details summary').click();
  await expect(page.locator('.ya-lca-details table')).toContainText('Diesel');
  await page.locator('[data-tco-scope]').selectOption('short');
  await expect(page.getByText("20'000 km", { exact: true })).toBeVisible();
  await expect(page.getByText('0.8 kWh/km DC', { exact: true })).toBeVisible();
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
  await dieselConsumption.fill('0.65');
  await expect.poll(() => page.evaluate(() => window.previews.at(-1)?.dieselConsumption)).toBe(.65);
  await expect(page.locator('[data-role="fleet-tco"]')).toHaveText(electricTco);
  await expect(page.locator('[data-role="diesel-tco"]')).not.toHaveText(dieselTco);
  await expect(page.locator('[data-lca-export]')).toBeVisible();
  const fuelDownload = page.waitForEvent('download');
  await page.locator('[data-lca-export]').click();
  const fuelExport = JSON.parse(readFileSync(await (await fuelDownload).path(), 'utf8'));
  expect(fuelExport.indicators.gwp100a.diesel_comparator_total).toBeGreaterThan(exported.indicators.gwp100a.diesel_comparator_total);
  expect(fuelExport.indicators.gwp100a.total).toBe(exported.indicators.gwp100a.total);

  await page.locator('input[type="number"][data-tco-input="km:short"]').fill('30000');
  await expect.poll(() => page.evaluate(() => window.previews.at(-1)?.annualKmByShift)).toEqual({ long: 100000, short: 30000 });
  await expect(page.getByText("30'000 km", { exact: true })).toBeVisible();
  await expect(page.locator('[data-annual-header]').getByText("24'000 kWh", { exact: true })).toBeVisible();
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

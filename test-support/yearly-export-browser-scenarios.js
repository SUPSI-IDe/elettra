import { fixtureProjectTco } from './project-tco-response.js';
import { readFileSync } from 'node:fs';
import { annualExportFixture, annualExportLca } from './yearly-export-acceptance-fixture.js';
import { assertYearlyExportReconciles } from './yearly-export-reconciliation.js';
import { browserApplicationOrigin } from './browser-application-target.mjs';

const downloadedJson = async (page, selector) => {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(readFileSync(await (await pending).path(), 'utf8'));
};
const displayedNumber = async locator => Number((await locator.textContent()).replace(/[^\d.-]/g, ''));

export function registerYearlyExportAcceptance(test, expect) {
  for (const uniform of [true, false]) {
    test(`annual JSON acceptance through the application: ${uniform ? 'uniform buses' : 'mixed batteries and diesel heating'}`, async ({ page, baseURL }) => {
      const heating = uniform ? 'default' : 'diesel';
      const { analysis, busModel } = annualExportFixture({ uniform, heating, rate: uniform ? 0 : .04 });
      const unexpected = [], errors = [], writes = [];
      const origin = browserApplicationOrigin(baseURL);
      await page.context().route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.fallback();
        // Production HTML loads Inter remotely; use the system-font fallback without network errors.
        if (url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2') {
          return route.fulfill({ contentType: 'text/css', body: '' });
        }
        unexpected.push(`${route.request().method()} ${url.href}`);
        return route.abort('blockedbyclient');
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => {
        localStorage.setItem('access_token', 'annual-export-fixture');
        localStorage.setItem('elettra_lang', 'en');
        localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
      });
      await page.route('**/auth/me', route => route.fulfill({ json: {
        id: 'export-user', email: 'export@example.invalid', role: 'analyst', company_id: 'export-company',
      } }));
      await page.route('**/api/v1/**', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (path === '/api/v1/version') return route.fulfill({ json: { version: 'annual-export-test' } });
        if (path === `/api/v1/yearly-analysis/${analysis.id}`) {
          if (request.method() === 'PATCH') {
            const payload = request.postDataJSON();
            writes.push(structuredClone(payload));
            Object.assign(analysis, structuredClone(payload));
          }
          return route.fulfill({ json: analysis });
        }
        if (path === `/api/v1/yearly-analysis/${analysis.id}/lca`) {
          const values = {
            annualKmByShift: JSON.parse(url.searchParams.get('annual_km_by_shift') ?? 'null') ?? undefined,
          };
          for (const [query, field] of [['lifetime_bus', 'bodyLife'], ['lifetime_battery', 'batteryLife'],
            ['lifetime_diesel_bus', 'dieselLife'], ['diesel_consumption_l_per_km', 'dieselConsumption']]) {
            if (url.searchParams.has(query)) values[field] = Number(url.searchParams.get(query));
          }
          return route.fulfill({ json: annualExportLca(analysis, values) });
        }
        if (path === `/api/v1/yearly-analysis/${analysis.id}/costs/project`) {
          return route.fulfill({ json: fixtureProjectTco(request.postDataJSON()) });
        }
        if (path === `/api/v1/yearly-analysis/${analysis.id}/costs`) return route.fulfill({ json: {
          assumptions: {}, ebus: { opex_items: [] }, diesel_comparator: { opex_items: [] }, scenarios: [],
        } });
        if (path === `/api/v1/yearly-analysis/${analysis.id}/auxiliary-assumptions`) {
          return route.fulfill({ json: { schema_version: 1, runs: [], weather_inputs: {} } });
        }
        if (path === '/api/v1/user/bus-models/bus-1') return route.fulfill({ json: busModel });
        if (path === '/api/v1/simulation/prediction-runs/') return route.fulfill({ json: [] });
        if (path === '/api/v1/user/shifts/') return route.fulfill({ json: analysis.features.config.fixedConfiguration.shifts.map(shift => ({
          id: shift.shiftId, name: shift.shiftName, structure: [], gtfs_datasets: analysis.features.gtfs_provenance.shifts[shift.shiftId],
        })) });
        if (path === '/api/v1/agency/agencies/export-company') {
          return route.fulfill({ json: { id: 'export-company', name: 'Fixture agency', gtfs_agency_id: 'fixture' } });
        }
        unexpected.push(`${request.method()} ${path}`);
        return route.fulfill({ status: 500, json: { detail: 'Missing annual-export fixture response' } });
      });

      await page.goto('./#home');
      await expect(page.locator('.home-page')).toBeVisible();
      await page.evaluate(id => document.dispatchEvent(new CustomEvent('partial:request', {
        detail: { slug: 'yearly-analysis-results', analysisId: id },
      })), analysis.id);
      const dashboard = page.locator('[data-role="annual-fleet-dashboard"]');
      await expect(dashboard).toBeVisible();
      await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
      await expect(page.locator('[data-lca-export]')).toBeEnabled();
      const initial = await downloadedJson(page, '[data-action="download-json"]');
      assertYearlyExportReconciles(initial);
      expect(initial.general.economics.electric.initial).toBe(uniform ? 1690000 : 1730000);
      expect(initial.general.environment.result.vehicles).toHaveLength(uniform ? 1 : 2);
      expect(initial.general.environment.result.vehicle_count).toBe(3);
      expect(initial.provenance.gtfs).toEqual(analysis.features.gtfs_provenance);
      expect(initial.provenance.weather).toEqual(analysis.features.config.weather_reference);

      const checkScope = async (scope, expected) => {
        await page.locator('[data-tco-scope]').selectOption(scope);
        await page.getByRole('tab', { name: 'Costs', exact: true }).click();
        expect(await displayedNumber(page.locator('[data-role="fleet-tco"]'))).toBeCloseTo(expected.economics.electric.perKm, 3);
        expect(await displayedNumber(page.locator('[data-role="diesel-tco"]'))).toBeCloseTo(expected.economics.diesel.perKm, 3);
        expect(await displayedNumber(page.locator('[data-summary="distance"] strong'))).toBe(Math.round(expected.activity.distanceKm));
        const annualChart = page.getByRole('img', { name: 'Total equivalent annual cost', exact: true });
        await expect(annualChart).toBeVisible();
        const totals = annualChart.locator('.annual-chart-total');
        const capital = annualChart.locator('rect > title').filter({ hasText: 'Annualized investment' });
        await expect(capital).toHaveCount(2);
        for (const [i, design] of [expected.economics.electric, expected.economics.diesel].entries()) {
          const barTotal = await displayedNumber(totals.nth(i));
          expect(barTotal).toBe(Math.round(design.annualEquivalent));
          expect(barTotal / expected.activity.distanceKm).toBeCloseTo(design.perKm, 3);
          const capitalAnnual = (design.initial + design.discountedReplacements - design.discountedResidual) / design.annuityFactor;
          const capitalText = (await capital.nth(i).textContent()).match(/CHF ([\d']+) \//);
          expect(Number(capitalText[1].replaceAll("'", ''))).toBe(Math.round(capitalAnnual));
        }
        const investment = page.locator('.annual-cost-comparison tbody tr').filter({ hasText: 'Initial investment' });
        expect(await displayedNumber(investment.locator('td').first())).toBe(Math.round(expected.economics.electric.initial));
        await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
        await expect(page.locator('[data-lca-export]')).toBeEnabled();
        expect(await downloadedJson(page, '[data-lca-export]')).toEqual(expected.environment.result);
        const full = await downloadedJson(page, '[data-action="download-json"]');
        assertYearlyExportReconciles(full);
        expect(full.general).toEqual(initial.general);
      };
      await checkScope('fleet', initial.general);
      for (const group of initial.groups) await checkScope(group.groupId, group.representativeBus);

      await page.getByRole('tab', { name: 'Costs', exact: true }).click();
      await page.locator('[data-tco-assumptions] > summary').click();
      await page.locator('input[type="number"][data-tco-input="energyPrice"]').fill('.37');
      const mileage = page.locator(`input[type="number"][data-tco-input="km:${initial.groups[0].groupId}"]`);
      await mileage.fill('30000'); await mileage.blur();
      await expect(page.locator('[data-save-status]')).toHaveText('Changes saved');
      await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
      await expect(page.locator('[data-lca-export]')).toBeEnabled();
      const edited = await downloadedJson(page, '[data-action="download-json"]');
      assertYearlyExportReconciles(edited);
      expect(edited.assumptions.energyPrice).toBe(.37);
      expect(edited.assumptions.annualKmByGroup[initial.groups[0].groupId]).toBe(30000);
      expect(edited.general.activity.distanceKm).toBe(uniform ? 90000 : 96500);
      expect(edited.technicalBaseline.activity).toEqual(initial.technicalBaseline.activity);
      expect(edited.general.economics.electric.initial).toBe(initial.general.economics.electric.initial);
      expect(writes.length).toBeGreaterThan(0);
      await page.reload();
      await expect(dashboard).toBeVisible();
      await page.getByRole('tab', { name: 'Emissions', exact: true }).click();
      await expect(page.locator('[data-lca-export]')).toBeEnabled();
      const reopened = await downloadedJson(page, '[data-action="download-json"]');
      assertYearlyExportReconciles(reopened);
      expect(reopened.assumptions).toEqual(edited.assumptions);
      expect(reopened.general).toEqual(edited.general);
      expect(unexpected).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

import { test, expect } from '@playwright/test';

const sections = [
  { slug: 'buses', collection: '/bus-models/', target: 'add-bus-model', key: 'busModel' },
  { slug: 'custom-stops', collection: '/depots/', target: 'add-custom-stop', key: 'depot' },
  { slug: 'shifts', collection: '/shifts/' },
  { slug: 'simulation-runs', collection: '/optimization-runs/', target: 'add-simulation', key: 'prefill' },
  { slug: 'yearly-analysis-runs', collection: '/yearly-analysis/', target: 'create-yearly-analysis', key: 'prefill' },
];
const source = {
  id: 'source', name: 'Family_copia_1', user_id: 'user', bus_id: 'bus', bus_model_id: 'model',
  description: 'Original settings', latitude: 46, longitude: 9,
  status: 'completed', mode: 'battery_only', electrification_feasible: true,
  created_at: '2026-11-23T08:00:00Z', optimization_run_id: 'run',
  start_time: '08:00', end_time: '10:00', daily_distance_km: 12, yearly_distance_km: 3000,
  structure: [{ trip_id: 'trip', sequence_number: 1 }],
  input_params: { shift_ids: [], mode: 'battery_only', bus_model_id: 'model', prediction_run_ids: [] },
  features: { type: 'depot', status: 'completed', config: { mode: 'joint' }, meta: { shiftNames: [] } },
  specs: { vehicle_reference_key: 'standard_electric_bus_12_13m', bus_length_m: 13 },
};

export function defineNumberedCopyTests() {
  for (const section of sections) {
    test(`${section.slug}: a copy of a copy uses the next family ordinal across pages`, async ({ page }) => {
      const errors = [], unexpected = [], writes = [], listReads = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('access_token', 'test');
        localStorage.setItem('elettra_lang', 'it');
        localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
      });
      await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', company_id: 'company', role: 'analyst' } }));
      await page.route('**/api/v1/**', route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        let json;
        if (request.method() === 'POST' && path.endsWith('/shifts/')) {
          writes.push(request.postDataJSON()); json = { ...source, id: 'created', name: writes.at(-1).name };
        } else if (path.endsWith('/version')) json = { version: 'test' };
        else if (path.endsWith(section.collection)) {
          listReads.push(url.href);
          const skip = Number(url.searchParams.get('skip') || 0), limit = Number(url.searchParams.get('limit') || 20);
          const items = skip ? [{ ...source, id: 'sibling', name: 'Family_copy_4' }] : [source];
          json = { items, count: 1, total: 2, skip, limit, has_next: skip === 0, has_previous: skip > 0 };
        } else if (path.endsWith(`${section.collection}source`)) json = source;
        else if (path.endsWith('/buses/bus')) json = { id: 'bus', user_id: 'user', bus_model_id: 'model' };
        else if (path.endsWith('/bus-models/model')) json = { id: 'model', user_id: 'user', name: 'Bus' };
        else if (path.endsWith('/bus-models/') || path.endsWith('/buses/') || path.endsWith('/prediction-runs/') || path.endsWith('/optimization-runs/')) json = [];
        else if (path.endsWith('/agency/agencies/company')) json = { id: 'company', gtfs_agency_id: 'agency' };
        else {
          unexpected.push(`${request.method()} ${path}`);
          return route.fulfill({ status: 500, json: { detail: 'Missing mock' } });
        }
        return route.fulfill({ json });
      });
      await page.goto(`./#${section.slug}`);
      const duplicate = page.locator('tr[data-id="source"] [data-row-action="duplicate"]');
      await expect(duplicate).toBeVisible();
      // Capture the actual prefill emitted by the row action. Existing editor
      // tests cover editing/saving it; this test isolates naming and pagination.
      await page.evaluate(() => {
        window.copyPrefill = null;
        document.addEventListener('partial:request', event => {
          event.stopImmediatePropagation();
          window.copyPrefill = event.detail;
        }, true);
      });
      await duplicate.click();
      if (section.target) {
        await expect.poll(() => page.evaluate(key => window.copyPrefill?.[key]?.name, section.key)).toBe('Family_copia_5');
        expect(await page.evaluate(() => window.copyPrefill.slug)).toBe(section.target);
      } else {
        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0].name).toBe('Family_copia_5');
        expect(writes[0].trip_ids).toEqual(['trip']);
      }
      expect(listReads.some(value => new URL(value).searchParams.get('skip') === '1')).toBe(true);
      expect(unexpected).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

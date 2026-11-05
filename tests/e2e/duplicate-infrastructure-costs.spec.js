import { test, expect } from '@playwright/test';

const depot = '11111111-1111-4111-8111-111111111111';
const pantograph = '22222222-2222-4222-8222-222222222222';
const variants = {
  standard: [
    { station_type: 'depot', point_cost_chf: 110000, site_fixed_cost_chf: 250000, connection_cost_per_kw_chf: 250 },
    { station_type: 'pantograph', point_cost_chf: 430000, site_fixed_cost_chf: 320000, connection_cost_per_kw_chf: 320 },
  ],
  custom: [
    { station_type: 'depot', point_cost_chf: 123456.78, site_fixed_cost_chf: 0, connection_cost_per_kw_chf: 275.5 },
    { station_type: 'pantograph', point_cost_chf: 456789.12, site_fixed_cost_chf: 234567.89, connection_cost_per_kw_chf: 0 },
  ],
};

for (const mode of ['battery_only', 'charging_only', 'joint']) {
  for (const [variant, models] of Object.entries(variants)) {
    for (const basis of ['mean', 'aggregate_q95']) {
      test(`repeated ${basis} duplication preserves ${variant} CHF costs in ${mode}`, async ({ page }) => {
        const stations = [depot, pantograph].map((stop_id, index) => ({
          stop_id, num_slots: 2, max_total_power_kw: 900, max_power_per_slot_kw: 450,
          cost_model: { ...models[index], ac_dc_efficiency: 0.95,
            source: variant === 'standard' ? 'infras2026-calibrated-v1' : 'custom' },
        }));
        const model = { id: 'model', user_id: 'user', name: 'Test bus', specs: {
          min_battery_packs: 10, max_battery_packs: 16, battery_pack_size_kwh: 50,
          battery_pack_cost_chf: 6000,
        } };
        const shift = { id: 'shift', name: 'Test duty', bus_id: 'bus', structure: [] };
        let saved = {
          id: 'saved', name: 'Saved evaluation', mode, status: 'completed',
          bus_model_id: 'model', created_at: '2026-01-01T12:00:00Z',
          input_params: { mode, shift_ids: ['shift'], bus_model_id: 'model',
            consumption_basis: basis, min_soc: 0.2, max_soc: 0.9,
            fixed_battery_packs: 14, charging_stations: stations },
        };
        const submissions = [];
        let predictionPacks = 16;
        await page.addInitScript(() => {
          localStorage.setItem('access_token', 'local-browser-test');
          localStorage.setItem('elettra_lang', 'en');
        });
        await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', email: 'local@example.invalid' } }));
        await page.route('**/api/v1/**', route => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          let data = [];
          if (path.endsWith('/version')) data = { version: 'test' };
          else if (path.endsWith('/bus-models/')) data = [model];
          else if (path.endsWith('/bus-models/model')) data = model;
          else if (path.endsWith('/buses/')) data = [{ id: 'bus', user_id: 'user', bus_model_id: 'model' }];
          else if (path.endsWith('/shifts/')) data = [shift];
          else if (path.includes('/shifts/shift')) data = shift;
          else if (path.endsWith('/simulation/charging-stops/candidates')) data = [
            { stop_id: depot, stop_name: 'Depot', is_depot: true, is_custom: true, depot_bus_count: 1 },
            { stop_id: pantograph, stop_name: 'Pantograph', is_depot: false, is_custom: true },
          ];
          else if (path.endsWith('/prediction-runs/') && request.method() === 'POST') {
            predictionPacks = request.postDataJSON().num_battery_packs;
            data = { prediction_run_ids: ['prediction'] };
          }
          else if (path.includes('/prediction-runs/')) {
            const prediction = { id: 'prediction', shift_id: 'shift', status: 'completed', contextual_parameters: { num_battery_packs: predictionPacks } };
            data = path.endsWith('/prediction-runs/') ? [prediction] : prediction;
          } else if (path.endsWith('/optimization-runs/') && request.method() === 'POST') {
            submissions.push(request.postDataJSON());
            data = { optimization_run_id: 'pending', basis_run_ids: { mean: 'pending', aggregate_q95: 'pending-q95' } };
          } else if (path.endsWith('/optimization-runs/')) data = [saved];
          else if (path.endsWith('/optimization-runs/saved')) data = saved;
          else if (path.includes('/optimization-runs/pending')) data = { id: 'pending', status: 'pending' };
          return route.fulfill({ json: data });
        });

        for (let copy = 1; copy <= 2; copy++) {
          await page.goto('./#simulation-runs');
          await page.getByRole('checkbox', { name: 'Select run', exact: true }).check();
          await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
          await expect(page.locator('#var-optimization-mode')).toHaveValue(mode);
          await page.locator('#simulation-name').fill(`Copy ${copy}`);
          if (mode === 'charging_only') await page.locator('[name="fixed_battery_packs"]').fill('14');
          await page.locator('[data-role="cost-options"] > summary').click();
          for (const station of stations) {
            const card = page.locator(`[data-cost-stop-id="${station.stop_id}"]`);
            await expect(card).toBeVisible();
            await expect(card).toContainText('Per charging point (CHF)');
            await expect(card).toContainText('Fixed per site (CHF)');
            for (const field of ['point_cost_chf', 'site_fixed_cost_chf', 'connection_cost_per_kw_chf']) {
              await expect(card.locator(`[data-cost-field="${field}"]`)).toHaveValue(String(station.cost_model[field]));
            }
          }
          if (variant === 'standard') {
            await expect(page.locator(`[data-cost-stop-id="${pantograph}"] [data-role="station-cost-total"]`)).toContainText("CHF 1'483'158");
          }
          await page.getByRole('button', { name: 'Start evaluation', exact: true }).click();
          await page.getByRole('dialog').getByRole('button', { name: 'Start evaluation', exact: true }).click();
          await expect.poll(() => submissions.length).toBe(copy);
          const submitted = submissions.at(-1);
          expect(submitted.mode).toBe(mode);
          expect(submitted.evaluate_both_bases).toBe(true);
          for (const station of stations) {
            expect(submitted.charging_stations.find(s => s.stop_id === station.stop_id).cost_model).toEqual(station.cost_model);
          }
          // Exercise another duplication from the payload actually persisted by the first.
          saved = { ...saved, name: `Copy ${copy}`, input_params: { ...submitted, consumption_basis: basis } };
          await page.goto('./#home');
          await page.reload();
        }
      });
    }
  }
}

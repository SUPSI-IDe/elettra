import { test, expect } from '@playwright/test';
const source = 'https://www.infras.ch/media/filer_public/86/db/86dbb9ed-9fc1-482e-85ca-a9f36f3da3b8/3954a_umweltbilanz_h2-busse_schlussbericht.pdf#page=45';
const model = { id: 'model', user_id: 'user', name: 'Existing bus', specs: {
  vehicle_reference_key: 'standard_electric_bus_12_13m', bus_length_m: 13, max_passengers: 64,
  empty_weight_kg: 12750, min_battery_packs: 7, max_battery_packs: 11, battery_pack_size_kwh: 40,
  battery_pack_weight_kg: 274, battery_pack_lifetime: 8, max_charging_power_kw: 450, bus_lifetime: 12,
  cost: 620000, battery_pack_cost_chf: 7200,
} };
async function setup(page) {
  const state = { unexpected: [], errors: [], writes: [] };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test');
    localStorage.setItem('elettra_lang', 'it');
    localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', company_id: 'company', role: 'analyst' } }));
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    if (method !== 'GET') state.writes.push({ path, body: request.postDataJSON() });
    let json;
    if (path.endsWith('/version')) json = { version: 'test' };
    else if (path.endsWith('/agency/agencies/company')) json = { id: 'company', gtfs_agency_id: 'agency' };
    else if (path.endsWith('/environmental/vehicles')) json = [];
    else if (path.endsWith('/bus-models/')) json = method === 'GET' ? [model] : { ...model, id: 'new-model' };
    else if (path.endsWith('/bus-models/model')) json = model;
    else if (path.endsWith('/buses/')) json = method === 'GET' ? [] : { id: 'new-bus' };
    else { state.unexpected.push(`${method} ${path}`); return route.fulfill({ status: 500, json: { detail: 'Missing mock' } }); }
    return route.fulfill({ json });
  });
  return state;
}
const check = state => {
  expect(state.unexpected).toEqual([]);
  expect(state.errors).toEqual([]);
};
export function defineBusCostDefaultsTests() {
  for (const [category, cost, hint] of [
    ['midi_electric_bus_9m', '253781', 'non esiste'],
    ['standard_electric_bus_12_13m', '338375', '12 m'],
    ['articulated_electric_bus_18m', '474032', '18 m'],
  ]) {
    test(`INFRAS ${category}: source defaults, tooltip and saved costs`, async ({ page }, info) => {
      const state = await setup(page);
      await page.goto('./#add-bus-model');
      await page.locator('#vehicle_reference_key').selectOption(category);
      await expect(page.locator('#cost')).toHaveValue(cost);
      await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('10280');
      const reference = page.locator('[data-role="cost-info"]');
      await expect(reference).toHaveAttribute('href', source);
      await expect(reference).toHaveAttribute('data-tooltip', /04\.12\.2025.*45.*2030/);
      await expect(reference).toHaveAttribute('data-tooltip', category.startsWith('midi') ? /non fornisce un prezzo|nessun valore|nessun.*9 m|non.*valore.*9 m/ : new RegExp(hint));
      await reference.scrollIntoViewIfNeeded();
      await reference.focus();
      expect(await reference.evaluate(node => getComputedStyle(node, '::after').display)).toBe('block');
      await expect(page.locator('[data-role="battery-cost-info"]')).toHaveAttribute('data-tooltip', /257\/kWh|257 CHF\/kWh/);
      await page.screenshot({ path: info.outputPath('bus-cost-source.png') });
      await page.locator('#name').fill('INFRAS bus');
      await page.locator('section.add-bus-model button[type="submit"]').click();
      await expect.poll(() => state.writes.filter(write => write.path.endsWith('/bus-models/')).length).toBe(1);
      const saved = state.writes.find(write => write.path.endsWith('/bus-models/')).body.specs;
      expect(saved.cost).toBe(Number(cost));
      expect(saved.battery_pack_cost_chf).toBe(10280);
      check(state);
    });
  }
  test('editing preserves stored and manually entered prices through language changes', async ({ page }) => {
    const state = await setup(page);
    await page.goto('./#buses');
    await page.locator('.bus-models [data-row-action="edit"]').click();
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('7200');
    await page.locator('#cost').fill('550000');
    await page.locator('#battery_pack_cost_chf').fill('9000');
    for (const lang of ['en','de','fr','it']) {
      await page.locator('.language-select').selectOption(lang);
      await expect(page.locator('#cost')).toHaveValue('550000');
      await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('9000');
      await expect(page.locator('[data-role="cost-info"]')).toHaveAttribute('data-tooltip', /INFRAS.*2030/);
      await expect(page.locator('[data-role="battery-cost-info"]')).not.toHaveAttribute('data-tooltip', /\{\w+\}/);
    }
    await page.locator('section.add-bus-model button[type="submit"]').click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0].body.specs.cost).toBe(550000);
    expect(state.writes[0].body.specs.battery_pack_cost_chf).toBe(9000);
    check(state);
  });
  test('duplicating preserves saved prices instead of replacing them with INFRAS defaults', async ({ page }) => {
    const state = await setup(page);
    await page.goto('./#buses');
    await page.locator('.bus-models [data-row-action="duplicate"]').click();
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('7200');
    check(state);
  });
}

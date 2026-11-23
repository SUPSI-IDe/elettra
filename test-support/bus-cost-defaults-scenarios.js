import { test, expect } from '@playwright/test';
const defaults = {
  bus_body_price_points: [
    { length_m: 9, cost_chf: 360000 },
    { length_m: 10, cost_chf: 460000 },
    { length_m: 12, cost_chf: 490000 },
    { length_m: 18, cost_chf: 570000 },
  ],
  battery_chemistries: {
    LFP: { kg_per_kwh: 6.85, cost_per_kwh: 330 },
    NMC: { kg_per_kwh: 1000 / 195, cost_per_kwh: 450 },
  },
  battery_chemistry_default: 'LFP',
};

const model = { id: 'model', user_id: 'user', name: 'Existing bus', specs: {
  vehicle_reference_key: 'standard_electric_bus_12_13m', bus_length_m: 13, max_passengers: 64,
  empty_weight_kg: 12750, min_battery_packs: 7, max_battery_packs: 11, battery_pack_size_kwh: 40,
  battery_pack_weight_kg: 274, battery_pack_lifetime: 8, max_charging_power_kw: 450, bus_lifetime: 12,
  cost: 620000, battery_pack_cost_chf: 7200,
} };
async function setup(page, storedModel = model) {
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
    else if (path.endsWith('/economic/defaults')) json = defaults;
    else if (path.endsWith('/environmental/vehicles')) json = [];
    else if (path.endsWith('/bus-models/')) json = method === 'GET' ? [storedModel] : { ...storedModel, id: 'new-model' };
    else if (path.endsWith('/bus-models/model')) json = storedModel;
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
const restore = (page, field) => page.locator(`[data-restore-field="${field}"]`);
const submit = (page) => page.locator('section.add-bus-model button[type="submit"]');

export function defineBusCostDefaultsTests() {
  test('uses the actual length and chemistry to estimate costs and pack mass', async ({ page }) => {
    const state = await setup(page);
    await page.goto('./#add-bus-model');
    const length = page.locator('#bus_length_m');
    const category = page.locator('#vehicle_reference_key');
    const chemistry = page.locator('#battery_chemistry');
    const bodyPrice = page.locator('#cost');
    const packPrice = page.locator('#battery_pack_cost_chf');
    const packWeight = page.locator('#battery_pack_weight_kg');

    await expect(category).toBeDisabled();
    const lengthInfo = page.locator('[data-role="length-info"]');
    await expect(lengthInfo).toHaveAttribute(
      'data-tooltip', 'Tra 13 e 17 m manca un profilo di climatizzazione VECTO.',
    );
    await expect(chemistry).toHaveValue('LFP');
    await length.fill('19');
    await expect(category).toHaveValue('articulated_electric_bus_18m');
    await expect(bodyPrice).toHaveValue('583333.33');

    await page.locator('#name').fill('Length and chemistry test');
    await length.fill('15');
    await submit(page).click();
    await expect(page.getByText('Inserisci una lunghezza di 9–13 m o 17–19 m.')).toBeVisible();
    await expect(page.getByText(/manca un profilo di climatizzazione VECTO/)).toHaveCount(0);
    expect(state.writes).toEqual([]);

    await length.fill('10.75');
    await expect(category).toHaveValue('standard_electric_bus_12_13m');
    await expect(bodyPrice).toHaveValue('471250');
    await page.locator('#battery_pack_size_kwh').fill('40');
    await expect(packPrice).toHaveValue('13200');
    await expect(packWeight).toHaveValue('274');

    await bodyPrice.fill('500000');
    await packPrice.fill('9000');
    await chemistry.selectOption('NMC');
    await expect(packPrice).toHaveValue('9000');
    await expect(packWeight).toHaveValue('205.13');

    await length.fill('11');
    await expect(bodyPrice).toHaveValue('500000');
    await length.fill('10.75');
    await restore(page, 'cost').click();
    await expect(bodyPrice).toHaveValue('471250');
    await expect(packPrice).toHaveValue('9000');
    await restore(page, 'battery_pack_cost_chf').click();
    await expect(packPrice).toHaveValue('18000');

    await packWeight.fill('222');
    await page.locator('#battery_pack_size_kwh').fill('42');
    await expect(packPrice).toHaveValue('18900');
    await expect(packWeight).toHaveValue('222');
    await restore(page, 'battery_pack_weight_kg').click();
    await expect(packWeight).toHaveValue('215.38');

    await packWeight.fill('223');
    await submit(page).click();
    await expect.poll(() => state.writes.filter(write => write.path.endsWith('/bus-models/')).length).toBe(1);
    const saved = state.writes.find(write => write.path.endsWith('/bus-models/')).body.specs;
    expect(saved).toMatchObject({
      bus_length_m: 10.75, battery_chemistry: 'NMC', cost: 471250,
      battery_pack_cost_chf: 18900, battery_pack_weight_kg: 223,
    });
    expect([...saved.suggested_spec_fields].sort()).toEqual(['battery_pack_cost_chf', 'cost']);
    check(state);
  });

  test('editing keeps saved manual values through assumption and language changes', async ({ page }) => {
    const state = await setup(page);
    await page.goto('./#buses');
    await page.locator('.bus-models [data-row-action="edit"]').click();
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('7200');
    await page.locator('#bus_length_m').fill('12.5');
    await page.locator('#battery_chemistry').selectOption('LFP');
    await page.locator('#battery_pack_size_kwh').fill('45');
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('7200');
    await expect(page.locator('#battery_pack_weight_kg')).toHaveValue('274');

    await page.locator('#cost').fill('550000');
    await page.locator('#battery_pack_cost_chf').fill('9000');
    for (const lang of ['en', 'de', 'fr', 'it']) {
      await page.locator('.language-select').selectOption(lang);
      await expect(page.locator('#cost')).toHaveValue('550000');
      await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('9000');
    }
    await submit(page).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0].body.specs).toMatchObject({
      bus_length_m: 12.5, battery_chemistry: 'LFP', cost: 550000,
      battery_pack_cost_chf: 9000, battery_pack_weight_kg: 274,
    });
    check(state);
  });

  test('duplicating preserves saved manual prices and pack mass', async ({ page }) => {
    const state = await setup(page);
    await page.goto('./#buses');
    await page.locator('.bus-models [data-row-action="duplicate"]').click();
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('7200');
    await expect(page.locator('#battery_pack_weight_kg')).toHaveValue('274');
    check(state);
  });

  test('editing refreshes only saved fields marked as estimates', async ({ page }) => {
    const state = await setup(page, {
      ...model,
      specs: { ...model.specs, battery_chemistry: 'LFP', suggested_spec_fields: ['battery_pack_cost_chf'] },
    });
    await page.goto('./#buses');
    await page.locator('.bus-models [data-row-action="edit"]').click();
    await page.locator('#battery_chemistry').selectOption('NMC');
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('18000');
    await expect(page.locator('#battery_pack_weight_kg')).toHaveValue('274');
    check(state);
  });
}

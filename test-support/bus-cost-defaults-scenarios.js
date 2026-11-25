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
  let currentModel = storedModel;
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test');
    localStorage.setItem('elettra_lang', 'it');
    localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', company_id: 'company', role: 'analyst' } }));
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const body = method === 'GET' ? undefined : request.postDataJSON();
    if (method !== 'GET') state.writes.push({ path, body });
    let json;
    if (path.endsWith('/version')) json = { version: 'test' };
    else if (path.endsWith('/agency/agencies/company')) json = { id: 'company', gtfs_agency_id: 'agency' };
    else if (path.endsWith('/economic/defaults')) json = defaults;
    else if (path.endsWith('/environmental/vehicles')) json = [];
    else if (path.endsWith('/bus-models/')) json = method === 'GET' ? [currentModel] : { ...currentModel, id: 'new-model' };
    else if (path.endsWith('/bus-models/model')) {
      if (method === 'PUT') currentModel = { ...currentModel, ...body };
      json = currentModel;
    }
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
const expectBatterySummary = async (page, values) => {
  for (const [field, value] of Object.entries(values)) {
    await expect(page.locator(`[data-battery-summary="${field}"]`)).toHaveText(value);
  }
};

export function defineBusCostDefaultsTests() {
  test('uses the actual length and chemistry to estimate costs and pack mass', async ({ page }, testInfo) => {
    const captureGuide = process.env.UPDATE_GUIDE_SCREENSHOTS === '1' && testInfo.project.name === 'chromium';
    if (captureGuide) await page.setViewportSize({ width: 1500, height: 1500 });
    const state = await setup(page);
    await page.goto('./#add-bus-model');
    const length = page.locator('#bus_length_m');
    const category = page.locator('#vehicle_reference_key');
    const chemistry = page.locator('#battery_chemistry');
    const bodyPrice = page.locator('#cost');
    const packPrice = page.locator('#battery_pack_cost_chf');
    const packWeight = page.locator('#battery_pack_weight_kg');
    const packSize = page.locator('#battery_pack_size_kwh');
    const minPacks = page.locator('#min_battery_packs');
    const maxPacks = page.locator('#max_battery_packs');

    await expect(category).toBeDisabled();
    await expect(page.locator('[data-battery-summary="min"]')).toBeVisible();
    await expectBatterySummary(page, { min: '—', max: '—', price: '—' });
    const lengthInfo = page.locator('[data-role="length-info"]');
    await expect(lengthInfo).toHaveAttribute(
      'data-tooltip', 'Tra 13 e 17 m manca un profilo di climatizzazione VECTO.',
    );
    await expect(chemistry).toHaveValue('LFP');
    if (captureGuide) {
      await length.fill('12');
      await page.locator('#name').fill('Autobus urbano 12 m');
      await page.locator('#name').blur();
      await expectBatterySummary(page, { min: '280 kWh', max: '440 kWh', price: '330 CHF/kWh' });
      await page.mouse.move(0, 0);
      await page.locator('section.add-bus-model').screenshot({
        path: 'guide/images/bus-model-battery.png',
        animations: 'disabled',
      });
    }
    await length.fill('19');
    await expect(category).toHaveValue('articulated_electric_bus_18m');
    await expect(bodyPrice).toHaveValue('583333.33');
    await expectBatterySummary(page, { min: '480 kWh', max: '640 kWh', price: '330 CHF/kWh' });

    await page.locator('#name').fill('Length and chemistry test');
    await length.fill('15');
    await submit(page).click();
    await expect(page.getByText('Inserisci una lunghezza di 9–13 m o 17–19 m.')).toBeVisible();
    await expect(page.getByText(/manca un profilo di climatizzazione VECTO/)).toHaveCount(0);
    expect(state.writes).toEqual([]);

    await length.fill('10.75');
    await expect(category).toHaveValue('standard_electric_bus_12_13m');
    await expect(bodyPrice).toHaveValue('471250');
    await packSize.fill('40');
    await expect(packPrice).toHaveValue('13200');
    await expect(packWeight).toHaveValue('274');
    await expectBatterySummary(page, { min: '280 kWh', max: '440 kWh', price: '330 CHF/kWh' });

    await minPacks.fill('0');
    await expectBatterySummary(page, { min: '—', max: '440 kWh', price: '330 CHF/kWh' });
    await minPacks.fill('8');
    await maxPacks.fill('');
    await expectBatterySummary(page, { min: '320 kWh', max: '—', price: '330 CHF/kWh' });
    await maxPacks.fill('12');
    await expectBatterySummary(page, { max: '480 kWh' });
    await maxPacks.fill('7');
    await expectBatterySummary(page, { min: '—', max: '—', price: '330 CHF/kWh' });
    await maxPacks.fill('12');

    for (const invalidSize of ['0', '']) {
      await packSize.fill(invalidSize);
      await expectBatterySummary(page, { min: '—', max: '—', price: '—' });
    }
    await packSize.fill('40');

    await bodyPrice.fill('500000');
    await packPrice.fill('');
    await expectBatterySummary(page, { price: '—' });
    await packPrice.fill('0');
    await expectBatterySummary(page, { price: '0 CHF/kWh' });
    await packPrice.fill('9000');
    await expectBatterySummary(page, { price: '225 CHF/kWh' });
    await chemistry.selectOption('NMC');
    await expect(packPrice).toHaveValue('9000');
    await expect(packWeight).toHaveValue('205.13');
    await expectBatterySummary(page, { price: '225 CHF/kWh' });

    await length.fill('11');
    await expect(bodyPrice).toHaveValue('500000');
    await length.fill('10.75');
    await restore(page, 'cost').click();
    await expect(bodyPrice).toHaveValue('471250');
    await expect(packPrice).toHaveValue('9000');
    await restore(page, 'battery_pack_cost_chf').click();
    await expect(packPrice).toHaveValue('18000');
    await expectBatterySummary(page, { price: '450 CHF/kWh' });

    await packWeight.fill('222');
    await packSize.fill('42');
    await expect(packPrice).toHaveValue('18900');
    await expect(packWeight).toHaveValue('222');
    await expectBatterySummary(page, { min: '336 kWh', max: '504 kWh', price: '450 CHF/kWh' });
    await restore(page, 'battery_pack_weight_kg').click();
    await expect(packWeight).toHaveValue('215.38');

    await packWeight.fill('223');
    await submit(page).click();
    await expect.poll(() => state.writes.filter(write => write.path.endsWith('/bus-models/')).length).toBe(1);
    const saved = state.writes.find(write => write.path.endsWith('/bus-models/')).body.specs;
    expect(saved).toMatchObject({
      bus_length_m: 10.75, battery_chemistry: 'NMC', cost: 471250,
      min_battery_packs: 8, max_battery_packs: 12, battery_pack_size_kwh: 42,
      battery_pack_cost_chf: 18900, battery_pack_weight_kg: 223,
    });
    expect([...saved.suggested_spec_fields].sort()).toEqual(['battery_pack_cost_chf', 'cost']);
    check(state);
  });

  test('editing keeps saved manual values through assumption and language changes', async ({ page }) => {
    const state = await setup(page);
    await page.goto('./#buses');
    const edit = page.locator('.bus-models [data-row-action="edit"]');
    await edit.click();
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('7200');
    await expectBatterySummary(page, { min: '280 kWh', max: '440 kWh', price: '180 CHF/kWh' });
    await page.locator('#bus_length_m').fill('12.5');
    await page.locator('#battery_chemistry').selectOption('LFP');
    await page.locator('#battery_pack_size_kwh').fill('45');
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('7200');
    await expect(page.locator('#battery_pack_weight_kg')).toHaveValue('274');
    await expectBatterySummary(page, { min: '315 kWh', max: '495 kWh', price: '160 CHF/kWh' });

    await page.locator('#cost').fill('550000');
    await page.locator('#battery_pack_cost_chf').fill('9022.5');
    for (const [lang, priceLabel] of Object.entries({ en: 'Price per kWh', de: 'Preis pro kWh', fr: 'Prix par kWh', it: 'Prezzo per kWh' })) {
      await page.locator('.language-select').selectOption(lang);
      await expect(page.locator('#cost')).toHaveValue('550000');
      await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('9022.5');
      await expect(page.getByLabel(priceLabel, { exact: true })).toHaveText('200.5 CHF/kWh');
    }
    await submit(page).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0].body.specs).toMatchObject({
      bus_length_m: 12.5, battery_chemistry: 'LFP', cost: 550000,
      battery_pack_cost_chf: 9022.5, battery_pack_weight_kg: 274,
    });
    await edit.click();
    await expectBatterySummary(page, { min: '315 kWh', max: '495 kWh', price: '200.5 CHF/kWh' });
    check(state);
  });

  test('aligns battery inputs when Italian labels wrap', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.use.isMobile;
    // The half-width battery panel fits four columns here while its longest labels still wrap.
    if (!isMobile) await page.setViewportSize({ width: 2292, height: 900 });

    const state = await setup(page);
    await page.goto('./#add-bus-model');
    const panel = page.locator('.bus-model-panel').filter({
      has: page.getByRole('heading', { name: 'Sistema batteria', exact: true }),
    });
    await expect(panel).toBeVisible();
    if (!isMobile) {
      // Exercise wrapped labels even on runners with narrower system fonts.
      await page.addStyleTag({ content:
        'label[for="battery_pack_size_kwh"], label[for="max_charging_power_kw"] { max-inline-size: 18ch; }',
      });
    }
    await page.locator('#bus_length_m').fill('12');
    await page.locator('#battery_pack_size_kwh').fill('40');
    await expect(panel.locator('#battery_pack_cost_chf')).toHaveValue('13200');
    await expect(panel.locator('#battery_pack_weight_kg')).toHaveValue('274');

    const rows = [
      ['min_battery_packs', 'max_battery_packs', 'battery_pack_size_kwh', 'battery_pack_cost_chf'],
      ['max_charging_power_kw', 'battery_pack_weight_kg', 'battery_pack_lifetime'],
    ];
    const expectInputLayout = async () => {
      const geometry = await panel.evaluate(async (panel, rows) => {
        await document.fonts.ready;
        return rows.map(row => row.map(field => {
          const input = panel.querySelector(`#${field}`);
          const { top, bottom, left, right } = input.getBoundingClientRect();
          const labelText = document.createRange();
          labelText.selectNodeContents(input.labels[0]);
          const wraps = new Set(Array.from(labelText.getClientRects(), rect => rect.top)).size > 1;
          return { field, top, bottom, left, right, wraps };
        }));
      }, rows);

      if (isMobile) {
        const inputs = geometry.flat();
        for (const [index, input] of inputs.entries()) {
          expect(Math.abs(input.left - inputs[0].left), input.field).toBeLessThan(1);
          if (index > 0) expect(input.top, input.field).toBeGreaterThan(inputs[index - 1].bottom);
        }
        return;
      }

      for (const row of geometry) {
        expect(row.some(input => input.wraps), 'at least one label wraps in the row').toBe(true);
        for (const [index, input] of row.entries()) {
          expect(Math.abs(input.top - row[0].top), input.field).toBeLessThan(1);
          expect(Math.abs(input.bottom - row[0].bottom), input.field).toBeLessThan(1);
          if (index > 0) expect(input.left, input.field).toBeGreaterThan(row[index - 1].right);
        }
      }
    };

    await test.step('with estimated values', async () => {
      await expect(restore(page, 'battery_pack_cost_chf')).toBeHidden();
      await expect(restore(page, 'battery_pack_weight_kg')).toBeHidden();
      await expectInputLayout();
    });
    await test.step('with manual values and restore controls', async () => {
      await panel.locator('#battery_pack_cost_chf').fill('13000');
      await panel.locator('#battery_pack_weight_kg').fill('270');
      await expect(restore(page, 'battery_pack_cost_chf')).toBeVisible();
      await expect(restore(page, 'battery_pack_weight_kg')).toBeVisible();
      await expectInputLayout();
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
    await expectBatterySummary(page, { price: '180 CHF/kWh' });
    await page.locator('#battery_chemistry').selectOption('NMC');
    await expect(page.locator('#cost')).toHaveValue('620000');
    await expect(page.locator('#battery_pack_cost_chf')).toHaveValue('18000');
    await expect(page.locator('#battery_pack_weight_kg')).toHaveValue('274');
    await expectBatterySummary(page, { price: '450 CHF/kWh' });
    check(state);
  });
}

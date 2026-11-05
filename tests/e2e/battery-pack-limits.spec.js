import { expect, test } from '@playwright/test';

const modelA = { id: 'model-a', user_id: 'user', name: 'Bus A', specs: { min_battery_packs: 10, max_battery_packs: 16, battery_pack_cost_chf: 6000 } };
const modelB = { id: 'model-b', user_id: 'user', name: 'Bus B', specs: { min_battery_packs: 12, max_battery_packs: 14, battery_pack_cost_chf: 6000 } };

async function setup(page, { lang = 'en', models = [modelA, modelB], details, mode = 'charging_only', stops = [] } = {}) {
  const writes = [];
  await page.addInitScript((lang) => {
    localStorage.setItem('access_token', 'test');
    localStorage.setItem('elettra_lang', lang);
  }, lang);
  await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', email: 'local@example.invalid' } }));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (route.request().method() === 'POST' && !path.endsWith('/charging-stops/candidates')) writes.push(path);
    if (path.endsWith('/charging-stops/candidates')) data = stops;
    else if (path.endsWith('/version')) data = { version: 'test' };
    else if (path.endsWith('/bus-models/')) data = models;
    else if (path.includes('/bus-models/')) {
      const id = path.split('/').at(-1);
      data = details ? await details(id) : models.find(model => model.id === id);
    } else if (path.endsWith('/buses/')) data = [{ id: 'bus', user_id: 'user', bus_model_id: 'model-a' }];
    else if (path.endsWith('/shifts/')) data = [{ id: 'shift', name: '40502', bus_id: 'bus', distance_km: 180, yearly_distance_km: 60000 }];
    return route.fulfill({ json: data });
  });
  await page.goto('./#add-simulation');
  await page.locator('.shift-table tbody input[type="checkbox"]').check();
  await page.locator('#simulation-name').fill('Pack limits test');
  if (mode) await page.locator('#var-optimization-mode').selectOption(mode);
  return {
    input: page.locator('#var-fixed-battery-packs'),
    help: page.locator('#fixed-battery-help'),
    error: page.locator('#fixed-battery-feedback'),
    confirm: page.locator('[data-role="evaluation-confirm"]'),
    submit: page.locator('.add-simulation form [type="submit"]'),
    writes,
  };
}

test('manual entries show precise errors and cannot start an evaluation; limits are inclusive', async ({ page }) => {
  const { input, help, error, confirm, submit, writes } = await setup(page);
  await expect(input).toHaveValue('13');
  await expect(input).toHaveAttribute('min', '10');
  await expect(input).toHaveAttribute('max', '16');
  await expect(help).toContainText('Bus A');
  await expect(help).toContainText('10 and 16');
  for (const [value, explanation] of [['390000', 'at most 16'], ['9', 'at least 10'], ['12.5', 'whole number'], ['', 'Enter the number']]) {
    await input.fill(value);
    await expect(error).toContainText(explanation);
    await expect(input).toHaveValue(value);
    await submit.click();
    await expect(confirm).not.toBeVisible();
    // The form uses novalidate: its own submit guard must also reject invalid data.
    await page.locator('.add-simulation form').evaluate(form => form.requestSubmit());
    await expect(confirm).not.toBeVisible();
    expect(writes).toEqual([]);
  }
  for (const value of ['10', '16']) {
    await input.fill(value);
    await expect(error).toBeHidden();
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await submit.click();
    await expect(confirm).toBeVisible();
    await page.locator('[data-role="evaluation-confirm-cancel"]').click();
  }
  // Native spinner/arrow navigation also respects the range.
  await input.fill('16');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('16');
  await input.fill('10');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('10');
});

test('the fixed battery control stays compact and aligned with its label', async ({ page }) => {
  const { input } = await setup(page, { lang: 'it' });
  const control = page.locator('.fixed-battery-control');
  await expect(control).toBeVisible();
  await expect(control.locator('label')).toHaveText(
    'Pacchi batteria (fissi per l’ottimizzazione della ricarica)',
  );

  const layout = await control.evaluate((element) => {
    const label = element.querySelector('label').getBoundingClientRect();
    const field = element.querySelector('input').getBoundingClientRect();
    const container = element.getBoundingClientRect();
    return {
      containerWidth: container.width,
      fieldWidth: field.width,
      centerDifference: Math.abs(
        (label.top + label.height / 2) - (field.top + field.height / 2),
      ),
    };
  });
  expect(layout.fieldWidth).toBeLessThanOrEqual(100);
  expect(layout.fieldWidth).toBeLessThan(layout.containerWidth / 2);
  expect(layout.centerDifference).toBeLessThanOrEqual(1);
  await expect(input).toBeEnabled();
});

test('changing bus model initializes its midpoint; edits survive unrelated mode changes', async ({ page }) => {
  const { input, help, error, confirm, submit } = await setup(page);
  await input.fill('16');
  await page.locator('[name="bus_model_id"]').selectOption('model-b');
  await expect(input).toHaveAttribute('min', '12');
  await expect(input).toHaveAttribute('max', '14');
  await expect(input).toHaveValue('13');
  await expect(error).toBeHidden();
  await input.fill('12');
  await page.locator('[name="bus_model_id"]').selectOption('model-a');
  await expect(input).toHaveValue('13');
  await expect(help).toContainText('10 and 16');
  await expect(error).toBeHidden();
  await input.fill('390000');
  for (const mode of ['battery_only', 'joint']) {
    await page.locator('#var-optimization-mode').selectOption(mode);
    await expect(input).toBeHidden();
    await expect(input).toBeDisabled();
    await submit.click();
    await expect(confirm).toBeVisible();
    await page.locator('[data-role="evaluation-confirm-cancel"]').click();
  }
  await page.locator('#var-optimization-mode').selectOption('charging_only');
  await expect(error).toContainText('at most 16');
});

test('unavailable or inconsistent specifications disable the field and block submission', async ({ page }) => {
  const missing = { ...modelA, specs: {} };
  const invalid = { ...modelB, specs: { min_battery_packs: 20, max_battery_packs: 10 } };
  const { input, help, confirm, submit, writes } = await setup(page, { models: [missing, invalid] });
  for (const id of ['model-a', 'model-b']) {
    await page.locator('[name="bus_model_id"]').selectOption(id);
    await expect(input).toBeDisabled();
    await expect(help).toContainText('missing or invalid');
    await expect(input).not.toHaveAttribute('max');
    await submit.click();
    await expect(confirm).not.toBeVisible();
    expect(writes).toEqual([]);
  }
});

test('asynchronous model details cannot restore obsolete limits after switching models', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { input, help, submit, confirm } = await setup(page, {
    models: [{ ...modelA, specs: undefined }, modelB],
    details: async id => { if (id === 'model-a') await pending; return id === 'model-a' ? modelA : modelB; },
  });
  await expect(input).toBeDisabled();
  await expect(help).toContainText('Loading');
  await submit.click();
  await expect(confirm).not.toBeVisible();
  await page.locator('[name="bus_model_id"]').selectOption('model-b');
  await expect(input).toBeEnabled();
  await expect(input).toHaveAttribute('max', '14');
  await expect(input).toHaveValue('13');
  await input.fill('12');
  const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/bus-models/model-a'));
  release();
  await response;
  await expect(input).toHaveValue('12');
  await expect(input).toHaveAttribute('max', '14');
  await page.locator('[name="bus_model_id"]').selectOption('model-a');
  await expect(input).toHaveAttribute('max', '16');
  await expect(input).toBeEnabled();
  await page.locator('[name="bus_model_id"]').selectOption('model-b');
  await expect(input).toHaveAttribute('max', '14');
});

for (const [lang, phrase] of [['it', 'al massimo 16'], ['fr', 'au maximum 16'], ['de', 'höchstens 16']]) {
  test(`pack validation is translated in ${lang}`, async ({ page }) => {
    const { input, error } = await setup(page, { lang });
    await input.fill('390000');
    await expect(error).toContainText(phrase);
  });
}

test('app and guide load the ELETTRA favicon under the application base path', async ({ page, request }) => {
  for (const url of ['./#landing', './guide/']) {
    await page.goto(url);
    const icon = page.locator('link[rel="icon"]');
    await expect(icon).toHaveAttribute('type', 'image/svg+xml');
    const href = await icon.evaluate(element => element.href);
    expect(new URL(href).pathname).toBe('/elettra/assets/favicon.svg');
    const response = await request.get(href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
  }
});

for (const width of [1053, 2302]) {
  test(`submit focuses and scrolls to the first problem at width ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { input, submit, confirm, writes } = await setup(page);
    const name = page.locator('#simulation-name');
    await name.fill('');
    await input.fill('390000');
    await submit.click();
    await expect(name).toBeFocused();
    await expect(name).toBeInViewport();
    await expect(page.locator('#evaluation-field-problem')).toBeVisible();
    await name.fill('Validation test');
    await page.locator('.shift-table tbody input[type="checkbox"]').uncheck();
    await submit.click();
    await expect(page.locator('#sim-shift-filter')).toBeFocused();
    await expect(page.locator('#sim-shift-filter')).toBeInViewport();
    await page.locator('.shift-table tbody input[type="checkbox"]').check();
    await input.fill('390000');
    await submit.click();
    await expect(input).toBeFocused();
    await expect(input).toBeInViewport();
    await expect(page.locator('#evaluation-field-problem')).toContainText('at most 16');
    await input.fill('13');
    const temp = page.locator('#var-external-temp');
    await temp.fill('');
    await submit.click();
    await expect(temp).toBeFocused();
    await expect(temp).toBeInViewport();
    await expect(confirm).not.toBeVisible();
    expect(writes).toEqual([]);
  });
}

test('missing mode and invalid collapsed infrastructure costs are revealed before confirmation', async ({ page }) => {
  const { submit, confirm, writes } = await setup(page, { mode: null, stops: [
    { stop_id: 'depot', stop_name: 'Depot', is_depot: true, is_custom: true, depot_bus_count: 1 },
  ] });
  const mode = page.locator('#var-optimization-mode');
  await submit.click();
  await expect(mode).toBeFocused();
  await expect(mode).toBeInViewport();
  await mode.selectOption('charging_only');
  const options = page.locator('[data-role="cost-options"]');
  await options.locator('summary').click();
  const cost = options.locator('[data-cost-field="point_cost_chf"]');
  await cost.fill('-1');
  await options.locator('summary').click();
  await submit.click();
  await expect(options).toHaveAttribute('open', '');
  await expect(cost).toBeFocused();
  await expect(cost).toBeInViewport();
  await expect(confirm).not.toBeVisible();
  expect(writes).toEqual([]);
});

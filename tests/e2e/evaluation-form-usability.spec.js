import {test, expect} from '@playwright/test';

test('filtered bulk selection preserves other selections and the form reveals relevant controls', async ({page}) => {
  const depot = '11111111-1111-4111-8111-111111111111';
  const model = {id:'model', user_id:'user', name:'TPL model', specs:{min_battery_packs:10,max_battery_packs:16,battery_pack_size_kwh:50}};
  const shifts = ['40501','40502','40701'].map(name => ({id:name,name,bus_id:'bus',
    structure:[{trip_id:'trip-'+name,sequence_number:1,trip_type:'auxiliary'}]}));
  await page.addInitScript(() => {localStorage.setItem('access_token','test');localStorage.setItem('elettra_lang','en');});
  await page.route('**/auth/me',route => route.fulfill({json:{id:'user',email:'local@example.invalid'}}));
  await page.route('**/api/v1/**',route => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path.endsWith('/version')) data = {version:'test'};
    else if (path.endsWith('/bus-models/')) data = [model];
    else if (path.endsWith('/bus-models/model')) data = model;
    else if (path.endsWith('/buses/')) data = [{id:'bus',user_id:'user',bus_model_id:'model'}];
    else if (path.endsWith('/shifts/')) data = shifts;
    else if (path.includes('/shifts/')) data = shifts.find(s => path.includes('/shifts/'+s.id)) ?? {};
    else if (path.includes('/gtfs-stops/by-trip/')) data = [{id:depot,stop_name:'TPL depot',stop_sequence:1}];
    else if (path.endsWith('/depots/')) data = [{id:'depot',stop_id:depot,name:'TPL depot'}];
    return route.fulfill({json:data});
  });
  await page.goto('./#add-simulation');
  const all = page.getByRole('checkbox',{name:'Select all filtered vehicle blocks',exact:true});
  const rows = page.locator('.shift-table tbody input[type="checkbox"]');
  const filter = page.locator('#sim-shift-filter');
  const stops = page.locator('[data-role="stops-table-wrapper"]');
  await expect(rows).toHaveCount(3);
  await expect(stops).toBeHidden();
  await expect(page.getByRole('heading',{name:'Evaluation parameters',exact:true})).toBeVisible();
  await expect(page.locator('#var-external-temp')).toBeVisible();
  await expect(page.locator('#var-occupancy')).toBeVisible();
  await expect(page.locator('details.add-simulation-options')).toHaveCount(0);

  await filter.fill('4050');
  await expect(rows).toHaveCount(2);
  await all.check();
  await expect(page.locator('.shift-table tbody input:checked')).toHaveCount(2);
  await expect(stops).toBeHidden();
  await filter.fill('407');
  await expect(all).not.toBeChecked();
  await rows.check();
  await expect(all).toBeChecked();
  await filter.fill('4050');
  await rows.first().uncheck();
  await expect(all).toHaveJSProperty('indeterminate',true);
  await all.check();
  await expect(page.locator('.shift-table tbody input:checked')).toHaveCount(2);
  await all.uncheck();
  await filter.fill('');
  await expect(page.locator('.shift-table tbody input:checked')).toHaveCount(1);
  await expect(page.locator('tr[data-id="40701"] input')).toBeChecked();
  await expect(all).toHaveJSProperty('indeterminate',true);
  await page.getByRole('button',{name:'Vehicle block name'}).click();
  await expect(all).toHaveJSProperty('indeterminate',true);
  await filter.fill('no matches');
  await expect(all).toBeDisabled();
  await expect(all).toHaveJSProperty('indeterminate',false);
  await filter.fill('');
  await all.check();
  await page.locator('#var-optimization-mode').selectOption('battery_only');
  await expect(stops).toBeVisible();
  await expect(stops.locator('[data-field="num_slots"]')).toHaveValue('3');

  for (const [title,tip,checkbox] of [
    ['Verify next-day departure with depot charging','#depot-cycle-help','#var-daily-cycle'],
    ['Simulate smart charging in the depot','#depot-peak-help','#var-depot-peak-shaving'],
  ]) {
    const info = page.getByRole('button',{name:title,exact:true});
    await expect(page.locator(tip)).toBeHidden();
    await info.click();
    await expect(page.locator(tip)).toBeVisible();
    await expect(page.locator(checkbox)).toBeChecked();
    const box = await page.locator(tip).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width);
    await info.press('Escape');
    await expect(page.locator(tip)).toBeHidden();
  }
  await all.uncheck();
  await expect(stops).toBeHidden();
});

import {test,expect} from '@playwright/test';

const departure='11111111-1111-4111-8111-111111111111';
const arrival='22222222-2222-4222-8222-222222222222';

async function openFeasibilityWithCosts(page, language = 'en') {
  const model={id:'model',user_id:'user',name:'Test bus',specs:{min_battery_packs:10,max_battery_packs:16,battery_pack_size_kwh:50,battery_pack_cost_chf:6000}};
  const shifts=['one','two'].map(id=>({id,name:id,bus_id:'bus',compatible_weekdays:['monday'],structure:[{trip_id:'trip-'+id,sequence_number:1,trip_type:'auxiliary'}]}));
  const predictions=shifts.map(shift=>({id:'prediction-'+shift.id,shift_id:shift.id,status:'completed',contextual_parameters:{num_battery_packs:16}}));
  let submitted;
  await page.addInitScript(lang=>{localStorage.setItem('access_token','test');localStorage.setItem('elettra_lang',lang);}, language);
  await page.route('**/auth/me',route=>route.fulfill({json:{id:'user',email:'local@example.invalid'}}));
  await page.route('**/api/v1/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let data=[];
    if(path.endsWith('/version'))data={version:'test'};
    else if(path.endsWith('/bus-models/'))data=[{id:model.id,user_id:model.user_id,name:model.name}];
    else if(path.endsWith('/bus-models/model'))data=model;
    else if(path.endsWith('/buses/'))data=[{id:'bus',user_id:'user',bus_model_id:'model'}];
    else if(path.endsWith('/shifts/'))data=shifts;
    else if(path.endsWith('/simulation/charging-stops/candidates'))data=[{stop_id:arrival,stop_name:'Arrival depot',is_depot:true,is_custom:true,depot_bus_count:2}];
    else if(path.includes('/shifts/'))data=shifts.find(s=>path.includes('/shifts/'+s.id))??{};
    else if(path.endsWith('/prediction-runs/')&&request.method()==='POST')data={prediction_run_ids:predictions.map(run=>run.id)};
    else if(path.endsWith('/prediction-runs/'))data=predictions;
    else if(path.includes('/prediction-runs/'))data=predictions.find(run=>path.endsWith('/'+run.id));
    else if(path.endsWith('/optimization-runs/')&&request.method()==='POST'){
      submitted=request.postDataJSON();data={optimization_run_id:'new-run',basis_run_ids:{mean:'new-run',aggregate_q95:'q95-run'}};
    }else if(path.endsWith('/optimization-runs/new-run'))data={id:'new-run',status:'pending'};
    return route.fulfill({json:data});
  });
  await page.goto('./#add-simulation');
  await page.locator('#simulation-service-weekday').selectOption('monday');
  return () => submitted;
}

for (const mode of ['battery_only', 'joint']) test(`advanced costs and uniform battery sizing in ${mode}`,async({page})=>{
  const getSubmitted = await openFeasibilityWithCosts(page);
  await page.locator('#simulation-name').fill('Daily cycle');
  const boxes=page.getByRole('checkbox',{name:'Select vehicle block',exact:true});
  await boxes.nth(0).check();await boxes.nth(1).check();
  await page.locator('#var-optimization-mode').selectOption('battery_only');
  await page.locator('#var-bus-model-override').selectOption('model');
  await expect(page.locator('#var-battery-sizing-mode')).toBeVisible();
  await page.locator('#var-battery-sizing-mode').selectOption('uniform');
  await expect(page.locator('#var-battery-sizing-mode option[value="per_route"]')).toHaveCount(0);
  const row=page.locator(`tr[data-stop-id="${arrival}"]`);
  await expect(row.locator('[data-field="num_slots"]')).toHaveValue('2');
  await expect(row.getByRole('checkbox')).toBeChecked();
  await expect(page.locator(`tr[data-stop-id="${departure}"]`)).toHaveCount(0);
  await row.locator('[data-field="max_total_power_kw"]').fill('80');
  await row.locator('[data-field="num_slots"]').fill('1');
  await expect(row.locator('[data-field="max_total_power_kw"]')).toHaveValue('80');
  const advanced=page.locator('[data-role="cost-options"]');
  await expect(advanced).not.toHaveAttribute('open');
  await advanced.locator('summary').click();
  const costCard=page.locator(`[data-cost-stop-id="${arrival}"]`);
  await expect(costCard.locator('[data-cost-field="point_cost_chf"]')).toHaveValue('110000');
  await costCard.locator('[data-cost-field="point_cost_chf"]').fill('125000');
  await expect(costCard.locator('[data-role="station-cost-total"]')).toContainText("CHF 396'053");
  await page.locator('#var-optimization-mode').selectOption('joint');
  await expect(row.locator('[data-field="max_total_power_kw"]')).toHaveValue('80');
  await expect(row.locator('[data-field="max_power_per_slot_kw"]')).toHaveValue('150');
  await expect(costCard.locator('[data-cost-field="point_cost_chf"]')).toHaveValue('125000');
  await expect(page.locator('[data-role="bus-pack-cost"]')).toHaveText("CHF 6'000");
  await expect(page.locator('#var-battery-cost-per-kwh')).toHaveCount(0);
  if (mode === 'battery_only') await page.locator('#var-optimization-mode').selectOption(mode);
  await page.getByRole('button',{name:'Start evaluation',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Start evaluation',exact:true}).click();
  await expect.poll(()=>getSubmitted()?.daily_cycle).toBe(true);
  const submitted = getSubmitted();
  expect(submitted.depot_peak_shaving).toBe(true);
  expect(submitted.battery_cost_per_kwh).toBeUndefined();
  expect(submitted.mode).toBe(mode);
  expect(submitted.battery_sizing_mode).toBe('uniform');
  expect(submitted.charging_stations[0].slot_costs_chf).toBeUndefined();
  expect(submitted.charging_stations[0].cost_model).toMatchObject({point_cost_chf:125000,site_fixed_cost_chf:250000,connection_cost_per_kw_chf:250,station_type:'depot'});
  expect(submitted.charging_stations[0]).toMatchObject({stop_id:arrival,num_slots:1,max_total_power_kw:80,max_power_per_slot_kw:150});
});

test('aligns the infrastructure cost inputs across wrapped Italian labels', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await openFeasibilityWithCosts(page, 'it');
  await page.locator('.shift-table tbody input[type="checkbox"]').first().check();
  await page.locator('#var-optimization-mode').selectOption('joint');
  await page.locator('[data-role="cost-options"] summary').click();

  const card = page.locator(`[data-cost-stop-id="${arrival}"]`);
  const inputs = card.getByRole('spinbutton');
  await expect(inputs).toHaveCount(3);
  await expect(card.getByRole('spinbutton', { name: 'Quota fissa per sito (CHF)' })).toBeVisible();

  for (const width of [1680, 720]) {
    await test.step(`Align the three cost inputs at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => { await document.fonts.ready; });
      const boxes = await inputs.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
      const tops = boxes.map(box => box.top);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
      expect(boxes[0].right).toBeLessThan(boxes[1].left);
      expect(boxes[1].right).toBeLessThan(boxes[2].left);
    });
  }
});

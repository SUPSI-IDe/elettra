import {test,expect} from '@playwright/test';

test('depot plugs use arrival endpoints and site power remains independent',async({page})=>{
  const departure='11111111-1111-4111-8111-111111111111';
  const arrival='22222222-2222-4222-8222-222222222222';
  const model={id:'model',user_id:'user',name:'Test bus',specs:{min_battery_packs:10,max_battery_packs:16,battery_pack_size_kwh:50}};
  const shifts=['one','two'].map(id=>({id,name:id,bus_id:'bus',structure:[{trip_id:'trip-'+id,sequence_number:1,trip_type:'auxiliary'}]}));
  const predictions=shifts.map(shift=>({id:'prediction-'+shift.id,shift_id:shift.id,status:'completed',contextual_parameters:{num_battery_packs:16}}));
  let submitted;
  await page.addInitScript(()=>{localStorage.setItem('access_token','test');localStorage.setItem('elettra_lang','en');});
  await page.route('**/auth/me',route=>route.fulfill({json:{id:'user',email:'local@example.invalid'}}));
  await page.route('**/api/v1/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let data=[];
    if(path.endsWith('/version'))data={version:'test'};
    else if(path.endsWith('/bus-models/'))data=[model];
    else if(path.endsWith('/bus-models/model'))data=model;
    else if(path.endsWith('/buses/'))data=[{id:'bus',user_id:'user',bus_model_id:'model'}];
    else if(path.endsWith('/shifts/'))data=shifts;
    else if(path.includes('/shifts/'))data=shifts.find(s=>path.includes('/shifts/'+s.id))??{};
    else if(path.includes('/gtfs-stops/by-trip/'))data=[{id:departure,stop_name:'Departure depot',stop_sequence:1},{id:arrival,stop_name:'Arrival depot',stop_sequence:2}];
    else if(path.endsWith('/depots/'))data=[{id:'da',stop_id:departure,name:'Departure depot'},{id:'db',stop_id:arrival,name:'Arrival depot'}];
    else if(path.endsWith('/prediction-runs/')&&request.method()==='POST')data={prediction_run_ids:predictions.map(run=>run.id)};
    else if(path.endsWith('/prediction-runs/'))data=predictions;
    else if(path.includes('/prediction-runs/'))data=predictions.find(run=>path.endsWith('/'+run.id));
    else if(path.endsWith('/optimization-runs/')&&request.method()==='POST'){
      submitted=request.postDataJSON();data={optimization_run_id:'new-run',basis_run_ids:{mean:'new-run',aggregate_q95:'q95-run'}};
    }else if(path.endsWith('/optimization-runs/new-run'))data={id:'new-run',status:'pending'};
    return route.fulfill({json:data});
  });
  await page.goto('./#add-simulation');
  await page.locator('#simulation-name').fill('Daily cycle');
  const boxes=page.getByRole('checkbox',{name:'Select vehicle block',exact:true});
  await boxes.nth(0).check();await boxes.nth(1).check();
  await page.locator('#var-optimization-mode').selectOption('battery_only');
  await page.locator('#var-bus-model-override').selectOption('model');
  const row=page.locator(`tr[data-stop-id="${arrival}"]`);
  await expect(row.locator('[data-field="num_slots"]')).toHaveValue('2');
  await expect(row.getByRole('checkbox')).toBeChecked();
  await expect(page.locator(`tr[data-stop-id="${departure}"]`)).toHaveCount(0);
  await row.locator('[data-field="max_total_power_kw"]').fill('80');
  await row.locator('[data-field="num_slots"]').fill('1');
  await expect(row.locator('[data-field="max_total_power_kw"]')).toHaveValue('80');
  await page.getByRole('button',{name:'Start evaluation',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Start evaluation',exact:true}).click();
  await expect.poll(()=>submitted?.daily_cycle).toBe(true);
  expect(submitted.depot_peak_shaving).toBe(true);
  expect(submitted.charging_stations[0]).toMatchObject({stop_id:arrival,num_slots:1,max_total_power_kw:80,max_power_per_slot_kw:150});
});

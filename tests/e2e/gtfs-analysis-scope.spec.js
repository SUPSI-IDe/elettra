import {expect,test} from '@playwright/test';

const old={gtfs_year:2026,gtfs_file_date:'2025-09-27',valid_from:'2025-12-14',valid_to:'2026-12-12'};
const early={gtfs_year:2027,gtfs_file_date:'2026-08-22',valid_from:'2026-12-13',valid_to:'2027-12-11'};
const latest={...early,gtfs_file_date:'2026-11-04'};
const duty=(id,datasets)=>({id,name:id,bus_id:'bus',gtfs_datasets:datasets,daily_distance_km:1,yearly_distance_km:365});
const shifts=[duty('old-a',[old]),duty('old-b',[old]),duty('early',[early]),duty('latest',[latest]),duty('aux',[]),duty('mixed',[old,latest])];
const model={id:'model',user_id:'user',name:'Model',specs:{min_battery_packs:2,max_battery_packs:8,battery_pack_size_kwh:50}};

async function setup(page,{prefill=null,empty=false}={}) {
  const requests=[];
  await page.addInitScript(()=>{localStorage.setItem('access_token','test');localStorage.setItem('elettra_lang','en');});
  await page.route('**/auth/me',route=>route.fulfill({json:{id:'user',role:'analyst'}}));
  await page.route('**/api/v1/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let data=[];
    if(path.endsWith('/version'))data={version:'test'};
    else if(path.endsWith('/bus-models/'))data=[model];
    else if(path.endsWith('/bus-models/model'))data=model;
    else if(path.endsWith('/buses/'))data=[{id:'bus',user_id:'user',bus_model_id:'model'}];
    else if(path.endsWith('/shifts/'))data=empty?[]:shifts;
    else if(path.endsWith('/yearly-distance'))data={daily_distance_km:1,yearly_distance_km:365};
    else if(path.endsWith('/charging-stops/candidates')) {
      const ids=request.postDataJSON().shift_ids;requests.push(ids);
      if(ids.includes('old-a'))await new Promise(resolve=>setTimeout(resolve,300));
      data=[{stop_id:ids.includes('early')?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111',stop_name:ids.join(','),is_depot:true,depot_bus_count:ids.length}];
    }
    return route.fulfill({json:data});
  });
  if(prefill) {
    await page.goto('./#landing');
    await page.evaluate(async prefill=>{
      const root=document.createElement('div');document.body.replaceChildren(root);
      root.innerHTML=await(await fetch(new URL('src/pages/Simulation/Runs/add-simulation.html',document.baseURI))).text();
      const {initializeAddSimulation}=await import(new URL('src/pages/Simulation/Runs/add-simulation.js',document.baseURI).href);
      await initializeAddSimulation(root,{prefill});
    },prefill);
  } else await page.goto('./#add-simulation');
  return requests;
}

test('year and file filter selection, search and select-all; changing edition clears stale stops',async({page})=>{
  const requests=await setup(page);
  const select=page.locator('#simulation-gtfs-dataset'),rows=page.locator('.shift-table tbody tr[data-id]');
  await expect(select).toHaveValue('2027|2026-11-04');
  await expect(rows).toHaveCount(1);await expect(rows.first()).toHaveAttribute('data-id','latest');
  await expect(rows.locator('[data-role="gtfs-metadata"]')).toHaveCount(0);
  await expect(page.locator('[data-role="gtfs-mixed-warning"]')).toBeVisible();
  await expect(page.locator('tr[data-id="mixed"]')).toHaveCount(0);
  await select.selectOption('2026|2025-09-27');
  await expect(rows).toHaveCount(2);
  await page.locator('[data-role="select-filtered-shifts"]').check();
  await expect(page.locator('.shift-table tbody input:checked')).toHaveCount(2);
  await page.locator('#sim-shift-filter').fill('old-a');await expect(rows).toHaveCount(1);
  await page.locator('#sim-shift-filter').fill('');
  await page.locator('#simulation-name').fill('Retained name');
  await page.locator('#var-optimization-mode').selectOption('battery_only');
  await expect.poll(()=>requests.length).toBeGreaterThan(0);
  await select.selectOption('2027|2026-08-22');
  await expect(page.locator('.shift-table tbody input:checked')).toHaveCount(0);
  await expect(rows).toHaveCount(1);await expect(rows.first()).toHaveAttribute('data-id','early');
  await rows.locator('input[type="checkbox"]').check();
  await expect(page.locator('tr[data-stop-id="22222222-2222-4222-8222-222222222222"]')).toBeVisible();
  await page.waitForTimeout(350);
  await expect(page.locator('tr[data-stop-id="11111111-1111-4111-8111-111111111111"]')).toHaveCount(0);
  expect(requests.at(-1)).toEqual(['early']);
  await expect(page.locator('#simulation-name')).toHaveValue('Retained name');
  await select.selectOption('none');await expect(rows).toHaveCount(1);await expect(rows.first()).toHaveAttribute('data-id','aux');
});

test('duplicating a single-edition evaluation opens its original version',async({page})=>{
  await setup(page,{prefill:{shiftIds:['old-a','old-b'],name:'Copy',busModelId:'model'}});
  await expect(page.locator('#simulation-gtfs-dataset')).toHaveValue('2026|2025-09-27');
  await expect(page.locator('.shift-table tbody input:checked')).toHaveCount(2);
});

test('a historical mixed evaluation cannot silently preselect hidden blocks',async({page})=>{
  await setup(page,{prefill:{shiftIds:['old-a','latest'],name:'Historical copy'}});
  await expect(page.locator('.shift-table tbody input:checked')).toHaveCount(0);
  await expect(page.locator('[data-role="feedback"]')).toContainText('different GTFS versions');
});

test('no available blocks leaves the version selector disabled',async({page})=>{
  await setup(page,{empty:true});
  await expect(page.locator('#simulation-gtfs-dataset')).toBeDisabled();
  await expect(page.locator('.shift-table tbody tr[data-id]')).toHaveCount(0);
});

import {expect, test} from '@playwright/test';

const editions = [
  {gtfs_year:2025,gtfs_file_date:'2025-10-02',valid_from:'2024-12-15',valid_to:'2025-12-13'},
  {gtfs_year:2026,gtfs_file_date:'2025-09-27',valid_from:'2025-12-14',valid_to:'2026-12-12'},
  {gtfs_year:2027,gtfs_file_date:'2026-08-22',valid_from:'2026-12-13',valid_to:'2027-12-11'},
  {gtfs_year:2027,gtfs_file_date:'2026-11-04',valid_from:'2026-12-13',valid_to:'2027-12-11'},
];

async function setup(page, {catalog=editions, edit=false, delay2025=false}={}) {
  const requests=[];
  await page.addInitScript(()=>{localStorage.setItem('access_token','test');localStorage.setItem('elettra_lang','en');});
  await page.route('**/auth/me',route=>route.fulfill({json:{id:'user',company_id:'company',role:'analyst'}}));
  await page.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    let data=[];
    if(path.endsWith('/version'))data={version:'test'};
    else if(path.endsWith('/datasets')) data=catalog;
    else if(path.includes('/gtfs-routes/')) {
      requests.push({year:url.searchParams.get('gtfs_year'),date:url.searchParams.get('gtfs_file_date')});
      const year=url.searchParams.get('gtfs_year');
      if(delay2025&&year==='2025')await new Promise(resolve=>setTimeout(resolve,250));
      data=[{id:`route-${year}`,route_id:`route-${year}`,route_short_name:`Line ${year}`}];
    } else if(path.includes('/gtfs-trips/by-route/')) {
      data=[{id:'trip-2026',trip_id:'trip-2026',route_id:'route-2026',departure_time:'08:00:00',arrival_time:'09:00:00',start_stop_name:'Start',end_stop_name:'Finish',status:'gtfs'}];
    } else if(path.endsWith('/buses/'))data=[{id:'bus',user_id:'user',name:'Bus',bus_model_id:'model'}];
    else if(path.endsWith('/bus-models/'))data=[{id:'model',user_id:'user',name:'Model'}];
    else if(path.endsWith('/shifts/old'))data={id:'old',name:'Old shift',bus_id:'bus',structure:[],gtfs_datasets:[editions[0]]};
    return route.fulfill({json:data});
  });
  await page.goto('./#landing');
  await page.evaluate(async edit=>{
    const root=document.createElement('div');root.id='gtfs-form-test';document.body.replaceChildren(root);
    root.innerHTML=await(await fetch(new URL('src/pages/Fleet/Shifts/shift-form.html',document.baseURI))).text();
    const {initializeShiftForm}=await import(new URL('src/pages/Fleet/Shifts/shift-form.js',document.baseURI).href);
    window.cleanupGtfsForm=await initializeShiftForm(root,edit?{mode:'edit',shiftId:'old'}:{});
  },edit);
  return requests;
}

test('new block defaults to the latest file and rapid selection discards old route responses',async({page})=>{
  await setup(page,{delay2025:true});
  const selector=page.locator('#shift-gtfs-dataset'),line=page.locator('#scheduled-trips-line');
  await expect(selector).toHaveValue('2027|2026-11-04');
  await expect(page.locator('#shift-gtfs-summary')).toContainText('13/12/2026–11/12/2027');
  await page.locator('#shift-name').fill('Preserve me');
  await page.locator('#shift-bus').selectOption('bus');
  await selector.selectOption('2025|2025-10-02');
  await selector.selectOption('2026|2025-09-27');
  await expect(line.locator('option[value="route-2026"]')).toHaveCount(1);
  await page.waitForTimeout(350);
  await expect(line.locator('option[value="route-2025"]')).toHaveCount(0);
  await expect(page.locator('#shift-name')).toHaveValue('Preserve me');
  await expect(page.locator('#shift-bus')).toHaveValue('bus');
  await line.selectOption('route-2026');
  await page.locator('#scheduled-trips-day').selectOption('monday');
  await page.locator('[data-action="add-trip"]').first().click();
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(1);
  page.once('dialog',dialog=>dialog.dismiss());
  await selector.selectOption('2027|2026-11-04');
  await expect(selector).toHaveValue('2026|2025-09-27');
  page.once('dialog',dialog=>dialog.accept());
  await selector.selectOption('2027|2026-11-04');
  await expect(page.locator('[data-role="shift-trips-body"] tr')).toHaveCount(0);
  await expect(page.locator('#shift-name')).toHaveValue('Preserve me');
});

test('editing an old shift requests its own routes directly after 2027 is available',async({page})=>{
  const requests=await setup(page,{edit:true});
  await expect(page.locator('#shift-gtfs-dataset')).toBeHidden();
  await expect(page.locator('#shift-gtfs-summary')).toContainText('2025');
  expect(requests).toEqual([{year:'2025',date:'2025-10-02'}]);
});

test('a company with no datasets has no selectable routes',async({page})=>{
  const requests=await setup(page,{catalog:[]});
  await expect(page.locator('#shift-gtfs-dataset')).toBeDisabled();
  await expect(page.locator('#shift-gtfs-summary')).toContainText('No GTFS timetable available');
  expect(requests).toEqual([]);
});

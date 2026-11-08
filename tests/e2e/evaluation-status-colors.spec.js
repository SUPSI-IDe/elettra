import { expect, test } from '@playwright/test';
import { translations } from '../../src/i18n/translations';

test('calculation and feasibility colours distinguish active work, infeasibility and a timed-out pair', async ({ page }) => {
  const feasible={status:'completed',verification_status:'verified',electrification_feasible:true};
  const infeasible={status:'completed',verification_status:'infeasible',electrification_feasible:false};
  const samples=[
    {id:'done',...feasible},
    {id:'infeasible',...infeasible},
    {id:'pending',status:'pending'},
    {id:'running',status:'running'},
    {id:'error',status:'failed'},
    {id:'timeout',status:'completed',basis_summaries:{mean:{...infeasible,verification_status:'time_budget_exhausted'},aggregate_q95:{...infeasible,verification_status:'time_budget_exhausted'}}},
    {id:'mixed',status:'completed',basis_summaries:{mean:feasible,aggregate_q95:infeasible}},
    {id:'waiting-q95',status:'completed',basis_summaries:{mean:feasible,aggregate_q95:{status:'running'}}},
    {id:'failed-q95',status:'completed',basis_summaries:{mean:feasible,aggregate_q95:{status:'failed'}}},
  ];
  const modes=['battery_only','charging_only','joint'];
  const modeLabels={battery_only:'Battery only',charging_only:'Charging',joint:'Joint'};
  samples.forEach((row,index)=>Object.assign(row,{name:row.id,mode:modes[index%modes.length],created_at:'2026-10-30T18:16:30Z',input_params:{shift_ids:[]},shift_ids:[]}));
  await page.addInitScript(()=>{localStorage.setItem('access_token','status-colour-test');localStorage.setItem('elettra_lang','en');});
  await page.route('**/auth/me',route=>route.fulfill({json:{id:'user-1',email:'status@example.invalid'}}));
  await page.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const body=path.endsWith('/optimization-runs/')?samples:
      path.includes('/optimization-runs/')?samples.find(row=>path.endsWith('/'+row.id))??[]:[];
    return route.fulfill({json:body});
  });
  await page.goto('./#simulation-runs');
  for(const row of samples) {
    await expect(page.locator(`tr[data-id="${row.id}"] td.type`)).toHaveText(modeLabels[row.mode]);
  }
  for(const [id,tone] of [['done','positive'],['infeasible','positive'],['pending','warning'],['running','warning'],['error','negative'],['timeout','negative'],['mixed','positive'],['waiting-q95','warning'],['failed-q95','negative']]) {
    await expect(page.locator(`tr[data-id="${id}"] td.status [role="img"]`)).toHaveClass(new RegExp(`--${tone}`));
  }
  const timeout=page.locator('tr[data-id="timeout"]');
  await expect(timeout.locator('td.status [role="img"]')).toHaveAttribute('title',/Mean: Failed.*Time limit reached.*Q95: Failed.*Time limit reached/);
  await expect(timeout.locator('td.feasibility [role="img"]')).toHaveClass(/--neutral/);
  await expect(timeout.locator('td.feasibility')).toHaveText('');
  await expect(timeout.locator('td.feasibility [role="img"]')).toHaveAttribute('title',/Time limit reached/);
  await expect(page.locator('tr[data-id="mixed"] td.feasibility [role="img"]')).toHaveClass(/--warning/);
  await expect(page.locator('tr[data-id="infeasible"] td.feasibility [role="img"]')).toHaveClass(/--negative/);
  await expect(page.locator('tr[data-id="failed-q95"] td.feasibility')).toHaveText('');
  await expect(page.locator('tr[data-id="failed-q95"] td.feasibility [role="img"]')).toHaveAttribute('title',/Not determined/);
});

test('Italian paired feasibility labels consistently translate the Mean profile', async ({ page }) => {
  const feasible={status:'completed',verification_status:'verified',electrification_feasible:true};
  const infeasible={status:'completed',verification_status:'infeasible',electrification_feasible:false};
  const samples=[
    {id:'both-feasible',basis_summaries:{mean:feasible,aggregate_q95:feasible}},
    {id:'both-infeasible',basis_summaries:{mean:infeasible,aggregate_q95:infeasible}},
    {id:'mean-only',basis_summaries:{mean:feasible,aggregate_q95:infeasible}},
    {id:'q95-only',basis_summaries:{mean:infeasible,aggregate_q95:feasible}},
  ];
  samples.forEach(row=>Object.assign(row,{name:row.id,mode:'battery_only',status:'completed',created_at:'2026-10-30T18:16:30Z',input_params:{shift_ids:[]},shift_ids:[]}));
  await page.addInitScript(()=>{localStorage.setItem('access_token','status-colour-test');localStorage.setItem('elettra_lang','it');});
  await page.route('**/auth/me',route=>route.fulfill({json:{id:'user-1',email:'status@example.invalid'}}));
  await page.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const body=path.endsWith('/optimization-runs/')?samples:
      path.includes('/optimization-runs/')?samples.find(row=>path.endsWith('/'+row.id))??[]:[];
    return route.fulfill({json:body});
  });
  await page.goto('./#simulation-runs');

  const expected={
    'both-feasible':'Fattibile con Media e Q95',
    'both-infeasible':'Non fattibile con Media né con Q95',
    'mean-only':'Fattibile con Media, non fattibile con Q95',
    'q95-only':'Fattibile con Q95, non fattibile con Media',
  };
  for(const [id,label] of Object.entries(expected)) {
    await expect(page.locator(`tr[data-id="${id}"] td.feasibility [role="img"]`)).toHaveAttribute('title',label);
  }
  await expect(page.locator('[data-i18n-title="simulation.col_feasibility_help"]')).toHaveAttribute('title',/Media o Q95/);
  expect(Object.entries(translations.it).filter(([,value])=>/\bMean\b/.test(value))).toEqual([]);
});

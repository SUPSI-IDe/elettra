import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const runsHtml = readFileSync(new URL('../../src/pages/Simulation/YearlyAnalysis/yearly-analysis-runs.html', import.meta.url), 'utf8');

for (const width of [1280, 900, 390]) {
  test(`annual efficiency keeps Min and Max separate without overlapping at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:900});
    await page.goto('./');
    await page.evaluate(async () => {
      await import('/elettra/src/style.css');
      localStorage.setItem('elettra_lang', 'it');
      document.body.innerHTML = '<main id="annual-layout"></main>';
      const {createYearlyFleetDashboard} = await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-fleet-dashboard.js');
      const ids = ['41201_weekday', '41202_weekday'];
      const features = {
        config:{auxiliary_heating_type:'default',fixedConfiguration:{
          fleet:{vehicleCount:2},
          investment:{rows:ids.map(id => ({id,modelName:'AL_NF_9m',packs:5,capacity:500,busCost:480000,batteryCost:150000}))},
          infrastructure:{dataAvailable:true,stations:[]},
        }},
        results:{yearlyTotals:{distanceKm:100000,totalEnergyKwh:107150},shiftResults:ids.map((id,index) => ({shiftId:id,shiftName:id,status:'completed',
          yearlyTotals:{distanceKm:50000,totalEnergyKwh:50000*(index ? 1.095 : 1.048)}}))},
      };
      window.layoutDashboard=createYearlyFleetDashboard({features,model:{bus_length_m:9},predictionRuns:[]});
      window.layoutDashboard.mount(document.querySelector('main'),{status:'error',error:'Layout fixture'});
    });
    const metric=page.locator('[data-outcome="efficiency"]');
    await expect(metric.locator('.annual-efficiency__value > span')).toHaveText([
      'Min: 1.048 (41201_weekday)', 'Max: 1.095 (41202_weekday)',
    ]);
    const geometry=await metric.evaluate(element => {
      const label=element.querySelector('.annual-outcome__label').getBoundingClientRect();
      const value=element.querySelector('.annual-efficiency__value').getBoundingClientRect();
      const lines=[...element.querySelectorAll('.annual-efficiency__value > span')].map(line => {
        const r=line.getBoundingClientRect();return {top:r.top,bottom:r.bottom};
      });
      return {labelRight:label.right,valueLeft:value.left,
        labelCenter:(label.top+label.bottom)/2,valueCenter:(value.top+value.bottom)/2,
        lines,overflow:[element,...element.querySelectorAll('.annual-efficiency__value, .annual-efficiency__value > span')]
          .some(node => node.scrollWidth>node.clientWidth+1)};
    });
    expect(geometry.labelRight).toBeLessThan(geometry.valueLeft);
    expect(Math.abs(geometry.labelCenter-geometry.valueCenter)).toBeLessThan(1);
    expect(geometry.lines[0].bottom).toBeLessThanOrEqual(geometry.lines[1].top+1);
    expect(geometry.overflow).toBe(false);
    await page.screenshot({path:test.info().outputPath(`annual-efficiency-${width}.png`),fullPage:true});

  });
}

for (const width of [1280, 1000]) {
  test(`annual list wraps long vehicle block names within the table at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.goto('./');
    const names=['41201_weekday','41202_weekday',...Array.from({length:12},(_,i) => `412${String(i+3).padStart(2,'0')}_weekday_nome_lungo`)];
    await page.evaluate(async ({html,names}) => {
      localStorage.setItem('elettra_lang','it');
      await import('/elettra/src/style.css');
      const {buildYearlyAnalysisRowsMarkup}=await import('/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-runs.js');
      const source=new DOMParser().parseFromString(html,'text/html');
      document.body.replaceChildren(source.querySelector('.yearly-analysis-runs'));
      document.querySelector('[data-role="ya-runs-body"]').innerHTML=buildYearlyAnalysisRowsMarkup([
        {id:'annual-layout',name:'L12_ch_depo_bre_SOH100',created_at:'2026-11-19T21:13:54Z',
          features:{status:'completed',meta:{shiftNames:names},config:{mode:'joint'}}},
      ]);
    },{html:runsHtml,names});
    const cell=page.locator('.ya-runs-table tbody td.shifts');
    await expect(cell.locator('.ya-runs-shift-name')).toHaveText(names);
    await expect(cell).toHaveAttribute('title',names.join(', '));
    const geometry=await cell.evaluate(element => {
      const row=element.parentElement;
      const rect=element.getBoundingClientRect();
      const names=[...element.children].map(name => name.getBoundingClientRect());
      const wrap=element.closest('.ya-runs-table-wrap');
      return {lines:new Set(names.map(r => Math.round(r.top))).size,
        cellOverflow:element.scrollWidth>element.clientWidth+1,
        tableOverflow:wrap.scrollWidth>wrap.clientWidth+1,
        namesWithinCell:names.every(r => r.left>=rect.left && r.right<=rect.right),
        alignment:[...row.children].map(td => getComputedStyle(td).verticalAlign)};
    });
    expect(geometry.lines).toBeGreaterThan(1);
    expect(geometry.cellOverflow).toBe(false);
    expect(geometry.tableOverflow).toBe(false);
    expect(geometry.namesWithinCell).toBe(true);
    expect(geometry.alignment.every(value => value==='middle')).toBe(true);
    await page.screenshot({path:test.info().outputPath(`annual-list-${width}.png`),fullPage:true});
  });
}

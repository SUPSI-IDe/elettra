import { test, expect } from '@playwright/test';

test('HVAC details and authenticated inputs are requested only when needed', async ({page}) => {
  const requests=[];
  await page.addInitScript(() => {localStorage.setItem('access_token','hvac-test');localStorage.setItem('elettra_lang','en');});
  await page.route('**/api/v1/**',route=>route.fulfill({json:[]}));
  await page.route('**/auth/me',route=>route.fulfill({json:{id:'test',role:'analyst'}}));
  await page.route('**/auxiliary-assumptions*', route => {
    requests.push({url:route.request().url(),auth:route.request().headers().authorization});
    return route.fulfill({json:{schema_version:1,weather_inputs:{},runs:[{temperature_c:17,
      assumptions:{policy_id:'feasibility-ghi-temperature-cap10-v1',ghi_reference_wm2:800,solar_clouding:1,solar_fixed_multiplier:.25,glazing_factor:.95},
      components:{total_hvac_in_trip_electrical_kwh:12,total_hvac_terminal_electrical_kwh:2}}]}});
  });
  await page.goto('./#landing');
  await page.evaluate(async () => {
    document.body.innerHTML='<main><header class="page-header"><div data-role="hvac-assumptions" hidden></div></header></main>';
    const {mountHvacAssumptions}=await import(new URL('src/pages/Simulation/shared/hvac-assumptions.js',document.baseURI).href);
    await mountHvacAssumptions(document.querySelector('main'),'run');
  });
  const panel=page.locator('[data-role="hvac-assumptions"]');
  await expect(panel).toContainText('one GHI per temperature');
  expect(requests).toHaveLength(1);
  await panel.locator('summary').first().click();
  await expect(panel.locator('tbody')).toContainText('800');
  await expect(panel).toContainText('Fixed auxiliaries apply only during trips');
  const download=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Download complete inputs (JSON)'}).click();
  expect((await download).suggestedFilename()).toBe('hvac-run-inputs.json');
  expect(requests).toHaveLength(2);
  expect(requests[1].url).toContain('include_inputs=true');
  expect(requests.every(request=>request.auth==='Bearer hvac-test')).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  // The app clips horizontal overflow, so document width alone cannot detect
  // a flex child whose text and buttons extend beyond the mobile viewport.
  for (const element of await panel.locator('p, .hvac-assumptions__table, .hvac-assumptions__actions').all()) {
    const bounds=await element.boundingBox();
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  }
});

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const html = readFileSync(new URL("../../src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.html", import.meta.url), "utf8");
const fixture = JSON.parse(readFileSync(new URL("../fixtures/grid94-lca.json", import.meta.url), "utf8"));

test("scenario and total electricity costs apply exactly the same grid boundary", async ({page}) => {
  await page.goto("./");
  const values = await page.evaluate(async () => {
    const module = await import("/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js");
    const raw = {auxiliary_heating_type:"default",annual_km:100,
      assumptions:{yearly_electric_kwh:94,yearly_distance_km:100,energy_price_per_kwh:.2},
      ebus:{opex_items:[]},diesel_comparator:{opex_items:[]},
      scenarios:[{annual_electric_kwh:94, annual_distance_km:100,daily_electric_kwh:94,daily_distance_km:100,occurrences:1}]};
    const mapped = module.mapBackendCostsToLocal(raw,100,94,{bus_length_m:12});
    return {total:mapped.electric.energyOpex, scenario:mapped.scenarioCosts[0].annualEnergyCost};
  });
  expect(values).toEqual({total:20,scenario:20});
});

test("annual LCA preserves mileage controls, calls the backend again and keeps costs on failure", async ({page}) => {
  const requests = [];
  let fail = false;
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    let body;
    if (url.pathname.endsWith("/lca")) {
      requests.push(url.searchParams.get("annual_km"));
      body = fail ? {methodology_version: fixture.base.methodology_version, status:"incomplete", reason:"Controlled timeout", indicators:{}, vehicles:[]} :
        url.searchParams.has("annual_km") ? fixture.extended : fixture.base;
    } else if (url.pathname.endsWith("/emissions")) {
      throw new Error("Legacy environmental endpoint must not be used");
    } else if (url.pathname.endsWith("/yearly-analysis/case")) {
      body = {id:"case", name:"Grid94 acceptance", features:{config:{bus_model_id:"bus", auxiliary_heating_type:"default"},
        results:{optimizedPacks:10, yearlyTotals:{totalEnergyKwh:90000, distanceKm:60000},
        scenarioResults:[{temperature:20, occurrences:365, kpis:{totalEnergyKwh:90000/365, distanceKm:60000/365}}]}}};
    } else if (url.pathname.includes("bus-models/bus")) {
      body = {id:"bus",name:"Bus",specs:{bus_length_m:12,battery_pack_size_kwh:40,bus_lifetime:12,battery_pack_lifetime:8,cost:400000}};
    } else if (url.pathname.endsWith("/costs")) {
      await route.fulfill({status:503,json:{detail:"Cost endpoint unavailable; local energy calculation remains available"}}); return;
    } else body = [];
    await route.fulfill({json:body});
  });
  await page.goto("./");
  await page.evaluate(async html => {
    localStorage.setItem("access_token", "fixture-token");
    const module = await import("/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js");
    document.body.innerHTML = html;
    await module.initializeYearlyAnalysisResults(document, {analysisId:"case"});
  }, html);
  await page.locator('[data-tab="emissions"]').click();
  const controls = page.locator('[data-role="ya-env-controls"]');
  await expect(controls).toBeVisible();
  await expect(page.locator('[data-role="ya-env-kpis"]')).toContainText("94%");
  const slider = page.locator('[data-role="ya-env-yearly-distance"]');
  await slider.evaluate(el => { el.value="90000"; el.dispatchEvent(new Event("input",{bubbles:true})); });
  await expect.poll(() => requests.length).toBe(2);
  await expect(controls).toBeVisible();
  expect(requests[1]).toBe("90000");
  const download = page.waitForEvent("download");
  await page.locator("[data-lca-export]").click();
  expect((await download).suggestedFilename()).toBe("parameterized-lca.json");
  fail = true;
  await slider.evaluate(el => { el.value="80000"; el.dispatchEvent(new Event("input",{bubbles:true})); });
  await expect(page.locator('[data-role="ya-env-kpis"]')).toContainText("Controlled timeout");
  await page.locator('[data-tab="costs"]').click();
  await expect(page.locator('[data-panel="costs"]')).toContainText("CHF");
});

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const html = readFileSync(new URL("../../src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.html", import.meta.url), "utf8");
const fixture = JSON.parse(readFileSync(new URL("../fixtures/grid94-lca.json", import.meta.url), "utf8"));

test("scenario and total electricity costs apply exactly the same grid boundary", async ({page}) => {
  await page.goto("./");
  const values = await page.evaluate(async () => {
    const module = await import("/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js");
    const boundary = {policy:"grid-to-bus-dc-94-v1",dc_kwh:94,grid_kwh:100,
      charging_losses_kwh:6,grid_to_bus_efficiency:.94};
    const raw = {auxiliary_heating_type:"default",annual_km:100,
      assumptions:{yearly_electric_kwh:94,yearly_distance_km:100,energy_price_per_kwh:.2,
        energy_boundary:boundary},
      ebus:{opex_items:[]},diesel_comparator:{opex_items:[]},
      scenarios:[{label:"Nominal",annual_electric_kwh:94,annual_distance_km:100,
        daily_electric_kwh:94,daily_distance_km:100,occurrences:1,energy_boundary:boundary}]};
    const bus = {bus_length_m:12,bus_lifetime:12,battery_pack_lifetime:8};
    const mapped = module.mapBackendCostsToLocal(raw,100,94,bus);
    const scaled = module.mapBackendCostsToLocal(raw,100,94,bus,{
      overrides:{yearlyDistanceKm:200,energyPricePerKwh:.4},
    });
    const legacy = structuredClone(raw);
    delete legacy.assumptions.energy_boundary;
    delete legacy.scenarios[0].energy_boundary;
    const mappedLegacy = module.mapBackendCostsToLocal(legacy,100,94,bus);
    const localFeatures = {results:{optimizedPacks:0,
      yearlyTotals:{totalEnergyKwh:94,distanceKm:100},
      scenarioResults:[{label:"Nominal",temperature:20,occurrences:1,
        kpis:{totalEnergyKwh:94,distanceKm:100,drivetrainEnergyKwh:80,auxiliaryEnergyKwh:14}}]}};
    const local = module.computeYearlyCosts(localFeatures,bus,{energyPricePerKwh:.2});
    const exportPayload = module.buildExportPayload(
      localFeatures,{}, {status:"done",costsData:mapped}, {},bus,"case",
    );
    const malformed = structuredClone(raw);
    malformed.assumptions.energy_boundary.charging_losses_kwh = 5;
    const mismatched = structuredClone(raw);
    mismatched.assumptions.energy_boundary.dc_kwh = 188;
    mismatched.assumptions.energy_boundary.grid_kwh = 200;
    mismatched.assumptions.energy_boundary.charging_losses_kwh = 12;
    let malformedRejected = false;
    let mismatchRejected = false;
    try {
      module.mapBackendCostsToLocal(malformed,100,94,bus);
    } catch {
      malformedRejected = true;
    }
    try {
      module.mapBackendCostsToLocal(mismatched,100,94,bus);
    } catch {
      mismatchRejected = true;
    }
    const select = cost => ({
      dc:cost.yearlyEnergyKwh,
      grid:cost.yearlyGridEnergyKwh,
      loss:cost.yearlyChargingLossesKwh,
      total:cost.electric.energyOpex,
      scenarioDc:cost.scenarioCosts[0].annualEnergy,
      scenarioGrid:cost.scenarioCosts[0].annualGridEnergy,
      scenarioLoss:cost.scenarioCosts[0].annualChargingLosses,
      scenarioCost:cost.scenarioCosts[0].annualEnergyCost,
    });
    return {
      mapped:select(mapped),scaled:select(scaled),legacy:select(mappedLegacy),local:select(local),
      malformedRejected,mismatchRejected,
      exported:exportPayload.costs,
    };
  });
  expect(values.mapped).toEqual({dc:94,grid:100,loss:6,total:20,
    scenarioDc:94,scenarioGrid:100,scenarioLoss:6,scenarioCost:20});
  expect(values.scaled).toEqual({dc:188,grid:200,loss:12,total:80,
    scenarioDc:188,scenarioGrid:200,scenarioLoss:12,scenarioCost:80});
  expect(values.legacy).toEqual(values.mapped);
  expect(values.local).toEqual(values.mapped);
  expect(values.malformedRejected).toBe(true);
  expect(values.mismatchRejected).toBe(true);
  expect(values.exported.assumptions).toMatchObject({
    energyPolicy:"grid-to-bus-dc-94-v1",gridToBusEfficiency:.94,
    electricityPriceBasis:"grid_energy",annualGridEnergy_kWh:100,
    annualChargingLosses_kWh:6,
  });
  expect(values.exported).toMatchObject({
    yearlyEnergy_kWh:94,yearlyBusEnergyDC_kWh:94,yearlyGridEnergy_kWh:100,
    yearlyChargingLosses_kWh:6,
  });
  expect(values.exported.scenarioCosts[0]).toMatchObject({
    dailyEnergy_kWh:94,dailyBusEnergyDC_kWh:94,dailyGridEnergy_kWh:100,
    dailyChargingLosses_kWh:6,annualEnergy_kWh:94,annualBusEnergyDC_kWh:94,
    annualGridEnergy_kWh:100,annualChargingLosses_kWh:6,annualEnergyCost_CHF:20,
  });
});

test("LCA disclosure handles absent optional provenance and empty backend lists", async ({page}) => {
  await page.goto("./");
  await page.evaluate(async raw => {
    localStorage.setItem("elettra_lang", "en");
    const [{renderParameterizedLca}, {t}] = await Promise.all([
      import("/elettra/src/pages/Simulation/YearlyAnalysis/parameterized-lca.js"),
      import("/elettra/src/i18n/index.js"),
    ]);
    const value = structuredClone(raw);
    delete value.provenance.base_url;
    delete value.provenance.diesel_heating_methodology;
    value.limitations = [];
    value.vehicles.forEach(vehicle => { vehicle.warnings = []; });
    const host = document.createElement("section");
    host.id = "lca-disclosure-test";
    document.body.replaceChildren(host);
    renderParameterizedLca(host, value, t);
  }, fixture.base);

  const disclosure = page.locator(".ya-lca-disclosure");
  await disclosure.locator("summary").click();
  await expect(disclosure.locator('[data-role="lca-provenance"]')).not.toContainText("undefined");
  await expect(disclosure.locator('[data-role="lca-provenance"]')).not.toContainText("null");
  await expect(disclosure.locator('[data-role="lca-limitations"]')).toContainText(
    "The backend reported no additional methodological limitations.",
  );
  await expect(disclosure.locator('[data-role="lca-warnings"]')).toHaveCount(0);
});

test("annual LCA preserves mileage controls, calls the backend again and keeps costs on failure", async ({page}) => {
  const requests = [];
  let responseMode = "complete";
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    let body;
    if (url.pathname.endsWith("/lca")) {
      requests.push(url.searchParams.get("annual_km"));
      if (responseMode === "incomplete") {
        body = {methodology_version: fixture.base.methodology_version, status:"incomplete", reason:"Controlled timeout", indicators:{}, vehicles:[]};
      } else {
        body = structuredClone(url.searchParams.has("annual_km") ? fixture.extended : fixture.base);
        body.vehicles.forEach((vehicle) => { vehicle.shift_id = "acceptance-12"; });
        if (responseMode === "malformed") body.indicators.gwp100a.phases.direct += 1_000_000;
      }
    } else if (url.pathname.endsWith("/emissions")) {
      throw new Error("Legacy environmental endpoint must not be used");
    } else if (url.pathname.endsWith("/yearly-analysis/case")) {
      body = {id:"case", name:"Grid94 acceptance", features:{config:{bus_model_id:"bus", shift_ids:["acceptance-12"], auxiliary_heating_type:"default"},
        meta:{shiftNames:["Acceptance shift"]},
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
    localStorage.setItem("elettra_lang", "en");
    const module = await import("/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js");
    document.body.innerHTML = html;
    await module.initializeYearlyAnalysisResults(document, {analysisId:"case"});
  }, html);
  await page.getByRole("tab", {name:"Acceptance shift"}).click();
  const resultViews = page.locator('[data-role="ya-result-view-tabs"]');
  await resultViews.getByRole("tab", {name:"Costs"}).click();
  const costsPanel = page.locator('[data-panel="costs"]');
  await expect(costsPanel).toBeVisible();
  await expect(costsPanel).toContainText("Annual bus energy (DC kWh)");
  await expect(costsPanel).toContainText("Annual grid energy (kWh)");
  await expect(costsPanel).toContainText("Charging losses (kWh)");
  await expect(costsPanel).toContainText("from the grid");
  const distanceControl = page.locator('[data-role="ya-var-yearly-distance"]');
  await expect(distanceControl).toBeVisible();
  await resultViews.getByRole("tab", {name:"Emissions"}).click();
  await expect(page.locator('[data-role="ya-env-kpis"]')).toContainText("94%");
  const disclosure = page.locator(".ya-lca-disclosure");
  await disclosure.locator("summary").click();
  const provenance = disclosure.locator('[data-role="lca-provenance"]');
  await expect(provenance).toContainText("mobitool-parameterized-grid94-v1");
  await expect(provenance).toContainText(fixture.base.provenance.data_version);
  await expect(provenance).toContainText(fixture.base.provenance.base_url);
  await expect(provenance).toContainText(fixture.base.provenance.diesel_heating_methodology);
  await expect(provenance).toContainText("grid-to-bus-dc-94-v1");
  const limitations = disclosure.locator('[data-role="lca-limitations"] li');
  await expect(limitations).toHaveCount(fixture.base.limitations.length + 1);
  await expect(limitations.first()).toHaveText(fixture.base.limitations[0]);
  await expect(disclosure.locator('[data-role="lca-limitations"]')).toContainText(
    fixture.base.limitations.at(-1),
  );
  await expect(disclosure.locator('[data-role="lca-warnings"]')).toHaveCount(0);
  const slider = distanceControl;
  await resultViews.getByRole("tab", {name:"Costs"}).click();
  await slider.evaluate(el => { el.value="90000"; el.dispatchEvent(new Event("input",{bubbles:true})); });
  await expect.poll(() => requests.length).toBe(2);
  await expect(distanceControl).toBeVisible();
  expect(requests[1]).toBe("90000");
  await resultViews.getByRole("tab", {name:"Emissions"}).click();
  const updatedDisclosure = page.locator(".ya-lca-disclosure");
  await updatedDisclosure.locator("summary").click();
  await expect(updatedDisclosure.locator('[data-role="lca-warnings"]')).toContainText(
    fixture.extended.vehicles[0].warnings[0],
  );
  const download = page.waitForEvent("download");
  await page.locator("[data-lca-export]").click();
  const downloadedLca = await download;
  expect(downloadedLca.suggestedFilename()).toBe("parameterized-lca.json");
  const downloadedPath = await downloadedLca.path();
  const exportedLca = JSON.parse(readFileSync(downloadedPath, "utf8"));
  expect(exportedLca.provenance).toEqual(fixture.extended.provenance);
  expect(exportedLca.limitations).toEqual(expect.arrayContaining(fixture.extended.limitations));
  expect(exportedLca.limitations).toHaveLength(fixture.extended.limitations.length + 1);
  expect(exportedLca.vehicles[0].warnings).toEqual(fixture.extended.vehicles[0].warnings);

  responseMode = "malformed";
  await resultViews.getByRole("tab", {name:"Costs"}).click();
  await slider.evaluate(el => { el.value="80000"; el.dispatchEvent(new Event("input",{bubbles:true})); });
  await resultViews.getByRole("tab", {name:"Emissions"}).click();
  await expect(page.locator('[data-role="ya-env-kpis"]')).toContainText("phases do not sum to total");
  await resultViews.getByRole("tab", {name:"Costs"}).click();
  await expect(page.locator('[data-panel="costs"]')).toContainText("CHF");

  responseMode = "incomplete";
  await slider.evaluate(el => { el.value="70000"; el.dispatchEvent(new Event("input",{bubbles:true})); });
  await resultViews.getByRole("tab", {name:"Emissions"}).click();
  await expect(page.locator('[data-role="ya-env-kpis"]')).toContainText("Controlled timeout");
  await resultViews.getByRole("tab", {name:"Costs"}).click();
  await expect(page.locator('[data-panel="costs"]')).toContainText("CHF");
});

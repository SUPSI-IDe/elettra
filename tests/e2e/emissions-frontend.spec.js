import { expect, test } from "@playwright/test";

test("the distance slider keeps the saved distance until a deliberate change and reset restores it", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const distance = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-distance.js"
    );
    const baseDistance = 54_139.184;
    const bounds = distance.buildYearlyDistanceSliderBounds(baseDistance);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(bounds.min);
    input.max = String(bounds.max);
    input.step = String(bounds.step);
    input.setAttribute("aria-label", "Annual distance");
    const output = document.createElement("output");
    output.setAttribute("for", "annual-distance");
    let override = null;

    const sync = () => {
      const selected = distance.resolveYearlyDistanceKm(override, baseDistance);
      input.value = String(selected);
      output.value = String(selected);
    };
    input.addEventListener("input", () => {
      override = distance.parseYearlyDistanceKm(input.value);
      sync();
    });

    const initial = document.createElement("span");
    initial.dataset.role = "initial";
    sync();
    initial.textContent = `${input.value}|${output.value}|${input.min}`;

    input.dispatchEvent(new Event("input"));
    const firstTouch = document.createElement("span");
    firstTouch.dataset.role = "first-touch";
    firstTouch.textContent = `${input.value}|${output.value}`;

    input.value = "30000";
    input.dispatchEvent(new Event("input"));
    const deliberate = document.createElement("span");
    deliberate.dataset.role = "deliberate";
    deliberate.textContent = `${input.value}|${output.value}`;

    override = null;
    sync();
    const reset = document.createElement("span");
    reset.dataset.role = "reset";
    reset.textContent = `${input.value}|${output.value}`;
    document.body.replaceChildren(input, output, initial, firstTouch, deliberate, reset);
  });

  await expect(page.locator('[data-role="initial"]')).toHaveText(/54139\|54139\.184\|30000/);
  await expect(page.locator('[data-role="first-touch"]')).toHaveText("54139|54139");
  await expect(page.locator('[data-role="deliberate"]')).toHaveText("30000|30000");
  await expect(page.locator('[data-role="reset"]')).toHaveText(/54139\|54139\.184/);
});

test("legacy default heating is presented as heat pump in the browser", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const module = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
    );
    const output = document.createElement("output");
    output.setAttribute("aria-label", "Heating type");
    output.value = module.heatingLabel("default");
    output.textContent = output.value;
    document.body.replaceChildren(output);
  });
  await expect(page.getByLabel("Heating type")).toHaveText("Heat pump");
});

test("analysis comparison renders CO2 tonnes and per-kilometre units correctly", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const module = await import(
      "/elettra/src/pages/Simulation/AnalysisComparison/analysis-comparison.js"
    );
    const makeInput = (name, co2Total) => ({
      analysis: { id: name, name },
      features: {
        config: { mode: "battery_only" },
        meta: { shiftNames: ["L5_08-20"] },
        results: {
          yearlyTotals: {
            totalEnergyKwh: 59_000,
            drivetrainEnergyKwh: 41_000,
            auxiliaryEnergyKwh: 18_000,
            distanceKm: 54_139.184,
          },
          scenarioResults: [],
        },
      },
      emissionsStatus: "ready",
      emissions: {
        ebus: {
          indicators: {
            gwp100a: { total: co2Total, unit: "g CO2-eq" },
            nox: { total: 5_000_000, unit: "mg NO2-eq" },
            pm10: { total: 700_000, unit: "mg PM10" },
            primaryEnergy: { total: 630_000, unit: "MJ" },
          },
        },
        dieselComparator: { indicators: {} },
        dataCompleteness: { status: "complete" },
      },
    });

    const modelA = module.buildModel(makeInput("HP", 7_672_736.1152));
    const modelB = module.buildModel(makeInput("Diesel heating", 8_159_874.3384));
    const host = document.createElement("main");
    host.innerHTML = `
      <div data-role="panel-overview"></div>
      <div data-role="panel-efficiency"></div>
      <div data-role="panel-cost"></div>
      <div data-role="panel-emissions"></div>
      <div data-role="panel-details"></div>
    `;
    document.body.replaceChildren(host);
    module.renderPanels(host, modelA, modelB);
    host.dataset.co2TotalA = String(modelA.emissions.co2TotalTons);
    host.dataset.co2PerKmA = String(modelA.emissions.co2PerKm);
  });

  const host = page.locator("main");
  await expect(host).toHaveAttribute("data-co2-total-a", "7.6727361152");
  await expect(host).toHaveAttribute("data-co2-per-km-a", /141\.7224/);
  const emissionsPanel = page.locator('[data-role="panel-emissions"]');
  await expect(emissionsPanel).toContainText("g/km");
  await expect(emissionsPanel).not.toContainText("kg/km");
  await expect(emissionsPanel).toContainText("GJ/year");
  await expect(emissionsPanel).toContainText("kg/year");
  await expect(emissionsPanel).not.toContainText("7’672.7 t");
});

test("yearly emissions shows the diesel-heater label and primary-energy chart", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const module = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
    );
    const host = document.createElement("main");
    host.innerHTML = `
      <div data-panel="emissions">
        <div data-role="ya-env-controls"></div>
        <div class="ya-env-chart-grid">
          <div class="ya-env-chart-section">
            <h3 class="ya-res-section-title">Emissions saved</h3>
            <div data-role="ya-env-histogram"></div>
            <div data-role="ya-env-histogram-legend"></div>
          </div>
          <div class="ya-env-chart-section">
            <h3 class="ya-res-section-title">CO2</h3>
            <div data-role="ya-env-co2-phase"></div>
            <div data-role="ya-env-co2-phase-legend"></div>
          </div>
        </div>
        <div data-role="ya-env-kpis"></div>
        <details class="ya-more-information" open>
          <div data-role="ya-env-header"></div>
          <div data-role="ya-env-table"></div>
          <div data-role="ya-env-primary-energy-section" hidden>
            <h3>Primary energy</h3>
            <div data-role="ya-env-primary-energy"></div>
            <div data-role="ya-env-primary-energy-legend"></div>
          </div>
          <div data-role="ya-env-methodology"></div>
        </details>
      </div>
    `;
    document.body.replaceChildren(host);

    const phases = {
      direct: 460_000,
      directNonExhaust: 0,
      energyChain: 3_820_000,
      maintenance: 370_000,
      vehicle: 2_130_000,
      endOfLife: 140_000,
      infrastructure: 1_239_874.3384,
    };
    const state = {
      status: "done",
      isDieselHeating: true,
      yearlyDistanceKm: 54_139.184,
      yearlyImpact: { yearly_distance_km: 54_139.184 },
      electricYearly: {
        gwp100a: { unit: "g CO2-eq", total: 8_159_874.3384, ...phases },
        nox: { unit: "mg NO2-eq", total: 5_773_875 },
        pm10: { unit: "mg PM10", total: 733_401 },
        primaryEnergy: { unit: "MJ", total: 632_000 },
        primaryEnergyNonRenewable: { unit: "MJ", total: 181_000 },
      },
      dieselYearly: {
        gwp100a: { unit: "g CO2-eq", total: 77_538_463.587, ...phases },
        nox: { unit: "mg NO2-eq", total: 114_962_400 },
        pm10: { unit: "mg PM10", total: 2_446_000 },
        primaryEnergy: { unit: "MJ", total: 670_000 },
        primaryEnergyNonRenewable: { unit: "MJ", total: 645_000 },
      },
      structured: {
        assumptions: {
          auxiliary_heating_type: "diesel",
          yearly_diesel_heating_liters: 187.565,
          yearly_distance_km: 54_139.184,
        },
        dataCompleteness: { status: "complete" },
        indicators: [
          { key: "gwp100a", unit: "g", display_unit: "t/year", ebus_total: 8_159_874.3384, diesel_comparator: 77_538_463.587, normalized_ebus_per_km: 150.72, normalized_diesel_per_km: 1432.21, normalized_unit: "g/km" },
          { key: "nox", unit: "mg", display_unit: "kg/year", ebus_total: 5_773_875, diesel_comparator: 114_962_400, normalized_ebus_per_km: 106.65, normalized_diesel_per_km: 2123.47, normalized_unit: "mg/km" },
          { key: "pm10", unit: "mg", display_unit: "kg/year", ebus_total: 733_401, diesel_comparator: 2_446_000, normalized_ebus_per_km: 13.55, normalized_diesel_per_km: 45.18, normalized_unit: "mg/km" },
        ],
        savings: {
          items: [
            { key: "gwp100a", unit: "t/year", ebus_display: 8.159874, diesel_display: 77.538464, saved_display: 69.37859, saved_percent: 89.48 },
            { key: "nox", unit: "kg/year", ebus_display: 5.773875, diesel_display: 114.9624, saved_display: 109.188525, saved_percent: 94.98 },
            { key: "pm10", unit: "kg/year", ebus_display: 0.733401, diesel_display: 2.446, saved_display: 1.712599, saved_percent: 70.02 },
          ],
        },
        lifecycleBreakdown: {
          unit: "g CO2-eq/year",
          ebus: { phases, total: 8_159_874.3384 },
          diesel_comparator: { phases, total: 77_538_463.587 },
        },
        primaryEnergyBreakdown: {
          unit: "MJ/year",
          display_unit: "GJ/year",
          ebus: { renewable: 451_000, non_renewable: 181_000, total: 632_000 },
          diesel_comparator: { renewable: 25_000, non_renewable: 645_000, total: 670_000 },
        },
      },
    };
    module.renderEmissionsPanel(host.querySelector('[data-panel="emissions"]'), state);
  });

  const kpis = page.locator('[data-role="ya-env-kpis"]');
  await expect(kpis).toContainText("E-bus (diesel heating)");
  const primarySection = page.locator('[data-role="ya-env-primary-energy-section"]');
  await expect(primarySection).toBeVisible();
  await expect(primarySection.locator("svg")).toHaveCount(1);
  await expect(primarySection).toContainText("Renewable");
  await expect(primarySection).toContainText("Non-renewable");
});

test("the browser export uses the explicit version 2 emissions schema", async ({
  page,
}) => {
  await page.goto("./");
  const exported = await page.evaluate(async () => {
    const emissionsModule = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-emissions.js"
    );
    const resultsModule = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
    );
    const state = {
      status: "done",
      isDieselHeating: true,
      baseYearlyDistanceKm: 54_139.184,
      yearlyDistanceKm: 30_000,
      electricYearly: {
        gwp100a: { total: 4_521_600, unit: "g" },
        primaryEnergy: { total: 350_000, unit: "MJ" },
        primaryEnergyNonRenewable: { total: 100_000, unit: "MJ" },
      },
      electricOnlyYearly: { gwp100a: { total: 4_209_600, unit: "g" } },
      dieselHeatingYearly: { gwp100a: { total: 312_000, unit: "g" } },
      dieselYearly: { gwp100a: { total: 42_966_200, unit: "g" } },
      structured: {
        primaryEnergyBreakdown: {
          unit: "MJ/year",
          ebus: { renewable: 250_000, non_renewable: 100_000, total: 350_000 },
          diesel_comparator: { renewable: 10_000, non_renewable: 350_000, total: 360_000 },
        },
      },
    };
    const emissions = emissionsModule.buildYearlyEmissionsExport(state, {
      auxiliaryHeatingType: "diesel",
    });
    const payload = resultsModule.buildExportPayload(
      {
        config: { auxiliary_heating_type: "diesel" },
        meta: { shiftNames: ["L5_08-20"] },
        results: {},
      },
      { summary: null, enriched: [] },
      { status: "idle", costsData: null },
      state,
      {},
      "diesel-case",
    );
    const hpPayload = resultsModule.buildExportPayload(
      {
        config: { auxiliary_heating_type: "default" },
        meta: { shiftNames: ["L5_08-20"] },
        results: {},
      },
      { summary: null, enriched: [] },
      { status: "idle", costsData: null },
      { ...state, isDieselHeating: false },
      {},
      "hp-case",
    );
    return { emissions, payload, hpPayload };
  });

  expect(exported.emissions.schemaVersion).toBe(2);
  expect(exported.emissions.distance.overrideApplied).toBe(true);
  expect(exported.emissions.indicators.gwp100a.ebus.components.electricSide.total).toBe(4.21);
  expect(exported.emissions.indicators.gwp100a.ebus.components.dieselHeating.total).toBe(0.312);
  expect(exported.emissions.indicators.gwp100a.electric).toBeUndefined();
  expect(exported.emissions.indicators.gwp100a.diesel).toBeUndefined();
  expect(exported.payload.header.heating).toBe("diesel");
  expect(exported.payload.emissions.schemaVersion).toBe(2);
  expect(exported.payload.emissions.distance.selectedYearlyDistance_km).toBe(30_000);
  expect(exported.hpPayload.header.heating).toBe("heat_pump");
  expect(exported.hpPayload.emissions.auxiliaryHeatingType).toBe("heat_pump");
});

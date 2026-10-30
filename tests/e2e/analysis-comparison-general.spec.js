import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const html = readFileSync(
  new URL(
    "../../src/pages/Simulation/AnalysisComparison/analysis-comparison.html",
    import.meta.url,
  ),
  "utf8",
);
const lcaFixture = JSON.parse(
  readFileSync(new URL("../fixtures/grid94-lca.json", import.meta.url), "utf8"),
).base;

const scenario = (label, energy, distance) => ({
  label,
  temperature: -5,
  occurrences: 365,
  kpis: {
    totalEnergyKwh: energy,
    drivetrainEnergyKwh: energy * 0.75,
    auxiliaryEnergyKwh: energy * 0.25,
    distanceKm: distance,
  },
});

const analysis = ({
  id,
  shiftSuffix,
  packs,
  energy,
  distance,
  slots,
  powerPerSlotKw,
}) => ({
  id,
  name: `Analysis ${id.toUpperCase()}`,
  created_at: "2026-10-20T08:00:00Z",
  features: {
    config: {
      mode: "joint",
      bus_model_id: "bus-1",
      shift_ids: ["morning", "evening"],
      min_soc: 0.2,
      max_soc: 0.9,
      fixedConfiguration: {
        mode: "joint",
        busModelId: "bus-1",
        shiftIds: ["morning", "evening"],
        fleet: {
          dataAvailable: true,
          source: "optimization_per_bus_summary",
          vehicleCount: 2,
          vehicleCountByShift: { morning: 1, evening: 1 },
          issue: null,
        },
        soc: { minFraction: 0.2, maxFraction: 0.9 },
        battery: {
          decision: "optimized",
          packs,
          packSizeKwh: 50,
          nominalKwh: packs * 50,
        },
        infrastructure: {
          decision: "optimized",
          dataAvailable: true,
          resultAvailable: true,
          totalInstallationCostChf: slots * 100000,
          stations: [{
            stopId: "depot",
            stopName: "Depot",
            status: "installed",
            selected: true,
            slots,
            powerPerSlotKw,
            totalPowerKw: slots * powerPerSlotKw,
          }],
        },
        shifts: [
          { shiftId: "morning", shiftName: `Morning ${shiftSuffix}` },
          { shiftId: "evening", shiftName: `Evening ${shiftSuffix}` },
        ],
      },
    },
    scenarios: [{
      scenarioId: "cold",
      label: "Cold",
      temperature: -5,
      occurrences: 365,
    }],
    meta: {
      busModelName: "Reference bus",
      shiftNames: [`Morning ${shiftSuffix}`, `Evening ${shiftSuffix}`],
      shifts: [
        { shiftId: "morning", shiftName: `Morning ${shiftSuffix}` },
        { shiftId: "evening", shiftName: `Evening ${shiftSuffix}` },
      ],
    },
    results: {
      status: "completed",
      optimizedPacks: packs,
      yearlyTotals: {
        totalEnergyKwh: energy * 365,
        drivetrainEnergyKwh: energy * 0.75 * 365,
        auxiliaryEnergyKwh: energy * 0.25 * 365,
        distanceKm: distance * 365,
      },
      scenarioResults: [scenario("General cold", energy, distance)],
      shiftResults: [
        {
          shiftId: "morning",
          shiftName: `Morning ${shiftSuffix}`,
          yearlyTotals: { totalEnergyKwh: 9_999_999, distanceKm: 8_888_888 },
          scenarioResults: [scenario("Morning detail", 9999, 8888)],
        },
        {
          shiftId: "evening",
          shiftName: `Evening ${shiftSuffix}`,
          yearlyTotals: { totalEnergyKwh: 7_777_777, distanceKm: 6_666_666 },
          scenarioResults: [scenario("Evening detail", 7777, 6666)],
        },
      ],
    },
  },
});

const analysisA = analysis({
  id: "a",
  shiftSuffix: "A",
  packs: 12,
  energy: 150,
  distance: 100,
  slots: 2,
  powerPerSlotKw: 150,
});
const analysisB = analysis({
  id: "b",
  shiftSuffix: "B",
  packs: 14,
  energy: 170,
  distance: 100,
  slots: 3,
  powerPerSlotKw: 180,
});

const busModel = {
  id: "bus-1",
  name: "Reference bus",
  specs: {
    bus_length_m: 12,
    battery_pack_size_kwh: 50,
    battery_pack_cost_chf: 10000,
    cost: 400000,
    bus_lifetime: 12,
    battery_pack_lifetime: 8,
  },
};

test("the comparison model uses only General totals and shared configuration", async ({ page }) => {
  await page.goto("./");
  const model = await page.evaluate(async ({ sourceAnalysis, sourceBus }) => {
    const module = await import(
      "/elettra/src/pages/Simulation/AnalysisComparison/analysis-comparison.js"
    );
    const parsedBus = module.parseBusModelSpecs
      ? module.parseBusModelSpecs(sourceBus)
      : {
          name: sourceBus.name,
          battery_pack_size_kwh: sourceBus.specs.battery_pack_size_kwh,
        };
    const result = module.buildModel({
      analysis: sourceAnalysis,
      features: sourceAnalysis.features,
      busModelName: sourceBus.name,
      busModelData: parsedBus,
    });
    const host = document.createElement("main");
    host.innerHTML = `
      <div data-role="panel-overview"></div>
      <div data-role="panel-efficiency"></div>
      <div data-role="panel-cost"></div>
      <div data-role="panel-emissions"></div>
      <div data-role="panel-details"></div>
    `;
    document.body.replaceChildren(host);
    module.renderPanels(host, result, result);
    return result;
  }, { sourceAnalysis: analysisA, sourceBus: busModel });

  expect(model).toMatchObject({
    scope: "general",
    shiftIds: ["morning", "evening"],
    shiftCount: 2,
    scenarioCount: 1,
    efficiency: {
      totalEnergyKwh: 54750,
      drivetrainEnergyKwh: 41062.5,
      auxiliaryEnergyKwh: 13687.5,
      energyPerKm: 1.5,
    },
    configuration: {
      soc: { minFraction: 0.2, maxFraction: 0.9 },
      battery: { packs: 12, nominalKwh: 600 },
      infrastructure: {
        available: true,
        chargingLocations: 1,
        installedSlots: 2,
        totalPowerKw: 300,
        installationCostChf: 200000,
      },
    },
  });
  expect(model).not.toHaveProperty("shiftResults");
  const overview = page.locator('[data-role="panel-overview"]');
  await expect(overview).toContainText("Common configuration");
  await expect(overview).toContainText("600.0 kWh");
  await expect(overview).toContainText("300 kW");
  await expect(overview).not.toContainText("9’999’999");
  await expect(overview).not.toContainText("7’777’777");
});

test("General configuration remains explicit for fixed and historical analyses", async ({ page }) => {
  await page.goto("./");
  const models = await page.evaluate(async ({ current, sourceBus }) => {
    const module = await import(
      "/elettra/src/pages/Simulation/AnalysisComparison/analysis-comparison.js"
    );
    const busModelData = {
      name: sourceBus.name,
      battery_pack_size_kwh: sourceBus.specs.battery_pack_size_kwh,
    };
    const batteryOnly = structuredClone(current);
    batteryOnly.id = "battery-only";
    batteryOnly.features.config.mode = "battery_only";
    batteryOnly.features.config.fixedConfiguration.mode = "battery_only";
    batteryOnly.features.config.fixedConfiguration.infrastructure.decision = "fixed";
    batteryOnly.features.config.fixedConfiguration.infrastructure.resultAvailable = false;

    const legacy = {
      id: "legacy",
      name: "Legacy analysis",
      features: {
        config: {
          mode: "battery_only",
          bus_model_id: "bus-1",
          min_soc: 0.15,
          max_soc: 0.85,
        },
        meta: {
          busModelName: sourceBus.name,
          shiftNames: ["Legacy shift"],
        },
        results: {
          optimizedPacks: 8,
          yearlyTotals: { totalEnergyKwh: 1000, distanceKm: 500 },
          scenarioResults: [],
        },
      },
    };

    return {
      batteryOnly: module.buildModel({
        analysis: batteryOnly,
        features: batteryOnly.features,
        busModelData,
      }),
      legacy: module.buildModel({
        analysis: legacy,
        features: legacy.features,
        busModelData,
      }),
    };
  }, { current: analysisA, sourceBus: busModel });

  expect(models.batteryOnly.configuration.infrastructure).toMatchObject({
    available: true,
    decision: "fixed",
    chargingLocations: 1,
    installedSlots: 2,
    totalPowerKw: 300,
  });
  expect(models.legacy).toMatchObject({
    scope: "general",
    shiftNames: ["Legacy shift"],
    shiftCount: 1,
    configuration: {
      soc: { minFraction: 0.15, maxFraction: 0.85 },
      battery: { decision: "optimized", packs: 8, nominalKwh: 400 },
      infrastructure: {
        available: false,
        chargingLocations: null,
        installedSlots: null,
        totalPowerKw: null,
      },
    },
  });
});

test("the annual comparison UI stays on General and exports that scope", async ({ page }) => {
  const requests = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);
    const path = url.pathname;
    if (path.endsWith("/yearly-analysis/")) {
      await route.fulfill({ json: {
        items: [
          { id: "a", name: analysisA.name, created_at: analysisA.created_at },
          { id: "b", name: analysisB.name, created_at: analysisB.created_at },
        ],
        total: 2,
        skip: 0,
        limit: 100,
        count: 2,
        has_next: false,
        has_previous: false,
      } });
    } else if (path.endsWith("/yearly-analysis/a/costs") || path.endsWith("/yearly-analysis/b/costs")) {
      await route.fulfill({ status: 503, json: { detail: "Use local cost calculation" } });
    } else if (path.endsWith("/yearly-analysis/a/lca") || path.endsWith("/yearly-analysis/b/lca")) {
      await route.fulfill({ json: lcaFixture });
    } else if (path.endsWith("/yearly-analysis/a")) {
      await route.fulfill({ json: analysisA });
    } else if (path.endsWith("/yearly-analysis/b")) {
      await route.fulfill({ json: analysisB });
    } else if (path.endsWith("/user/bus-models/bus-1")) {
      await route.fulfill({ json: busModel });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.goto("./");
  await page.evaluate(async ({ source }) => {
    localStorage.setItem("access_token", "fixture-token");
    localStorage.setItem("elettra_lang", "en");
    const module = await import(
      "/elettra/src/pages/Simulation/AnalysisComparison/analysis-comparison.js"
    );
    document.body.innerHTML = source;
    module.initializeAnalysisComparison(document, { analysisA: "a", analysisB: "b" });
  }, { source: html });

  const comparison = page.locator('[data-role="comparison"]');
  await expect(comparison).toBeVisible();
  const scope = page.locator('[data-role="comparison-scope"]');
  await expect(scope).toHaveAttribute("data-scope", "general");
  await expect(scope).toContainText("General");
  await expect(scope).toContainText("Results for individual vehicle blocks are not compared");
  await expect(page.getByRole("tab")).toHaveText([
    "Overview",
    "Efficiency",
    "Cost",
    "Emissions",
    "Details / Export",
  ]);
  await expect(page.locator('[data-scope-key^="shift:"]')).toHaveCount(0);
  await expect(page.locator('[data-role="panel-overview"]')).toContainText("600.0 kWh");
  await expect(page.locator('[data-role="panel-overview"]')).toContainText("700.0 kWh");
  await expect(page.locator('[data-role="compatibility"]')).toContainText("Compatible");

  await page.getByRole("tab", { name: "Efficiency" }).click();
  const efficiencyPanel = page.locator('[data-role="panel-efficiency"]');
  await expect(efficiencyPanel).toContainText(/54['’]750 kWh/);
  await expect(efficiencyPanel).toContainText(/62['’]050 kWh/);
  await expect(efficiencyPanel).not.toContainText(/9['’]999['’]999/);

  const jsonPromise = page.waitForEvent("download");
  await page.locator('[data-action="export-json"]').last().click();
  const jsonDownload = await jsonPromise;
  const exportedJson = JSON.parse(readFileSync(await jsonDownload.path(), "utf8"));
  expect(exportedJson.scope).toBe("general");
  expect(exportedJson.analysisA.scope).toBe("general");
  expect(exportedJson.analysisB.scope).toBe("general");
  expect(exportedJson.analysisA.efficiency.totalEnergyKwh).toBe(54750);
  expect(exportedJson.analysisA.configuration.battery.packs).toBe(12);
  expect(exportedJson.analysisA.cost.capitalScope).toMatchObject({
    scope: "general",
    vehicleCount: 2,
    includedInfrastructureChf: 200000,
    infrastructureLifetimeYears: 15,
    electricVehicleAndBatteryCapexChf: 1040000,
    electricInitialCapexChf: 1240000,
    dieselVehicleCapexChf: 700000,
  });
  expect(exportedJson.analysisA.cost.totalAnnualCost).toBeGreaterThan(
    exportedJson.analysisA.cost.energyOpex +
      exportedJson.analysisA.cost.maintenanceOpex,
  );
  expect(exportedJson.analysisA).not.toHaveProperty("shiftResults");

  await page.getByRole("tab", { name: "Details / Export" }).click();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csvDownload = await csvPromise;
  const exportedCsv = readFileSync(await csvDownload.path(), "utf8");
  expect(exportedCsv).toMatch(/^scope,category,/);
  expect(exportedCsv.split("\n").slice(1).every((row) => row.startsWith("general,"))).toBe(true);

  expect(requests.some((url) => url.includes("prediction-runs"))).toBe(false);
  expect(requests.some((url) => url.includes("shift_id"))).toBe(false);
});

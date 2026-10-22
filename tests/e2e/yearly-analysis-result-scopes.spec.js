import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const html = readFileSync(
  new URL("../../src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.html", import.meta.url),
  "utf8",
);
const lcaFixture = JSON.parse(
  readFileSync(new URL("../fixtures/grid94-lca.json", import.meta.url), "utf8"),
).base;

const sumObjects = (left, right) => Object.fromEntries(
  Object.keys(left).map((key) => [key, left[key] + right[key]]),
);

const scaledVehicle = (vehicle, shiftId, factor) => {
  const copy = structuredClone(vehicle);
  copy.shift_id = shiftId;
  copy.annual_km *= factor;
  copy.dc_kwh *= factor;
  copy.diesel_heating_liters *= factor;
  for (const indicator of Object.values(copy.indicators)) {
    for (const field of [
      "electricity_operation",
      "diesel_heating",
      "other_lifecycle",
      "total",
      "diesel_comparator_total",
    ]) indicator[field] *= factor;
    for (const phaseField of [
      "phases",
      "diesel_comparator_phases",
      "diesel_heating_phases",
    ]) {
      indicator[phaseField] = Object.fromEntries(
        Object.entries(indicator[phaseField]).map(([key, value]) => [key, value * factor]),
      );
    }
  }
  return copy;
};

const multiShiftLca = () => {
  const morning = scaledVehicle(lcaFixture.vehicles[0], "morning", 1);
  const evening = scaledVehicle(lcaFixture.vehicles[0], "evening", 0.5);
  const indicators = {};
  for (const key of Object.keys(lcaFixture.indicators)) {
    const first = morning.indicators[key];
    const second = evening.indicators[key];
    indicators[key] = {
      ...first,
      electricity_operation: first.electricity_operation + second.electricity_operation,
      diesel_heating: first.diesel_heating + second.diesel_heating,
      other_lifecycle: first.other_lifecycle + second.other_lifecycle,
      total: first.total + second.total,
      diesel_comparator_total: first.diesel_comparator_total + second.diesel_comparator_total,
      phases: sumObjects(first.phases, second.phases),
      diesel_comparator_phases: sumObjects(first.diesel_comparator_phases, second.diesel_comparator_phases),
      diesel_heating_phases: sumObjects(first.diesel_heating_phases, second.diesel_heating_phases),
    };
  }
  const dcKwh = morning.dc_kwh + evening.dc_kwh;
  return {
    ...structuredClone(lcaFixture),
    annual_km: morning.annual_km + evening.annual_km,
    vehicle_count: 2,
    vehicles: [morning, evening],
    energy_boundary: {
      ...lcaFixture.energy_boundary,
      dc_kwh: dcKwh,
      grid_kwh: dcKwh / 0.94,
      charging_losses_kwh: dcKwh / 0.94 - dcKwh,
    },
    indicators,
  };
};

const scenario = (id, label, energy, distance) => ({
  scenarioId: id,
  label,
  temperature: -5,
  occurrences: 365,
  kpis: {
    totalEnergyKwh: energy,
    drivetrainEnergyKwh: energy * 0.75,
    auxiliaryEnergyKwh: energy * 0.25,
    distanceKm: distance,
    energyPerKm: energy / distance,
    quantiles: { q05: energy * 0.9, q50: energy, q95: energy * 1.1 },
    consumptionPerKmQuantiles: {
      q05: energy * 0.9 / distance,
      q50: energy / distance,
      q95: energy * 1.1 / distance,
    },
  },
});

const predictionRun = ({ id, shiftId, temperature, energy, distance, status = "completed" }) => ({
  id,
  shift_id: shiftId,
  bus_model_id: "bus-1",
  external_temp_celsius: temperature,
  status,
  summary: {
    total_consumption_kwh: energy,
    total_drivetrain_kwh: energy * 0.75,
    total_auxiliary_kwh: energy * 0.25,
    total_distance_km: distance,
    consumption_per_km_kwh: energy / distance,
    drivetrain_per_km_kwh: energy * 0.75 / distance,
    auxiliary_per_km_kwh: energy * 0.25 / distance,
    quantiles: { q05: energy * 0.9, q50: energy, q95: energy * 1.1 },
    consumption_per_km_kwh_quantiles: {
      q05: energy * 0.9 / distance,
      q50: energy / distance,
      q95: energy * 1.1 / distance,
    },
  },
});

const sourceFeasibilityRun = {
  id: "source-feasibility",
  input_params: {
    mode: "joint",
    bus_model_id: "bus-1",
    shift_ids: ["morning", "evening"],
    min_soc: 0.2,
    max_soc: 0.9,
    charging_stations: [{
      stop_id: "depot",
      stop_name: "Depot",
      num_slots: 3,
      max_power_per_slot_kw: 150,
    }],
  },
  results: {
    battery_results: {
      morning: {
        optimized_packs: 8,
        optimized_kwh: 400,
        required_total_packs: 8,
      },
      evening: {
        optimized_packs: 12,
        optimized_kwh: 600,
        required_total_packs: 10,
      },
    },
    installed_chargers: {
      depot: {
        stop_name: "Depot",
        num_slots: 2,
        max_power_per_slot_kw: 150,
      },
    },
    per_bus_summary: [
      { shift_id: "morning", charging_sessions: [] },
      { shift_id: "evening", charging_sessions: [] },
    ],
  },
};

const multishiftAnalysis = {
  id: "case",
  name: "Two-shift annual analysis",
  features: {
    config: {
      mode: "joint",
      bus_model_id: "bus-1",
      shift_ids: ["morning", "evening"],
      min_soc: 0.2,
      max_soc: 0.9,
      occupancy_percent: 60,
      auxiliary_heating_type: "default",
      fixedConfiguration: {
        fixed: true,
        mode: "joint",
        busModelId: "bus-1",
        shiftIds: ["morning", "evening"],
        soc: { minFraction: 0.2, maxFraction: 0.9 },
        battery: {
          decision: "optimized",
          packs: 12,
          packSizeKwh: 50,
          nominalKwh: 600,
          sizingShiftNames: ["Evening service"],
        },
        infrastructure: {
          scope: "shared",
          decision: "optimized",
          totalInstallationCostChf: 250000,
          stations: [{
            stopId: "depot",
            stopName: "Depot",
            status: "installed",
            selected: true,
            slots: 2,
            powerPerSlotKw: 150,
            totalPowerKw: 300,
          }],
        },
        shifts: [
          {
            shiftId: "morning",
            shiftName: "Morning service",
            battery: { requiredPacks: 8, commonPacks: 12, commonPackMargin: 4 },
            operation: {
              minSocKwh: 100,
              maxSocKwh: 450,
              totalChargedKwh: 75,
              chargingSessions: [{
                startMinute: 60,
                endMinute: 90,
                durationMinutes: 30,
                stationStopId: "depot",
                stationName: "Depot",
                energyKwh: 75,
              }],
            },
          },
          {
            shiftId: "evening",
            shiftName: "Evening service",
            battery: { requiredPacks: 10, commonPacks: 12, commonPackMargin: 2 },
            operation: { chargingSessions: [] },
          },
        ],
      },
    },
    meta: {
      modeLabel: "Joint optimization",
      shiftNames: ["Morning service", "Evening service"],
      sizingTemp: -5,
    },
    results: {
      status: "completed",
      optimizedPacks: 12,
      baseFeasible: true,
      yearlyTotals: {
        totalEnergyKwh: 54750,
        drivetrainEnergyKwh: 41062.5,
        auxiliaryEnergyKwh: 13687.5,
        distanceKm: 36500,
      },
      scenarioResults: [scenario("general-cold", "Cold aggregate", 150, 100)],
      shiftResults: [
        {
          shiftId: "morning",
          shiftName: "Morning service",
          status: "completed",
          nominalDailyDistanceKm: 60,
          yearlyTotals: {
            totalEnergyKwh: 36500,
            drivetrainEnergyKwh: 27375,
            auxiliaryEnergyKwh: 9125,
            distanceKm: 21900,
          },
          scenarioResults: [scenario("morning-cold", "Cold morning", 100, 60)],
        },
        {
          shiftId: "evening",
          shiftName: "Evening service",
          status: "completed",
          nominalDailyDistanceKm: 40,
          yearlyTotals: {
            totalEnergyKwh: 18250,
            drivetrainEnergyKwh: 13687.5,
            auxiliaryEnergyKwh: 4562.5,
            distanceKm: 14600,
          },
          scenarioResults: [scenario("evening-cold", "Cold evening", 50, 40)],
        },
      ],
    },
  },
};

const mountResults = async (
  page,
  analysis,
  { predictionRuns = [], optimizationRun = null } = {},
) => {
  const configuredShiftCount = analysis.features?.config?.shift_ids?.length ?? 0;
  const lca = analysis.features?.results?.shiftResults || configuredShiftCount > 1
    ? multiShiftLca()
    : lcaFixture;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith(`/yearly-analysis/${analysis.id}/lca`)) {
      await route.fulfill({ json: lca });
    } else if (path.endsWith(`/yearly-analysis/${analysis.id}/costs`)) {
      await route.fulfill({ status: 503, json: { detail: "Use deterministic local costs" } });
    } else if (path.endsWith(`/yearly-analysis/${analysis.id}`)) {
      await route.fulfill({ json: analysis });
    } else if (path.endsWith("/simulation/prediction-runs/")) {
      await route.fulfill({ json: predictionRuns });
    } else if (
      optimizationRun &&
      path.endsWith(`/simulation/optimization-runs/${optimizationRun.id}`)
    ) {
      await route.fulfill({ json: optimizationRun });
    } else if (path.endsWith("/user/bus-models/bus-1")) {
      await route.fulfill({ json: {
        id: "bus-1",
        name: "Reference bus",
        specs: {
          bus_length_m: 12,
          battery_pack_size_kwh: 50,
          bus_lifetime: 12,
          battery_pack_lifetime: 8,
          cost: 400000,
        },
      } });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.goto("./");
  await page.evaluate(async ({ source, analysisId }) => {
    localStorage.setItem("access_token", "fixture-token");
    localStorage.setItem("elettra_lang", "en");
    const module = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
    );
    document.body.innerHTML = source;
    await module.initializeYearlyAnalysisResults(document, { analysisId });
  }, { source: html, analysisId: analysis.id });
};

const downloadAllResults = async (page) => {
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-action="download-json"]').click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  return {
    download,
    exported: JSON.parse(readFileSync(downloadedPath, "utf8")),
  };
};

test("yearly results use General and one primary tab per shift", async ({ page }) => {
  await mountResults(page, multishiftAnalysis);

  await expect(page.locator('[data-role="page-title"]')).toHaveText(
    "Yearly analysis results - Two-shift annual analysis",
  );
  await expect(page.locator(".ya-results-toolbar")).toHaveCount(0);
  const configurationAction = page.getByRole("button", { name: "View configuration data" });
  await expect(configurationAction).toBeVisible();
  await configurationAction.click();
  const configurationOverlay = page.locator('[data-role="ya-config-overlay"]');
  await expect(configurationOverlay).toBeVisible();
  await configurationOverlay.getByRole("button", { name: "Close" }).click();
  await expect(configurationOverlay).toBeHidden();

  const scopeTablist = page.locator('[data-role="ya-result-scope-tabs"]');
  const tabs = scopeTablist.getByRole("tab");
  const resultViewTablist = page.locator('[data-role="ya-result-view-tabs"]');
  const resultViewTabs = resultViewTablist.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs).toHaveText(["General", "Morning service", "Evening service"]);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".ya-result-scope-select")).toHaveCount(0);

  const content = page.locator("#yearly-result-scope-content");
  await expect(content).toContainText("Deployed configuration");
  await expect(content).toContainText("Common bus configuration");
  await expect(content).toContainText("Shared charging infrastructure");
  await expect(page.locator('[data-panel="overview"]')).toBeVisible();
  const generalLevel = page.locator('[data-role="ya-deployed-configuration"]');
  await expect(generalLevel).toHaveClass(/ya-scope-level--general/);
  await expect(generalLevel.locator(".ya-scope-level__eyebrow")).toHaveText("General result");
  await expect(generalLevel.locator(".ya-scope-level__title")).toHaveText("Deployed configuration");
  await expect(generalLevel.locator(".ya-scope-mode")).toHaveText("Optimization mode: Joint");
  const generalDownload = generalLevel.getByRole("button", { name: "Download all results (JSON)" });
  await expect(generalDownload).toBeVisible();
  const { download, exported } = await downloadAllResults(page);
  expect(download.suggestedFilename()).toMatch(/^yearly-analysis-.*\.json$/);
  expect(exported.schemaVersion).toBe(3);
  expect(exported.general.configuration).toMatchObject({
    mode: "joint",
    shiftIds: ["morning", "evening"],
  });
  expect(exported.shifts.map(({ shiftId }) => shiftId)).toEqual(["morning", "evening"]);
  await expect(generalLevel.locator(".ya-deployed-card")).toHaveCount(5);
  const generalCosts = generalLevel.locator('[data-role="ya-general-costs"]');
  await expect(generalCosts).toBeVisible();
  await expect(generalCosts).toHaveAttribute("data-economic-scope", "general-shared");
  await expect(generalCosts).toContainText("Shared investment costs");
  await expect(generalCosts).toContainText("Shared charging infrastructure investment");
  await expect(generalCosts).toContainText(/CHF 250['’,]000/);
  await expect(generalCosts).toContainText("Allocated by annual DC energy");
  const generalCostTooltip = generalCosts.getByRole("button");
  await expect(generalCostTooltip).toHaveAccessibleName(
    /charging infrastructure, vehicle and battery investments are counted once/i,
  );
  await generalCostTooltip.hover();
  await expect(generalCostTooltip.locator(".ya-info-tooltip")).toBeVisible();
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
  await expect(resultViewTablist).toBeHidden();
  await expect(page.locator('[data-role="overview-panel"] .ya-overview-grid')).toHaveCount(0);

  await tabs.getByText("Morning service", { exact: true }).click();
  await expect(tabs.getByText("Morning service", { exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(resultViewTablist).toBeVisible();
  await expect(resultViewTabs).toHaveCount(3);
  await expect(resultViewTabs).toHaveText(["Efficiency", "Costs", "Emissions"]);
  await expect(resultViewTabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-action="download-json"]')).toHaveCount(0);
  await expect(page.locator('[data-panel="efficiency"]')).toBeVisible();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
  const shiftLevel = page.locator('[data-role="ya-shift-reference"]');
  await expect(shiftLevel).toHaveClass(/ya-scope-level--shift/);
  await expect(shiftLevel.locator(":scope > *")).toHaveCount(1);
  await expect(shiftLevel.locator(".ya-scope-level__eyebrow")).toHaveCount(0);
  await expect(shiftLevel.locator('[data-role="ya-selected-shift"]')).toHaveCount(0);
  await expect(shiftLevel.locator(".ya-scope-status")).toHaveCount(0);
  await expect(shiftLevel).not.toContainText("Shift detail");
  await expect(shiftLevel).not.toContainText("Complete");
  await expect(shiftLevel.locator(".ya-scope-level__subtitle")).toHaveCount(0);
  await expect(shiftLevel).not.toContainText("Energy demand and operating details");
  const yearlySummary = shiftLevel.locator('[data-role="ya-shift-yearly-summary"]');
  await expect(yearlySummary).toContainText("Yearly aggregated summary");
  await expect(yearlySummary.locator("thead")).toHaveCount(0);
  await expect(yearlySummary.locator("tbody tr")).toHaveCount(1);
  await expect(yearlySummary.locator("tbody th")).toHaveText("Yearly aggregated summary");
  await expect(yearlySummary.locator("tbody td span")).toHaveText([
    "Yearly energy:",
    "Yearly simulated distance:",
    "Average yearly efficiency:",
  ]);
  await expect(yearlySummary.locator("tbody td strong")).toHaveText([
    /36['’,]500 kWh/,
    /21['’,]900 km/,
    "1.667 kWh/km",
  ]);
  const compactShiftContext = await shiftLevel.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    summaryFontSize: Number.parseFloat(getComputedStyle(
      element.querySelector('[data-role="ya-shift-yearly-summary"] td'),
    ).fontSize),
  }));
  expect(compactShiftContext.height).toBeLessThan(40);
  expect(compactShiftContext.summaryFontSize).toBeLessThanOrEqual(14);
  const shiftContentOrder = await content.evaluate((element) =>
    Array.from(element.children).map((child) =>
      child.getAttribute("data-role") || child.getAttribute("data-panel")),
  );
  expect(shiftContentOrder.slice(0, 2)).toEqual(["ya-result-view-tabs", "overview"]);
  await expect(shiftLevel).not.toContainText("Common bus configuration");
  await expect(shiftLevel).not.toContainText("Feasibility reference");
  await expect(shiftLevel).not.toContainText("Reference charging plan");
  await expect(shiftLevel).not.toContainText("Charging session 1: Depot");
  await expect(page.locator('[data-role="ya-eff-chart-1-note"]')).toHaveCount(0);
  await expect(page.locator('[data-role="ya-eff-chart-2-note"]')).toHaveCount(0);
  await expect(content).not.toContainText("Cold evening");
  await expect(page.locator('[data-role="ya-cost-scope-note"]')).toBeHidden();
  await expect(page.locator('[data-role="ya-emissions-scope-note"]')).toHaveCount(0);

  await resultViewTabs.getByText("Costs", { exact: true }).click();
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeVisible();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
  await expect(page.locator('[data-role="ya-cost-scope-note"]')).toBeVisible();
  await expect(page.locator('[data-role="ya-cost-scope-note"]')).toContainText(
    "Operating costs use this shift's energy and distance",
  );
  await expect(page.locator('[data-panel="costs"]')).toContainText("Shift costs");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Annual shift OPEX comparison");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Allocated shared CAPEX");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Cumulative cost and break-even");
  const capexAllocation = page.locator('[data-role="ya-costs-capex-section"]');
  await expect(capexAllocation).toHaveAttribute("data-allocation-method", "annual_dc_energy");
  await expect(capexAllocation).toContainText("66.7%");
  await expect(capexAllocation).toContainText("shown in Emissions");
  await expect(capexAllocation.locator(".ya-costs-kpi-card")).toHaveCount(0);
  await expect(capexAllocation.locator(".ya-compact-metrics__table thead tr")).toHaveCount(1);
  await expect(capexAllocation.locator(".ya-compact-metrics__table thead th")).toHaveCount(5);
  await expect(capexAllocation.locator(".ya-compact-metrics__table tbody tr")).toHaveCount(1);
  await expect(capexAllocation.locator(".ya-compact-metrics__table tbody td")).toHaveCount(5);
  await expect(page.locator('[data-role="ya-costs-line-chart"] svg')).toBeVisible();
  await expect(page.locator('[data-role="ya-var-interest"]')).toHaveCount(0);
  await expect(page.locator('[data-role="ya-var-diesel-capex"]')).toHaveCount(0);
  await expect(page.locator('[data-role="ya-costs-bar-legend"]')).not.toContainText("CAPEX");
  await expect(page.locator('[data-panel="costs"]')).not.toContainText("Bus cost");
  await expect(page.locator('[data-panel="costs"]')).not.toContainText("Battery replacement");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Electric yearly OPEX");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Diesel yearly OPEX");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Annual operating saving");
  const shiftCostTooltip = page.locator('[data-panel="costs"] .ya-scope-section-title').getByRole("button");
  await expect(shiftCostTooltip).toHaveAccessibleName(
    /operating costs use this shift's energy and distance/i,
  );
  await shiftCostTooltip.hover();
  await expect(shiftCostTooltip.locator(".ya-info-tooltip")).toBeVisible();

  await resultViewTabs.getByText("Emissions", { exact: true }).click();
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeVisible();
  await expect(page.locator('[data-role="ya-emissions-scope-note"]')).toHaveCount(0);
  await expect(page.locator('[data-panel="emissions"]')).not.toContainText("Shift impacts use");
  await expect(page.locator('[data-role="ya-env-controls"]')).toBeHidden();

  await resultViewTabs.getByText("Emissions", { exact: true }).focus();
  await resultViewTabs.getByText("Emissions", { exact: true }).press("Home");
  await expect(resultViewTabs.getByText("Efficiency", { exact: true })).toBeFocused();
  await expect(page.locator('[data-panel="efficiency"]')).toBeVisible();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();

  await page.getByRole("tab", { name: "Evening service" }).click();
  await expect(page.getByRole("tab", { name: "Evening service" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-role="ya-shift-yearly-summary"] tbody td strong')).toHaveText([
    /18['’,]250 kWh/,
    /14['’,]600 km/,
    "1.250 kWh/km",
  ]);
  await expect(content).not.toContainText("Reference charging plan");

  await page.getByRole("tab", { name: "General" }).click();
  await expect(resultViewTablist).toBeHidden();
  await expect(page.locator('[data-action="download-json"]')).toBeVisible();
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();

  await page.getByRole("tab", { name: "General" }).focus();
  await page.getByRole("tab", { name: "General" }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Morning service" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Morning service" })).toHaveAttribute("aria-selected", "true");
  await expect(resultViewTablist).toBeVisible();
  await expect(page.locator('[data-panel="efficiency"]')).toBeVisible();

  await page.setViewportSize({ width: 320, height: 700 });
  const overflow = await page.locator('[data-role="ya-result-scope-tabs"]').evaluate((element) => ({
    overflowX: getComputedStyle(element).overflowX,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(overflow.overflowX).toBe("auto");
  expect(overflow.bodyScrollWidth).toBe(overflow.bodyClientWidth);
  await expect(resultViewTablist).toHaveCSS("overflow-x", "auto");
  const mobileShiftContext = await shiftLevel.boundingBox();
  expect(mobileShiftContext.height).toBeLessThan(40);
  await expect(yearlySummary.locator(".ya-compact-metrics")).toHaveCSS("overflow-x", "auto");
});

test("historical single-shift results expose General and the configured shift", async ({ page }) => {
  const legacy = {
    id: "legacy",
    name: "Historical annual analysis",
    features: {
      config: {
        mode: "battery_only",
        bus_model_id: "bus-1",
        shift_ids: ["legacy-shift"],
        min_soc: 0.2,
        max_soc: 0.9,
      },
      meta: { shiftNames: ["Legacy shift"], sizingTemp: -5 },
      results: {
        optimizedPacks: 10,
        baseFeasible: true,
        yearlyTotals: { totalEnergyKwh: 36500, distanceKm: 21900 },
        scenarioResults: [scenario("legacy-cold", "Historical cold", 100, 60)],
      },
    },
  };
  await mountResults(page, legacy);
  const scopeTabs = page.locator('[data-role="ya-result-scope-tabs"]').getByRole("tab");
  const resultViewTabs = page.locator('[data-role="ya-result-view-tabs"]').getByRole("tab");
  await expect(scopeTabs).toHaveCount(2);
  await expect(scopeTabs).toHaveText(["General", "Legacy shift"]);
  await expect(page.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  const generalConfiguration = page.locator('[data-role="ya-deployed-configuration"]');
  await expect(generalConfiguration).toBeVisible();
  await expect(generalConfiguration).toContainText("Reference bus");
  await expect(generalConfiguration).toContainText("10 packs");
  await expect(generalConfiguration).toContainText("Legacy shift");
  await expect(generalConfiguration).toContainText(
    "Shared charging infrastructure details are unavailable",
  );
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
  await page.getByRole("tab", { name: "Legacy shift" }).click();
  await expect(page.getByRole("tab", { name: "Legacy shift" })).toHaveAttribute("aria-selected", "true");
  await expect(resultViewTabs).toHaveText(["Efficiency", "Costs", "Emissions"]);
  await expect(page.locator('[data-panel="efficiency"]')).toBeVisible();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
  await expect(page.locator("#yearly-result-scope-content")).toContainText("Historical cold");

  await resultViewTabs.getByText("Costs", { exact: true }).click();
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeVisible();
  await expect(page.locator("#yearly-result-scope-content")).toContainText("Shift costs");

  await resultViewTabs.getByText("Emissions", { exact: true }).click();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeVisible();
  await expect(page.locator("#yearly-result-scope-content")).toContainText("Annual emissions");
});

test("historical General recovers its physical configuration from the source feasibility", async ({ page }) => {
  const legacy = structuredClone(multishiftAnalysis);
  legacy.id = "legacy-source-configuration";
  legacy.optimization_run_id = sourceFeasibilityRun.id;
  delete legacy.features.config.fixedConfiguration;

  await mountResults(page, legacy, { optimizationRun: sourceFeasibilityRun });

  const generalConfiguration = page.locator('[data-role="ya-deployed-configuration"]');
  await expect(generalConfiguration).toBeVisible();
  await expect(generalConfiguration).toContainText("12 packs");
  await expect(generalConfiguration).toContainText("600.0 kWh");
  await expect(generalConfiguration).toContainText("Depot");
  await expect(generalConfiguration).toContainText("2");
  await expect(generalConfiguration).toContainText("300 kW");
  await expect(generalConfiguration).not.toContainText(
    "Shared charging infrastructure details are unavailable",
  );
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
});

test("General keeps fixed battery-only charging infrastructure visible without optimizer output", async ({ page }) => {
  const batteryOnly = structuredClone(multishiftAnalysis);
  batteryOnly.id = "battery-only-fixed-infrastructure";
  batteryOnly.features.config.mode = "battery_only";
  batteryOnly.features.config.fixedConfiguration.mode = "battery_only";
  batteryOnly.features.config.fixedConfiguration.infrastructure = {
    decision: "fixed",
    dataAvailable: true,
    resultAvailable: false,
    stations: [{
      stopId: "depot",
      stopName: "Fixed depot",
      status: "fixed",
      selected: true,
      slots: 3,
      powerPerSlotKw: 150,
      totalPowerKw: 450,
    }],
  };

  await mountResults(page, batteryOnly);

  const generalConfiguration = page.locator('[data-role="ya-deployed-configuration"]');
  await expect(generalConfiguration).toContainText("Fixed depot");
  await expect(generalConfiguration).toContainText("450 kW");
  await expect(generalConfiguration).not.toContainText(
    "Shared charging infrastructure details are unavailable",
  );
});

test("historical multi-shift results are reconstructed by shift ID", async ({ page }) => {
  const legacy = structuredClone(multishiftAnalysis);
  legacy.id = "legacy-multi";
  legacy.name = "Historical two-shift analysis";
  delete legacy.features.config.fixedConfiguration;
  legacy.features.scenarios = [{
    scenarioId: "cold",
    label: "Historical cold",
    temperature: -5,
    occurrences: 365,
  }];
  delete legacy.features.results.shiftResults;
  legacy.features.results.scenarioResults = [
    scenario("aggregate-cold", "Historical cold", 150, 100),
  ];

  const reversedRuns = [
    predictionRun({ id: "evening-cold", shiftId: "evening", temperature: -5, energy: 50, distance: 40 }),
    predictionRun({ id: "morning-cold", shiftId: "morning", temperature: -5, energy: 100, distance: 60 }),
  ];
  await mountResults(page, legacy, { predictionRuns: reversedRuns });

  await expect(page.getByRole("tab")).toHaveText([
    "General",
    "Morning service",
    "Evening service",
  ]);
  await page.getByRole("tab", { name: "Morning service" }).click();
  const shiftReference = page.locator('[data-role="ya-shift-reference"]');
  await expect(shiftReference).toContainText(/36['’,]500 kWh/);
  await expect(shiftReference).toContainText(/21['’,]900 km/);

  await page.getByRole("tab", { name: "Evening service" }).click();
  await expect(shiftReference).toContainText(/18['’,]250 kWh/);
  await expect(shiftReference).toContainText(/14['’,]600 km/);
  await expect(shiftReference).not.toContainText(/36['’,]500 kWh/);
});

test("historical multi-shift tabs remain visible when one shift is incomplete", async ({ page }) => {
  const legacy = structuredClone(multishiftAnalysis);
  legacy.id = "legacy-partial";
  delete legacy.features.config.fixedConfiguration;
  legacy.features.scenarios = [{
    scenarioId: "cold",
    label: "Cold",
    temperature: -5,
    occurrences: 365,
  }];
  delete legacy.features.results.shiftResults;

  await mountResults(page, legacy, {
    predictionRuns: [
      predictionRun({ id: "morning-only", shiftId: "morning", temperature: -5, energy: 100, distance: 60 }),
    ],
  });

  await expect(page.getByRole("tab")).toHaveCount(3);
  const eveningTab = page.getByRole("tab", { name: "Evening service" });
  await expect(eveningTab).toHaveAttribute("data-status", "failed");
  await eveningTab.click();
  const shiftReference = page.locator('[data-role="ya-shift-reference"]');
  await expect(shiftReference).not.toContainText("Failed");
  await expect(shiftReference.locator("tbody td strong")).toHaveText(["0 kWh", "0 km", "—"]);
  await expect(page.locator('[data-action="download-json"]')).toHaveCount(0);

  await page.getByRole("tab", { name: "Morning service" }).click();
  await expect(shiftReference).not.toContainText("Complete");
  await expect(shiftReference.locator("tbody td strong")).toHaveText([
    /36['’,]500 kWh/,
    /21['’,]900 km/,
    "1.667 kWh/km",
  ]);
});

test("shift tab labels keep backend HTML inert without duplicating shift context", async ({ page }) => {
  const unsafe = structuredClone(multishiftAnalysis);
  unsafe.id = "unsafe";
  const payload = '<img src=x onerror="window.__yearlyScopeInjected=true">';
  unsafe.features.results.shiftResults[0].shiftName = payload;
  unsafe.features.config.fixedConfiguration.shifts[0].shiftName = payload;
  unsafe.features.config.fixedConfiguration.shifts[0].operation.chargingSessions[0].stationName = payload;
  unsafe.features.config.fixedConfiguration.infrastructure.resultAvailable = false;
  delete unsafe.features.config.fixedConfiguration.shifts[1].operation.chargingSessions;

  await mountResults(page, unsafe);
  await expect(page.locator("#yearly-result-scope-content")).toContainText(
    "Shared charging infrastructure details are unavailable",
  );
  const unsafeTab = page.getByRole("tab", { name: payload });
  await expect(unsafeTab).toHaveCount(1);
  await unsafeTab.click();
  await expect(page.locator("#yearly-result-scope-content")).not.toContainText(payload);
  await expect(page.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__yearlyScopeInjected)).toBeUndefined();
  await page.getByRole("tab", { name: "Evening service" }).click();
  await expect(page.locator("#yearly-result-scope-content")).not.toContainText(
    "Reference charging-plan details are unavailable",
  );
});

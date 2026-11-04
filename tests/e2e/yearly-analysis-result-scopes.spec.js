import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const updateGuideScreenshots = process.env.UPDATE_GUIDE_SCREENSHOTS === "1";

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

const fleetLcaFromVehicles = (vehicles) => {
  const indicators = {};
  for (const key of Object.keys(lcaFixture.indicators)) {
    const rows = vehicles.map((vehicle) => vehicle.indicators[key]);
    const sumField = (field) => rows.reduce((sum, row) => sum + row[field], 0);
    const sumPhases = (field) => rows
      .map((row) => row[field])
      .reduce(sumObjects);
    indicators[key] = {
      ...rows[0],
      electricity_operation: sumField("electricity_operation"),
      diesel_heating: sumField("diesel_heating"),
      other_lifecycle: sumField("other_lifecycle"),
      total: sumField("total"),
      diesel_comparator_total: sumField("diesel_comparator_total"),
      phases: sumPhases("phases"),
      diesel_comparator_phases: sumPhases("diesel_comparator_phases"),
      diesel_heating_phases: sumPhases("diesel_heating_phases"),
    };
  }
  const dcKwh = vehicles.reduce((sum, vehicle) => sum + vehicle.dc_kwh, 0);
  return {
    ...structuredClone(lcaFixture),
    annual_km: vehicles.reduce((sum, vehicle) => sum + vehicle.annual_km, 0),
    vehicle_count: vehicles.length,
    vehicles,
    energy_boundary: {
      ...lcaFixture.energy_boundary,
      dc_kwh: dcKwh,
      grid_kwh: dcKwh / 0.94,
      charging_losses_kwh: dcKwh / 0.94 - dcKwh,
    },
    indicators,
  };
};

const multiShiftLca = () => {
  const morning = scaledVehicle(lcaFixture.vehicles[0], "morning", 1);
  const evening = scaledVehicle(lcaFixture.vehicles[0], "evening", 0.5);
  morning.annual_km = 21900;
  evening.annual_km = 14600;
  return fleetLcaFromVehicles([morning, evening]);
};

const lcaForShiftDistance = (source, shiftId, annualKm) => {
  if (!shiftId || !Number.isFinite(annualKm)) return source;
  const vehicles = source.vehicles.map((vehicle) => vehicle.shift_id === shiftId
    ? scaledVehicle(vehicle, shiftId, annualKm / vehicle.annual_km)
    : structuredClone(vehicle));
  return fleetLcaFromVehicles(vehicles);
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
  {
    predictionRuns = [],
    optimizationRun = null,
    lcaRequests = null,
    yearlyCosts = null,
    busSpecs = {},
  } = {},
) => {
  const configuredShiftCount = analysis.features?.config?.shift_ids?.length ?? 0;
  const lca = analysis.features?.results?.shiftResults || configuredShiftCount > 1
    ? multiShiftLca()
    : structuredClone(lcaFixture);
  if (configuredShiftCount === 1 && Array.isArray(lca.vehicles)) {
    lca.vehicles.forEach((vehicle) => {
      vehicle.shift_id = analysis.features.config.shift_ids[0];
    });
  }
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith(`/yearly-analysis/${analysis.id}/lca`)) {
      const shiftId = url.searchParams.get("shift_id");
      const annualKmRaw = url.searchParams.get("annual_km");
      const annualKm = annualKmRaw == null ? null : Number(annualKmRaw);
      lcaRequests?.push({ shiftId, annualKm });
      await route.fulfill({ json: lcaForShiftDistance(lca, shiftId, annualKm) });
    } else if (path.endsWith(`/yearly-analysis/${analysis.id}/costs`)) {
      if (yearlyCosts) await route.fulfill({ json: yearlyCosts });
      else await route.fulfill({ status: 503, json: { detail: "Use deterministic local costs" } });
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
          battery_pack_cost: 10000,
          bus_lifetime: 12,
          battery_pack_lifetime: 8,
          cost: 400000,
          ...busSpecs,
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
  const shiftSummarySlot = page.locator('[data-role="ya-shift-summary-slot"]');
  await expect(shiftSummarySlot).toBeHidden();

  const content = page.locator("#yearly-result-scope-content");
  await expect(content).toContainText("Deployed configuration");
  await expect(content).toContainText("Common bus configuration");
  await expect(content).toContainText("Shared charging infrastructure");
  await expect(page.locator('[data-panel="overview"]')).toBeVisible();
  const generalLevel = page.locator('[data-role="ya-deployed-configuration"]');
  await expect(generalLevel).toHaveClass(/ya-scope-level--general/);
  await expect(generalLevel).toHaveClass(/result-card/);
  await expect(generalLevel.locator(".ya-scope-level__eyebrow")).toHaveCount(0);
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
  expect(exported.general.costs.sharedInvestments.vehicleUnitReference).toMatchObject({
    fleetVehicleCount: 2,
    fleetInvestmentChf: 1_040_000,
  });
  expect(exported.general.costs.sharedInvestments.fleetCapital).toMatchObject({
    vehicleCount: 2,
    busInvestmentChf: 800_000,
    batteryInvestmentChf: 240_000,
    vehicleAndBatteryInvestmentChf: 1_040_000,
    totalInitialInvestmentChf: 1_290_000,
  });
  expect(exported.general.costs.capitalComparison.capitalScope).toMatchObject({
    scope: "general",
    vehicleCount: 2,
    infrastructureInvestmentCAPEX_CHF: 250_000,
    vehicleAndBatteryCAPEX_CHF: 1_040_000,
    initialElectricCAPEX_CHF: 1_290_000,
    dieselVehicleCAPEX_CHF: 700_000,
  });
  expect(exported.general.costs.capitalComparison.electric.initialCAPEX_CHF).toBe(1_290_000);
  expect(exported.general.costs.capitalComparison.diesel.initialCAPEX_CHF).toBe(700_000);
  expect(exported.shifts[0].costs.capitalScope).toMatchObject({
    scope: "shift",
    shiftId: "morning",
    vehicleCount: 1,
    includedInfrastructureCAPEX_CHF: 166_667,
    vehicleAndBatteryCAPEX_CHF: 520_000,
    initialElectricCAPEX_CHF: 686_667,
    dieselVehicleCAPEX_CHF: 350_000,
  });
  expect(exported.shifts[0].costs.capitalAllocation).toMatchObject({
    method: "annual_dc_energy",
    source: "emissions",
    shiftId: "morning",
    vehicleCount: 1,
    share_pct: 66.667,
    electric: {
      ownedVehicleAndBatteryCAPEX_CHF: 520_000,
      allocatedInfrastructureCAPEX_CHF: 166_667,
      allocatedInitialCAPEX_CHF: 686_667,
    },
    diesel: {
      ownedVehicleCAPEX_CHF: 350_000,
      allocatedInitialCAPEX_CHF: 350_000,
    },
  });
  expect(exported.shifts.map(({ shiftId }) => shiftId)).toEqual(["morning", "evening"]);
  await expect(generalLevel.locator(".ya-deployed-card")).toHaveCount(5);
  const generalCosts = generalLevel.locator('[data-role="ya-general-costs"]');
  await expect(generalCosts).toBeVisible();
  await expect(generalCosts).toHaveAttribute("data-economic-scope", "general-shared");
  await expect(generalCosts).toContainText("Fleet and shared investment costs");
  await expect(generalLevel).toContainText("Fleet vehicles");
  await expect(generalLevel).toContainText("2");
  await expect(generalCosts).toContainText("Fleet bus investment");
  await expect(generalCosts).toContainText(/CHF 800['’,]000/);
  await expect(generalCosts).toContainText("Fleet battery investment");
  await expect(generalCosts).toContainText(/CHF 240['’,]000/);
  await expect(generalCosts).toContainText("Shared charging infrastructure investment");
  await expect(generalCosts).toContainText(/CHF 250['’,]000/);
  await expect(generalCosts).toContainText("Total initial fleet investment");
  await expect(generalCosts).toContainText(/CHF 1['’,]290['’,]000/);
  await expect(generalCosts).toContainText("Only infrastructure, by annual DC energy");
  const generalCostTooltip = generalCosts.getByRole("button");
  await expect(generalCostTooltip).toHaveAccessibleName(
    /bus and battery capex is multiplied by the physical vehicle count/i,
  );
  await generalCostTooltip.hover();
  await expect(generalCostTooltip.locator(".ya-info-tooltip")).toBeVisible();
  const generalPresentation = await generalLevel.evaluate((element) => {
    const style = getComputedStyle(element);
    const role = element.querySelector(".ya-configuration-role");
    const roleStyle = getComputedStyle(role);
    const nestedCards = [...element.querySelectorAll(".ya-deployed-card")];
    return {
      background: style.backgroundColor,
      borderStyle: style.borderStyle,
      shadow: style.boxShadow,
      roleBackground: roleStyle.backgroundColor,
      roleBorderWidth: roleStyle.borderWidth,
      nestedBackgrounds: [...new Set(nestedCards.map((card) => getComputedStyle(card).backgroundColor))],
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(generalPresentation.background).toBe("rgb(255, 255, 255)");
  expect(generalPresentation.borderStyle).toBe("solid");
  expect(generalPresentation.shadow).not.toBe("none");
  expect(generalPresentation.roleBackground).toBe("rgba(0, 0, 0, 0)");
  expect(generalPresentation.roleBorderWidth).toBe("0px");
  expect(generalPresentation.nestedBackgrounds).toEqual(["rgb(255, 255, 255)"]);
  expect(generalPresentation.hasHorizontalOverflow).toBe(false);
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
  await expect(resultViewTablist).toBeHidden();
  await expect(page.locator('[data-role="overview-panel"] .ya-overview-grid')).toHaveCount(0);

  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1440, height: 1020 });
    await generalCostTooltip.evaluate((button) => button.blur());
    await page.mouse.move(4, 4);
    await page.waitForTimeout(250);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".ya-results-main").evaluate((main) => {
      main.scrollTop = 0;
    });
    await page.screenshot({ path: "guide/images/yearly-efficiency.png" });
  }

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
  await expect(page.locator('[data-panel="overview"]')).toBeHidden();
  await expect(shiftSummarySlot).toBeVisible();
  const shiftLevel = page.locator('[data-role="ya-shift-reference"]');
  await expect(shiftLevel).toHaveClass(/ya-scope-level--shift/);
  await expect(shiftLevel.locator(":scope > *")).toHaveCount(1);
  await expect(shiftLevel.locator(".ya-scope-level__eyebrow")).toHaveCount(0);
  await expect(shiftLevel.locator('[data-role="ya-selected-shift"]')).toHaveCount(0);
  await expect(shiftLevel.locator(".ya-scope-status")).toHaveCount(0);
  await expect(shiftLevel).not.toContainText("Vehicle block detail");
  await expect(shiftLevel).not.toContainText("Complete");
  await expect(shiftLevel.locator(".ya-scope-level__subtitle")).toHaveCount(0);
  await expect(shiftLevel).not.toContainText("Energy demand and operating details");
  const yearlySummary = shiftLevel.locator('[data-role="ya-shift-yearly-summary"]');
  await expect(yearlySummary).toContainText("Yearly aggregated summary");
  await expect(yearlySummary.locator(".ya-shift-yearly-summary__title")).toHaveText(
    "Yearly aggregated summary",
  );
  await expect(yearlySummary.locator("thead")).toHaveCount(0);
  await expect(yearlySummary.locator("tbody tr")).toHaveCount(1);
  await expect(yearlySummary.locator("tbody th")).toHaveCount(0);
  await expect(yearlySummary.locator("tbody td")).toHaveCount(3);
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
  const compactShiftContext = await shiftSummarySlot.evaluate((element) => ({
    followsScopeTabs:
      element.previousElementSibling?.matches('[data-role="ya-result-scope-tabs"]') ?? false,
    width: element.getBoundingClientRect().width,
    parentWidth: element.parentElement?.getBoundingClientRect().width ?? 0,
    background: getComputedStyle(
      element.querySelector('[data-role="ya-shift-yearly-summary"]'),
    ).backgroundColor,
    summaryFontSize: Number.parseFloat(getComputedStyle(
      element.querySelector('[data-role="ya-shift-yearly-summary"] td'),
    ).fontSize),
  }));
  expect(compactShiftContext.followsScopeTabs).toBe(true);
  expect(compactShiftContext.width).toBeGreaterThanOrEqual(compactShiftContext.parentWidth - 1);
  expect(compactShiftContext.background).toBe("rgb(228, 246, 246)");
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
  const efficiencyCardPresentation = await page.locator(".ya-eff-chart-section").evaluateAll(
    (cards) => cards.map((card) => {
      const style = getComputedStyle(card);
      const titleStyle = getComputedStyle(card.querySelector(".ya-res-section-title"));
      return {
        background: style.backgroundColor,
        borderStyle: style.borderStyle,
        titleSize: Number.parseFloat(titleStyle.fontSize),
      };
    }),
  );
  expect(efficiencyCardPresentation).toHaveLength(2);
  efficiencyCardPresentation.forEach((card) => {
    expect(card.background).toBe("rgb(255, 255, 255)");
    expect(card.borderStyle).toBe("solid");
    expect(card.titleSize).toBeLessThanOrEqual(16);
  });
  await expect(content).not.toContainText("Cold evening");
  await expect(page.locator('[data-role="ya-cost-scope-note"]')).toBeHidden();
  await expect(page.locator('[data-role="ya-emissions-scope-note"]')).toHaveCount(0);

  await resultViewTabs.getByText("Costs", { exact: true }).click();
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeVisible();
  await expect(page.locator('[data-panel="emissions"]')).toBeHidden();
  await expect(page.locator('[data-role="ya-cost-scope-note"]')).toBeVisible();
  await expect(page.locator('[data-role="ya-cost-scope-note"]')).toContainText(
    "Operating costs use this vehicle block's energy and distance",
  );
  await expect(page.locator('[data-panel="costs"]')).toContainText("Vehicle block costs");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Annual vehicle block OPEX comparison");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Vehicle block CAPEX");
  await expect(page.locator('[data-panel="costs"]')).toContainText("Cumulative cost and break-even");
  const capexAllocation = page.locator('[data-role="ya-costs-capex-section"]');
  await expect(capexAllocation).toHaveAttribute("data-allocation-method", "annual_dc_energy");
  await expect(capexAllocation).toContainText("Vehicles in this vehicle block");
  await expect(capexAllocation).toContainText("Owned bus + battery CAPEX");
  await expect(capexAllocation).toContainText(/CHF 520['’,]000/);
  await expect(capexAllocation).toContainText("Allocated infrastructure CAPEX");
  await expect(capexAllocation).toContainText(/CHF 166['’,]667/);
  await expect(capexAllocation).toContainText("Total e-bus CAPEX");
  await expect(capexAllocation).toContainText(/CHF 686['’,]667/);
  await expect(capexAllocation).toContainText("Diesel comparator CAPEX");
  await expect(capexAllocation).toContainText(/CHF 350['’,]000/);
  await expect(capexAllocation).toContainText("66.7% to this vehicle block");
  await expect(capexAllocation).toContainText("shown in Emissions");
  await expect(capexAllocation).toContainText("Bus and battery CAPEX belongs in full");
  await expect(capexAllocation.locator(".ya-costs-kpi-card")).toHaveCount(0);
  await expect(capexAllocation.locator(".ya-compact-metrics__table thead tr")).toHaveCount(1);
  await expect(capexAllocation.locator(".ya-compact-metrics__table thead th")).toHaveCount(6);
  await expect(capexAllocation.locator(".ya-compact-metrics__table tbody tr")).toHaveCount(1);
  await expect(capexAllocation.locator(".ya-compact-metrics__table tbody td")).toHaveCount(6);
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
    /operating costs use this vehicle block's energy and distance/i,
  );
  await shiftCostTooltip.hover();
  await expect(shiftCostTooltip.locator(".ya-info-tooltip")).toBeVisible();

  await resultViewTabs.getByText("Emissions", { exact: true }).click();
  await expect(page.locator('[data-panel="efficiency"]')).toBeHidden();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeVisible();
  await expect(page.locator('[data-role="ya-emissions-scope-note"]')).toHaveCount(0);
  await expect(page.locator('[data-panel="emissions"]')).not.toContainText("Shift impacts use");
  const emissionsTitle = page.locator('[data-panel="emissions"] > .ya-env-heading-row .ya-scope-section-title');
  const emissionsDistanceControl = page.locator('[data-role="ya-env-controls"]');
  await expect(emissionsDistanceControl).toBeVisible();
  await expect(page.locator('[data-role="ya-env-yearly-distance"]')).toHaveValue("21900");
  await expect(emissionsDistanceControl.locator(".ya-cost-variables__range-scale span")).toHaveText([
    /10.000/,
    /40.000/,
  ]);
  const [titleBox, distanceControlBox] = await Promise.all([
    emissionsTitle.boundingBox(),
    emissionsDistanceControl.boundingBox(),
  ]);
  if (page.viewportSize().width > 700) {
    expect(distanceControlBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
    expect(Math.abs(distanceControlBox.y - titleBox.y)).toBeLessThanOrEqual(4);
  } else {
    expect(distanceControlBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
    expect(Math.abs(distanceControlBox.x - titleBox.x)).toBeLessThanOrEqual(4);
  }
  const firstLcaSection = page.locator(".ya-lca-result > section").first();
  await expect(firstLcaSection).toHaveAttribute("data-role", "ya-lca-phases");
  await expect(firstLcaSection.getByRole("heading")).toHaveText("Climate impact by phase");
  await expect(page.locator('[data-panel="emissions"]')).not.toContainText(
    "DC powers and consumption at the bus",
  );
  await expect(page.locator('[data-role="ya-lca-overview"]')).toBeVisible();
  await expect(page.locator('[data-role="ya-lca-energy-summary"] .result-metric')).toHaveCount(4);
  await expect(page.locator('[data-role="ya-lca-indicators"]')).toBeVisible();
  await expect(page.locator('[data-role="ya-lca-phases"]')).toBeVisible();
  const emissionsPresentation = await page.locator('[data-role="ya-lca-overview"]').evaluate(
    (element) => {
      const style = getComputedStyle(element);
      const metrics = [...element.querySelectorAll(".result-metric")].map((metric) =>
        getComputedStyle(metric).backgroundColor,
      );
      return {
        background: style.backgroundColor,
        borderStyle: style.borderStyle,
        metricBackgrounds: [...new Set(metrics)],
        hasHorizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    },
  );
  expect(emissionsPresentation.background).toBe("rgb(255, 255, 255)");
  expect(emissionsPresentation.borderStyle).toBe("solid");
  expect(emissionsPresentation.metricBackgrounds).toEqual(["rgba(0, 0, 0, 0)"]);
  expect(emissionsPresentation.hasHorizontalOverflow).toBe(false);
  const disclosureToggle = page.locator(".ya-lca-disclosure > summary");
  const disclosureTypography = await disclosureToggle.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight),
    };
  });
  expect(disclosureTypography.fontSize).toBeLessThanOrEqual(14);
  expect(disclosureTypography.fontWeight).toBeLessThanOrEqual(500);

  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1440, height: 990 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".ya-results-main").evaluate((main) => {
      main.scrollTop = 0;
    });
    await page.screenshot({ path: "guide/images/yearly-emissions.png" });
  }

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
  expect(mobileShiftContext.height).toBeLessThan(80);
  await expect(yearlySummary.locator(".ya-compact-metrics")).toHaveCSS("overflow-x", "auto");
  await resultViewTabs.getByText("Emissions", { exact: true }).click();
  const mobileActivityMetric = page
    .locator('[data-role="ya-lca-energy-summary"] .result-metric')
    .last();
  await expect(mobileActivityMetric).toHaveCSS("flex-direction", "column");
  const mobileActivityLayout = await mobileActivityMetric.evaluate((metric) => {
    const label = metric.querySelector(".result-metric__label").getBoundingClientRect();
    const value = metric.querySelector(".result-metric__value").getBoundingClientRect();
    return {
      separated: value.top >= label.bottom,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
  expect(mobileActivityLayout.separated).toBe(true);
  expect(mobileActivityLayout.bodyScrollWidth).toBe(mobileActivityLayout.bodyClientWidth);
});

test("fleet and shift CAPEX expose multiple physical vehicles without reallocating them", async ({ page }) => {
  const analysis = structuredClone(multishiftAnalysis);
  analysis.id = "multi-vehicle-shift";
  analysis.features.config.fixedConfiguration.fleet.vehicleCount = 3;
  analysis.features.config.fixedConfiguration.fleet.vehicleCountByShift = {
    morning: 2,
    evening: 1,
  };

  await mountResults(page, analysis);

  const generalLevel = page.locator('[data-role="ya-deployed-configuration"]');
  const generalCosts = generalLevel.locator('[data-role="ya-general-costs"]');
  await expect(generalLevel).toContainText("Fleet vehicles");
  await expect(generalCosts).toContainText(/CHF 1['’,]200['’,]000/);
  await expect(generalCosts).toContainText(/CHF 360['’,]000/);
  await expect(generalCosts).toContainText(/CHF 1['’,]810['’,]000/);

  const { exported } = await downloadAllResults(page);
  expect(exported.general.costs.capitalComparison.capitalScope).toMatchObject({
    vehicleCount: 3,
    vehicleAndBatteryCAPEX_CHF: 1_560_000,
    initialElectricCAPEX_CHF: 1_810_000,
    dieselVehicleCAPEX_CHF: 1_050_000,
  });
  expect(exported.shifts[0].costs.capitalAllocation).toMatchObject({
    vehicleCount: 2,
    electric: {
      ownedVehicleAndBatteryCAPEX_CHF: 1_040_000,
      allocatedInfrastructureCAPEX_CHF: 166_667,
      allocatedInitialCAPEX_CHF: 1_206_667,
    },
    diesel: {
      ownedVehicleCAPEX_CHF: 700_000,
      allocatedInitialCAPEX_CHF: 700_000,
    },
  });

  await page
    .locator('[data-role="ya-result-scope-tabs"]')
    .getByRole("tab", { name: "Morning service" })
    .click();
  await page
    .locator('[data-role="ya-result-view-tabs"]')
    .getByRole("tab", { name: "Costs" })
    .click();
  const capex = page.locator('[data-role="ya-costs-capex-section"]');
  await expect(capex.locator('tbody [data-metric="vehicles"]')).toHaveText("2");
  await expect(capex).toContainText(/CHF 1['’,]040['’,]000/);
  await expect(capex).toContainText(/CHF 166['’,]667/);
  await expect(capex).toContainText(/CHF 1['’,]206['’,]667/);
  await expect(capex).toContainText(/CHF 700['’,]000/);
});

test("General, shifts, controls and export share one set of yearly economic assumptions", async ({ page }) => {
  const conflictingBackendCosts = {
    assumptions: {
      yearly_electric_kwh: 54750,
      yearly_distance_km: 36500,
      energy_price_per_kwh: 0.24,
      fuel_cost_per_l: 1.91,
      diesel_comparator_consumption_l_per_km: 0.5518,
      diesel_comparator_maint_cost_per_km_chf: 0.50,
      electric_maint_cost_per_km_chf: 0.2846,
      interest_rate: 0.04,
      diesel_heating_maintenance_factor: 0.15,
    },
    ebus: { opex_items: [] },
    diesel_comparator: { opex_items: [] },
    scenarios: [],
  };
  await mountResults(page, multishiftAnalysis, {
    yearlyCosts: conflictingBackendCosts,
    busSpecs: { bus_length_m: 18 },
  });

  const scopeTabs = page.locator('[data-role="ya-result-scope-tabs"]');
  await scopeTabs.getByRole("tab", { name: "Morning service" }).click();
  await page
    .locator('[data-role="ya-result-view-tabs"]')
    .getByRole("tab", { name: "Costs" })
    .click();

  const electricMaintenance = page.locator('[data-role="ya-var-elec-maint"]');
  const dieselMaintenance = page.locator('[data-role="ya-var-diesel-maint"]');
  const dieselEfficiency = page.locator('[data-role="ya-var-diesel-eff"]');
  await expect(electricMaintenance).toHaveValue("0.4");
  await expect(dieselMaintenance).toHaveValue("0.45");
  await expect(dieselEfficiency).toHaveValue("0.55");
  await expect(page.locator('[data-role="ya-var-diesel-eff-value"]')).toHaveText("0.552");

  await scopeTabs.getByRole("tab", { name: "General" }).click();
  const initial = (await downloadAllResults(page)).exported;
  const initialScopes = [
    initial.general.costs.operatingCosts,
    ...initial.shifts.map((shift) => shift.costs),
  ];
  for (const costs of initialScopes) {
    expect(costs.assumptions).toMatchObject({
      energyPrice_CHFPerKwh: 0.24,
      fuelPrice_CHFPerL: 1.91,
      dieselComparator_efficiency_LPerKm: 0.5518,
      dieselComparator_maintenanceCost_CHFPerKm: 0.45,
      electricMaintenanceCost_CHFPerKm: 0.40,
      annualizationRate: 0.04,
    });
  }
  expect(initial.general.costs.operatingReconciliation).toMatchObject({
    status: "consistent",
    shiftCount: 2,
    issue: null,
  });
  expect(initial.general.costs.capitalAnnualization).toMatchObject({
    electricBus: { lifetime_years: 12 },
    battery: { lifetime_years: 8, replacementYears: [8] },
    chargingInfrastructure: { lifetime_years: 15 },
    dieselBus: { lifetime_years: 12, replacementYears: [] },
  });
  for (const shift of initial.shifts) {
    expect(shift.costs.capitalAnnualization).toMatchObject({
      electricBus: { lifetime_years: 12 },
      battery: { lifetime_years: 8, replacementYears: [8] },
      chargingInfrastructure: { lifetime_years: 15 },
      dieselBus: { lifetime_years: 12, replacementYears: [] },
    });
  }
  expect(
    initial.general.costs.operatingReconciliation.metrics
      .dieselHeatingFuelOpexChf.general,
  ).toBeGreaterThan(0);
  const shiftElectricAnnualizedCapex = initial.shifts.reduce(
    (sum, shift) => sum +
      shift.costs.capitalAllocation.electric.allocatedAnnualizedCAPEX_CHF,
    0,
  );
  const shiftDieselAnnualizedCapex = initial.shifts.reduce(
    (sum, shift) => sum +
      shift.costs.capitalAllocation.diesel.allocatedAnnualizedCAPEX_CHF,
    0,
  );
  expect(Math.abs(
    initial.general.costs.capitalComparison.electric.annualizedCAPEX_CHF -
      shiftElectricAnnualizedCapex,
  )).toBeLessThanOrEqual(initial.shifts.length);
  expect(Math.abs(
    initial.general.costs.capitalComparison.diesel.annualizedCAPEX_CHF -
      shiftDieselAnnualizedCapex,
  )).toBeLessThanOrEqual(initial.shifts.length);
  const generalTrend = initial.general.costs.capitalComparison.projectedCostTrend;
  for (const [index, point] of generalTrend.entries()) {
    const shiftPoints = initial.shifts.map((shift) =>
      shift.costs.projectedCostTrend[index]);
    expect(shiftPoints.every(Boolean)).toBe(true);
    expect(shiftPoints.every((entry) => entry.year === point.year)).toBe(true);
    const electricDelta = Math.abs(
      point.electric_CHF -
        shiftPoints.reduce((sum, entry) => sum + entry.electric_CHF, 0));
    const dieselDelta = Math.abs(
      point.diesel_CHF -
        shiftPoints.reduce((sum, entry) => sum + entry.diesel_CHF, 0));
    expect(
      electricDelta,
      `electric curve mismatch at year ${point.year}: General ${point.electric_CHF}, shifts ${shiftPoints.map((entry) => entry.electric_CHF).join(" + ")}`,
    ).toBeLessThanOrEqual(initial.shifts.length);
    expect(
      dieselDelta,
      `diesel curve mismatch at year ${point.year}`,
    ).toBeLessThanOrEqual(initial.shifts.length);
  }

  await scopeTabs.getByRole("tab", { name: "Morning service" }).click();
  await electricMaintenance.evaluate((element) => {
    element.value = "0.43";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await dieselMaintenance.evaluate((element) => {
    element.value = "0.52";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator('[data-role="ya-var-elec-maint-value"]')).toHaveText("0.430");
  await expect(page.locator('[data-role="ya-var-diesel-maint-value"]')).toHaveText("0.520");
  await page.waitForTimeout(400);

  await scopeTabs.getByRole("tab", { name: "General" }).click();
  const overridden = (await downloadAllResults(page)).exported;
  for (const costs of [
    overridden.general.costs.operatingCosts,
    ...overridden.shifts.map((shift) => shift.costs),
  ]) {
    expect(costs.assumptions).toMatchObject({
      dieselComparator_maintenanceCost_CHFPerKm: 0.52,
      electricMaintenanceCost_CHFPerKm: 0.43,
    });
  }
  expect(overridden.general.costs.operatingReconciliation.status).toBe("consistent");

  await scopeTabs.getByRole("tab", { name: "Morning service" }).click();
  await page.locator('[data-role="ya-var-reset-all"]').click();
  await expect(electricMaintenance).toHaveValue("0.4");
  await expect(dieselMaintenance).toHaveValue("0.45");
  await page.waitForTimeout(400);

  await scopeTabs.getByRole("tab", { name: "General" }).click();
  const reset = (await downloadAllResults(page)).exported;
  for (const costs of [
    reset.general.costs.operatingCosts,
    ...reset.shifts.map((shift) => shift.costs),
  ]) {
    expect(costs.assumptions).toMatchObject({
      dieselComparator_maintenanceCost_CHFPerKm: 0.45,
      electricMaintenanceCost_CHFPerKm: 0.40,
    });
  }
  expect(reset.general.costs.operatingReconciliation.status).toBe("consistent");
});

for (const mode of ["joint", "charging_only", "battery_only"]) {
  test(`${mode} multi-shift OPEX reconciles General with every shift`, async ({ page }) => {
    const source = structuredClone(multishiftAnalysis);
    source.id = `reconciliation-${mode}`;
    source.features.config.mode = mode;
    source.features.config.fixedConfiguration.mode = mode;
    await mountResults(page, source);

    const exported = (await downloadAllResults(page)).exported;
    expect(exported.general.costs.operatingReconciliation).toMatchObject({
      status: "consistent",
      shiftCount: 2,
      issue: null,
    });
  });
}

test("the two-shift TPL JOINT case reconciles OPEX and component CAPEX", async ({ page }) => {
  await page.goto("./");
  const values = await page.evaluate(async () => {
    const resultsModule = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
    );
    const scopeModule = await import(
      "/elettra/src/utils/yearly-analysis-cost-scope.js"
    );
    const operatingModule = await import(
      "/elettra/src/utils/yearly-analysis-operating-costs.js"
    );
    const shifts = [
      { distanceKm: 100824.6998180805, totalEnergyKwh: 170037.46275370274 },
      { distanceKm: 68039.72394037398, totalEnergyKwh: 117545.61315404146 },
    ];
    const totals = shifts.reduce((sum, shift) => ({
      distanceKm: sum.distanceKm + shift.distanceKm,
      totalEnergyKwh: sum.totalEnergyKwh + shift.totalEnergyKwh,
    }), { distanceKm: 0, totalEnergyKwh: 0 });
    const bus = {
      bus_length_m: 18,
      cost: 800000,
      battery_pack_cost: 6000,
      bus_lifetime: 12,
      battery_pack_lifetime: 8,
    };
    const raw = {
      assumptions: {
        energy_price_per_kwh: 0.20,
        fuel_cost_per_l: 1.85,
        diesel_comparator_consumption_l_per_km: 0.5518,
        diesel_comparator_maint_cost_per_km_chf: 0.50,
        electric_maint_cost_per_km_chf: 0.2846,
        interest_rate: 0.03,
        diesel_heating_maintenance_factor: 0.10,
      },
      scenarios: [],
    };
    const unitGeneral = resultsModule.mapBackendCostsToLocal(
      raw,
      totals.distanceKm,
      totals.totalEnergyKwh,
      bus,
      { optimizedPacks: 10, overrides: {} },
    );
    const general = scopeModule.applyGeneralFleetCapital(
      unitGeneral,
      {
        dataAvailable: true,
        source: "optimization_per_bus_summary",
        scope: "general",
        shiftId: null,
        vehicleCount: 2,
        fleetVehicleCount: 2,
        issue: null,
      },
      { infrastructureInvestmentChf: 300000 },
    );
    const shiftCosts = shifts.map((yearlyTotals) =>
      resultsModule.computeYearlyCosts(
        { results: { optimizedPacks: 10, yearlyTotals, scenarioResults: [] } },
        bus,
        {},
        { resolvedAssumptions: unitGeneral.assumptions },
      ));
    return {
      electricOpex: general.electric.totalOpex,
      dieselOpex: general.diesel.totalOpex,
      operatingSaving: general.diesel.totalOpex - general.electric.totalOpex,
      totalAnnualSaving: general.annualSaving,
      breakEvenYear: general.breakEvenYear,
      capitalComponents: general.capitalComponents,
      reconciliation: operatingModule.reconcileYearlyOperatingCosts(
        general,
        shiftCosts,
      ),
    };
  });

  expect(Math.round(values.electricOpex)).toBe(128734);
  expect(Math.round(values.dieselOpex)).toBe(248371);
  expect(Math.round(values.operatingSaving)).toBe(119637);
  expect(Math.round(values.totalAnnualSaving)).toBe(17135);
  expect(values.capitalComponents.electricBus.lifetimeYears).toBe(12);
  expect(values.capitalComponents.battery.lifetimeYears).toBe(8);
  expect(values.capitalComponents.chargingInfrastructure.lifetimeYears).toBe(15);
  expect(values.capitalComponents.dieselBus.lifetimeYears).toBe(12);
  expect(Math.round(
    values.capitalComponents.electricBus.annualizedCostChfPerYear +
      values.capitalComponents.battery.annualizedCostChfPerYear +
      values.capitalComponents.chargingInfrastructure.annualizedCostChfPerYear,
  )).toBe(202964);
  expect(values.breakEvenYear).toBeGreaterThanOrEqual(11);
  expect(values.breakEvenYear).toBeLessThanOrEqual(11.2);
  expect(values.reconciliation.status).toBe("consistent");
});

test("annual-distance sensitivity remains isolated to the selected shift", async ({ page }) => {
  const lcaRequests = [];
  await mountResults(page, multishiftAnalysis, { lcaRequests });

  const scopeTabs = page.locator('[data-role="ya-result-scope-tabs"]');
  const resultTabs = page.locator('[data-role="ya-result-view-tabs"]');
  const distanceSlider = page.locator('[data-role="ya-env-yearly-distance"]');
  const activityMetric = page
    .locator('[data-role="ya-lca-energy-summary"] .result-metric')
    .last();

  await scopeTabs.getByRole("tab", { name: "Morning service" }).click();
  await resultTabs.getByRole("tab", { name: "Emissions" }).click();
  await expect(distanceSlider).toBeVisible();
  await expect(distanceSlider).toHaveValue("21900");

  await distanceSlider.evaluate((element) => {
    element.value = "40000";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect.poll(() => lcaRequests.at(-1)).toEqual({
    shiftId: "morning",
    annualKm: 40000,
  });
  await expect(distanceSlider).toHaveValue("40000");
  await expect(activityMetric).toContainText(/40.000 km/);

  await scopeTabs.getByRole("tab", { name: "Evening service" }).click();
  await expect(distanceSlider).toBeVisible();
  await expect(distanceSlider).toHaveValue("14600");
  await expect.poll(() => lcaRequests.at(-1)).toEqual({
    shiftId: null,
    annualKm: null,
  });
  await expect(activityMetric).toContainText(/14.600 km/);

  await scopeTabs.getByRole("tab", { name: "Morning service" }).click();
  await expect.poll(() => lcaRequests.at(-1)).toEqual({
    shiftId: "morning",
    annualKm: 40000,
  });
  await expect(distanceSlider).toHaveValue("40000");

  await page.locator('[data-role="ya-env-yearly-distance-reset"]').click();
  await expect.poll(() => lcaRequests.at(-1)).toEqual({
    shiftId: null,
    annualKm: null,
  });
  await expect(distanceSlider).toHaveValue("21900");
  await expect(activityMetric).toContainText(/21.900 km/);
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
  await expect(page.locator("#yearly-result-scope-content")).toContainText("Vehicle block costs");

  await resultViewTabs.getByText("Emissions", { exact: true }).click();
  await expect(page.locator('[data-panel="costs"]')).toBeHidden();
  await expect(page.locator('[data-panel="emissions"]')).toBeVisible();
  await expect(page.locator("#yearly-result-scope-content")).toContainText("Annual emissions");

  await page.getByRole("tab", { name: "General" }).click();
  const exported = (await downloadAllResults(page)).exported;
  expect(exported.general.costs.operatingReconciliation).toMatchObject({
    status: "consistent",
    shiftCount: 1,
    issue: null,
  });
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

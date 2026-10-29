import { expect, test } from "@playwright/test";

const updateGuideScreenshots = process.env.UPDATE_GUIDE_SCREENSHOTS === "1";

const battery = (shiftName, packs, overrides = {}) => ({
  shift_name: shiftName,
  reference_packs: 6,
  base_packs: 6,
  optimized_packs: packs,
  required_total_packs: packs,
  max_physical_packs: 16,
  base_kwh: 300,
  optimized_kwh: packs * 50,
  max_physical_kwh: 800,
  physical_feasible: true,
  feasibility_status: "feasible",
  ...overrides,
});

const prediction = (id, shiftId, packs, consumption) => ({
  id,
  status: "completed",
  shift_id: shiftId,
  external_temp_celsius: -10,
  auxiliary_heating_type: "default",
  occupancy_percent: 100,
  contextual_parameters: {
    num_battery_packs: packs,
    battery_capacity_kwh: packs * 50,
    total_weight_kg: 18_000,
  },
  summary: {
    total_distance_km: 100,
    total_consumption_kwh: consumption,
    consumption_per_km_kwh: consumption / 100,
    total_drivetrain_kwh: consumption - 50,
    total_auxiliary_kwh: 50,
    quantiles: {
      q05: consumption - 20,
      q50: consumption,
      q95: consumption + 20,
    },
  },
});

const mountResults = async (page, {
  shiftIds = ["morning", "evening"],
  shiftNames: shiftNameOverrides = {},
  predictionRunIds,
  predictionOverrides = {},
  mode = "battery_only",
  chargingStations = [{
    stop_id: "depot",
    stop_name: "Depot",
    num_slots: 2,
    max_power_per_slot_kw: 150,
  }],
  installedChargers,
  stationUtilization,
  totalInstallationCostChf,
  includeInfrastructureInput = true,
  includeElectrificationFeasible = true,
  electrificationFeasible = true,
  fixedBatteryPacks = 12,
  batteryResultOverrides = {},
  perBusSummaryOverrides = {},
  consumptionAnalysis,
  consumptionBasis,
  forecastVerification,
} = {}) => {
  const shiftNames = {
    morning: "Morning service",
    evening: "Evening service",
    ...shiftNameOverrides,
  };
  const predictions = {
    "prediction-morning": prediction("prediction-morning", "morning", 8, 350),
    "prediction-evening": prediction("prediction-evening", "evening", 12, 550),
    ...predictionOverrides,
  };
  const batteryResults = Object.fromEntries(
    shiftIds.map((shiftId) => [
      shiftId,
      battery(
        shiftNames[shiftId],
        shiftId === "evening" ? 12 : 8,
        batteryResultOverrides[shiftId] ?? {},
      ),
    ]),
  );
  const defaultChargingSessions = {
    morning: [
      {
        start_minute: 60,
        end_minute: 90,
        duration_minutes: 30,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 60,
      },
      {
        start_minute: 720,
        end_minute: 730,
        duration_minutes: 10,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 20,
      },
    ],
    evening: [
      {
        start_minute: 1430,
        end_minute: 10,
        duration_minutes: 20,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 50,
      },
      {
        start_minute: 1500,
        end_minute: 1530,
        duration_minutes: 30,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 60,
      },
      {
        start_minute: 1600,
        end_minute: 1615,
        duration_minutes: 15,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 30,
      },
    ],
  };

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/api/v1/simulation/optimization-runs/level-test")) {
      await route.fulfill({
        json: {
          id: "level-test",
          name: "Multi-shift feasibility",
          mode,
          status: "completed",
          input_params: {
            shift_ids: shiftIds,
            mode,
            consumption_basis: consumptionBasis,
            min_soc: 0.2,
            max_soc: 0.9,
            ...(includeInfrastructureInput ? { charging_stations: chargingStations } : {}),
            ...(mode === "charging_only" ? { fixed_battery_packs: fixedBatteryPacks } : {}),
          },
          prediction_run_ids:
            predictionRunIds ?? shiftIds.map((shiftId) => `prediction-${shiftId}`),
          results: {
            consumption_analysis: consumptionAnalysis,
            forecast_verification: forecastVerification,
            ...(includeElectrificationFeasible
              ? { electrification_feasible: electrificationFeasible }
              : {}),
            battery_results: batteryResults,
            per_bus_summary: shiftIds.map((shiftId) => ({
              shift_id: shiftId,
              shift_name: shiftNames[shiftId],
              min_soc_kwh: shiftId === "evening" ? 60 : 120,
              max_soc_kwh: shiftId === "evening" ? 500 : 400,
              total_charged_kwh: shiftId === "evening" ? 140 : 80,
              num_charging_sessions: shiftId === "evening" ? 3 : 2,
              charging_sessions: defaultChargingSessions[shiftId] ?? [],
              ...(perBusSummaryOverrides[shiftId] ?? {}),
            })),
            ...(installedChargers === undefined
              ? {}
              : { installed_chargers: installedChargers }),
            ...(stationUtilization === undefined
              ? {}
              : { station_utilization: stationUtilization }),
            ...(totalInstallationCostChf === undefined
              ? {}
              : { total_installation_cost_chf: totalInstallationCostChf }),
          },
        },
      });
      return;
    }

    const predictionId = Object.keys(predictions).find((id) => path.endsWith(`/${id}`));
    if (predictionId) {
      await route.fulfill({ json: predictions[predictionId] });
      return;
    }

    const shiftInfoMatch = path.match(/\/api\/v1\/user\/shifts\/([^/]+)\/info$/);
    if (shiftInfoMatch) {
      const shiftId = decodeURIComponent(shiftInfoMatch[1]);
      await route.fulfill({
        json: {
          id: shiftId,
          name: shiftNames[shiftId] ?? shiftId,
          structure: [],
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/economic/defaults")) {
      await route.fulfill({ json: {} });
      return;
    }

    await route.fulfill({ status: 404, json: { detail: "Unused by this test" } });
  });

  await page.goto("./");
  await page.evaluate(async () => {
    const template = await fetch(
      "/elettra/src/pages/Simulation/Runs/simulation-results.html",
    ).then((response) => response.text());
    document.body.innerHTML = template;
    const { initializeSimulationResults } = await import(
      "/elettra/src/pages/Simulation/Runs/simulation-results.js"
    );
    window.__cleanupSimulationResults = initializeSimulationResults(document, {
      runId: "level-test",
    });
  });
};

const scopeSelector = (page) => page.locator('[data-role="shift-tabs"]');

const selectShiftScope = async (page, shiftId) => {
  await scopeSelector(page)
    .locator(`[data-action="select-result-scope"][data-shift-id="${shiftId}"]`)
    .click();
};

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__cleanupSimulationResults?.());
});

for (const mode of ["battery_only", "charging_only", "joint"]) {
  test(`accounts for the optimized charging plan in ${mode} energy adequacy`, async ({ page }) => {
    const meanDemandKwh = 644.0907143001715;
    const plannedChargingKwh = 84.09071430017156;
    await mountResults(page, {
      shiftIds: ["morning"],
      mode,
      fixedBatteryPacks: 16,
      predictionOverrides: {
        "prediction-morning": prediction(
          "prediction-morning",
          "morning",
          16,
          meanDemandKwh,
        ),
      },
      batteryResultOverrides: {
        morning: {
          reference_packs: 16,
          base_packs: 10,
          optimized_packs: 16,
          required_total_packs: 16,
          optimized_kwh: 800,
          max_physical_packs: 16,
          max_physical_kwh: 800,
          physical_feasible: true,
          feasibility_status: "feasible",
        },
      },
      perBusSummaryOverrides: {
        morning: {
          min_soc_kwh: 160,
          max_soc_kwh: 720,
          total_charged_kwh: plannedChargingKwh,
          num_charging_sessions: 2,
        },
      },
    });

    await selectShiftScope(page, "morning");

    const adequacy = page.locator(".efficiency-adequacy-panel");
    await expect(adequacy).toContainText("Shift energy adequacy");
    await expect(adequacy.locator('[data-role="battery-adequacy-usable"]')).toHaveText("560.0 kWh (20%–90%)");
    await expect(adequacy.locator('[data-role="battery-adequacy-charging"]')).toContainText("84.1 kWh");
    await expect(adequacy.locator('[data-role="battery-adequacy-operational"]')).toContainText("644.1 kWh");
    await expect(adequacy.locator('[data-role="battery-adequacy-minimum-soc"]')).toHaveText("160.0 kWh — limit ≥ 160.0 kWh (20%)");
    await expect(adequacy.locator('[data-role="battery-adequacy-maximum-soc"]')).toHaveText("720.0 kWh — limit ≤ 720.0 kWh (90%)");
    await expect(adequacy.locator('[data-role="battery-adequacy-mean"]')).toContainText("feasible in optimized schedule");
    await expect(adequacy.locator('[data-role="battery-adequacy-mean"] .badge')).toHaveClass(/badge--positive/);

    const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
    await expect(energyAdequacy).toContainText("Available operational energy");
    await expect(energyAdequacy).toContainText("Operational energy margin — mean basis");
    await expect(energyAdequacy).toContainText("0.0 kWh");
    await expect(energyAdequacy).toContainText("Sensitivity drivers");
    await expect(page.locator('[data-role="feasibility-shift-sensitivity"]')).toHaveCount(0);

    if (mode === "charging_only") {
      await expect(
        page.locator('[data-role="feasibility-shift-coverage-status"]'),
      ).toHaveText("Covered by selected battery and planned charging");
    }
  });
}

test("explains reached and configured SOC limits for the selected shift", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    mode: "joint",
    predictionOverrides: {
      "prediction-morning": prediction(
        "prediction-morning",
        "morning",
        10,
        350,
      ),
    },
    batteryResultOverrides: {
      morning: {
        reference_packs: 10,
        base_packs: 6,
        optimized_packs: 10,
        required_total_packs: 10,
        optimized_kwh: 500,
        max_physical_packs: 16,
        max_physical_kwh: 800,
        physical_feasible: true,
        feasibility_status: "feasible",
      },
    },
    perBusSummaryOverrides: {
      morning: {
        min_soc_kwh: 100,
        max_soc_kwh: 450,
        total_charged_kwh: 263.0127454632992,
        num_charging_sessions: 2,
      },
    },
  });

  await selectShiftScope(page, "morning");

  const adequacy = page.locator(".efficiency-adequacy-panel");
  await expect(adequacy).toContainText("Usable SOC window");
  await expect(adequacy.locator('[data-role="battery-adequacy-usable"]')).toHaveText(
    "350.0 kWh (20%–90%)",
  );
  await expect(adequacy).toContainText("Minimum SOC reached");
  await expect(adequacy.locator('[data-role="battery-adequacy-minimum-soc"]')).toHaveText(
    "100.0 kWh — limit ≥ 100.0 kWh (20%)",
  );
  await expect(adequacy).toContainText("Maximum SOC reached");
  await expect(adequacy.locator('[data-role="battery-adequacy-maximum-soc"]')).toHaveText(
    "450.0 kWh — limit ≤ 450.0 kWh (90%)",
  );
});

test("separates the common result from one selected shift without an aggregate option", async ({ page }) => {
  await mountResults(page);

  const general = page.locator('[data-role="feasibility-general-level"]');
  const shiftDetail = page.locator('[data-role="feasibility-shift-level"]');
  const selector = page.locator('[data-role="shift-tabs"]');

  await expect(page.locator(".results-toolbar")).toHaveCount(0);
  await expect(page.locator('[data-role="results-page-title"]')).toHaveText(
    "Feasibility evaluation results - Multi-shift feasibility",
  );
  await expect(
    page.locator(".page-header .result-header-action"),
  ).toHaveText("View raw feasibility data");
  await expect(general).toBeVisible();
  await expect(shiftDetail).toHaveCount(0);
  await expect(page.locator(".results-tabs")).toHaveCount(0);
  await expect(page.locator(".results-tab")).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-shift-predictions"]')).toHaveCount(0);
  await expect(general).toContainText("Fleet evaluation");
  await expect(general.locator('[data-role="feasibility-mode"]')).toHaveText(
    "Optimization mode: Battery only",
  );
  await expect(general.locator('[data-role="feasibility-overall-status"]')).toHaveText(
    "All shifts are feasible",
  );
  await expect(general.locator('[data-role="feasibility-overall-status"]')).toHaveClass(
    /feasibility-overall-status--feasible/,
  );
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("12");
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("Optimized");
  await expect(general.locator('[data-role="feasibility-shared-infrastructure"]')).toContainText("Fixed");
  await expect(general.locator('[data-role="feasibility-shift-count"]')).toContainText("2");
  await expect(general.locator('[data-role="feasibility-limiting-shifts"]')).toContainText("Evening service");
  await expect(general.locator('[data-station-status="fixed"]')).toContainText("Fixed");
  await expect(general.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(general.locator('[data-role="feasibility-total-plugs"]')).toHaveText("2");
  await expect(general.locator('[data-role="feasibility-total-power"]')).toHaveText("300 kW DC");
  await expect(
    general.locator('[data-role="feasibility-fleet-battery"] .feasibility-general-card__value'),
  ).toHaveText("12 packs · 600 kWh");
  await expect(general.locator(".feasibility-general-card__value small")).toHaveCount(0);
  await expect(general.locator(".feasibility-infrastructure-metrics small")).toHaveCount(0);
  await expect(general.locator(".feasibility-level__eyebrow")).toHaveCount(0);
  const generalPresentation = await general.evaluate((section) => {
    const cardStyle = getComputedStyle(section);
    const metricGrid = section.querySelector(".result-metric-grid");
    const metric = section.querySelector(".result-metric");
    const decision = section.querySelector(".feasibility-decision");
    return {
      background: cardStyle.backgroundColor,
      borderStyle: cardStyle.borderStyle,
      shadow: cardStyle.boxShadow,
      metricGridColumns: metricGrid ? getComputedStyle(metricGrid).gridTemplateColumns : "",
      metricBackground: metric ? getComputedStyle(metric).backgroundColor : "",
      decisionBorderWidth: decision ? getComputedStyle(decision).borderWidth : "",
      decisionBackground: decision ? getComputedStyle(decision).backgroundColor : "",
    };
  });
  expect(generalPresentation).toMatchObject({
    background: "rgb(255, 255, 255)",
    borderStyle: "solid",
    metricBackground: "rgba(0, 0, 0, 0)",
    decisionBorderWidth: "0px",
    decisionBackground: "rgba(0, 0, 0, 0)",
  });
  expect(generalPresentation.shadow).not.toBe("none");
  expect(generalPresentation.metricGridColumns).not.toBe("");
  const generalMetricLayout = await general.evaluate((section) => {
    const pairs = [
      ...section.querySelectorAll(".feasibility-general-card__heading"),
      ...section.querySelectorAll(".feasibility-infrastructure-metrics > div"),
    ].map((row) => {
      const label = row.querySelector(":scope > span");
      const value = row.querySelector(
        ":scope > .feasibility-general-card__value, :scope > .feasibility-general-card__result .feasibility-general-card__value, :scope > strong",
      );
      if (!label || !value) return null;
      const labelStyle = getComputedStyle(label);
      const valueStyle = getComputedStyle(value);
      const labelBox = label.getBoundingClientRect();
      const valueBox = value.getBoundingClientRect();
      return {
        labelFontFamily: labelStyle.fontFamily,
        valueFontFamily: valueStyle.fontFamily,
        labelFontSize: labelStyle.fontSize,
        valueFontSize: valueStyle.fontSize,
        topDifference: Math.abs(labelBox.top - valueBox.top),
      };
    }).filter(Boolean);
    return { pairs, viewportWidth: window.innerWidth };
  });
  expect(generalMetricLayout.pairs).toHaveLength(8);
  generalMetricLayout.pairs.forEach((pair) => {
    expect(pair.labelFontFamily).toBe(pair.valueFontFamily);
    expect(pair.labelFontSize).toBe(pair.valueFontSize);
    if (generalMetricLayout.viewportWidth > 620) {
      expect(pair.topDifference).toBeLessThanOrEqual(1);
    }
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);

  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1000, height: 850 });
    await page.locator(".results-main").evaluate((main) => { main.scrollTop = 0; });
    await page.screenshot({ path: "guide/images/feasibility-efficiency.png" });
  }

  await expect(selector).toBeVisible();
  await expect(selector).toHaveAttribute("role", "tablist");
  await expect(selector.locator('[data-action="select-result-scope"]')).toHaveCount(3);
  await expect(selector).not.toContainText("All");
  const generalTab = selector.getByRole("tab", { name: "General" });
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(generalTab).toHaveAttribute("tabindex", "0");

  await selectShiftScope(page, "morning");
  await expect(general).toHaveCount(0);
  await expect(shiftDetail).toBeVisible();
  await expect(page.locator(".results-tabs, .results-tab")).toHaveCount(0);
  await expect(
    shiftDetail.locator('[data-role="feasibility-selected-shift"]'),
  ).toHaveClass(/sr-only/);
  await expect(shiftDetail).not.toContainText("Shift detail");
  await expect(shiftDetail).not.toContainText(
    "Energy demand and operating details for the selected shift.",
  );

  const shiftSummary = shiftDetail.locator('[data-role="feasibility-shift-summary"]');
  await expect(shiftSummary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Covered by selected battery and planned charging");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText("8");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-common-packs"]')).toContainText("8");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-pack-margin"]')).toContainText("0 packs");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-min-soc"]')).toContainText("120.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-charged-energy"]')).toContainText("80.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-session-count"]')).toContainText("2");
  await expect(
    shiftSummary.locator('[data-role="feasibility-shift-required-packs"]'),
  ).toHaveText(/Shift battery requirement\s+8 packs/);
  await expect(shiftSummary.locator(".feasibility-shift-metrics strong small")).toHaveCount(0);
  const shiftMetricLayout = await shiftSummary
    .locator(".feasibility-shift-metrics")
    .evaluate((grid) => {
      const rows = [...grid.querySelectorAll(":scope > article")].map((row) => {
        const label = row.querySelector(":scope > span:first-child");
        const value = row.querySelector("strong");
        if (!label || !value) return null;
        const labelStyle = getComputedStyle(label);
        const valueStyle = getComputedStyle(value);
        const labelBox = label.getBoundingClientRect();
        const valueBox = value.getBoundingClientRect();
        return {
          labelFontFamily: labelStyle.fontFamily,
          valueFontFamily: valueStyle.fontFamily,
          labelFontSize: labelStyle.fontSize,
          valueFontSize: valueStyle.fontSize,
          topDifference: Math.abs(labelBox.top - valueBox.top),
        };
      }).filter(Boolean);
      return { rows, viewportWidth: window.innerWidth };
    });
  expect(shiftMetricLayout.rows).toHaveLength(8);
  shiftMetricLayout.rows.forEach((row) => {
    expect(row.labelFontFamily).toBe(row.valueFontFamily);
    expect(row.labelFontSize).toBe(row.valueFontSize);
    if (shiftMetricLayout.viewportWidth > 620) {
      expect(row.topDifference).toBeLessThanOrEqual(1);
    }
  });
  const chargingPlan = shiftDetail.locator('[data-role="feasibility-charging-plan"]');
  const chargingSessions = chargingPlan.locator('[data-role="feasibility-charging-session"]');
  await expect(chargingPlan).toHaveAttribute("data-status", "complete");
  await expect(chargingPlan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveText("2");
  await expect(chargingSessions).toHaveCount(2);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-location"]')).toHaveText("Depot");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-start"]')).toContainText("01:00");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-end"]')).toContainText("01:30");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-duration"]')).toContainText("30");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-energy"]')).toContainText("60.0");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-average-power"]')).toContainText("120.0");
  await expect(chargingSessions.first().locator(".feasibility-charging-session__location")).toContainText(/Charging session 1:\s*Depot/);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-duration"]')).toContainText(/Duration:\s*30 min/);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-energy"]')).toContainText(/Energy:\s*60\.0 kWh/);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-average-power"]')).toContainText(/Average power:\s*120\.0 kW/);

  const visualAnalysis = shiftDetail.locator('[data-role="feasibility-shift-visual-analysis"]');
  const energyAdequacy = shiftDetail.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(visualAnalysis).toHaveAttribute("data-status", "available");
  await expect(visualAnalysis.locator("h3")).toHaveText("Visual analysis");
  await expect(visualAnalysis.locator("svg")).toHaveCount(2);
  await expect(visualAnalysis).not.toContainText("Compare simulated");
  await expect(visualAnalysis).not.toContainText("exceedance probability");
  await expect(visualAnalysis).not.toContainText(
    "Compare drivetrain and auxiliary demand for each battery-pack scenario.",
  );
  const chartCardLayout = await visualAnalysis
    .locator(".efficiency-chart-card")
    .evaluateAll((cards) => ({
      viewportWidth: window.innerWidth,
      cards: cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { top: box.top, height: box.height };
      }),
    }));
  expect(chartCardLayout.cards).toHaveLength(2);
  if (chartCardLayout.viewportWidth > 900) {
    expect(Math.abs(chartCardLayout.cards[0].top - chartCardLayout.cards[1].top)).toBeLessThanOrEqual(1);
    expect(Math.abs(chartCardLayout.cards[0].height - chartCardLayout.cards[1].height)).toBeLessThanOrEqual(1);
  }
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "feasible");
  await expect(energyAdequacy).toContainText("Shift energy adequacy");
  await expect(energyAdequacy).toContainText("Sensitivity drivers");
  await expect(energyAdequacy).toContainText("350.0 kWh");
  await expect(energyAdequacy).not.toContainText("550.0 kWh");
  await expect(visualAnalysis.locator(".efficiency-adequacy-panel")).toHaveCount(0);
  await expect(energyAdequacy.locator(".efficiency-adequacy-panel")).toHaveCount(1);
  await expect(shiftDetail).not.toContainText("Sensitivity / Feasibility Insight");

  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1900, height: 1000 });
    await page.locator(".results-main").evaluate((main) => { main.scrollTop = 0; });
    await page.screenshot({ path: "guide/images/feasibility-sizing.png" });
  }

  const shiftSectionOrder = await shiftDetail
    .locator(".feasibility-level__content > *")
    .evaluateAll((elements) => elements.slice(0, 5).map((element) => element.dataset.role));
  expect(shiftSectionOrder).toEqual([
    "feasibility-shift-summary",
    "aggregate-energy",
    "feasibility-shift-visual-analysis",
    "feasibility-shift-energy-adequacy",
    "feasibility-charging-plan",
  ]);

  const chargingLayout = await chargingPlan.evaluate((plan) => {
    const list = plan.querySelector('[data-role="feasibility-charging-session-list"]');
    const session = plan.querySelector('[data-role="feasibility-charging-session"]');
    const visual = plan.parentElement?.querySelector(
      '[data-role="feasibility-shift-visual-analysis"]',
    );
    const sensitivityCard = plan.parentElement?.querySelector(
      '[data-role="feasibility-shift-energy-adequacy"]',
    );
    if (!list || !session || !visual || !sensitivityCard) return null;
    const sessionStyle = getComputedStyle(session);
    const location = session.querySelector(".feasibility-charging-session__location");
    const duration = session.querySelector(
      '[data-role="feasibility-charging-session-duration"]',
    );
    const sessionRows = sessionStyle.gridTemplateRows
      .split(" ")
      .filter(Boolean);
    return {
      listOverflowX: getComputedStyle(list).overflowX,
      sessionDisplay: sessionStyle.display,
      locationDisplay: location ? getComputedStyle(location).display : null,
      durationDisplay: duration ? getComputedStyle(duration).display : null,
      sessionRows,
      sessionHeight: session.getBoundingClientRect().height,
      visualBeforePlan:
        visual.getBoundingClientRect().top < plan.getBoundingClientRect().top,
      sensitivityBeforePlan:
        sensitivityCard.getBoundingClientRect().top < plan.getBoundingClientRect().top,
      metricValuesFit: [...session.querySelectorAll(".feasibility-charging-session__metrics dd")]
        .every((value) => value.scrollWidth <= value.clientWidth),
    };
  });
  expect(chargingLayout).toMatchObject({
    listOverflowX: "auto",
    sessionDisplay: "grid",
    locationDisplay: "flex",
    durationDisplay: "flex",
    visualBeforePlan: true,
    sensitivityBeforePlan: true,
    metricValuesFit: true,
  });
  expect(chargingLayout?.sessionRows).toHaveLength(1);
  expect(chargingLayout?.sessionHeight).toBeLessThanOrEqual(48);

  const moreInformation = shiftDetail.locator("details.ya-more-information");
  const inlinePredictions = moreInformation.locator(
    '[data-role="feasibility-shift-predictions"]',
  );
  await expect(moreInformation).not.toHaveAttribute("open", "");
  await expect(inlinePredictions).toBeHidden();
  await moreInformation.locator(":scope > summary").click();
  await expect(moreInformation).toHaveAttribute("open", "");
  await expect(inlinePredictions).toBeVisible();
  await expect(inlinePredictions.locator("h3").first()).toHaveText("Predictions");
  await expect(inlinePredictions).toContainText("350.0 kWh");
  await expect(inlinePredictions).not.toContainText("550.0 kWh");
  await expect(inlinePredictions.locator("svg")).not.toHaveCount(0);
  const lastMoreInformationSection = await moreInformation
    .locator(".ya-more-information__content > *")
    .last()
    .getAttribute("data-role");
  expect(lastMoreInformationSection).toBe("feasibility-shift-predictions");

  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Morning service");

  await selector.getByRole("tab", { name: "Evening service" }).click();
  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Evening service");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Largest selected battery");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText("12");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-pack-margin"]')).toContainText("0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-min-soc"]')).toContainText("60.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-charged-energy"]')).toContainText("140.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-session-count"]')).toContainText("3");
  await expect(chargingPlan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveText("3");
  await expect(chargingSessions).toHaveCount(3);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-start"]')).toContainText("23:50");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-end"]')).toContainText("00:10");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-end"]')).toContainText("next day");
  await expect(chargingSessions.nth(1).locator('[data-role="feasibility-charging-session-start"]')).toContainText("01:00");
  await expect(chargingSessions.nth(1).locator('[data-role="feasibility-charging-session-start"]')).toContainText("next day");
  await expect(visualAnalysis).toHaveAttribute("data-status", "available");
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "feasible");
  await expect(energyAdequacy).toContainText("550.0 kWh");
  await expect(energyAdequacy).not.toContainText("350.0 kWh");
  await expect(moreInformation).toHaveAttribute("open", "");
  await expect(inlinePredictions).toBeVisible();
  await expect(inlinePredictions).toContainText("550.0 kWh");
  await expect(inlinePredictions).not.toContainText("350.0 kWh");
  await generalTab.click();
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("12");
  await expect(general.locator('[data-role="feasibility-limiting-shifts"]')).toContainText("Evening service");
  await expect(shiftDetail).toHaveCount(0);
  await expect(page.locator(".results-tabs, .results-tab")).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-shift-predictions"]')).toHaveCount(0);
});

test("supports keyboard navigation, duplicate names, safe labels, and horizontal overflow", async ({ page }) => {
  const unsafeName = '<img src=x onerror="window.__scopeXss = true">Shared service';
  await mountResults(page, {
    shiftNames: {
      morning: unsafeName,
      evening: unsafeName,
    },
  });

  const selector = scopeSelector(page);
  const tabs = selector.getByRole("tab");
  const generalTab = selector.getByRole("tab", { name: "General" });
  const morningTab = selector.getByRole("tab", { name: `${unsafeName} (1)` });
  const eveningTab = selector.getByRole("tab", { name: `${unsafeName} (2)` });

  await expect(tabs).toHaveCount(3);
  await expect(selector.locator("img")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__scopeXss)).toBeUndefined();
  await expect(selector).toHaveCSS("overflow-x", "auto");
  await expect(morningTab).toHaveCSS("white-space", "nowrap");

  await generalTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(morningTab).toHaveAttribute("aria-selected", "true");
  await expect(morningTab).toBeFocused();
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveText(unsafeName);

  await page.keyboard.press("End");
  await expect(eveningTab).toHaveAttribute("aria-selected", "true");
  await expect(eveningTab).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(generalTab).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(eveningTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
});

test("never reuses another shift prediction when the selected shift has none", async ({ page }) => {
  await mountResults(page, {
    predictionRunIds: ["prediction-morning"],
  });

  await selectShiftScope(page, "evening");

  const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(energyAdequacy).toBeVisible();
  await expect(energyAdequacy).not.toContainText("350.0 kWh");
  await expect(energyAdequacy).not.toContainText("-10 °C");

  const visualAnalysis = page.locator('[data-role="feasibility-shift-visual-analysis"]');
  await expect(visualAnalysis).toHaveAttribute("data-status", "unavailable");
  await expect(visualAnalysis.locator('[data-role="feasibility-shift-visual-analysis-empty"]')).toHaveText(
    "No prediction data available.",
  );
  await expect(visualAnalysis.locator("svg")).toHaveCount(0);

  await page.locator("details.ya-more-information > summary").click();
  const predictionsPanel = page.locator('[data-role="feasibility-shift-predictions"]');
  await expect(predictionsPanel).toContainText("No prediction summaries available");
  await expect(predictionsPanel).not.toContainText("350.0");
});

test("does not match predictions from an equally named but differently identified shift", async ({ page }) => {
  await mountResults(page, {
    shiftNames: {
      morning: "Shared service name",
      evening: "Shared service name",
    },
    predictionRunIds: ["prediction-morning"],
    predictionOverrides: {
      "prediction-morning": {
        ...prediction("prediction-morning", "morning", 8, 350),
        shift_name: "Shared service name",
      },
    },
  });

  await selectShiftScope(page, "evening");
  await page.locator("details.ya-more-information > summary").click();

  await expect(page.locator('[data-role="feasibility-shift-predictions"]')).toContainText(
    "No prediction summaries available",
  );
});

test("does not present an aggregate multi-shift prediction as one physical shift", async ({ page }) => {
  await mountResults(page, {
    predictionRunIds: ["prediction-aggregate"],
    predictionOverrides: {
      "prediction-aggregate": {
        ...prediction("prediction-aggregate", undefined, 12, 900),
        shift_ids: ["morning", "evening"],
      },
    },
  });

  await selectShiftScope(page, "morning");
  await page.locator("details.ya-more-information > summary").click();
  const predictionsPanel = page.locator('[data-role="feasibility-shift-predictions"]');
  await expect(predictionsPanel).toContainText("No prediction summaries available");
  await expect(predictionsPanel).not.toContainText("900.0");
});

test("keeps general and the physical shift available for a single-shift result", async ({ page }) => {
  await mountResults(page, { shiftIds: ["morning"] });

  const selector = scopeSelector(page);
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("tab")).toHaveCount(2);
  await expect(selector.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-role="feasibility-shift-count"]')).toContainText("1");
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveCount(0);
  await selectShiftScope(page, "morning");
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Morning service");
  await expect(page.locator('[data-role="feasibility-fleet-battery"]')).toHaveCount(0);
});

test("renders unavailable values safely when a historical result has no shift details", async ({ page }) => {
  await mountResults(page, {
    shiftIds: [],
    includeInfrastructureInput: false,
  });

  const selector = scopeSelector(page);
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("tab")).toHaveCount(1);
  await expect(selector.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-role="feasibility-shift-count"]')).toContainText("0");
  await expect(page.locator('[data-role="feasibility-fleet-battery"] .feasibility-general-card__value')).toHaveText("—");
  await expect(page.locator('[data-role="feasibility-infrastructure-unavailable"]')).toBeVisible();
  await expect(page.locator('[data-role="feasibility-shift-summary"]')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-charging-plan"]')).toHaveCount(0);
});

test("shows an explicit overall infeasible status without replacing the general configuration", async ({ page }) => {
  await mountResults(page, { electrificationFeasible: false });

  const general = page.locator('[data-role="feasibility-general-level"]');
  const status = general.locator('[data-role="feasibility-overall-status"]');
  await expect(status).toHaveText("Not all shifts are feasible");
  await expect(status).toHaveClass(/feasibility-overall-status--infeasible/);
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("12");
  await expect(general.locator('[data-role="feasibility-infrastructure"]')).toBeVisible();
});

test("keeps a missing historical overall status visibly unknown", async ({ page }) => {
  await mountResults(page, { includeElectrificationFeasible: false });

  const status = page.locator('[data-role="feasibility-overall-status"]');
  await expect(status).toHaveText("Feasibility status unavailable");
  await expect(status).toHaveClass(/feasibility-overall-status--unknown/);
});

test("distinguishes a shift with no required charging from missing schedule details", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        total_charged_kwh: 0,
        num_charging_sessions: 0,
        charging_sessions: [],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "empty");
  await expect(plan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveText("0");
  await expect(plan.locator('[data-role="feasibility-charging-plan-empty"]')).toContainText("No charging sessions are required");
  await expect(plan.locator('[data-role="feasibility-charging-session-list"]')).toHaveCount(0);
});

test("explains when sessions are reported without time and location rows", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: 2,
        charging_sessions: [],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "unavailable");
  await expect(plan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveText("2");
  await expect(plan.locator('[data-role="feasibility-charging-plan-unavailable"]')).toContainText("2 charging sessions are reported");
  await expect(plan.locator('[data-role="feasibility-charging-session-list"]')).toHaveCount(0);
});

test("does not present missing historical charging fields as a zero-session result", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: undefined,
        charging_sessions: undefined,
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "unavailable");
  await expect(plan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveCount(0);
  await expect(plan.locator('[data-role="feasibility-charging-plan-unavailable"]')).toContainText("Charging times and locations are not available");
  await expect(plan.locator('[data-role="feasibility-charging-plan-empty"]')).toHaveCount(0);
});

test("keeps available rows visible when the reported charging plan is partial", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: 2,
        charging_sessions: [{
          start_minute: 720,
          end_minute: 730,
          duration_minutes: 10,
          station_stop_id: "terminal",
          station_name: "Central terminal",
          energy_kwh: 25,
        }],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "partial");
  await expect(plan.locator('[data-role="feasibility-charging-plan-partial"]')).toContainText("1 of 2 reported charging sessions");
  await expect(plan.locator('[data-role="feasibility-charging-session"]')).toHaveCount(1);
  await expect(plan.locator('[data-role="feasibility-charging-session-location"]')).toHaveText("Central terminal");
  await expect(plan.locator('[data-role="feasibility-charging-session-start"]')).toContainText("12:00");
  await expect(plan.locator('[data-role="feasibility-charging-session-end"]')).toContainText("12:10");
});

test("renders charging locations as text without interpreting backend HTML", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: 1,
        charging_sessions: [{
          start_minute: 720,
          end_minute: 730,
          duration_minutes: 10,
          station_stop_id: '<svg onload="window.__chargingXss = true">',
          station_name: '<img src=x onerror="window.__chargingXss = true">Depot',
          energy_kwh: 25,
        }],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan.locator('[data-role="feasibility-charging-session-location"]')).toHaveText('<img src=x onerror="window.__chargingXss = true">Depot');
  await expect(plan.locator("img, svg")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__chargingXss)).toBeUndefined();
});

test("shows an infeasible shift as a shortfall against the common physical battery", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    batteryResultOverrides: {
      morning: {
        optimized_packs: 16,
        required_total_packs: 18,
        optimized_kwh: 900,
        max_physical_packs: 16,
        max_physical_kwh: 800,
        excess_packs: 2,
        physical_feasible: false,
        feasibility_status: "infeasible",
      },
    },
  });

  await selectShiftScope(page, "morning");

  const summary = page.locator('[data-role="feasibility-shift-summary"]');
  await expect(summary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Battery shortfall");
  await expect(summary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText("18");
  await expect(summary.locator('[data-role="feasibility-shift-common-packs"]')).toContainText("16");
  await expect(summary.locator('[data-role="feasibility-shift-pack-margin"]')).toContainText("-2");
  await expect(summary.locator('[data-role="feasibility-shift-physical-limit"]')).toContainText("Exceeds physical pack limit");
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"]')).toHaveAttribute(
    "data-status",
    "available",
  );
  await expect(page.locator('[data-role="feasibility-shift-energy-adequacy"]')).toHaveAttribute(
    "data-feasibility",
    "infeasible",
  );
});

test("keeps each shift feasibility independent from an infeasible overall result", async ({ page }) => {
  await mountResults(page, {
    electrificationFeasible: false,
    batteryResultOverrides: {
      evening: {
        physical_feasible: false,
        feasibility_status: "infeasible",
      },
    },
  });

  await selectShiftScope(page, "morning");
  const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "feasible");
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"] svg')).toHaveCount(2);

  await selectShiftScope(page, "evening");
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "infeasible");
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"] svg')).toHaveCount(2);
});

test("shows an unknown shift status without hiding available visual analysis", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    includeElectrificationFeasible: false,
    batteryResultOverrides: {
      morning: {
        optimized_packs: undefined,
        required_total_packs: undefined,
        physical_feasible: undefined,
        feasibility_status: undefined,
      },
    },
  });

  await selectShiftScope(page, "morning");

  const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "unknown");
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"]')).toHaveAttribute(
    "data-status",
    "available",
  );
});

test("shows one complete shared infrastructure for joint optimization across every shift", async ({ page }) => {
  await mountResults(page, {
    mode: "joint",
    chargingStations: [
      {
        stop_id: "depot",
        stop_name: "Depot",
        num_slots: 3,
        max_power_per_slot_kw: 150,
        max_total_power_kw: 400,
      },
      {
        stop_id: "terminal",
        stop_name: "Terminal",
        num_slots: 2,
        max_power_per_slot_kw: 100,
      },
    ],
    installedChargers: {
      depot: { stop_name: "Depot", num_slots: 2, cost_chf: 30_000 },
      terminal: { stop_name: "Terminal", num_slots: 0, cost_chf: 0 },
    },
    stationUtilization: {
      depot: { peak_concurrent_buses: 2, total_energy_kwh: 420.5 },
      terminal: { peak_concurrent_buses: 0, total_energy_kwh: 0 },
    },
    totalInstallationCostChf: 30_000,
  });

  const infrastructure = page.locator('[data-role="feasibility-infrastructure"]');
  await expect(page.locator('[data-role="feasibility-mode"]')).toHaveText(
    "Optimization mode: Joint",
  );
  await expect(page.locator('[data-role="feasibility-fleet-battery"]')).toContainText("Optimized");
  await expect(page.locator('[data-role="feasibility-shared-infrastructure"]')).toContainText("Optimized");
  await expect(infrastructure).toContainText("Configuration available");
  await expect(infrastructure.locator('tbody tr')).toHaveCount(2);
  await expect(infrastructure.locator('[data-station-status="installed"]')).toContainText("Installed");
  await expect(infrastructure.locator('[data-station-status="rejected"]')).toContainText("Not installed");
  await expect(infrastructure.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(infrastructure.locator('[data-role="feasibility-total-plugs"]')).toHaveText("2");
  await expect(infrastructure.locator('[data-role="feasibility-total-power"]')).toContainText("300");
  await expect(infrastructure.locator('[data-role="feasibility-total-installation-cost"]')).toContainText(/30['’]000/);
  await expect(infrastructure.locator('[data-station-status="installed"]')).toContainText("420.5");

  await selectShiftScope(page, "evening");
  await scopeSelector(page).getByRole("tab", { name: "General" }).click();
  await expect(infrastructure.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(infrastructure.locator('tbody tr')).toHaveCount(2);
});

test("keeps unresolved candidates visible without presenting partial totals as final", async ({ page }) => {
  await mountResults(page, {
    mode: "charging_only",
    chargingStations: [
      { stop_id: "resolved", stop_name: "Resolved", num_slots: 2, max_power_per_slot_kw: 100 },
      { stop_id: "pending", stop_name: "Pending", num_slots: 1, max_power_per_slot_kw: 150 },
    ],
    installedChargers: {
      resolved: { stop_name: "Resolved", num_slots: 1, cost_chf: 10_000 },
    },
  });

  const infrastructure = page.locator('[data-role="feasibility-infrastructure"]');
  await expect(page.locator('[data-role="feasibility-mode"]')).toHaveText(
    "Optimization mode: Charging",
  );
  await expect(page.locator('[data-role="feasibility-fleet-battery"]')).toContainText("Fixed");
  await expect(page.locator('[data-role="feasibility-shared-infrastructure"]')).toContainText("Optimized");
  await expect(infrastructure).toContainText("Configuration incomplete");
  await expect(infrastructure.locator('[data-role="feasibility-infrastructure-incomplete"]')).toBeVisible();
  await expect(infrastructure.locator('[data-station-status="candidate"]')).toContainText("Candidate");
  await expect(infrastructure.locator('[data-role="feasibility-active-locations"]')).toHaveText("—");
  await expect(infrastructure.locator('[data-role="feasibility-total-plugs"]')).toHaveText("—");
  await expect(infrastructure.locator('[data-role="feasibility-total-power"]')).toHaveText("—");
});

test("distinguishes a resolved configuration with no charging locations from missing data", async ({ page }) => {
  await mountResults(page, {
    mode: "joint",
    chargingStations: [],
    installedChargers: {},
    totalInstallationCostChf: 0,
  });

  await expect(page.locator('[data-role="feasibility-infrastructure-empty"]')).toBeVisible();
  await expect(page.locator('[data-role="feasibility-active-locations"]')).toHaveText("0");
  await expect(page.locator('[data-role="feasibility-total-plugs"]')).toHaveText("0");
  await expect(page.locator('[data-role="feasibility-total-power"]')).toContainText("0");
  await expect(page.locator('[data-role="feasibility-total-installation-cost"]')).toContainText("CHF 0");
});

const aggregateAnalysis = () => ({
  status: 'available', optimization_basis: 'mean',
  per_shift: { morning: {
    status: 'available', selected_packs: 8, max_packs: 16, pack_size_kwh: 50,
    nominal_kwh: 400, usable_kwh: 280, min_soc: .2, max_soc: .9, state_of_health: 1,
    verified_soc_kwh: [360,200,260,120],
    trajectory_validation: {samples:100000,completion_probability:.932},
    statistics: {samples:100000,seed:42,q95_total_kwh:360,q95_monte_carlo_ci95_kwh:[359.8,360.2],precision_met:true},
    cases: {
      mean: {required_usable_kwh:240,margin_kwh:40,total_consumption_kwh:300,accepted_charge_kwh:60,soc_kwh:[360,200,260,120],first_minute:480},
      aggregate_q95: {required_usable_kwh:300,margin_kwh:-20,total_consumption_kwh:360,accepted_charge_kwh:60,soc_kwh:[360,170,230,60],first_minute:480},
    },
  }},
});

for (const mode of ['battery_only','charging_only','joint']) {
  test(`aggregate energy exposes usable capacity, timed charging and Q95 deficit in ${mode}`, async ({page}) => {
    await mountResults(page, {mode,shiftIds:['morning'],consumptionBasis:'mean',consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'}});
    await selectShiftScope(page,'morning');
    const card=page.locator('[data-role="aggregate-energy"]');
    await expect(card).toHaveAttribute('data-status','available');
    await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(8);
    await expect(card.locator('.aggregate-pack--unused')).toHaveCount(8);
    await expect(card).toContainText('400 kWh');
    await expect(card).toContainText('280 kWh');
    await expect(card.locator('[data-basis="aggregate_q95"]')).toContainText('deficit 20 kWh');
    await expect(card.locator('svg')).toBeVisible();
    await expect(card.locator('.aggregate-coverage')).toContainText('93.2%');
    await expect(card.locator('.aggregate-soc--verified')).toHaveCount(1);
    await expect(page.locator('[data-role="efficiency-consumption-coverage-chart"]')).toHaveCount(0);
    const box=await card.boundingBox();
    expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width+1);
    if(process.env.FE12_SCREENSHOTS) await card.screenshot({path:`/tmp/elettra-fe12-${mode}-${page.viewportSize().width}.png`});
  });
}

test('choosing Q95 preserves current design until an explicit optimization is started', async ({page}) => {
  let writes=0;
  await mountResults(page,{shiftIds:['morning'],consumptionBasis:'mean',consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'}});
  await page.route('**/optimization-runs/level-test/basis/aggregate_q95', route => {
    const started=route.request().method()==='POST'; if(started) writes++;
    return route.fulfill({json:{optimization_run_id:started?'new-q95':null,status:started?'pending':'not_calculated'}});
  });
  await selectShiftScope(page,'morning');
  const card=page.locator('[data-role="aggregate-energy"]');
  await card.locator('select').selectOption('aggregate_q95');
  await expect(card.locator('[data-role="aggregate-basis-message"]')).toContainText('No compatible result');
  await expect(card.locator('[data-role="aggregate-current-basis"]')).toHaveText('Mean');
  await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(8);
  expect(writes).toBe(0);
  await page.evaluate(() => document.addEventListener('partial:request',event=>{window.__basisNavigation=event.detail;event.stopImmediatePropagation();},true));
  await card.locator('[data-role="aggregate-basis-action"]').click();
  await expect.poll(()=>writes).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__basisNavigation?.runId)).toBe('new-q95');
});

test('a cached Q95 result opens without starting another optimization', async ({page}) => {
  let writes=0;
  await mountResults(page,{shiftIds:['morning'],consumptionBasis:'mean',consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'}});
  await page.route('**/optimization-runs/level-test/basis/aggregate_q95',route=>{
    if(route.request().method()==='POST') writes++;
    return route.fulfill({json:{optimization_run_id:'cached-q95',status:'completed'}});
  });
  await selectShiftScope(page,'morning');
  const card=page.locator('[data-role="aggregate-energy"]');
  await card.locator('select').selectOption('aggregate_q95');
  await expect(card.locator('[data-role="aggregate-basis-action"]')).toHaveText('Open evaluation');
  await page.evaluate(()=>document.addEventListener('partial:request',event=>{window.__basisNavigation=event.detail;event.stopImmediatePropagation();},true));
  await card.locator('[data-role="aggregate-basis-action"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__basisNavigation?.runId)).toBe('cached-q95');
  expect(writes).toBe(0);
});

test('historical infeasible results show virtual packs separately without invented aggregate margins', async ({page})=>{
  await mountResults(page,{shiftIds:['morning'],electrificationFeasible:false,batteryResultOverrides:{morning:{optimized_packs:16,required_total_packs:19,excess_packs:3,optimized_kwh:950,physical_feasible:false}}});
  await selectShiftScope(page,'morning');
  const card=page.locator('[data-role="aggregate-energy"]');
  await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(16);
  await expect(card.locator('.aggregate-pack--excess')).toHaveCount(3);
  await expect(card).toContainText('800 kWh');
  await expect(card).toContainText('Physical limit exceeded');
  await expect(card.locator('.aggregate-demand')).toHaveCount(0);
});

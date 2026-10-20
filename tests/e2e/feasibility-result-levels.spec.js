import { expect, test } from "@playwright/test";

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
  batteryResultOverrides = {},
  perBusSummaryOverrides = {},
} = {}) => {
  const shiftNames = {
    morning: "Morning service",
    evening: "Evening service",
  };
  const predictions = {
    "prediction-morning": prediction("prediction-morning", "morning", 8, 350),
    "prediction-evening": prediction("prediction-evening", "evening", 12, 550),
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
            min_soc: 0.2,
            max_soc: 0.9,
            ...(includeInfrastructureInput ? { charging_stations: chargingStations } : {}),
            ...(mode === "charging_only" ? { fixed_battery_packs: 12 } : {}),
          },
          prediction_run_ids: shiftIds.map((shiftId) => `prediction-${shiftId}`),
          results: {
            electrification_feasible: true,
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

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__cleanupSimulationResults?.());
});

test("separates the common result from one selected shift without an aggregate option", async ({ page }) => {
  await mountResults(page);

  const general = page.locator('[data-role="feasibility-general-level"]');
  const shiftDetail = page.locator('[data-role="feasibility-shift-level"]');
  const selector = page.locator('[data-role="shift-tabs"]');

  await expect(general).toBeVisible();
  await expect(shiftDetail).toBeVisible();
  await expect(general).toContainText("Common fleet configuration");
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("12");
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("Optimized");
  await expect(general.locator('[data-role="feasibility-shared-infrastructure"]')).toContainText("Fixed");
  await expect(general.locator('[data-role="feasibility-shift-count"]')).toContainText("2");
  await expect(general.locator('[data-role="feasibility-limiting-shifts"]')).toContainText("Evening service");
  await expect(general.locator('[data-station-status="fixed"]')).toContainText("Fixed");
  await expect(general.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(general.locator('[data-role="feasibility-total-plugs"]')).toHaveText("2");
  await expect(general.locator('[data-role="feasibility-total-power"]')).toContainText("300");

  const shiftSummary = shiftDetail.locator('[data-role="feasibility-shift-summary"]');
  await expect(shiftSummary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Covered by common battery");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText("8");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-common-packs"]')).toContainText("12");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-pack-margin"]')).toContainText("+4");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-min-soc"]')).toContainText("120.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-charged-energy"]')).toContainText("80.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-session-count"]')).toContainText("2");
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

  await expect(selector).toBeVisible();
  await expect(selector.locator('[data-action="select-shift"]')).toHaveCount(2);
  await expect(selector).not.toContainText("All");
  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Morning service");

  await selector.getByRole("button", { name: "Evening service" }).click();
  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Evening service");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Sizing shift");
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
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("12");
  await expect(general.locator('[data-role="feasibility-limiting-shifts"]')).toContainText("Evening service");
});

test("keeps a single shift selected and hides a redundant selector", async ({ page }) => {
  await mountResults(page, { shiftIds: ["morning"] });

  await expect(page.locator('[data-role="shift-tabs"]')).toBeHidden();
  await expect(page.locator('[data-role="feasibility-shift-count"]')).toContainText("1");
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Morning service");
  await expect(page.locator('[data-role="feasibility-fleet-battery"]')).toContainText("8");
});

test("renders unavailable values safely when a historical result has no shift details", async ({ page }) => {
  await mountResults(page, {
    shiftIds: [],
    includeInfrastructureInput: false,
  });

  await expect(page.locator('[data-role="shift-tabs"]')).toBeHidden();
  await expect(page.locator('[data-role="feasibility-shift-count"]')).toContainText("0");
  await expect(page.locator('[data-role="feasibility-fleet-battery"] .feasibility-general-card__value')).toHaveText("—");
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveText("—");
  await expect(page.locator('[data-role="feasibility-infrastructure-unavailable"]')).toBeVisible();
  await expect(page.locator('[data-role="feasibility-shift-summary"]')).toContainText("Operational details are not available");
  await expect(page.locator('[data-role="feasibility-charging-plan"]')).toHaveCount(0);
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

  const summary = page.locator('[data-role="feasibility-shift-summary"]');
  await expect(summary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Battery shortfall");
  await expect(summary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText("18");
  await expect(summary.locator('[data-role="feasibility-shift-common-packs"]')).toContainText("16");
  await expect(summary.locator('[data-role="feasibility-shift-pack-margin"]')).toContainText("-2");
  await expect(summary.locator('[data-role="feasibility-shift-physical-limit"]')).toContainText("Exceeds physical pack limit");
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
  await expect(infrastructure).toContainText("Configuration available");
  await expect(infrastructure.locator('tbody tr')).toHaveCount(2);
  await expect(infrastructure.locator('[data-station-status="installed"]')).toContainText("Installed");
  await expect(infrastructure.locator('[data-station-status="rejected"]')).toContainText("Not installed");
  await expect(infrastructure.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(infrastructure.locator('[data-role="feasibility-total-plugs"]')).toHaveText("2");
  await expect(infrastructure.locator('[data-role="feasibility-total-power"]')).toContainText("300");
  await expect(infrastructure.locator('[data-role="feasibility-total-installation-cost"]')).toContainText(/30['’]000/);
  await expect(infrastructure.locator('[data-station-status="installed"]')).toContainText("420.5");

  await page.locator('[data-role="shift-tabs"]').getByRole("button", { name: "Evening service" }).click();
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

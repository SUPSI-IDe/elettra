import { expect, test } from "@playwright/test";

const battery = (shiftName, packs) => ({
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

const mountResults = async (page, { shiftIds = ["morning", "evening"] } = {}) => {
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
      battery(shiftNames[shiftId], shiftId === "evening" ? 12 : 8),
    ]),
  );

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/api/v1/simulation/optimization-runs/level-test")) {
      await route.fulfill({
        json: {
          id: "level-test",
          name: "Multi-shift feasibility",
          mode: "battery_only",
          status: "completed",
          input_params: {
            shift_ids: shiftIds,
            mode: "battery_only",
            min_soc: 0.2,
            max_soc: 0.9,
            charging_stations: [{
              stop_id: "depot",
              stop_name: "Depot",
              num_slots: 2,
              max_power_per_slot_kw: 150,
            }],
          },
          prediction_run_ids: shiftIds.map((shiftId) => `prediction-${shiftId}`),
          results: {
            electrification_feasible: true,
            battery_results: batteryResults,
            per_bus_summary: shiftIds.map((shiftId) => ({
              shift_id: shiftId,
              shift_name: shiftNames[shiftId],
              total_charged_kwh: 0,
              num_charging_sessions: 0,
              charging_sessions: [],
            })),
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

  await expect(selector).toBeVisible();
  await expect(selector.locator('[data-action="select-shift"]')).toHaveCount(2);
  await expect(selector).not.toContainText("All");
  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Morning service");

  await selector.getByRole("button", { name: "Evening service" }).click();
  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Evening service");
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
  await mountResults(page, { shiftIds: [] });

  await expect(page.locator('[data-role="shift-tabs"]')).toBeHidden();
  await expect(page.locator('[data-role="feasibility-shift-count"]')).toContainText("0");
  await expect(page.locator('[data-role="feasibility-fleet-battery"] .feasibility-general-card__value')).toHaveText("—");
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveText("—");
});

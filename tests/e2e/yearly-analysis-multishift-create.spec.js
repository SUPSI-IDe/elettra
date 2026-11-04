import { expect, test } from "@playwright/test";

const battery = (name, packs) => ({
  shift_name: name,
  base_packs: 6,
  base_kwh: 300,
  optimized_packs: packs,
  optimized_kwh: packs * 50,
  required_total_packs: packs,
  max_physical_packs: 16,
  max_physical_kwh: 800,
  physical_feasible: true,
});

const completedPrediction = (id, shiftId, temperature, energy, distance) => ({
  id,
  shift_id: shiftId,
  bus_model_id: "bus-1",
  status: "completed",
  external_temp_celsius: temperature,
  prediction_stack: "vecto-g2",
  model_name: "vecto-release-1",
  auxiliary_estimator_release: "aux-release-1",
  summary: {
    total_consumption_kwh: energy,
    total_drivetrain_kwh: energy * 0.75,
    total_auxiliary_kwh: energy * 0.25,
    total_distance_km: distance,
    consumption_per_km_kwh: energy / distance,
    drivetrain_per_km_kwh: energy * 0.75 / distance,
    auxiliary_per_km_kwh: energy * 0.25 / distance,
    quantiles: {
      q05: energy * 0.9,
      q50: energy,
      q95: energy * 1.1,
    },
  },
});

test("creation persists every cluster and shift with one fixed feasibility configuration", async ({ page }) => {
  const predictionRuns = {
    "cold-evening": completedPrediction("cold-evening", "evening", -5, 80, 40),
    "cold-morning": completedPrediction("cold-morning", "morning", -5, 120, 60),
    "warm-evening": completedPrediction("warm-evening", "evening", 20, 60, 40),
    "warm-morning": completedPrediction("warm-morning", "morning", 20, 90, 60),
  };
  const predictionRequests = [];
  let initialCreateBody = null;
  let savedPatch = null;
  let releasePredictions;
  const predictionGate = new Promise(resolve => { releasePredictions = resolve; });
  page.on("dialog", dialog => { throw new Error(`Unexpected browser dialog: ${dialog.message()}`); });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (method === "GET" && path === "/api/v1/simulation/optimization-runs/") {
      await route.fulfill({ json: [{
        id: "base-run",
        user_id: "user-1",
        status: "completed",
        electrification_feasible: true,
      }] });
      return;
    }

    if (method === "GET" && path === "/api/v1/simulation/optimization-runs/base-run") {
      await route.fulfill({ json: {
        id: "base-run",
        user_id: "user-1",
        name: "Worst-case feasibility",
        status: "completed",
        input_params: {
          mode: "joint",
          bus_model_id: "bus-1",
          shift_ids: ["morning", "evening"],
          prediction_run_ids: ["base-prediction"],
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
          integrity_audit: { yearly_eligible: true },
          electrification_feasible: true,
          battery_results: {
            morning: battery("Morning stored name", 8),
            evening: battery("Evening stored name", 12),
          },
          installed_chargers: {
            depot: { stop_name: "Depot", num_slots: 2, max_power_per_slot_kw: 150 },
          },
          per_bus_summary: [
            { shift_id: "morning", charging_sessions: [] },
            { shift_id: "evening", charging_sessions: [] },
          ],
        },
      } });
      return;
    }

    if (method === "GET" && path === "/api/v1/user/bus-models/") {
      await route.fulfill({ json: [{
        id: "bus-1",
        user_id: "user-1",
        name: "Bus model",
        manufacturer: "Maker",
        specs: {
          battery_pack_size_kwh: 50,
          battery_pack_weight_kg: 400,
          empty_weight_kg: 12_000,
          max_passengers: 80,
          bus_length_m: 12,
        },
      }] });
      return;
    }

    if (method === "GET" && path === "/api/v1/user/bus-models/bus-1") {
      await route.fulfill({ json: {
        id: "bus-1",
        specs: {
          battery_pack_size_kwh: 50,
          battery_pack_weight_kg: 400,
          empty_weight_kg: 12_000,
          max_passengers: 80,
          bus_length_m: 12,
        },
      } });
      return;
    }

    const shiftMatch = path.match(/^\/api\/v1\/user\/shifts\/(morning|evening)$/);
    if (method === "GET" && shiftMatch) {
      const shiftId = shiftMatch[1];
      await route.fulfill({ json: {
        id: shiftId,
        name: shiftId === "morning" ? "Morning service" : "Evening service",
        distance_km: shiftId === "morning" ? 60 : 40,
        trip_ids: [shiftId === "morning" ? "trip-morning" : "trip-evening"],
      } });
      return;
    }

    if (method === "GET" && path === "/api/v1/gtfs/gtfs-stops/by-trip/trip-morning") {
      await route.fulfill({ json: [{ stop_lat: 46.01, stop_lon: 8.96 }] });
      return;
    }

    if (method === "GET" && path === "/api/v1/yearly-analysis/weather-reference") {
      expect(new URL(request.url()).searchParams.get('optimization_run_id')).toBe('base-run');
      await route.fulfill({json: {latitude: 47.2, longitude: 9.3, depot_name: 'Arrival depot B',
        weather_temperature_series_id: 'series-arrival-b', resolution: 'arrival-depot:b'}});
      return;
    }

    if (method === "GET" && path === "/api/v1/simulation/weather-temperature-clusters/") {
      expect(new URL(request.url()).searchParams.get('latitude')).toBe('47.2');
      expect(new URL(request.url()).searchParams.get('longitude')).toBe('9.3');
      await route.fulfill({ json: { clusters: [
        { label: "Cold", centroid_daily_avg_temp: -5, occurrences: 100 },
        { label: "Warm", centroid_daily_avg_temp: 20, occurrences: 265 },
      ] } });
      return;
    }

    if (method === "GET" && path === "/api/v1/simulation/prediction-runs/base-prediction") {
      await route.fulfill({ json: {
        id: "base-prediction",
        shift_id: "morning",
        external_temp_celsius: -10,
        occupancy_percent: 100,
        auxiliary_heating_type: "default",
        contextual_parameters: { quantiles: [0.05, 0.5, 0.95] },
      } });
      return;
    }

    if (method === "POST" && path === "/api/v1/yearly-analysis/") {
      initialCreateBody = request.postDataJSON();
      expect(initialCreateBody.weather_temperature_series_id).toBe('series-arrival-b');
      expect(initialCreateBody.features.config.weather_reference.depot_name).toBe('Arrival depot B');
      await route.fulfill({ json: { id: "yearly-1", ...initialCreateBody } });
      return;
    }

    if (method === "POST" && path === "/api/v1/simulation/prediction-runs/") {
      const body = request.postDataJSON();
      predictionRequests.push(body);
      await predictionGate;
      const cold = body.external_temp_celsius === -5;
      // Deliberately return the IDs in reverse shift order.
      await route.fulfill({ json: {
        prediction_run_ids: [...body.shift_ids].reverse().map(id => `${cold ? "cold" : "warm"}-${id}`),
      } });
      return;
    }

    const predictionMatch = path.match(/^\/api\/v1\/simulation\/prediction-runs\/(.+)$/);
    if (method === "GET" && predictionMatch && predictionRuns[predictionMatch[1]]) {
      await route.fulfill({ json: predictionRuns[predictionMatch[1]] });
      return;
    }

    if (method === "PATCH" && path === "/api/v1/yearly-analysis/yearly-1") {
      savedPatch = request.postDataJSON();
      await route.fulfill({ json: { id: "yearly-1", ...savedPatch } });
      return;
    }

    await route.fulfill({ status: 404, json: { detail: `Unused test route: ${method} ${path}` } });
  });

  await page.goto("./");
  await page.evaluate(async () => {
    localStorage.setItem("access_token", "test-token");
    const { setCurrentUserId } = await import("/elettra/src/store.js");
    setCurrentUserId("user-1");
    const template = await fetch(
      "/elettra/src/pages/Simulation/YearlyAnalysis/create-yearly-analysis.html",
    ).then((response) => response.text());
    document.body.innerHTML = template;
    const { initializeCreateYearlyAnalysis } = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/create-yearly-analysis.js"
    );
    window.__yearlyCleanup = await initializeCreateYearlyAnalysis(document);
  });

  await page.locator('[data-role="base-run-select"]').selectOption("base-run");
  await expect(page.locator('[data-role="scenarios-body"] tr')).toHaveCount(2);
  await page.locator("#ya-analysis-name").fill("Multi-shift annual analysis");
  const submit = page.locator('button[type="submit"]');
  await submit.click();
  const confirmation = page.getByRole('dialog', {name: 'Start this yearly analysis?'});
  await expect(confirmation).toBeVisible();
  await expect(confirmation.locator('[data-role="confirm-weather"]')).toHaveText('Arrival depot B');
  await expect(confirmation.locator('[data-role="confirm-shifts"]')).toHaveText('2');
  await expect(confirmation.locator('[data-role="confirm-scenarios"]')).toHaveText('2');
  await confirmation.getByRole('button', {name:'Cancel', exact:true}).click();
  await expect(confirmation).not.toBeVisible();
  expect(initialCreateBody).toBeNull();
  await expect(page.locator('#ya-analysis-name')).toHaveValue('Multi-shift annual analysis');
  await submit.click();
  await page.keyboard.press('Escape');
  await expect(confirmation).not.toBeVisible();
  expect(initialCreateBody).toBeNull();
  await submit.click();
  await confirmation.getByRole('button', {name:'Start analysis', exact:true}).click();
  const progress = page.getByRole('dialog', {name:'Yearly analysis in progress'});
  await expect(progress).toBeVisible();
  await expect(progress.locator('[data-role="progress-message"]')).toContainText('Prediction 1/2');
  await expect(progress.locator('progress')).toHaveAttribute('value','0');
  await expect(progress.locator('progress')).toHaveAttribute('max','2');
  const bounds = await progress.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  await page.keyboard.press('Escape');
  await expect(progress).toBeVisible();
  releasePredictions();

  await expect.poll(() => savedPatch).not.toBeNull();

  await expect(progress).not.toBeVisible();

  expect(initialCreateBody.features.config.fixedConfiguration).toMatchObject({
    fixed: true,
    mode: "joint",
    busModelId: "bus-1",
    shiftIds: ["morning", "evening"],
    soc: { minFraction: 0.2, maxFraction: 0.9 },
    battery: { decision: "optimized", packs: 12, nominalKwh: 600 },
    infrastructure: { scope: "shared", decision: "optimized" },
  });
  expect(initialCreateBody.features.meta.shifts).toEqual([
    { shiftId: "morning", shiftName: "Morning service" },
    { shiftId: "evening", shiftName: "Evening service" },
  ]);
  expect(initialCreateBody.features.scenarios.map(({ scenarioId }) => scenarioId)).toEqual([
    "cluster-1",
    "cluster-2",
  ]);

  expect(predictionRequests).toHaveLength(4);
  expect(predictionRequests.map(({ shift_ids }) => shift_ids)).toEqual([
    ["morning"], ["evening"],
    ["morning"], ["evening"],
  ]);
  expect(
    predictionRequests.map(({ contextual_parameters }) => contextual_parameters.num_battery_packs),
  ).toEqual([8, 12, 8, 12]);

  const { results } = savedPatch.features;
  expect(savedPatch.features.status).toBe("completed");
  expect(results.schemaVersion).toBe(2);
  expect(results.status).toBe("completed");
  expect(results.completion).toEqual({
    expectedPredictionCount: 4,
    completedPredictionCount: 4,
    failedPredictionCount: 0,
  });
  expect(results.scenarioResults.map(({ kpis }) => kpis.totalEnergyKwh)).toEqual([200, 150]);
  expect(results.scenarioResults[0].predRunIds).toEqual(["cold-morning", "cold-evening"]);
  expect(results.yearlyTotals.totalEnergyKwh).toBe(200 * 100 + 150 * 265);
  expect(results.yearlyTotals.distanceKm).toBe(36_500);
  expect(results.nominalDailyDistanceKm).toBe(100);
  expect(results.shiftResults.map(({ shiftId }) => shiftId)).toEqual(["morning", "evening"]);
  expect(results.shiftResults[0].yearlyTotals.totalEnergyKwh).toBe(120 * 100 + 90 * 265);
  expect(results.shiftResults[1].yearlyTotals.totalEnergyKwh).toBe(80 * 100 + 60 * 265);
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__yearlyCleanup?.());
});

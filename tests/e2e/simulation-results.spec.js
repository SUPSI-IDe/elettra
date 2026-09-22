import { expect, test } from "@playwright/test";

test("feasibility results render every supported heating type", async ({ page }) => {
  await page.goto("./");

  const heatingLabels = await page.evaluate(async () => {
    const template = await fetch(
      "/elettra/src/pages/Simulation/Runs/simulation-results.html",
    ).then((response) => response.text());
    const { initializeSimulationResults } = await import(
      "/elettra/src/pages/Simulation/Runs/simulation-results.js"
    );
    const results = {};

    for (const heatingType of ["default", "diesel", "electric"]) {
      document.body.innerHTML = template;
      const cleanup = initializeSimulationResults(document, { heatingType });
      const fields = [...document.querySelectorAll("[data-role='general-info'] .sim-data-field")];
      const heatingField = fields.find(
        (field) =>
          field.querySelector(".sim-data-field-label")?.textContent.trim() ===
          "Auxiliary heating type",
      );
      results[heatingType] = heatingField
        ?.querySelector(".sim-data-field-value")
        ?.textContent.trim();
      cleanup?.();
    }

    return results;
  });

  expect(heatingLabels).toEqual({
    default: "Heat pump",
    diesel: "Diesel",
    electric: "Electric",
  });
});

test("loaded feasibility results use mean for the decision and show the full distribution", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/api/v1/simulation/optimization-runs/test-run")) {
      await route.fulfill({
        json: {
          id: "test-run",
          name: "Heating regression",
          mode: "battery_only",
          status: "completed",
          input_params: {
            shift_ids: [],
            mode: "battery_only",
            min_soc: 0.2,
            max_soc: 0.9,
            state_of_health: 1,
            quantile_consumption: "mean",
          },
          prediction_run_ids: ["test-prediction"],
          results: {
            solver_status: "optimal",
            electrification_feasible: true,
            electrification_summary: {
              status: "feasible",
              num_buses: 1,
              num_infeasible_buses: 0,
              infeasible_buses: [],
            },
            battery_results: {
              "test-shift": {
                shift_id: "test-shift",
                optimized_packs: 12,
                max_physical_packs: 16,
                optimized_kwh: 600,
                max_physical_kwh: 800,
                physical_feasible: true,
                feasibility_status: "feasible",
              },
            },
          },
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/simulation/prediction-runs/test-prediction")) {
      await route.fulfill({
        json: {
          id: "test-prediction",
          status: "completed",
          shift_id: "test-shift",
          external_temp_celsius: -5,
          auxiliary_heating_type: "diesel",
          occupancy_percent: 100,
          contextual_parameters: {
            num_battery_packs: 12,
            battery_capacity_kwh: 600,
            total_weight_kg: 19800,
          },
          summary: {
            total_distance_km: 200,
            total_consumption_kwh: 411.6,
            consumption_per_km_kwh: 2.058,
            total_drivetrain_kwh: 300,
            total_auxiliary_kwh: 111.6,
            quantiles: { q05: 258.1, q50: 424.1, q95: 538.7 },
            consumption_per_km_kwh_quantiles: {
              q05: 1.2905,
              q50: 2.1205,
              q95: 2.6935,
            },
            drivetrain_quantiles: { q05: 185, q50: 310, q95: 400 },
          },
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/economic/defaults")) {
      await route.fulfill({ json: {} });
      return;
    }

    await route.fulfill({ status: 404, json: { detail: "Unexpected test request" } });
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
      runId: "test-run",
    });
  });

  await expect(page.locator(".efficiency-sensitivity-card__chips")).toContainText(
    "Heating type: Diesel",
  );
  await expect(page.locator(".efficiency-sensitivity-card__header")).toContainText(
    "Feasible — mean-based demand scenario",
  );
  const sensitivityBody = page.locator(".efficiency-sensitivity-card__body");
  await expect(sensitivityBody).toContainText(
    "Q05 demand",
  );
  await expect(sensitivityBody).toContainText(
    "Mean demand — decision basis",
  );
  await expect(sensitivityBody).toContainText(
    "Q50 demand",
  );
  await expect(sensitivityBody).toContainText(
    "Q95 demand",
  );
  await expect(sensitivityBody).toContainText(
    "Battery margin — mean basis",
  );
  await expect(sensitivityBody).toContainText("8.4 kWh (2.0%)");
  await expect(sensitivityBody).toContainText(
    "Q50 demand exceeds usable energy; the feasibility decision uses mean demand.",
  );

  const sensitivityText = await sensitivityBody.innerText();
  expect(sensitivityText.indexOf("Q05 demand")).toBeLessThan(
    sensitivityText.indexOf("Mean demand — decision basis"),
  );
  expect(sensitivityText.indexOf("Mean demand — decision basis")).toBeLessThan(
    sensitivityText.indexOf("Q50 demand"),
  );
  expect(sensitivityText.indexOf("Q50 demand")).toBeLessThan(
    sensitivityText.indexOf("Q95 demand"),
  );

  const efficiencyTable = page.locator("[data-role='efficiency-table']");
  await expect(efficiencyTable).toContainText("411.6");
  await expect(efficiencyTable).toContainText(
    "Total mean — decision basis (kWh)",
  );
  await expect(efficiencyTable).toContainText("424.1");
  await expect(efficiencyTable).toContainText("538.7");
  await expect(efficiencyTable).not.toContainText(
    "Feasible — Q50-based demand scenario",
  );
  await expect(efficiencyTable).not.toContainText(
    "HEATING_LABELS is not defined",
  );

  await page.evaluate(() => window.__cleanupSimulationResults?.());
});

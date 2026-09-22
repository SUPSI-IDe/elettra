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

test("loaded feasibility results render the heating sensitivity driver", async ({
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
          input_params: { shift_ids: [], min_soc: 0.2, max_soc: 0.9 },
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
                optimized_kwh: 444,
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
          summary: {},
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
  await expect(page.locator("[data-role='efficiency-table']")).not.toContainText(
    "HEATING_LABELS is not defined",
  );

  await page.evaluate(() => window.__cleanupSimulationResults?.());
});

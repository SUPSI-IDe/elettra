import { expect, test } from "@playwright/test";

for (const mode of ["battery_only", "joint", "charging_only"]) {
  test(`${mode}: keep seven forecasts, submit one physical reference`, async ({ page }) => {
    const runs = [];
    let submitted;
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.includes("bus-models/")) {
        return route.fulfill({json: {id: "bus", specs: {
          min_battery_packs: 10, max_battery_packs: 16, battery_pack_size_kwh: 50,
          battery_pack_weight_kg: 300, bus_length_m: 12, empty_weight_kg: 12000, max_passengers: 80,
        }}});
      }
      if (path.endsWith("prediction-runs/") && request.method() === "POST") {
        const data = request.postDataJSON();
        const id = `p-${data.num_battery_packs}`;
        runs.push({id, shift_id: "s", status: "completed", contextual_parameters: {num_battery_packs: data.num_battery_packs}});
        return route.fulfill({json: {prediction_run_ids: [id]}});
      }
      if (path.endsWith("prediction-runs/")) return route.fulfill({json: runs});
      if (path.includes("prediction-runs/")) return route.fulfill({json: runs.find((r) => path.endsWith(r.id))});
      if (path.endsWith("optimization-runs/")) {
        submitted = request.postDataJSON();
        return route.fulfill({json: {optimization_run_id: "o"}});
      }
      return route.fulfill({json: []});
    });
    await page.goto("./");
    await page.evaluate(async (mode) => {
      const {createOptimizationRun} = await import("/elettra/src/api/simulation.js");
      await createOptimizationRun({name: "Regression", mode, shift_ids: ["s"], bus_model_id: "bus",
        prediction_params: {}, fixed_battery_packs: mode === "charging_only" ? 12 : undefined});
    }, mode);
    expect(runs).toHaveLength(7);
    expect(submitted.prediction_run_ids).toHaveLength(7);
    expect(submitted.reference_prediction_run_ids).toEqual({s: mode === "charging_only" ? "p-12" : "p-16"});
    expect(submitted.fixed_battery_packs).toBeUndefined();
  });
}

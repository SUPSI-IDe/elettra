import { expect, test } from "@playwright/test";

const scenarios = ["battery_only", "charging_only", "joint"].flatMap(mode =>
  ["new", "duplicate"].map(entry => ({ mode, entry, outcome: "success" }))
).concat([
  { mode: "battery_only", entry: "new", outcome: "mean-failed" },
  { mode: "battery_only", entry: "new", outcome: "both-failed" },
  ...["battery_only", "charging_only", "joint"].map(mode => ({mode, entry: "new", outcome: "q95-infeasible"})),
]);

for (const { mode, entry, outcome } of scenarios) {
    test(`${entry} ${mode} ${outcome}: confirm once and automatically open the completed evaluation`, async ({ page }) => {
      const ids = { mean: "paired-mean", aggregate_q95: "paired-q95" };
      const model = { id: "model", user_id: "user", name: "Local test bus", specs: {
        min_battery_packs: 10, max_battery_packs: 16, battery_pack_size_kwh: 50,
        battery_pack_weight_kg: 300, battery_pack_cost_chf: 6000, bus_length_m: 18, empty_weight_kg: 18000, max_passengers: 100,
      }};
      const shift = { id: "shift", name: "Test duty", bus_id: "bus", trip_count: 1, structure: [] };
      const runs = [];
      const submitted = [];
      const predictions = [];
      const delayedQ95 = mode === "battery_only" && entry === "new" && outcome === "success";
      let q95Ready = !delayedQ95;
      let q95Polls = 0;
      let q95Phase = "sizing";
      const result = (basis, historical = false) => {
        const packs = basis === "aggregate_q95" || mode === "charging_only" ? 14 : 13;
        const record = { id: historical ? "historical" : ids[basis], name: historical ? "Historical evaluation" : `Paired ${basis}`,
          mode, status: outcome === "both-failed" || (outcome === "mean-failed" && basis === "mean") ? "failed" : "completed", bus_model_id: "model", created_at: "2026-01-01T12:00:00Z", prediction_run_ids: [],
          electrification_feasible: true,
          input_params: { mode, shift_ids: ["shift"], bus_model_id: "model", consumption_basis: basis,
            evaluate_both_bases: !historical, min_soc: .2, max_soc: .9, battery_cost_per_kwh: 300,
            ...(historical ? {} : { basis_run_ids: ids }), charging_stations: [] },
          results: { electrification_feasible: true, forecast_verification: {status: "verified"},
            installed_chargers: {}, battery_results: {shift: {shift_name: "Test duty", reference_packs: 16,
              base_packs: 10, optimized_packs: packs, required_total_packs: packs, max_physical_packs: 16,
              base_kwh: 500, optimized_kwh: packs*50, selected_nominal_kwh: packs*50, max_physical_kwh: 800,
              physical_feasible: true, feasibility_status: "feasible"}},
            per_bus_summary: [{shift_id: "shift", shift_name: "Test duty", total_charged_kwh: 0,
              num_charging_sessions: 0, charging_sessions: [], min_soc_kwh: 150, max_soc_kwh: 600}],
          }};
        if (outcome === "q95-infeasible") {
          record.basis_summaries = {
            mean: {status:"completed",verification_status:"verified",electrification_feasible:true},
            aggregate_q95: {status:"completed",verification_status:"infeasible",electrification_feasible:false},
          };
          if (basis === "aggregate_q95") record.results = {
            solver_status:"infeasible",electrification_feasible:false,
            forecast_verification:{status:"infeasible"},
            battery_results:{},per_bus_summary:[],installed_chargers:{},
            infeasibility_diagnostics: {
              status: "available", forecast_verification: {status:mode === "joint" ? "physical_limits_exceeded" : "verified"},
              battery_results: {shift: {shift_name:"Test duty", optimized_packs:mode === "joint" ? 16 : 14,
                required_total_packs:mode === "joint" ? 17 : 14, excess_packs:mode === "joint" ? 1 : 0,
                max_physical_packs:16, max_physical_kwh:800}},
              reasons: [{code:"depot_power", shift_id:"shift", shift_name:"Test duty", stop_name:"TPL depot",
                required_recharge_kwh:340.7, maximum_recharge_kwh:319, minimum_shortfall_kwh:21.7,
                available_power_kw_dc:32.5, minimum_average_power_kw_dc:34.7}],
            },
          };
        }
        return record;
      };
      if (entry === "duplicate") runs.push(result("aggregate_q95", true));
      await page.addInitScript(() => {
        localStorage.setItem("access_token", "local-browser-test");
        localStorage.setItem("elettra_lang", "en");
      });
      await page.route("**/auth/me", route => route.fulfill({json: {id: "user", full_name: "Local test", email: "local@example.invalid"}}));
      await page.route("**/api/v1/**", async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        let data;
        if (path === "/api/v1/version") data = {version: "local-test"};
        else if (path.endsWith("/bus-models/")) data = [model];
        else if (path.endsWith("/bus-models/model")) data = model;
        else if (path.endsWith("/buses/")) data = [{id: "bus", user_id: "user", bus_model_id: "model"}];
        else if (path.endsWith("/shifts/")) data = [shift];
        else if (path.includes("/shifts/shift")) data = shift;
        else if (path.endsWith("/prediction-runs/") && request.method() === "POST") {
          const body = request.postDataJSON();
          predictions.push({id: "prediction", shift_id: "shift", status: delayedQ95 ? "running" : "completed",
            contextual_parameters: {num_battery_packs: body.num_battery_packs}});
          data = {prediction_run_ids: ["prediction"]};
        } else if (path.endsWith("/prediction-runs/")) data = predictions;
        else if (path.endsWith("/prediction-runs/prediction")) data = predictions[0];
        else if (path.endsWith("/optimization-runs/") && request.method() === "POST") {
          submitted.push(request.postDataJSON()); runs.push(result("mean"));
          data = {optimization_run_id: ids.mean, basis_run_ids: ids};
        } else if (path.endsWith("/optimization-runs/")) data = runs;
        else if (path.includes("/basis/")) {
          const basis = path.split("/").pop(); data = {optimization_run_id: ids[basis], status: "completed"};
        } else if (path.endsWith("/optimization-runs/historical")) data = result("aggregate_q95", true);
        else if (path.endsWith(`/optimization-runs/${ids.mean}`)) data = result("mean");
        else if (path.endsWith(`/optimization-runs/${ids.aggregate_q95}`)) {
          q95Polls++;
          data = q95Ready ? result("aggregate_q95") : {id: ids.aggregate_q95, status: "running",
            results: {forecast_verification: {status: "running", phase: q95Phase, iteration: 1}}};
        }
        else if (path.endsWith("/economic/defaults")) data = {};
        else data = [];
        await route.fulfill({json: data});
      });
      page.on("dialog", dialog => { throw new Error(`Unexpected browser dialog: ${dialog.message()}`); });
      await page.goto("./#simulation-runs");
      if (entry === "duplicate") {
        await page.getByRole("checkbox", {name: "Select run", exact: true}).check();
        await page.getByRole("button", {name: "Duplicate", exact: true}).click();
      } else {
        await page.getByRole("button", {name: "New", exact: true}).click();
      }
      await expect(page.getByText("Mean and Q95", {exact: true})).toBeVisible();
      await expect(page.getByLabel("Optimize for", {exact: true})).toHaveCount(0);
      await page.locator("#simulation-name").fill("Paired local regression");
      await page.getByRole("checkbox", {name: "Select vehicle block", exact: true}).check();
      await page.locator("#var-optimization-mode").selectOption(mode);
      await page.locator("#var-bus-model-override").selectOption("model");
      if (mode === "charging_only") await page.locator('[name="fixed_battery_packs"]').fill("14");
      const start = page.getByRole("button", {name: "Start evaluation", exact: true});
      await start.click();
      const confirmation = page.getByRole("dialog", {name: "Start this evaluation?"});
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByText("Paired local regression", {exact: true})).toBeVisible();
      await expect(confirmation.locator('[data-role="evaluation-confirm-count"]')).toHaveText("1");
      if (delayedQ95) {
        const bounds = await confirmation.boundingBox();
        const viewport = page.viewportSize();
        expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThan(2);
        expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThan(2);
        await expect(confirmation.getByRole("button", {name: "Cancel", exact: true})).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(confirmation).not.toBeVisible();
        await expect(start).toBeFocused();
        await start.click();
        await confirmation.getByRole("button", {name: "Cancel", exact: true}).click();
        await expect(confirmation).not.toBeVisible();
        expect(submitted).toHaveLength(0);
        expect(predictions).toHaveLength(0);
        await start.click();
      }
      await confirmation.getByRole("button", {name: "Start evaluation", exact: true}).click();
      if (delayedQ95) {
        const progress = page.getByRole("dialog", {name: "Evaluation in progress"});
        await expect(progress).toBeVisible();
        await expect(progress.getByText("Paired local regression", {exact: true})).toBeVisible();
        await expect(progress.locator('[data-progress-step="predictions"]')).toContainText("0 of 1 estimates ready");
        await expect(progress.locator('[data-progress-step="mean"]')).toHaveAttribute("data-state", "pending");
        await expect(progress.locator('[data-progress-step="aggregate_q95"]')).toHaveAttribute("data-state", "pending");
        expect(submitted).toHaveLength(0);
        predictions[0].status = "completed";
      }
      await expect.poll(() => submitted.length).toBe(1);
      expect(submitted[0].evaluate_both_bases).toBe(true);
      expect(submitted[0].lock_entire_dwell).toBe(true);
      if (delayedQ95) {
        await expect.poll(() => q95Polls).toBeGreaterThan(0);
        await expect(page).toHaveURL(/#add-simulation/);
        await expect(page.locator('[data-role="progress-message"]')).toBeVisible();
        const progress = page.getByRole("dialog", {name: "Evaluation in progress"});
        await expect(progress.locator('[data-progress-step="predictions"]')).toContainText("1 of 1 estimates ready");
        await expect(progress.locator('[data-progress-step="mean"]')).toHaveAttribute("data-state", "completed");
        const q95 = progress.locator('[data-progress-step="aggregate_q95"]');
        await expect(q95).toHaveAttribute("data-state", "running");
        await expect(q95).toContainText("Optimizing battery size · Pass 1");
        await expect(progress.locator('[data-role="progress-elapsed"]')).not.toHaveText("0:00");
        q95Phase = "full_forecast";
        await expect(q95).toContainText("Recalculating consumption at the selected battery mass");
        q95Phase = "fixed_design_verification";
        await expect(q95).toContainText("Verifying battery and charging plan");
        q95Ready = true;
      }
      if (outcome === "both-failed") {
        await expect(page).toHaveURL(/#simulation-runs/);
        await expect(page.getByText("Evaluation finished. 2 of 2 calculation(s) failed.", {exact: true})).toBeVisible();
        return;
      }
      await expect(page).toHaveURL(/#simulation-results/);
      if (outcome === "mean-failed") {
        await expect(page.getByRole("heading", {level: 1})).toContainText("Paired aggregate_q95");
        return;
      }
      await expect(page.getByRole("heading", {level: 1})).toContainText("Paired mean");
      const switcher = page.locator('[data-role="paired-basis-switch"] [data-role="aggregate-basis"]');
      if (outcome === "q95-infeasible") {
        const mixedText = "Feasible for Mean, not feasible for Q95";
        await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveText(mixedText);
        await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveClass(/result-status--warning/);
        await page.screenshot({path:test.info().outputPath("mixed-feasibility.png")});
        await switcher.selectOption("aggregate_q95");
        await expect(page.locator('[data-role="feasibility-no-solution"]')).toBeVisible();
        await expect(page.locator('[data-role="feasibility-no-solution"]')).toContainText("The complete daily cycle is infeasible");
        await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveClass(/result-status--warning/);
        await expect(page.locator('[data-role="aggregate-energy"]')).toHaveCount(1);
        await expect(page.locator('[data-role="aggregate-energy"]')).toContainText(mode === "joint" ? "17 / 16" : "14 / 16");
        await expect(page.locator('[data-role="feasibility-no-solution"]')).toContainText("21.7 kWh are missing");
        await page.getByRole("tab", {name:"Test duty", exact:true}).click();
        await expect(page.locator('[data-role="aggregate-energy"]')).toContainText(mode === "charging_only" ? "Configured battery for vehicle block Test duty" : "Battery required for vehicle block Test duty");
        await expect(page.locator('[data-role="aggregate-energy"] [data-role="aggregate-basis"]')).toHaveCount(0);
        await expect(page.locator('[data-role="aggregate-basis-message"]')).toBeHidden();
        await switcher.selectOption("mean");
        await expect(page.getByRole("heading", {level:1})).toContainText("Paired mean");
        await expect(page.locator('[data-role="feasibility-no-solution"]')).toHaveCount(0);
        await page.goto("./#simulation-runs");
        const indicator = page.locator('td.feasibility [role="img"]');
        await expect(indicator).toHaveClass(/simulation-state-indicator--warning/);
        await expect(indicator).toHaveAttribute("title",mixedText);
        expect(submitted).toHaveLength(1);
        return;
      }
      await switcher.selectOption("aggregate_q95");
      await expect(page.getByRole("heading", {level: 1})).toContainText("Paired aggregate_q95");
      const batteryRow = page.locator('[data-role="feasibility-fleet-battery"] tbody tr[data-shift-id="shift"]');
      await expect(batteryRow.locator('td').nth(0)).toHaveText('14');
      await expect(batteryRow.locator('td').nth(1)).toHaveText('700');
      await expect(page.getByRole("button", {name: "Run new optimization", exact: true})).toHaveCount(0);
      await switcher.selectOption("mean");
      await expect(page.getByRole("heading", {level: 1})).toContainText("Paired mean");
      expect(submitted).toHaveLength(1);
    });
}

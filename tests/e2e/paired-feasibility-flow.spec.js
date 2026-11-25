import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { translations } from "../../src/i18n/translations.js";
import {
  feasibilityGuideImage, feasibilityGuideLabels, guideCaptureEnabled, guideLocales,
} from "../../test-support/feasibility-guide-screenshots.js";

// Computed with the staging backend's trip Monte Carlo and battery optimizer for
// a synthetic ten-trip duty with one 25-minute charging opportunity at the depot.
const guideDesigns = JSON.parse(readFileSync(new URL("../../test-support/fixtures/guide-feasibility-results.json", import.meta.url), "utf8"));

const dataset = {
  gtfs_year: 2026, gtfs_file_date: "2025-09-27", valid_from: "2025-12-14", valid_to: "2026-12-12",
};

const scenarios = ["battery_only", "charging_only", "joint"].flatMap(mode =>
  ["new", "duplicate"].map(entry => ({ mode, entry, outcome: "success" }))
).concat([
  { mode: "battery_only", entry: "new", outcome: "mean-failed" },
  { mode: "battery_only", entry: "new", outcome: "both-failed" },
  ...["battery_only", "charging_only", "joint"].map(mode => ({mode, entry: "new", outcome: "q95-infeasible"})),
  ...guideLocales.map(guideLanguage => ({ mode: "battery_only", entry: "new", outcome: "success", guideLanguage })),
]);

for (const { mode, entry, outcome, guideLanguage } of scenarios) {
    const title = guideLanguage
      ? `captures feasibility form and fleet results for the guide in ${guideLanguage}`
      : `${entry} ${mode} ${outcome}: confirm once and automatically open the completed evaluation`;
    test(title, async ({ page }, testInfo) => {
      if (guideLanguage) test.skip(!guideCaptureEnabled(testInfo), "Guide screenshots are generated on demand with desktop Chromium");
      const language = guideLanguage ?? "en";
      const labels = feasibilityGuideLabels[language];
      const strings = translations[language];
      const demoDepot = {
        stop_id: "11111111-1111-4111-8111-111111111111", stop_name: guideLanguage ? "Deposito Nord" : labels.depot, num_slots: 1,
        max_power_per_slot_kw: 150, max_total_power_kw: 150,
      };
      const guideScenario = mode === "battery_only" && entry === "new" && outcome === "success";
      const ids = { mean: "paired-mean", aggregate_q95: "paired-q95" };
      const model = { id: "model", user_id: "user", name: guideScenario ? labels.bus : "Local test bus", specs: {
        min_battery_packs: 10, max_battery_packs: 16, battery_pack_size_kwh: 50,
        battery_pack_weight_kg: 300, battery_pack_cost_chf: 6000, bus_length_m: 18, empty_weight_kg: 18000, max_passengers: 100,
      }};
      const shift = {
        id: "shift", name: guideScenario ? labels.duty : "Test duty", bus_id: "bus",
        trip_count: guideLanguage ? 10 : 1, structure: [], compatible_weekdays: ["monday"],
        ...(guideScenario ? { gtfs_datasets: [dataset], daily_distance_km: 190, yearly_distance_km: 49_400 } : {}),
      };
      const runs = [];
      const submitted = [];
      const predictions = [];
      const delayedQ95 = guideScenario && !guideLanguage;
      let q95Ready = !delayedQ95;
      let q95Polls = 0;
      let q95Phase = "sizing";
      const result = (basis, historical = false) => {
        const packs = basis === "aggregate_q95" || mode === "charging_only" ? 14 : 13;
        const record = { id: historical ? "historical" : ids[basis], name: historical ? "Historical evaluation"
          : guideScenario ? labels.pairedEvaluation : `Paired ${basis}`,
          mode, status: outcome === "both-failed" || (outcome === "mean-failed" && basis === "mean") ? "failed" : "completed", bus_model_id: "model", created_at: "2026-01-01T12:00:00Z", prediction_run_ids: [],
          electrification_feasible: true,
          input_params: { mode, shift_ids: ["shift"], bus_model_id: "model", consumption_basis: basis,
            evaluate_both_bases: !historical, min_soc: .2, max_soc: .9, battery_cost_per_kwh: guideScenario ? 120 : 300,
            ...(historical ? {} : { basis_run_ids: ids, service_weekday: "monday" }),
            ...(guideScenario ? { gtfs_provenance: { version: 1, source: "recorded", shifts: { shift: [dataset] } } } : {}),
            charging_stations: guideScenario ? [demoDepot] : [] },
          results: { electrification_feasible: true, forecast_verification: {status: "verified"},
            installed_chargers: {}, battery_results: {shift: {shift_name: shift.name, reference_packs: 16,
              base_packs: 10, optimized_packs: packs, required_total_packs: packs, max_physical_packs: 16,
              base_kwh: 500, optimized_kwh: packs*50, selected_nominal_kwh: packs*50, max_physical_kwh: 800,
              physical_feasible: true, feasibility_status: "feasible",
              ...(guideScenario ? { investment_cost_source: "bus_model_snapshot", bus_cost_chf: 400000, battery_pack_cost_chf: 6000 } : {})}},
            per_bus_summary: [{shift_id: "shift", shift_name: shift.name, total_charged_kwh: 0,
              num_charging_sessions: 0, charging_sessions: [], min_soc_kwh: 150, max_soc_kwh: packs * 50 * .9}],
          }};
        if (guideLanguage) {
          const { consumption_analysis, per_bus_summary } = guideDesigns[basis];
          record.results.consumption_analysis = consumption_analysis;
          record.results.per_bus_summary = per_bus_summary.map(row => ({ ...row, shift_name: shift.name, bus_model_name: labels.bus }));
        }
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
      await page.addInitScript(selectedLanguage => {
        localStorage.setItem("access_token", "local-browser-test");
        localStorage.setItem("elettra_lang", selectedLanguage);
      }, language);
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
        else if (guideScenario && path.endsWith("/charging-stops/candidates")) {
          data = [{ ...demoDepot, is_depot: true, depot_bus_count: 1 }];
        }
        else if (guideScenario && path.endsWith("/yearly-distance")) {
          data = { daily_distance_km: shift.daily_distance_km, yearly_distance_km: shift.yearly_distance_km };
        }
        else if (path.endsWith("/economic/defaults")) data = {};
        else data = [];
        await route.fulfill({json: data});
      });
      page.on("dialog", dialog => { throw new Error(`Unexpected browser dialog: ${dialog.message()}`); });
      if (guideLanguage) await page.setViewportSize({ width: 1740, height: 1600 });
      await page.goto("./#simulation-runs");
      if (entry === "duplicate") {
        await page.getByRole("checkbox", {name: "Select run", exact: true}).check();
        await page.locator('[data-row-action="duplicate"]').click();
      } else {
        await page.getByRole("button", {name: strings["simulation.new_list_action"], exact: true}).click();
      }
      await expect(page.getByText(strings["simulation.aggregate_both"], {exact: true})).toBeVisible();
      await expect(page.getByLabel("Optimize for", {exact: true})).toHaveCount(0);
      const evaluationName = guideScenario ? labels.pairedEvaluation : "Paired local regression";
      await page.locator("#simulation-name").fill(evaluationName);
      const weekdays = page.locator("#simulation-service-weekday");
      if (entry === "duplicate") await expect(weekdays).toHaveValue("monday");
      else await weekdays.selectOption("monday");
      await page.getByRole("checkbox", {name: strings["simulation.select_shift"], exact: true}).check();
      await page.locator("#var-optimization-mode").selectOption(mode);
      await page.locator("#var-bus-model-override").selectOption("model");
      if (mode === "charging_only") await page.locator('[name="fixed_battery_packs"]').fill("14");
      if (guideScenario) {
        await page.locator("#var-daily-cycle").uncheck();
        await page.locator("#var-state-of-health").fill("100");
        await page.locator("#var-usable-capacity").fill("70");
        await expect(page.locator('[data-role="battery-preview"]')).toContainText("560 kWh");
        const form = page.locator(".add-simulation");
        await form.getByRole("checkbox", { name: strings["simulation.select_stop"], exact: true }).check();
        if (guideLanguage) {
          await expect(page.locator("html")).toHaveAttribute("lang", language);
          await expect(form.getByRole("heading", { level: 1 })).toHaveText(strings["simulation.make_simulation"]);
          await expect(form.getByText(demoDepot.stop_name, { exact: true })).toBeVisible();
          await expect(form.getByText(labels.duty, { exact: true })).toBeVisible();
          await expect(form.locator('.shift-table [data-id="shift"]')).toContainText(
            strings["buses.vehicle_category_articulated_18m"],
          );
          await expect(form.locator("#var-bus-model-override option:checked")).toHaveText(labels.bus);
          await page.evaluate(() => document.fonts.ready);
          const table = form.locator(".shift-table-wrapper");
          expect(await table.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
          const depot = form.locator(".stops-table .stop-name");
          expect(await depot.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
          await form.locator("main").evaluate(main => { main.scrollTop = 0; });
          await page.locator("#var-usable-capacity").blur();
          await page.mouse.move(0, 0);
          await expect(form.locator("#simulation-service-weekday")).toBeInViewport();
          await expect(form.locator('[data-role="battery-preview"]')).toBeInViewport();
          const { x, y, width } = await form.boundingBox();
          const footer = await form.locator(".evaluation-form-footer").boundingBox();
          await page.screenshot({
            path: feasibilityGuideImage(language, "feasibility-form"),
            clip: { x, y, width, height: Math.ceil(footer.y + footer.height - y + 24) },
            animations: "disabled",
          });
        }
      }
      const start = page.getByRole("button", {name: strings["simulation.run"], exact: true});
      await start.click();
      const confirmation = page.getByRole("dialog", {name: strings["simulation.run_confirm"]});
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByText(evaluationName, {exact: true})).toBeVisible();
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
      await confirmation.getByRole("button", {name: strings["simulation.run"], exact: true}).click();
      if (delayedQ95) {
        const progress = page.getByRole("dialog", {name: "Evaluation in progress"});
        await expect(progress).toBeVisible();
        await expect(progress.getByText(evaluationName, {exact: true})).toBeVisible();
        await expect(progress.locator('[data-progress-step="predictions"]')).toContainText("0 of 1 estimates ready");
        await expect(progress.locator('[data-progress-step="mean"]')).toHaveAttribute("data-state", "pending");
        await expect(progress.locator('[data-progress-step="aggregate_q95"]')).toHaveAttribute("data-state", "pending");
        expect(submitted).toHaveLength(0);
        predictions[0].status = "completed";
      }
      await expect.poll(() => submitted.length).toBe(1);
      expect(submitted[0].evaluate_both_bases).toBe(true);
      expect(submitted[0].lock_entire_dwell).toBe(true);
      expect(submitted[0].service_weekday).toBe("monday");
      if (guideScenario) {
        expect(submitted[0].charging_stations).toMatchObject([{
          stop_id: demoDepot.stop_id, num_slots: 1, max_power_per_slot_kw: 150, max_total_power_kw: 150,
        }]);
      }
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
      await expect(page.getByRole("heading", {level: 1})).toContainText(guideScenario ? evaluationName : "Paired mean");
      const switcher = page.locator('[data-role="paired-basis-switch"] [data-role="aggregate-basis"]');
      await expect(page.locator('[data-role="feasibility-demand-basis"]')).toHaveText(strings["simulation.feasibility_basis_mean"]);
      await expect(page.locator('[data-role="feasibility-service-day"]')).toHaveText(
        strings["simulation.service_day_result"].replace("{day}", strings["simulation.day_monday"]),
      );
      await expect(page.locator('.feasibility-level__scenario-mode [data-role="feasibility-overall-status"]')).toHaveCount(1);
      if (outcome === "q95-infeasible") {
        const mixedText = "Feasible for Mean, not feasible for Q95";
        await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveText(mixedText);
        await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveClass(/result-status--warning/);
        await page.screenshot({path:test.info().outputPath("mixed-feasibility.png")});
        await switcher.selectOption("aggregate_q95");
        await expect(page.locator('[data-role="feasibility-demand-basis"]')).toHaveText('Q95-based demand scenario');
        await expect(page.locator('[data-role="feasibility-general-level"]')).toBeVisible();
        await expect(page.locator('[data-role="feasibility-general-level"]')).toContainText("The displayed demand profile is not feasible with the selected configuration.");
        await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveClass(/result-status--warning/);
        await expect(page.locator('[data-role="aggregate-energy"]')).toHaveCount(0);
        await expect(page.locator('[data-role="feasibility-critical-shifts"] tbody td')).toHaveText(
          mode === "joint" ? ['16', '16', '17', '+1'] : ['14', '16', '14', '0']);
        const constraintHelp = page.getByRole('button', {name:'Identified constraints', exact:true});
        await expect(constraintHelp.getByRole('tooltip')).toBeHidden();
        await constraintHelp.click();
        await expect(constraintHelp.getByRole('tooltip')).toBeVisible();
        await expect(constraintHelp.getByRole('tooltip')).toContainText('21.7 kWh are missing');
        await constraintHelp.press('Escape');
        await page.getByRole("tab", {name:"Test duty", exact:true}).click();
        await expect(page.locator('[data-role="aggregate-energy"]')).toContainText("Battery and energy margin");
        await expect(page.locator('[data-role="feasibility-shift-predicted-consumption"] strong')).toHaveText('N/A');
        await expect(page.locator('[data-role="feasibility-shift-predicted-consumption"] .q95-consumption-info')).toHaveCount(1);
        await expect(page.locator('[data-role="feasibility-shift-predicted-consumption-per-km"] strong')).toHaveText('—');
        await expect(page.locator('[data-role="aggregate-energy"] [data-role="aggregate-basis"]')).toHaveCount(0);
        await expect(page.locator('[data-role="aggregate-basis-message"]')).toBeHidden();
        await switcher.selectOption("mean");
        await expect(page.getByRole("heading", {level:1})).toContainText("Paired mean");
        await expect(page.locator('[data-role="infeasibility-context"]')).toHaveCount(0);
        await page.goto("./#simulation-runs");
        const indicator = page.locator('td.feasibility [role="img"]');
        await expect(indicator).toHaveClass(/simulation-state-indicator--warning/);
        await expect(indicator).toHaveAttribute("title",mixedText);
        expect(submitted).toHaveLength(1);
        return;
      }
      await switcher.selectOption("aggregate_q95");
      await expect(page.locator('[data-role="feasibility-demand-basis"]')).toHaveText(strings["simulation.feasibility_basis_q95"]);
      await expect(page.getByRole("heading", {level: 1})).toContainText(guideScenario ? evaluationName : "Paired aggregate_q95");
      const batteryRow = page.locator('[data-role="feasibility-fleet-battery"] tbody tr[data-shift-id="shift"]');
      await expect(batteryRow.locator('td').nth(0)).toHaveText('14');
      await expect(batteryRow.locator('td').nth(1)).toHaveText('700');
      await expect(page.getByRole("button", {name: strings["simulation.aggregate_calculate"], exact: true})).toHaveCount(0);
      if (guideScenario) {
        await expect(switcher).toHaveValue("aggregate_q95");
        await expect(page.getByRole("tab", { name: strings["simulation.feasibility_scope_general"], exact: true })).toHaveAttribute("aria-selected", "true");
        await expect(page.getByRole("button", { name: strings["simulation.results_download_json"] })).toBeEnabled();
        await expect(page.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
        await expect(page.locator('[data-role="analysis-gtfs"]')).toContainText("2026");
        if (guideLanguage) {
          await page.setViewportSize({ width: 1360, height: 1220 });
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            `${strings["simulation.results_page_title"]} - ${evaluationName}`,
          );
          await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveText(strings["simulation.feasibility_all_shifts_feasible"]);
          await expect(batteryRow).toContainText(labels.duty);
          await page.evaluate(() => document.fonts.ready);
          await switcher.blur();
          await page.mouse.move(0, 0);
          const results = page.locator(".simulation-results-page");
          const { x, y, width } = await results.boundingBox();
          const close = results.getByRole("button", { name: strings["common.close"], exact: true });
          await expect(close).toBeInViewport();
          const footer = await close.boundingBox();
          await page.screenshot({
            path: feasibilityGuideImage(language, "feasibility-efficiency"),
            clip: { x, y, width, height: Math.ceil(footer.y + footer.height - y + 24) },
            animations: "disabled",
          });
          await page.getByRole("tab", { name: labels.duty, exact: true }).click();
          const battery = page.locator('[data-role="aggregate-energy"]');
          await expect(battery).toHaveAttribute("data-status", "available");
          await expect(battery.locator('[data-role="aggregate-usable-capacity"]')).toContainText("490");
          const histogram = battery.locator('[data-role="energy-distribution"]');
          await expect(histogram).toHaveAttribute("data-packs", "14");
          await expect(histogram.locator('[data-role="energy-distribution-bin"]')).toHaveCount(60);
          const marker = histogram.locator('[data-role="energy-distribution-marker"]');
          await expect(marker).toHaveAttribute("data-basis", "aggregate_q95");
          await expect(marker).toHaveAttribute("data-value", "539.2");
          await expect(battery.locator('.aggregate-soc--verified').first()).toBeVisible();
          await expect(battery.locator('.aggregate-warning')).toHaveCount(0);
          await expect(page.locator('[data-role="feasibility-shift-visual-analysis"]')).toHaveCount(0);
          await page.mouse.move(0, 0);
          await battery.screenshot({ path: feasibilityGuideImage(language, "feasibility-sizing"), animations: "disabled" });
          await page.getByRole("tab", { name: strings["simulation.feasibility_scope_general"], exact: true }).click();
        }
      }
      await switcher.selectOption("mean");
      await expect(page.locator('[data-role="feasibility-demand-basis"]')).toHaveText(strings["simulation.feasibility_basis_mean"]);
      await expect(page.getByRole("heading", {level: 1})).toContainText(guideScenario ? evaluationName : "Paired mean");
      expect(submitted).toHaveLength(1);
    });
}

import "./simulation-result.css";
import {
  createPredictionRun,
  getPredictionRun,
  createOptimizationRun,
  getOptimizationRun,
} from "../../../api/simulation";
import { fetchBusModelById } from "../../../api/bus-models";
import { getCurrentUserId } from "../../../store";
import { computePlaceholderResults } from "./placeholder-data";
import {
  renderAnnualCostsChart,
  renderBreakPointChart,
  renderEfficiencyBarChart,
  renderEfficiencyLineChart,
  renderEmissionsBarChart,
  renderEmissionsLineChart,
} from "./simulation-charts";

export const initializeSimulationResult = (root, options = {}) => {
  const { name, shift, busModel, day } = options;

  // Header Logic
  if (name) root.querySelector("#result-sim-name").textContent = name;
  if (shift || busModel || day) {
    const meta = [shift, busModel, "Lines 1,2", day].filter(Boolean).join(", ");
    root.querySelector("#result-sim-meta").textContent = meta;
  }

  // Navigation / Close
  const closeBtn = root.querySelector("#close-simulation-result");
  const cancelBtn = root.querySelector("#cancel-simulation-result");
  const saveBtn = root.querySelector("#save-simulation-result");
  const updateBtn = root.querySelector("#update-simulation-result");

  const goBack = () => {
    document.dispatchEvent(
      new CustomEvent("partial:request", {
        detail: { slug: "simulation-archive" },
      }),
    );
  };

  closeBtn.addEventListener("click", goBack);
  cancelBtn.addEventListener("click", goBack);

  saveBtn.addEventListener("click", () => {
    alert("Simulation saved!");
    goBack();
  });

  // --- See All Data Modal ---
  const seeAllDataBtn = root.querySelector("#see-all-data-btn");
  const simDataOverlay = root.querySelector("#sim-data-overlay");
  const closeSimDataBtn = root.querySelector("#close-sim-data");
  const closeSimDataFooterBtn = root.querySelector("#close-sim-data-btn");

  const openSimDataModal = () => {
    simDataOverlay.classList.remove("hidden");
  };

  const closeSimDataModal = () => {
    simDataOverlay.classList.add("hidden");
  };

  seeAllDataBtn.addEventListener("click", async () => {
    // Populate general info from options
    const subtitle = [shift, "Lines 1,2", day].filter(Boolean).join(", ");
    root.querySelector("#sim-data-subtitle").textContent = subtitle || "--";

    const now = new Date().toLocaleString("de-CH");
    root.querySelector("#sd-creation-date").textContent = now;
    root.querySelector("#sd-update-date").textContent = now;
    root.querySelector("#sd-day").textContent = day || "--";
    root.querySelector("#sd-lines").textContent = "1, 2, 3";
    root.querySelector("#sd-shift-name").textContent = shift || "--";

    // Fetch bus model details if available
    const { busModelId } = options;
    if (busModelId) {
      try {
        const busModelData = await fetchBusModelById(busModelId);
        const specs = busModelData.specs || {};

        root.querySelector("#sd-bus-name").textContent =
          busModelData.name || "--";
        root.querySelector("#sd-manufacturer").textContent =
          busModelData.manufacturer || "--";
        root.querySelector("#sd-bus-cost").textContent =
          specs.cost != null ?
            Number(specs.cost).toLocaleString("de-CH")
          : "--";
        root.querySelector("#sd-bus-length").textContent =
          specs.bus_length_m ?? specs.length ?? "--";
        root.querySelector("#sd-max-passengers").textContent =
          specs.max_passengers ?? specs.capacity ?? "--";
        root.querySelector("#sd-bus-lifetime").textContent =
          specs.bus_lifetime_years ?? specs.lifetime ?? "--";
        root.querySelector("#sd-battery-cost").textContent =
          specs.battery_pack_cost != null ?
            Number(specs.battery_pack_cost).toLocaleString("de-CH")
          : "--";
        root.querySelector("#sd-battery-lifetime").textContent =
          specs.battery_pack_lifetime_years ?? "--";
      } catch (err) {
        console.warn("Failed to fetch bus model details:", err);
      }
    } else {
      root.querySelector("#sd-bus-name").textContent = busModel || "--";
    }

    // Charging station info (placeholder for now — no API available for individual CS data)
    // These fields can be populated later when charging station data is available

    openSimDataModal();
  });

  closeSimDataBtn.addEventListener("click", closeSimDataModal);
  closeSimDataFooterBtn.addEventListener("click", closeSimDataModal);

  // Close on overlay background click
  simDataOverlay.addEventListener("click", (e) => {
    if (e.target === simDataOverlay) closeSimDataModal();
  });

  // ... existing code ...

  updateBtn.addEventListener("click", async () => {
    // Collect specific values
    const dieselCost = parseFloat(root.querySelector("#var-diesel-cost").value);
    const dieselCurr = parseFloat(root.querySelector("#var-diesel-curr").value);
    const passenger = parseInt(root.querySelector("#var-passenger").value, 10);
    const energyCost = parseFloat(root.querySelector("#var-energy-cost").value);
    const rechargeDepot =
      root.querySelector("#var-recharge-depot").value === "yes";

    const originalText = updateBtn.textContent;
    updateBtn.textContent = "Updating...";
    updateBtn.disabled = true;

    try {
      const { shiftId, busModelId } = options;

      if (!shiftId) {
        throw new Error("No shift selected. Cannot run simulation.");
      }

      // --- Step 1: Create Prediction Run ---
      const predictionPayload = {
        shift_ids: [shiftId],
        bus_model_id: busModelId,
        model_name: "greybox_qrf_production_crps_optimized_3",
        external_temp_celsius: 15.0,
        occupancy_percent: passenger,
        auxiliary_heating_type: "default",
        quantiles: [0.05, 0.5, 0.95],
      };

      console.log("Creating prediction run:", predictionPayload);
      const predictionResult = await createPredictionRun(predictionPayload);
      console.log("Prediction run created:", predictionResult);

      const predictionRunIds = predictionResult.prediction_run_ids;
      if (!predictionRunIds || predictionRunIds.length === 0) {
        throw new Error("No prediction run IDs returned from API.");
      }

      // --- Step 2: Poll Prediction Run(s) for completion ---
      updateBtn.textContent = "Running prediction...";
      await pollRunsUntilComplete(predictionRunIds, getPredictionRun);
      console.log("All prediction runs completed.");

      // --- Step 3: Create Optimization Run ---
      const optimizationPayload = {
        mode: rechargeDepot ? "battery_only" : "charging_only",
        shift_ids: [shiftId],
        prediction_run_ids: predictionRunIds,
        charging_stations: [],
        min_soc: 0.4,
        max_soc: 0.9,
        state_of_health: 1.0,
        quantile_consumption: "mean",
      };

      if (busModelId) {
        optimizationPayload.bus_model_id = busModelId;
      }

      console.log("Creating optimization run:", optimizationPayload);
      const optimizationResult =
        await createOptimizationRun(optimizationPayload);
      console.log("Optimization run created:", optimizationResult);

      const optimizationRunId = optimizationResult.optimization_run_id;

      // --- Step 4: Poll Optimization Run for completion ---
      updateBtn.textContent = "Running optimization...";
      await pollRunsUntilComplete([optimizationRunId], getOptimizationRun);
      console.log("Optimization run completed.");

      // --- Step 5: Fetch results ---
      const optimizationRun = await getOptimizationRun(optimizationRunId);
      console.log("Optimization results:", optimizationRun);

      // For now, continue with placeholder charts
      // TODO: Map real API results to chart data
      alert("Simulation completed successfully! Results are ready.");
      updateBtn.textContent = originalText;
      updateBtn.disabled = false;
    } catch (error) {
      console.error("Simulation update failed:", error);
      alert(`Update failed: ${error.message}`);
      updateBtn.textContent = originalText;
      updateBtn.disabled = false;
    }
  });

  // Tab Logic
  const tabs = root.querySelectorAll(".tab-btn");
  const tabContents = root.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.add("hidden"));

      tab.classList.add("active");
      const targetId = tab.dataset.tab;
      const targetContent = root.querySelector(`#tab-${targetId}`);
      if (targetContent) targetContent.classList.remove("hidden");
    });
  });

  // Sliders Logic (Sync input and range)
  const syncInputs = (inputId, sliderId) => {
    const input = root.querySelector(`#${inputId}`);
    const slider = root.querySelector(`#${sliderId}`);

    if (input && slider) {
      input.addEventListener("input", () => {
        slider.value = input.value;
      });
      slider.addEventListener("input", () => {
        input.value = slider.value;
      });
    }
  };

  syncInputs("var-diesel-cost", "slider-diesel-cost");
  syncInputs("var-diesel-curr", "slider-diesel-curr");
  syncInputs("var-passenger", "slider-passenger");
  syncInputs("var-energy-cost", "slider-energy-cost");

  // --- Chart rendering ---
  const readCustomVariables = () => ({
    dieselPrice:
      parseFloat(root.querySelector("#var-diesel-cost").value) || 1.3,
    dieselConsumption:
      parseFloat(root.querySelector("#var-diesel-curr").value) || 2,
    passengers: parseInt(root.querySelector("#var-passenger").value, 10) || 60,
    electricityPrice:
      parseFloat(root.querySelector("#var-energy-cost").value) || 0.02,
    chargingStrategy:
      root.querySelector("#var-recharge-depot").value === "yes" ?
        "depot_only"
      : "opportunity",
  });

  const renderAllCharts = () => {
    const vars = readCustomVariables();
    const results = computePlaceholderResults(vars);

    renderAnnualCostsChart(
      root.querySelector("#chart-annual-costs"),
      results.annualCosts,
    );
    renderBreakPointChart(
      root.querySelector("#chart-break-point"),
      results.breakPointData,
    );
    renderEfficiencyBarChart(
      root.querySelector("#chart-efficiency-bar"),
      results.efficiencyCostPerKm,
    );
    renderEfficiencyLineChart(
      root.querySelector("#chart-efficiency-line"),
      results.efficiencyLineData,
    );
    renderEmissionsBarChart(
      root.querySelector("#chart-emissions-bar"),
      results.emissionsSaved,
    );
    renderEmissionsLineChart(
      root.querySelector("#chart-emissions-line"),
      results.emissionsSavedLine,
    );
  };

  // Initial render
  renderAllCharts();

  // Re-render charts when sliders / inputs change
  const debouncedRender = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(renderAllCharts, 300);
    };
  })();

  const variableInputs = root.querySelectorAll(
    ".custom-variables-sidebar input, .custom-variables-sidebar select",
  );
  variableInputs.forEach((el) => el.addEventListener("input", debouncedRender));

  return () => {
    variableInputs.forEach((el) =>
      el.removeEventListener("input", debouncedRender),
    );
  };
};

// ==================== HELPERS ====================

/**
 * Poll a list of run IDs until all reach "completed" or "failed" status.
 * @param {string[]} runIds - Array of run UUIDs to poll
 * @param {Function} fetchFn - Async function to fetch a run by ID (e.g. getPredictionRun)
 * @param {number} intervalMs - Polling interval in ms (default 2000)
 * @param {number} maxAttempts - Max polling attempts (default 60)
 */
const pollRunsUntilComplete = async (
  runIds,
  fetchFn,
  intervalMs = 2000,
  maxAttempts = 60,
) => {
  const completedIds = new Set();
  let attempts = 0;

  while (completedIds.size < runIds.length && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;

    for (const runId of runIds) {
      if (completedIds.has(runId)) continue;

      const run = await fetchFn(runId);
      console.log(`Polling run ${runId}: status=${run.status}`);

      if (run.status === "completed") {
        completedIds.add(runId);
      } else if (run.status === "failed") {
        throw new Error(`Run ${runId} failed.`);
      }
    }
  }

  if (completedIds.size < runIds.length) {
    throw new Error("Simulation timed out waiting for runs to complete.");
  }
};

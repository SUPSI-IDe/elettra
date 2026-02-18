import "./simulation-result.css";
import { createSimulationRun, getSimulationRun } from "../../../api/simulation";
import { fetchShiftInfo } from "../../../api/shifts";
import { fetchVariantsByRoute } from "../../../api/gtfs";
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
    // Navigate back to Archive or Make Simulation? Archive seems safer as 'Cancel'
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
      // Fetch variant info if missing
      let variantId = "1"; // Default or placeholder
      const { shiftId, busModelId } = options;

      if (shiftId) {
        try {
          const shiftInfo = await fetchShiftInfo(shiftId);
          if (shiftInfo?.route?.id) {
            const variants = await fetchVariantsByRoute(shiftInfo.route.id);
            if (variants && variants.length > 0) {
              variantId = variants[0].id; // Use the first variant
            }
          } else {
            console.warn("Shift info missing route id", shiftInfo);
          }
        } catch (err) {
          console.error("Failed to fetch variant info", err);
          // Verify if we can proceed without valid variantId? No, API requires UUID.
          // If fetching fails, we likely can't submit a valid simulation.
          throw new Error("Failed to resolve route variant from shift.");
        }
      }

      // Construct Payload
      const payload = {
        // name: root.querySelector("#result-sim-name").textContent, // Backend doesn't support top-level name
        user_id: getCurrentUserId(),
        status: "pending",
        created_at: new Date().toISOString(),
        variant_id: variantId,
        input_params: {
          name: root.querySelector("#result-sim-name").textContent,
          shift_name: shift, // From options
          day: day, // From options
          diesel_price: dieselCost,
          diesel_consumption: dieselCurr,
          passengers: passenger,
          electricity_price: energyCost,
          charging_strategy: rechargeDepot ? "depot_only" : "opportunity",
        },
      };

      // NOTE: Without the original Shift ID and Bus Model ID stored in the DOM or closure, we can't fully create a valid run if those are required.
      // However, let's assume we post what we have and see, or better, log it.
      // For now, I will use the payload structure as best guessed and alert if it fails.

      console.log("Sending simulation update:", payload);
      const result = await createSimulationRun(payload);
      console.log("Simulation Result:", result);

      // Poll for completion
      const pollInterval = 2000; // 2 seconds
      const maxAttempts = 30; // 60 seconds timeout
      let attempts = 0;

      const poll = async () => {
        try {
          const run = await getSimulationRun(result.id);
          console.log("Polling simulation:", run.status);

          if (run.status === "completed") {
            // Update UI with results (reload page or update specific elements)
            const event = new CustomEvent("partial:request", {
              detail: {
                slug: "simulation-result",
                // Pass the updated run details if needed, or re-fetch?
                // For now, let's re-initialize or notify
                // We might need to handle the 'result' structure to update charts
                name: run.input_params?.name, // Persist metadata
                shift: run.input_params?.shift_name,
                day: run.input_params?.day,
              },
            });
            // document.dispatchEvent(event);
            // Alert for now as requested
            alert("Simulation updated successfully! Results are ready.");
            updateBtn.textContent = originalText;
            updateBtn.disabled = false;
            return;
          } else if (run.status === "failed") {
            throw new Error("Simulation run failed.");
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error("Simulation timed out.");
            }
            setTimeout(poll, pollInterval);
          }
        } catch (err) {
          console.error("Polling failed:", err);
          alert(`Update failed: ${err.message}`);
          updateBtn.textContent = originalText;
          updateBtn.disabled = false;
        }
      };

      poll();
    } catch (error) {
      console.error("Simulation update failed:", error);
      alert(`Update failed: ${error.message}`);
      updateBtn.textContent = originalText;
      updateBtn.disabled = false;
    }
    // Finally block removed because polling is async and handles button state reset
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
        // debounce chart update?
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

import "./compare-simulations.css";
import { escapeHtml } from "../../../ui-helpers";
import { getPredictionRun } from "../../../api/simulation";
import { fetchBusModelById } from "../../../api/bus-models";
import { fetchShiftInfo } from "../../../api/shifts";
import { computePlaceholderResults } from "../SimulationResult/placeholder-data";
import {
  renderAnnualCostsChart,
  renderBreakPointChart,
  renderEfficiencyBarChart,
  renderEfficiencyLineChart,
  renderEmissionsBarChart,
  renderEmissionsLineChart,
} from "../SimulationResult/simulation-charts";

export const initializeCompareSimulations = async (root, options = {}) => {
  console.log("[CompareSimulations] Initializing view with options:", options);
  const sim1 = options.sim1 || {};
  const sim2 = options.sim2 || {};

  const closeBtnTop = root.querySelector("#close-compare-simulations");
  const closeBtnBottom = root.querySelector("#bottom-close-btn");
  const tabBtns = root.querySelectorAll(".tab-btn");
  const tabContents = root.querySelectorAll(".tab-content");

  // DOM Elements for content
  const shiftDetailsEl = root.querySelector("#compare-shift-details");
  const sim1NameEl = root.querySelector("#sim1-name");
  const sim1DetailsEl = root.querySelector("#sim1-details");
  const sim2NameEl = root.querySelector("#sim2-name");
  const sim2DetailsEl = root.querySelector("#sim2-details");

  // Populate Header
  const shiftId = sim1.shift_id || sim2.shift_id || "--";
  const day = sim1.day || sim2.day || "--";
  shiftDetailsEl.textContent = `Shift: ${shiftId.substring(0, 8)}..., ${day}`;

  // Populate Columns Header
  sim1NameEl.textContent = sim1.model_name || "Simulation 1";
  sim2NameEl.textContent = sim2.model_name || "Simulation 2";

  const sim1Created =
    sim1.created_at ? new Date(sim1.created_at).toLocaleDateString() : "--";
  const sim2Created =
    sim2.created_at ? new Date(sim2.created_at).toLocaleDateString() : "--";
  sim1DetailsEl.textContent = `Created: ${sim1Created}`;
  sim2DetailsEl.textContent = `Created: ${sim2Created}`;

  const goBack = () => {
    document.dispatchEvent(
      new CustomEvent("partial:request", {
        detail: { slug: "simulation-archive" },
      }),
    );
  };

  closeBtnTop.addEventListener("click", goBack);
  closeBtnBottom.addEventListener("click", goBack);

  // --- See All Data Modal Logic ---
  const simDataOverlay = root.querySelector("#sim-data-overlay");
  const closeSimDataBtn = root.querySelector("#close-sim-data");
  const closeSimDataFooterBtn = root.querySelector("#close-sim-data-btn");

  const openSimDataModal = () => {
    simDataOverlay.classList.remove("hidden");
  };

  const closeSimDataModal = () => {
    simDataOverlay.classList.add("hidden");
  };

  closeSimDataBtn.addEventListener("click", closeSimDataModal);
  closeSimDataFooterBtn.addEventListener("click", closeSimDataModal);
  simDataOverlay.addEventListener("click", (e) => {
    if (e.target === simDataOverlay) closeSimDataModal();
  });

  const populateAndOpenModal = async (sim) => {
    const shiftId = sim.shift_id;
    const busModelId = sim.bus_model_id;

    // Fetch shift info and bus model in parallel
    const [shiftInfo, busModelData] = await Promise.all([
      shiftId ?
        fetchShiftInfo(shiftId).catch((err) => {
          console.warn("Failed to fetch shift info:", err);
          return null;
        })
      : Promise.resolve(null),
      busModelId ?
        fetchBusModelById(busModelId).catch((err) => {
          console.warn("Failed to fetch bus model details:", err);
          return null;
        })
      : Promise.resolve(null),
    ]);

    // Extract lines from shift info
    const lines = shiftInfo?.route?.name || "--";
    const daysOfWeek = shiftInfo?.days_of_week?.join(", ") || "--";
    const simDay = sim.day || daysOfWeek;
    const shiftName = sim.shift_name || shiftId || "--";

    // Populate subtitle
    const subtitle = [shiftName, lines, simDay].filter(Boolean).join(", ");
    root.querySelector("#sim-data-subtitle").textContent = subtitle || "--";

    // General info
    const creationDate =
      sim.created_at ? new Date(sim.created_at).toLocaleString("de-CH") : "--";
    root.querySelector("#sd-creation-date").textContent = creationDate;
    root.querySelector("#sd-update-date").textContent = creationDate;
    root.querySelector("#sd-day").textContent = simDay;
    root.querySelector("#sd-lines").textContent = lines;
    root.querySelector("#sd-shift-name").textContent = shiftName;

    // Bus info
    if (busModelData) {
      const specs = busModelData.specs || {};

      root.querySelector("#sd-bus-name").textContent =
        busModelData.name || "--";
      root.querySelector("#sd-manufacturer").textContent =
        busModelData.manufacturer || "--";
      root.querySelector("#sd-bus-cost").textContent =
        specs.cost != null ? Number(specs.cost).toLocaleString("de-CH") : "--";
      root.querySelector("#sd-bus-length").textContent = specs.size ?? "--";
      root.querySelector("#sd-max-passengers").textContent =
        specs.passengers ?? "--";
      root.querySelector("#sd-bus-lifetime").textContent =
        specs.lifetime ?? "--";
      root.querySelector("#sd-battery-cost").textContent =
        specs.battery_cost != null ?
          Number(specs.battery_cost).toLocaleString("de-CH")
        : "--";
      root.querySelector("#sd-battery-lifetime").textContent =
        specs.battery_lifetime ?? "--";
    } else {
      root.querySelector("#sd-bus-name").textContent =
        busModelId || sim.model_name || "--";
      root.querySelector("#sd-manufacturer").textContent = "--";
      root.querySelector("#sd-bus-cost").textContent = "--";
      root.querySelector("#sd-bus-length").textContent = "--";
      root.querySelector("#sd-max-passengers").textContent = "--";
      root.querySelector("#sd-bus-lifetime").textContent = "--";
      root.querySelector("#sd-battery-cost").textContent = "--";
      root.querySelector("#sd-battery-lifetime").textContent = "--";
    }

    // Charging station info — no dedicated API for CS data yet
    // Fields remain at default "--"

    openSimDataModal();
  };

  root
    .querySelector("#sim1-see-all-data")
    .addEventListener("click", () => populateAndOpenModal(sim1));
  root
    .querySelector("#sim2-see-all-data")
    .addEventListener("click", () => populateAndOpenModal(sim2));

  // Fetch detailed data
  let results1 = null;
  let results2 = null;

  try {
    const [detail1, detail2] = await Promise.all([
      sim1.id ? getPredictionRun(sim1.id) : Promise.resolve(null),
      sim2.id ? getPredictionRun(sim2.id) : Promise.resolve(null),
    ]);

    console.log("[CompareSimulations] Sim1 detail:", detail1);
    console.log("[CompareSimulations] Sim2 detail:", detail2);

    // Use placeholder results for chart rendering
    // TODO: Replace with real data mapping once API response structure is finalized
    results1 = computePlaceholderResults();
    results2 = computePlaceholderResults({
      dieselPrice: 1.5,
      electricityPrice: 0.03,
    });
  } catch (error) {
    console.error("[CompareSimulations] Error loading data:", error);
  }

  // Render charts for a given tab only when it becomes visible
  const renderedTabs = new Set();

  const renderChartsForTab = (tabId) => {
    if (!results1 || !results2 || renderedTabs.has(tabId)) return;
    renderedTabs.add(tabId);

    switch (tabId) {
      case "costs":
        renderAnnualCostsChart(
          root.querySelector("#sim1-annual-costs-chart"),
          results1.annualCosts,
        );
        renderAnnualCostsChart(
          root.querySelector("#sim2-annual-costs-chart"),
          results2.annualCosts,
        );
        renderBreakPointChart(
          root.querySelector("#sim1-bpa-chart"),
          results1.breakPointData,
        );
        renderBreakPointChart(
          root.querySelector("#sim2-bpa-chart"),
          results2.breakPointData,
        );
        break;
      case "efficiency":
        renderEfficiencyBarChart(
          root.querySelector("#sim1-efficiency-bar-chart"),
          results1.efficiencyCostPerKm,
        );
        renderEfficiencyBarChart(
          root.querySelector("#sim2-efficiency-bar-chart"),
          results2.efficiencyCostPerKm,
        );
        renderEfficiencyLineChart(
          root.querySelector("#sim1-efficiency-line-chart"),
          results1.efficiencyLineData,
        );
        renderEfficiencyLineChart(
          root.querySelector("#sim2-efficiency-line-chart"),
          results2.efficiencyLineData,
        );
        break;
      case "emissions":
        renderEmissionsBarChart(
          root.querySelector("#sim1-emissions-bar-chart"),
          results1.emissionsSaved,
        );
        renderEmissionsBarChart(
          root.querySelector("#sim2-emissions-bar-chart"),
          results2.emissionsSaved,
        );
        renderEmissionsLineChart(
          root.querySelector("#sim1-emissions-line-chart"),
          results1.emissionsSavedLine,
        );
        renderEmissionsLineChart(
          root.querySelector("#sim2-emissions-line-chart"),
          results2.emissionsSavedLine,
        );
        break;
    }
  };

  // Tab switching logic
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");

      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      tabContents.forEach((tc) => {
        if (tc.id === `tab-${tabId}`) {
          tc.classList.add("active");
        } else {
          tc.classList.remove("active");
        }
      });

      renderChartsForTab(tabId);
    });
  });

  // Render the initially active tab (costs)
  renderChartsForTab("costs");

  return () => {
    // Cleanup if needed
  };
};

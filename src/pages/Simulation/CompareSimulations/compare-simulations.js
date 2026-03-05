import "./compare-simulations.css";
import { escapeHtml } from "../../../ui-helpers";
import { getPredictionRun } from "../../../api/simulation";
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

  const sim1Created = sim1.created_at ? new Date(sim1.created_at).toLocaleDateString() : "--";
  const sim2Created = sim2.created_at ? new Date(sim2.created_at).toLocaleDateString() : "--";
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
    results2 = computePlaceholderResults({ dieselPrice: 1.5, electricityPrice: 0.03 });
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
        renderAnnualCostsChart(root.querySelector("#sim1-annual-costs-chart"), results1.annualCosts);
        renderAnnualCostsChart(root.querySelector("#sim2-annual-costs-chart"), results2.annualCosts);
        renderBreakPointChart(root.querySelector("#sim1-bpa-chart"), results1.breakPointData);
        renderBreakPointChart(root.querySelector("#sim2-bpa-chart"), results2.breakPointData);
        break;
      case "efficiency":
        renderEfficiencyBarChart(root.querySelector("#sim1-efficiency-bar-chart"), results1.efficiencyCostPerKm);
        renderEfficiencyBarChart(root.querySelector("#sim2-efficiency-bar-chart"), results2.efficiencyCostPerKm);
        renderEfficiencyLineChart(root.querySelector("#sim1-efficiency-line-chart"), results1.efficiencyLineData);
        renderEfficiencyLineChart(root.querySelector("#sim2-efficiency-line-chart"), results2.efficiencyLineData);
        break;
      case "emissions":
        renderEmissionsBarChart(root.querySelector("#sim1-emissions-bar-chart"), results1.emissionsSaved);
        renderEmissionsBarChart(root.querySelector("#sim2-emissions-bar-chart"), results2.emissionsSaved);
        renderEmissionsLineChart(root.querySelector("#sim1-emissions-line-chart"), results1.emissionsSavedLine);
        renderEmissionsLineChart(root.querySelector("#sim2-emissions-line-chart"), results2.emissionsSavedLine);
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

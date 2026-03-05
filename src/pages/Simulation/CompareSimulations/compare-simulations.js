import "./compare-simulations.css";
import { escapeHtml } from "../../../ui-helpers";

export const initializeCompareSimulations = async (root, options = {}) => {
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
  const shiftName =
    typeof sim1.shift === "object" ? sim1.shift?.name : sim1.shift;
  const day = sim1.day || "--";
  shiftDetailsEl.textContent = `${escapeHtml(shiftName || "Unknown Shift")}, ${escapeHtml(day)}`;

  // Populate Columns Header
  sim1NameEl.textContent = escapeHtml(sim1.model_name || "<Simulation 1>");
  sim2NameEl.textContent = escapeHtml(sim2.model_name || "<Simulation 2>");

  sim1DetailsEl.textContent = `${escapeHtml(sim1.bus_model || "<Bus model>")} , ${escapeHtml(sim1.lines || "<Lines>")}`;
  sim2DetailsEl.textContent = `${escapeHtml(sim2.bus_model || "<Bus model>")} , ${escapeHtml(sim2.lines || "<Lines>")}`;

  // Tab switching logic
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");

      // Update active classes on buttons
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Show requested tab content, hide others
      tabContents.forEach((tc) => {
        if (tc.id === `tab-${tabId}`) {
          tc.classList.add("active");
        } else {
          tc.classList.remove("active");
        }
      });
    });
  });

  const goBack = () => {
    document.dispatchEvent(
      new CustomEvent("partial:request", {
        detail: { slug: "simulation-archive" },
      }),
    );
  };

  closeBtnTop.addEventListener("click", goBack);
  closeBtnBottom.addEventListener("click", goBack);

  return () => {
    // Cleanup if needed
  };
};

import "./simulation-archive.css";
import { listPredictionRuns } from "../../../api/simulation";
import { escapeHtml, escapeAttr } from "../../../ui-helpers";
import { createTablePagination } from "../../../dom/pagination";

export const initializeSimulationArchive = async (root) => {
  const tableBody = root.querySelector("#simulations-table tbody");
  const selectAllCheckbox = root.querySelector("#select-all-simulations");
  const compareBtn = root.querySelector("#compare-simulations-btn");
  const deleteBtn = root.querySelector("#delete-simulations-btn");
  const editBtn = root.querySelector("#edit-simulation-btn");

  const makeSimulationBtn = root.querySelector("#make-simulation-btn");

  makeSimulationBtn.addEventListener("click", () => {
    document.dispatchEvent(
      new CustomEvent("partial:request", {
        detail: { slug: "make-simulation" },
      }),
    );
  });

  let simulations = [];
  let selectedIds = new Set();

  const updateButtonStates = () => {
    const selectedCount = selectedIds.size;
    const selectedSimulations = simulations.filter((s) =>
      selectedIds.has(s.id),
    );

    editBtn.disabled = selectedCount !== 1;
    deleteBtn.disabled = selectedCount === 0;

    let canCompare = false;

    if (selectedCount === 2) {
      const sim1 = selectedSimulations[0];
      const sim2 = selectedSimulations[1];

      const shift1 =
        typeof sim1.shift === "object" ? sim1.shift.name : sim1.shift;
      const shift2 =
        typeof sim2.shift === "object" ? sim2.shift.name : sim2.shift;

      if (shift1 && shift2 && shift1 === shift2) {
        canCompare = true;
      }
    }

    compareBtn.disabled = !canCompare;

    // Attach click listener exactly when it is comparable and detach otherwise,
    // or just overwrite the onclick
    compareBtn.onclick = () => {
      if (canCompare) {
        document.dispatchEvent(
          new CustomEvent("partial:request", {
            detail: {
              slug: "compare-simulations",
              sim1: selectedSimulations[0],
              sim2: selectedSimulations[1],
            },
          }),
        );
      }
    };
  };

  const renderVisibleRows = (visibleSimulations) => {
    tableBody.innerHTML = "";

    if (simulations.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No simulations found.</td></tr>`;
      return;
    }

    visibleSimulations.forEach((sim) => {
      if (!sim.id) console.warn("Simulation missing ID:", sim);
      const row = document.createElement("tr");
      const isSelected = selectedIds.has(sim.id);
      if (isSelected) {
        row.classList.add("selected");
      }

      const creationDate =
        sim.created_at ? new Date(sim.created_at).toLocaleString() : "--";

      const modelName = sim.model_name || "--";
      const shiftId = sim.shift_id || "--";
      const day = sim.day || "--";
      const summary = sim.summary || {};
      const initialInvestment =
        summary.initial_investment_chf !== undefined ?
          Number(summary.initial_investment_chf).toLocaleString("de-CH")
        : "--";

      row.innerHTML = `
        <td class="checkbox">
          <input type="checkbox" class="sim-checkbox" data-id="${escapeAttr(sim.id)}" ${isSelected ? "checked" : ""} />
        </td>
        <td>${escapeHtml(creationDate)}</td>
        <td>${escapeHtml(modelName)}</td>
        <td>${escapeHtml(String(shiftId).substring(0, 8))}...</td>
        <td>${escapeHtml(day)}</td>
        <td class="text-right">${escapeHtml(initialInvestment)}</td>
      `;

      const checkbox = row.querySelector(".sim-checkbox");
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          selectedIds.add(sim.id);
        } else {
          selectedIds.delete(sim.id);
        }
        pagination.render();
      });

      tableBody.appendChild(row);
    });
  };

  const pagination = createTablePagination(root, {
    tableWrapper: ".table-wrapper",
    table: "#simulations-table",
    paginationContainer: "#simulation-pagination",
    renderRows: renderVisibleRows,
    onPageRender: updateButtonStates,
    defaultPerPage: 6,
  });

  // Select All Logic
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        simulations.forEach((s) => selectedIds.add(s.id));
      } else {
        selectedIds.clear();
      }
      pagination.render();
    });
  }

  // Delete Handler
  deleteBtn.addEventListener("click", async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${count} simulation(s)? This action cannot be undone.`,
    );

    if (!confirmed) return;

    alert("Delete is not currently available for prediction runs.");
    return;
  });

  // Initial fetch
  try {
    const data = await listPredictionRuns();
    console.log("[SimulationArchive] Raw API response:", data);
    simulations = Array.isArray(data) ? data : data.results || [];
    if (simulations.length > 0)
      console.log("[SimulationArchive] First sim fields:", simulations[0]);
    pagination.update(simulations);
  } catch (error) {
    console.error("Error loading simulations:", error);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: red;">Error loading simulations.</td></tr>`;
  }

  // Cleanup
  return () => {
    pagination.destroy();
  };
};

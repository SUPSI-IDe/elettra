import "./simulation-archive.css";
import { listPredictionRuns } from "../../../api/simulation";
import { escapeHtml, escapeAttr } from "../../../ui-helpers";

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

  // Pagination State
  let currentPage = 1;
  const itemsPerPage = 15;

  const renderPagination = () => {
    const paginationContainer = root.querySelector("#simulation-pagination");
    if (!paginationContainer) return;

    paginationContainer.innerHTML = "";

    // Hide if items <= itemsPerPage
    if (simulations.length <= itemsPerPage) {
      paginationContainer.style.display = "none";
      return;
    }

    paginationContainer.style.display = "flex";
    const totalPages = Math.ceil(simulations.length / itemsPerPage);

    // Prev Button
    const prevBtn = document.createElement("button");
    prevBtn.className = "page-btn prev";
    prevBtn.textContent = "<";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        renderPagination();
      }
    });
    paginationContainer.appendChild(prevBtn);

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.className = `page-btn ${i === currentPage ? "active" : ""}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener("click", () => {
        currentPage = i;
        renderTable();
        renderPagination();
      });
      paginationContainer.appendChild(pageBtn);
    }

    // Next Button
    const nextBtn = document.createElement("button");
    nextBtn.className = "page-btn next";
    nextBtn.textContent = ">";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        renderPagination();
      }
    });
    paginationContainer.appendChild(nextBtn);
  };

  const renderTable = () => {
    tableBody.innerHTML = "";

    if (simulations.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No simulations found.</td></tr>`;
      renderPagination();
      return;
    }

    // Pagination Slice
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const visibleSimulations = simulations.slice(startIndex, endIndex);

    visibleSimulations.forEach((sim) => {
      if (!sim.id) console.warn("Simulation missing ID:", sim);
      const row = document.createElement("tr");
      const isSelected = selectedIds.has(sim.id);
      if (isSelected) {
        row.classList.add("selected");
      }

      // Map API fields to Table columns
      const creationDate =
        sim.created_at ? new Date(sim.created_at).toLocaleString() : "--";

      const modelName = sim.model_name || "--";
      const shiftId = sim.shift_id || "--";
      const status = sim.status || "unknown";
      const summary = sim.summary || {};
      const totalConsumption =
        summary.total_consumption_kwh !== undefined ?
          `${Number(summary.total_consumption_kwh).toFixed(1)} kWh`
        : "--";

      const statusClass = `status-${status.toLowerCase()}`;
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

      row.innerHTML = `
        <td class="checkbox">
          <input type="checkbox" class="sim-checkbox" data-id="${escapeAttr(sim.id)}" ${isSelected ? "checked" : ""} />
        </td>
        <td>${escapeHtml(creationDate)}</td>
        <td>${escapeHtml(modelName)}</td>
        <td>${escapeHtml(String(shiftId).substring(0, 8))}...</td>
        <td><span class="status-badge ${escapeAttr(statusClass)}">${escapeHtml(statusLabel)}</span></td>
        <td>${escapeHtml(totalConsumption)}</td>
      `;

      // Row simple selection via checkbox, but we also handle row click if desired?
      // For now, let's stick to delegating events or attaching here.
      // Attaching here is safer for the loop.
      const checkbox = row.querySelector(".sim-checkbox");
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          selectedIds.add(sim.id);
        } else {
          selectedIds.delete(sim.id);
        }
        // Don't re-render whole table on check, just update state buttons could be better but
        // to match existing logic exactly let's keep it simple. However, re-rendering loses focus if not careful.
        // The previous implementation re-rendered. I'll stick to it but maybe just update styles?
        // Actually, previous implementation called renderTable(), so I will too.
        renderTable();
      });

      tableBody.appendChild(row);
    });

    renderPagination();
    updateButtonStates();
  };

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

    if (canCompare) {
      compareBtn.disabled = false;
    } else {
      compareBtn.disabled = true;
    }
  };

  const fetchAndRender = async () => {
    try {
      const data = await listPredictionRuns();
      // Adjust based on actual API response structure (array vs paginated object)
      simulations = Array.isArray(data) ? data : data.results || [];
      // Reset current page when fetching new data
      currentPage = 1;
      renderTable();
    } catch (error) {
      console.error("Error loading simulations:", error);
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: red;">Error loading simulations.</td></tr>`;
    }
  };

  // Select All Logic
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        simulations.forEach((s) => selectedIds.add(s.id));
      } else {
        selectedIds.clear();
      }
      renderTable();
    });
  }

  // Delete Handler
  deleteBtn.addEventListener("click", async () => {
    console.log("Delete button clicked");
    const count = selectedIds.size;
    console.log("Selected count:", count);
    if (count === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${count} simulation(s)? This action cannot be undone.`,
    );

    if (!confirmed) return;

    // Delete not available in the current API
    alert("Delete is not currently available for prediction runs.");
    return;
  });

  // Initial fetch
  await fetchAndRender();

  // Cleanup
  return () => {
    // Cleanup listeners if needed
  };
};

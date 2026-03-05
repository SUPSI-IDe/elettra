import { fetchShifts, fetchShiftInfo } from "../../../api/shifts";
import { fetchBusModels } from "../../../api/bus-models";
import { escapeHtml, escapeAttr } from "../../../ui-helpers";
import { createTablePagination } from "../../../dom/pagination";
import "./make-simulation.css";

export const initializeMakeSimulation = async (root) => {
  const form = root.querySelector("#make-simulation-form");
  const busModelSelect = root.querySelector("#simulation-bus-model");
  const shiftTableBody = root.querySelector("#shift-selection-table tbody");
  const nextBtn = root.querySelector("#submit-make-simulation");
  const cancelBtn = root.querySelector("#cancel-make-simulation");
  const closeBtn = root.querySelector("#close-make-simulation");
  const shiftSearch = root.querySelector("#shift-search");

  let shifts = [];
  let filteredShifts = [];
  let selectedShiftId = null;

  // Validation
  const checkValidity = () => {
    const name = root.querySelector("#simulation-name").value.trim();
    const model = busModelSelect.value;
    const day = root.querySelector("#simulation-day").value;
    const shift = selectedShiftId;

    const isValid = name && model && day && shift;
    nextBtn.disabled = !isValid;
  };

  // Render visible page of shifts
  const renderShiftRows = (visibleShifts) => {
    shiftTableBody.innerHTML = "";

    if (filteredShifts.length === 0) {
      shiftTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No shifts found</td></tr>`;
      return;
    }

    visibleShifts.forEach((shift) => {
      const row = document.createElement("tr");
      if (shift.id === selectedShiftId) {
        row.classList.add("selected");
      }

      const startTime = shift.start_time || "--:--";
      const endTime = shift.end_time || "--:--";
      const tripCount = shift.structure ? shift.structure.length : 0;
      const lines =
        shift.lines ? shift.lines.join(", ")
        : tripCount > 0 ? `${tripCount} trips`
        : "--";

      row.innerHTML = `
        <td class="checkbox">
          <input type="checkbox" name="shift-select" value="${escapeAttr(shift.id)}" ${shift.id === selectedShiftId ? "checked" : ""} />
        </td>
        <td>${escapeHtml(shift.name)}</td>
        <td>${escapeHtml(lines)}</td>
        <td>${escapeHtml(startTime)}</td>
        <td>${escapeHtml(endTime)}</td>
      `;

      row.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          selectedShiftId = shift.id;
          pagination.render();
          checkValidity();
        }
      });

      const input = row.querySelector("input");
      input.addEventListener("change", () => {
        selectedShiftId = shift.id;
        pagination.render();
        checkValidity();
      });

      shiftTableBody.appendChild(row);
    });
  };

  const formSection = root.querySelector(".form-section");
  const pagination = createTablePagination(formSection, {
    tableWrapper: ".shift-table-wrapper",
    table: "#shift-selection-table",
    paginationContainer: "#shift-pagination",
    renderRows: renderShiftRows,
    onPageRender: checkValidity,
    defaultPerPage: 6,
  });

  const applyFilter = (filterText = "") => {
    const lowerFilter = filterText.toLowerCase();
    filteredShifts = shifts.filter((s) =>
      s.name?.toLowerCase().includes(lowerFilter),
    );
    pagination.update(filteredShifts);
  };

  // Search
  shiftSearch.addEventListener("input", (e) => {
    applyFilter(e.target.value);
  });

  // Listeners for inputs to trigger validation
  root
    .querySelector("#simulation-name")
    .addEventListener("input", checkValidity);
  busModelSelect.addEventListener("change", checkValidity);
  root
    .querySelector("#simulation-day")
    .addEventListener("change", checkValidity);

  // Navigation Helpers
  const goBack = () => {
    // Trigger navigation event
    const event = new CustomEvent("partial:request", {
      detail: { slug: "simulation-archive" },
    });
    document.dispatchEvent(event);
  };

  cancelBtn.addEventListener("click", goBack);
  closeBtn.addEventListener("click", goBack);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Gather data
    const name = root.querySelector("#simulation-name").value.trim();
    // Get text content of selected option for display
    const busModelOption = busModelSelect.options[busModelSelect.selectedIndex];
    const busModel = busModelOption ? busModelOption.textContent : "";
    const day = root.querySelector("#simulation-day").value;

    // Find selected shift name
    const selectedShift = shifts.find((s) => s.id === selectedShiftId);
    const shiftName = selectedShift ? selectedShift.name : "";

    const event = new CustomEvent("partial:request", {
      detail: {
        slug: "simulation-result",
        name,
        busModel,
        day,
        shift: shiftName,
        shiftId: selectedShiftId,
        busModelId: busModelSelect.value,
      },
    });
    document.dispatchEvent(event);
  });

  // Fetch data
  try {
    shiftTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading data...</td></tr>`;

    const [fetchedShifts, fetchedBusModels] = await Promise.all([
      fetchShifts({ limit: 1000 }),
      fetchBusModels({ limit: 1000 }),
    ]);

    // Process Bus Models
    const models = Array.isArray(fetchedBusModels) ? fetchedBusModels : [];
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name;
      busModelSelect.appendChild(option);
    });

    // Process Shifts
    shifts = Array.isArray(fetchedShifts) ? fetchedShifts : [];
    applyFilter();

    // Fetch detailed info for times in background
    if (shifts.length > 0) {
      Promise.all(
        shifts.map(async (shift) => {
          try {
            const info = await fetchShiftInfo(shift.id);
            if (info && info.trips && info.trips.length > 0) {
              const sortedTrips = info.trips.sort(
                (a, b) => a.sequence_number - b.sequence_number,
              );
              shift.start_time = sortedTrips[0].departure_time;
              shift.end_time = sortedTrips[sortedTrips.length - 1].arrival_time;
            }
          } catch (err) {
            console.warn(`Failed to load details for shift ${shift.id}`, err);
          }
        }),
      ).then(() => {
        applyFilter(shiftSearch.value);
      });
    }
  } catch (err) {
    console.error("Failed to fetch simulation data:", err);
    shiftTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Error loading data</td></tr>`;
  }

  return () => {
    pagination.destroy();
  };
};

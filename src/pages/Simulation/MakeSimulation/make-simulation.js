import { fetchShifts, fetchShiftInfo } from "../../../api/shifts";
import { fetchBusModels } from "../../../api/bus-models";
import { initializeSimulationArchive } from "../SimulationArchive/simulation-archive";
import { escapeHtml, escapeAttr } from "../../../ui-helpers";
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
  let selectedShiftId = null;

  // Validation
  const checkValidity = () => {
    const name = root.querySelector("#simulation-name").value.trim();
    const model = busModelSelect.value;
    const day = root.querySelector("#simulation-day").value;
    const shift = selectedShiftId;

    // Check if shift is selected and other fields have values
    const isValid = name && model && day && shift;
    nextBtn.disabled = !isValid;
  };

  // Render Table
  const renderShifts = (filterText = "") => {
    shiftTableBody.innerHTML = "";
    const lowerFilter = filterText.toLowerCase();

    const filteredShifts = shifts.filter((s) => {
      // Assuming API returns 'name', maybe 'trip_ids' or similar for lines?
      // Check the structure of fetched object in debugger or assume common fields.
      // Based on typical shift objects: { id, name, ... }
      // Lines might need to be derived or are part of the object.
      // For now, safe check on name.
      const nameMatch = s.name?.toLowerCase().includes(lowerFilter);
      return nameMatch;
    });

    if (filteredShifts.length === 0) {
      shiftTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No shifts found</td></tr>`;
      return;
    }

    filteredShifts.forEach((shift) => {
      const row = document.createElement("tr");
      if (shift.id === selectedShiftId) {
        row.classList.add("selected");
      }

      // Format time if available, or placeholder
      // API might return proper objects or we need to extract info.
      // Shift object from API typically has: id, name, trip_ids.
      // Start/End might need calculation from trips or are provided.
      // Let's assume placeholders if not present, or basic values.
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

      // Row click UX
      const selectHandler = (e) => {
        // Prevent event bubbling if clicking input directly to avoid double toggle
        if (e.target.tagName === "INPUT" && e.type === "click") return;

        if (selectedShiftId === shift.id) {
          // Optional: allow deselect?
          // selectedShiftId = null;
        } else {
          selectedShiftId = shift.id;
        }
        renderShifts(shiftSearch.value);
        checkValidity();
      };

      row.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          selectHandler(e);
        }
      });

      const input = row.querySelector("input");
      input.addEventListener("change", () => {
        selectedShiftId = shift.id;
        renderShifts(shiftSearch.value);
        checkValidity();
      });

      shiftTableBody.appendChild(row);
    });
  };

  // Search
  shiftSearch.addEventListener("input", (e) => {
    renderShifts(e.target.value);
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
    renderShifts(); // Initial render with basic info

    // Fetch detailed info for times (in background/parallel)
    if (shifts.length > 0) {
      // Show loading state or just update progressively?
      // Let's update in place to keep UI responsive.
      Promise.all(
        shifts.map(async (shift) => {
          try {
            const info = await fetchShiftInfo(shift.id);
            if (info && info.trips && info.trips.length > 0) {
              // Sort by sequence just in case
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
        renderShifts(shiftSearch.value); // Re-render with times
      });
    }
  } catch (err) {
    console.error("Failed to fetch simulation data:", err);
    shiftTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Error loading data</td></tr>`;
  }

  return () => {};
};

import { t } from "../../../i18n";
import "./shifts.css";
import {
  createShift,
  deleteShift,
  fetchShiftById,
  fetchShifts,
  fetchBuses,
  fetchStopsByTripId,
} from "../../../api";
import { bindSelectAll } from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const setFlashMessage = (section, message) => {
  const flashElement = section.querySelector('[data-role="flash"]');
  if (!flashElement) {
    return;
  }

  if (message) {
    flashElement.textContent = message;
    flashElement.hidden = false;
  } else {
    flashElement.textContent = "";
    flashElement.hidden = true;
  }
};

const renderLoading = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="id" colspan="7">Loading…</td>
        </tr>
    `;
};

const renderError = (tbody, message = "Unable to load shifts.") => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="id" colspan="7">${textContent(message)}</td>
        </tr>
    `;
};

const renderEmpty = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="id" colspan="7">No shifts found.</td>
        </tr>
    `;
};

const parseTime = (time) => {
  const match = /^\s*(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "—";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const renderRows = (tbody, shifts = []) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(shifts) || shifts.length === 0) {
    renderEmpty(tbody);
    return;
  }

  const rows = shifts
    .map((shift = {}) => {
      const structure = Array.isArray(shift?.structure) ? shift.structure : [];
      const tripsCount = structure.length;
      const routeLabel =
        tripsCount === 0 ? "—" : (
          `${tripsCount} trip${tripsCount === 1 ? "" : "s"}`
        );

      let startTime =
        text(shift?.start_time).trim() || text(shift?.startTime).trim();
      let endTime = text(shift?.end_time).trim() || text(shift?.endTime).trim();

      if ((!startTime || !endTime) && structure.length > 0) {
        const times = structure.flatMap((item) => {
          const trip = item?.trip ?? {};
          const nestedTrip = trip?.trip ?? {};
          const stopTimes =
            Array.isArray(trip?.stop_times) ? trip.stop_times
            : Array.isArray(nestedTrip?.stop_times) ? nestedTrip.stop_times
            : [];

          return [
            trip.departure_time,
            trip.arrival_time,
            trip.start_time,
            trip.end_time,
            nestedTrip.departure_time,
            nestedTrip.arrival_time,
            nestedTrip.start_time,
            nestedTrip.end_time,
            stopTimes[0]?.departure_time,
            stopTimes[0]?.arrival_time,
            stopTimes[stopTimes.length - 1]?.departure_time,
            stopTimes[stopTimes.length - 1]?.arrival_time,
          ];
        });

        const minutes = times.map(parseTime).filter((m) => m !== null);

        if (minutes.length > 0) {
          if (!startTime) {
            startTime = formatTime(Math.min(...minutes));
          }
          if (!endTime) {
            endTime = formatTime(Math.max(...minutes));
          }
        }
      }

      startTime = startTime || "—";
      endTime = endTime || "—";

      const rowId = text(shift?.id);
      const rowName = text(shift?.name);
      const rowBus = text(
        shift?.bus_name ?? shift?.bus_name ?? shift?.bus_id ?? ""
      );
      return `
                <tr data-id="${rowId}" data-name="${rowName}" data-bus="${rowBus}">
                    <td class="checkbox"><input type="checkbox" aria-label="Select shift"></td>
                    <td class="id">${textContent(shift?.id ?? "")}</td>
                    <td class="name">${textContent(shift?.name ?? "")}</td>
                    <td class="bus">${textContent(
                      shift?.bus_name ?? shift?.bus_id ?? ""
                    )}</td>
                    <td class="start">${textContent(startTime)}</td>
                    <td class="end">${textContent(endTime)}</td>
                    <td class="route">${textContent(routeLabel)}</td>
                    <td class="actions">
                        <button type="button" data-action="visualize-shift">Visualize shift</button>
                    </td>
                </tr>
            `;
    })
    .join("");

  tbody.innerHTML = rows;

  shifts.forEach((shift) => {
    const row = tbody.querySelector(`tr[data-id="${shift.id}"]`);
    updateShiftTimes(row, shift);
  });
};

const updateShiftTimes = async (row, shift) => {
  if (!row || !shift) {
    return;
  }

  const startCell = row.querySelector(".start");
  const endCell = row.querySelector(".end");

  if (
    !startCell ||
    !endCell ||
    (startCell.textContent !== "—" && endCell.textContent !== "—")
  ) {
    return;
  }

  const structure = Array.isArray(shift?.structure) ? shift.structure : [];
  if (structure.length === 0) {
    return;
  }

  const sorted = [...structure].sort(
    (a, b) => (a.sequence_number || 0) - (b.sequence_number || 0)
  );
  const firstItem = sorted[0];
  const lastItem = sorted[sorted.length - 1];

  try {
    let startTime = null;
    let endTime = null;

    const firstTripId = firstItem?.trip_id;
    const lastTripId = lastItem?.trip_id;

    if (firstTripId) {
      const stops = await fetchStopsByTripId(firstTripId);
      if (stops?.length) {
        startTime = stops[0].departure_time || stops[0].arrival_time;
        if (firstTripId === lastTripId) {
          endTime =
            stops[stops.length - 1].arrival_time ||
            stops[stops.length - 1].departure_time;
        }
      }
    }

    if (lastTripId && lastTripId !== firstTripId) {
      const stops = await fetchStopsByTripId(lastTripId);
      if (stops?.length) {
        endTime =
          stops[stops.length - 1].arrival_time ||
          stops[stops.length - 1].departure_time;
      }
    }

    if (startTime) {
      startCell.textContent = formatTime(parseTime(startTime));
    }
    if (endTime) {
      endCell.textContent = formatTime(parseTime(endTime));
    }
  } catch (e) {
    console.warn("Failed to update shift times", e);
  }
};

const getSelectedIdsFrom = (table) =>
  Array.from(
    table?.querySelectorAll('tbody input[type="checkbox"]:checked') ?? []
  )
    .map((input) => input.closest("tr")?.dataset?.id)
    .filter(Boolean);

const readTripIds = (shift = {}) => {
  const structure = Array.isArray(shift?.structure) ? shift.structure : [];
  if (structure.length === 0) {
    return [];
  }
  return structure
    .map((item = {}) => item?.trip_id ?? item?.tripId ?? "")
    .filter((value) => typeof value === "string" && value.length > 0);
};

export const initializeShifts = async (root = document, options = {}) => {
  const section = root.querySelector("section.shifts");
  if (!section) {
    return;
  }

  const table = section.querySelector("table");
  const tbody = table?.querySelector('tbody[data-role="shifts-body"]');
  const headerCheckbox = table?.querySelector(
    'thead .checkbox input[type="checkbox"]'
  );
  const searchInput = section.querySelector("#shifts-filter");
  const deleteButton = section.querySelector(
    '[data-action="delete-selected-shifts"]'
  );
  const duplicateButton = section.querySelector(
    '[data-action="duplicate-selected-shifts"]'
  );
  const editButton = section.querySelector(
    '[data-action="edit-selected-shifts"]'
  );
  const addButton = section.querySelector('[data-action="add-shift"]');

  setFlashMessage(section, options.flashMessage ?? "");

  if (!table || !tbody) {
    return;
  }

  let allShifts = [];

  const applyFilter = () => {
    const query = (searchInput?.value ?? "").toLowerCase().trim();
    const filtered =
      query ?
        allShifts.filter((shift = {}) =>
          text(shift?.name).toLowerCase().includes(query)
        )
      : allShifts;

    renderRows(tbody, filtered);
    bindSelectAll(headerCheckbox, table);
  };

  const loadShifts = async () => {
    renderLoading(tbody);

    try {
      const [shiftsPayload, busesPayload] = await Promise.all([
        fetchShifts({ skip: 0, limit: 100 }),
        fetchBuses({ skip: 0, limit: 1000 }),
      ]);

      const shifts =
        Array.isArray(shiftsPayload) ? shiftsPayload : (
          (shiftsPayload?.items ?? shiftsPayload?.results ?? [])
        );

      const buses =
        Array.isArray(busesPayload) ? busesPayload : (
          (busesPayload?.items ?? busesPayload?.results ?? [])
        );

      const busMap = new Map(buses.map((b) => [b.id, b.name]));

      allShifts = (Array.isArray(shifts) ? shifts : []).map((shift) => ({
        ...shift,
        bus_name: busMap.get(shift.bus_id) ?? shift.bus_name,
      }));
      applyFilter();
    } catch (error) {
      console.error("Failed to load shifts", error);
      renderError(tbody, error?.message ?? "Unable to load shifts.");
    }
  };

  searchInput?.addEventListener("input", applyFilter);

  addButton?.addEventListener("click", () => {
    triggerPartialLoad("shift-form");
  });

  deleteButton?.addEventListener("click", async () => {
    const ids = getSelectedIdsFrom(table);
    if (!ids.length) {
      alert(t("shifts.select_min"));
      return;
    }

    const confirmDelete = confirm(
      t("shifts.delete_confirm", { count: ids.length })
    );
    if (!confirmDelete) {
      return;
    }

    deleteButton.disabled = true;

    try {
      await Promise.all(ids.map((id) => deleteShift(id)));
      alert(t("shifts.deleted"));
      await loadShifts();
    } catch (error) {
      console.error("Failed to delete shifts", error);
      alert(error?.message ?? "Unable to delete shifts.");
    } finally {
      deleteButton.disabled = false;
    }
  });

  duplicateButton?.addEventListener("click", async () => {
    const ids = getSelectedIdsFrom(table);
    if (!ids.length) {
      alert("Select at least one shift to duplicate.");
      return;
    }

    duplicateButton.disabled = true;

    try {
      for (const id of ids) {
        const shift = await fetchShiftById(id);
        const name = `${text(shift?.name) || "Untitled shift"} (copy)`.trim();
        const busId = shift?.bus_id ?? shift?.busId ?? "";
        const tripIds = readTripIds(shift);

        await createShift({
          name,
          busId,
          tripIds,
        });
      }
      alert("Shift(s) duplicated.");
      await loadShifts();
    } catch (error) {
      console.error("Failed to duplicate shift(s)", error);
      alert(error?.message ?? "Unable to duplicate shift(s).");
    } finally {
      duplicateButton.disabled = false;
    }
  });

  editButton?.addEventListener("click", () => {
    const ids = getSelectedIdsFrom(table);
    if (ids.length !== 1) {
      alert(t("shifts.select_single"));
      return;
    }

    const id = ids[0];

    triggerPartialLoad("shift-form", { mode: "edit", shiftId: id });
  });

  table?.addEventListener("click", (event) => {
    const button = event.target?.closest?.(
      'button[data-action="visualize-shift"]'
    );
    if (!button) {
      return;
    }

    const row = button.closest("tr");
    const id = row?.dataset?.id;
    if (!id) {
      return;
    }

    triggerPartialLoad("visualize-shift", { shiftId: id });
  });

  bindSelectAll(headerCheckbox, table);
  await loadShifts();
};

import "./shifts.css";
import {
  fetchShiftById,
  fetchStopsByTripId,
  fetchDepotById,
  fetchBusById,
} from "../../../api";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import {
  text,
  firstAvailable,
  normalizeTime,
  resolveTripId,
  normalizeTrip,
  readShiftTripsFromStructure,
  formatMinutes,
  computeTimeBounds,
} from "./shift-utils";
import { renderTimeline } from "./shift-timeline";

const ensurePlaceholder = (container, message) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const paragraph = document.createElement("p");
  paragraph.className = "timeline__placeholder";
  paragraph.textContent = message ?? "";
  container.append(paragraph);
};

export const initializeVisualizeShift = async (
  root = document,
  options = {}
) => {
  const section = root.querySelector("section.visualize-shift");
  if (!section) {
    return;
  }

  const backButton = section.querySelector('[data-action="back"]');
  backButton?.addEventListener("click", () => {
    triggerPartialLoad("shifts");
  });

  const state = {
    name: text(options.name).trim(),
    busName: text(options.busName ?? options.busLabel ?? ""),
    startTime: normalizeTime(options.startTime),
    startDepotName: text(options.startDepotName ?? ""),
    endTime: normalizeTime(options.endTime),
    endDepotName: text(options.endDepotName ?? ""),
    trips:
      Array.isArray(options.trips) ?
        options.trips.map((trip) => normalizeTrip(trip)).filter(Boolean)
      : [],
  };

  const setFieldText = (field, value, fallback = "—") => {
    const node = section.querySelector(`[data-field="${field}"]`);
    if (!node) {
      return;
    }
    const resolved = text(value).trim() || fallback;
    node.textContent = textContent(resolved);
    if (field === "bus-name") {
      node.hidden = !text(value).trim();
    }
  };

  const tripsBody = section.querySelector('tbody[data-role="trips-body"]');
  const tripsEmpty = section.querySelector('[data-role="trips-empty"]');
  const timelineContainer = section.querySelector('[data-role="timeline"]');

  const renderTripsTable = () => {
    if (!tripsBody) {
      return;
    }

    tripsBody.innerHTML = "";

    if (!state.trips.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.className = "empty";
      cell.textContent = "No trips available.";
      row.append(cell);
      tripsBody.append(row);
      if (tripsEmpty) {
        tripsEmpty.hidden = false;
      }
      return;
    }

    if (tripsEmpty) {
      tripsEmpty.hidden = true;
    }

    const fragment = document.createDocumentFragment();
    state.trips.forEach((trip = {}) => {
      const row = document.createElement("tr");
      const tripId = resolveTripId(trip);
      if (tripId) {
        row.dataset.tripId = tripId;
      }

      const timeCell = document.createElement("td");
      timeCell.className = "time";
      const range = [trip?.departure_time, trip?.arrival_time]
        .map((part) => normalizeTime(part))
        .filter((part) => part && part.length > 0);
      timeCell.textContent =
        range.length ?
          range.join(" – ")
        : normalizeTime(trip?.departure_time) || "—";

      const routeCell = document.createElement("td");
      routeCell.className = "route";
      const startName = text(trip?.start_stop_name ?? "");
      const endName = text(trip?.end_stop_name ?? "");
      routeCell.textContent =
        startName && endName ?
          `${textContent(startName)} – ${textContent(endName)}`
        : startName || endName || "—";

      const actionsCell = document.createElement("td");
      actionsCell.className = "actions";
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "remove-trip";
      button.textContent = "Remove";
      actionsCell.append(button);

      row.append(timeCell, routeCell, actionsCell);
      fragment.append(row);
    });
    tripsBody.append(fragment);
  };

  const renderSummary = () => {
    const { earliest, latest } = computeTimeBounds(state.trips);
    const startTime =
      state.startTime || (earliest !== null ? formatMinutes(earliest) : "");
    const endTime =
      state.endTime || (latest !== null ? formatMinutes(latest) : "");

    setFieldText("name", state.name || "Untitled shift");
    setFieldText("bus-name", state.busName);
    setFieldText("start-time", startTime);
    setFieldText("start-depot", state.startDepotName || "—");
    setFieldText("end-time", endTime);
    setFieldText("end-depot", state.endDepotName || "—");
  };

  const renderAll = async () => {
    const { earliest, latest } = computeTimeBounds(state.trips);
    const effectiveStartTime =
      state.startTime || (earliest !== null ? formatMinutes(earliest) : "");
    const effectiveEndTime =
      state.endTime || (latest !== null ? formatMinutes(latest) : "");

    renderSummary();
    renderTripsTable();
    await renderTimeline(timelineContainer, state.trips, {
      startDepotName: state.startDepotName,
      endDepotName: state.endDepotName,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
    });
  };

  const handleTripsTableClick = (event) => {
    const button = event.target?.closest?.('button[data-action="remove-trip"]');
    if (!button) {
      return;
    }
    const row = button.closest("tr");
    const tripId = row?.dataset?.tripId;
    if (!tripId) {
      return;
    }
    state.trips = state.trips.filter(
      (trip = {}) => resolveTripId(trip) && resolveTripId(trip) !== tripId
    );
    renderAll();
  };

  tripsBody?.addEventListener("click", handleTripsTableClick);

  if (!state.trips.length && options.shiftId) {
    ensurePlaceholder(timelineContainer, "Loading shift timeline…");
    try {
      const shift = await fetchShiftById(options.shiftId);
      state.name = state.name || text(shift?.name ?? "");

      let resolvedBusName =
        shift?.bus?.name ?? shift?.bus_name ?? shift?.busName;
      if (!resolvedBusName) {
        const busId = shift?.bus?.id ?? shift?.bus_id ?? shift?.busId;
        if (busId) {
          try {
            const bus = await fetchBusById(busId);
            resolvedBusName = bus?.name;
          } catch (error) {
            console.warn(`Failed to fetch bus ${busId}`, error);
            resolvedBusName = busId;
          }
        }
      }
      state.busName = state.busName || text(resolvedBusName || "");
      state.startTime =
        state.startTime ||
        normalizeTime(
          firstAvailable(
            shift?.start_time,
            shift?.startTime,
            shift?.start?.time,
            shift?.start?.scheduled_time,
            shift?.start?.planned_time
          )
        );
      state.startDepotName =
        state.startDepotName ||
        text(
          shift?.start_depot?.name ??
            shift?.startDepotName ??
            shift?.start_depot ??
            shift?.startDepot ??
            ""
        );
      state.endTime =
        state.endTime ||
        normalizeTime(
          firstAvailable(
            shift?.end_time,
            shift?.endTime,
            shift?.end?.time,
            shift?.end?.scheduled_time,
            shift?.end?.planned_time
          )
        );
      state.endDepotName =
        state.endDepotName ||
        text(
          shift?.end_depot?.name ??
            shift?.endDepotName ??
            shift?.end_depot ??
            shift?.endDepot ??
            ""
        );

      // Fetch missing start depot
      if (!state.startDepotName) {
        const depotId = shift?.start_depot_id ?? shift?.startDepotId;
        if (depotId) {
          try {
            const depot = await fetchDepotById(depotId);
            state.startDepotName = text(depot?.name ?? "");
          } catch (e) {
            console.warn(`Failed to fetch start depot ${depotId}`, e);
          }
        }
      }

      // Fetch missing end depot
      if (!state.endDepotName) {
        const depotId = shift?.end_depot_id ?? shift?.endDepotId;
        if (depotId) {
          try {
            const depot = await fetchDepotById(depotId);
            state.endDepotName = text(depot?.name ?? "");
          } catch (e) {
            console.warn(`Failed to fetch end depot ${depotId}`, e);
          }
        }
      }

      // Check if trips are missing details (e.g. stop_times)
      const structure = Array.isArray(shift?.structure) ? shift.structure : [];
      const enrichedStructure = await Promise.all(
        structure.map(async (item) => {
          const trip = item?.trip ?? {};
          // If trip has no stop_times or stops, try to fetch it
          if (
            (!trip.stop_times || trip.stop_times.length === 0) &&
            (!trip.stops || trip.stops.length === 0)
          ) {
            const tripId = item.trip_id || item.tripId || trip.id;
            if (tripId) {
              try {
                const stops = await fetchStopsByTripId(tripId);
                // The API returns stops with arrival_time/departure_time, which matches stop_times structure
                return { ...item, trip: { ...trip, stop_times: stops } };
              } catch (e) {
                console.warn(`Failed to fetch stops for trip ${tripId}`, e);
                return item;
              }
            }
          }
          return item;
        })
      );

      state.trips = readShiftTripsFromStructure({
        ...shift,
        structure: enrichedStructure,
      });

      // Fallback: try to get depot names from the first/last trip stops if still missing
      if (!state.startDepotName && state.trips.length > 0) {
        state.startDepotName = state.trips[0].start_stop_name || "";
      }
      if (!state.endDepotName && state.trips.length > 0) {
        state.endDepotName =
          state.trips[state.trips.length - 1].end_stop_name || "";
      }
    } catch (error) {
      console.error("Unable to load shift for visualization", error);
      ensurePlaceholder(
        timelineContainer,
        error?.message ?? "Unable to load shift timeline."
      );
    }
  }

  await renderAll();

  let resizeTimeout;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      renderAll();
    }, 100);
  });
  resizeObserver.observe(timelineContainer);
};

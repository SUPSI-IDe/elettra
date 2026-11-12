import { datasetSummaryHtml } from "../../../utils/gtfs-datasets.js";
import "./shift-visualization.css";
import "./shifts.css";
import {
  fetchShiftById,
  fetchStopsByTripId,
  fetchDepotById,
  fetchBusById,
  fetchBusModelById,
} from "../../../api";
import { triggerPartialLoad } from "../../../events";
import { toText, resolveBusModelDisplayName } from "../../../ui-helpers";
import {
  extractShiftDistanceKm,
  formatDistanceKm,
  resolveShiftDailyDistanceKm,
} from "../../../utils/shift-distance";
import {
  text,
  firstAvailable,
  normalizeTime,
  normalizeTrip,
  readShiftTripsFromStructure,
  formatMinutes,
  computeTimeBounds,
} from "./shift-utils";
import { renderTimeline } from "./shift-timeline";
import { createShiftTripMap } from "./shift-trip-map";
import { t } from "../../../i18n";

const isDepotTrip = (trip = {}) => {
  if (
    trip?.status === "depot" ||
    trip?.trip?.status === "depot" ||
    trip?.trip_type === "auxiliary" ||
    trip?.trip?.trip_type === "auxiliary"
  ) {
    return true;
  }
  const start = (trip?.start_stop_name || trip?.startStopName || "").trim();
  const end = (trip?.end_stop_name || trip?.endStopName || "").trim();
  if (start && end && start === end) {
    return true;
  }
  return false;
};

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
    return null;
  }

  const cleanupHandlers = [];

  const closeButton = section.querySelector('[data-action="close"]');
  const handleCloseClick = () => {
    triggerPartialLoad("shifts");
  };
  if (closeButton) {
    closeButton.addEventListener("click", handleCloseClick);
    cleanupHandlers.push(() => {
      closeButton.removeEventListener("click", handleCloseClick);
    });
  }

  const state = {
    name: text(options.name).trim(),
    busModelName: text(
      options.busModelName ?? options.busName ?? options.busLabel ?? ""
    ),
    startTime: normalizeTime(options.startTime),
    startDepotName: text(options.startDepotName ?? ""),
    endTime: normalizeTime(options.endTime),
    endDepotName: text(options.endDepotName ?? ""),
    dailyDistanceKm: extractShiftDistanceKm(options),
    gtfsDatasets:
      Array.isArray(options.gtfsDatasets) ? options.gtfsDatasets
      : Array.isArray(options.gtfs_datasets) ? options.gtfs_datasets
      : null,
    trips:
      Array.isArray(options.trips) ?
        options.trips.map((trip) => normalizeTrip(trip)).filter(Boolean).filter((trip) => !isDepotTrip(trip))
      : [],
  };

  const setFieldText = (field, value, fallback = "—") => {
    const node = section.querySelector(`[data-field="${field}"]`);
    if (!node) {
      return;
    }
    const resolved = text(value).trim() || fallback;
    node.textContent = toText(resolved);
  };

  const gtfsSummary = section.querySelector('[data-role="shift-gtfs-summary"]');
  const timelineContainer = section.querySelector('[data-role="timeline"]');
  const timelineLegend = section.querySelector('[data-role="timeline-legend"]');
  const tripMapContainer = section.querySelector('[data-role="trip-map"]');
  const viewButtons = Array.from(section.querySelectorAll('[data-view]'));
  let viewMode = "timeline";
  const tripMap = createShiftTripMap({
    container: tripMapContainer,
    trips: state.trips,
  });

  const renderSummary = () => {
    const { earliest, latest } = computeTimeBounds(state.trips);
    const startTime =
      state.startTime || (earliest !== null ? formatMinutes(earliest) : "");
    const endTime =
      state.endTime || (latest !== null ? formatMinutes(latest) : "");
    const formatLocationTime = (location, timeValue) => {
      const place = text(location).trim();
      const time = normalizeTime(timeValue);
      if (place && time) return `${place} (${time})`;
      return place || time || "—";
    };

    const displayName = state.name || t("shifts.untitled_shift");
    setFieldText("name", displayName);
    setFieldText("heading-name", `- ${displayName}`, "");
    setFieldText("bus-name", state.busModelName);
    setFieldText("daily-distance", formatDistanceKm(state.dailyDistanceKm));
    setFieldText(
      "start-summary",
      formatLocationTime(state.startDepotName, startTime)
    );
    setFieldText(
      "end-summary",
      formatLocationTime(state.endDepotName, endTime)
    );
    if (gtfsSummary) {
      gtfsSummary.innerHTML = datasetSummaryHtml(state.gtfsDatasets, t);
    }
  };

  const renderTimelineView = async () => {
    const { earliest, latest } = computeTimeBounds(state.trips);
    const effectiveStartTime =
      state.startTime || (earliest !== null ? formatMinutes(earliest) : "");
    const effectiveEndTime =
      state.endTime || (latest !== null ? formatMinutes(latest) : "");

    await renderTimeline(timelineContainer, state.trips, {
      startDepotName: state.startDepotName,
      endDepotName: state.endDepotName,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      showAllStops: true,
    });
  };

  const renderAll = async () => {
    renderSummary();
    tripMap?.setTrips(state.trips);
    if (viewMode === "map") {
      tripMap?.show();
      return;
    }
    await renderTimelineView();
  };

  const setViewMode = (nextMode) => {
    viewMode = nextMode === "map" ? "map" : "timeline";
    const showMap = viewMode === "map";

    if (timelineContainer) timelineContainer.hidden = showMap;
    if (timelineLegend) timelineLegend.hidden = showMap;
    if (tripMapContainer) tripMapContainer.hidden = !showMap;
    viewButtons.forEach((button) => {
      const isActive = button.dataset.view === viewMode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (showMap) {
      tripMap?.show();
    } else {
      renderTimelineView();
    }
  };

  viewButtons.forEach((button) => {
    const handleViewChange = () => setViewMode(button.dataset.view);
    button.addEventListener("click", handleViewChange);
    cleanupHandlers.push(() => {
      button.removeEventListener("click", handleViewChange);
    });
  });


  if (options.shiftId) {
    ensurePlaceholder(timelineContainer, t("shifts.loading_timeline"));
    try {
      const shift = await fetchShiftById(options.shiftId);
      if (Array.isArray(shift?.gtfs_datasets)) {
        state.gtfsDatasets = shift.gtfs_datasets;
      }
      state.name = state.name || text(shift?.name ?? "");

      let resolvedBusName =
        shift?.bus?.name ?? shift?.bus_name ?? shift?.busName;
      let resolvedBusModelName =
        shift?.bus?.model ?? shift?.bus_model_name ?? shift?.busModelName;
      let resolvedBusModelId =
        shift?.bus?.bus_model_id ?? shift?.bus_model_id ?? shift?.busModelId;
      if (!resolvedBusModelName) {
        const busId = shift?.bus?.id ?? shift?.bus_id ?? shift?.busId;
        if (busId) {
          try {
            const bus = await fetchBusById(busId);
            resolvedBusName = resolvedBusName || bus?.name;
            resolvedBusModelId =
              resolvedBusModelId ??
              bus?.bus_model_id ??
              bus?.busModelId ??
              bus?.model_id ??
              bus?.modelId;
          } catch (error) {
            console.warn(`Failed to fetch bus ${busId}`, error);
            resolvedBusName = resolvedBusName || busId;
          }
        }
      }
      if (!resolvedBusModelName && resolvedBusModelId) {
        try {
          // Fetch the specific bus model by id rather than downloading
          // the entire (now paginated) list.
          const model = await fetchBusModelById(resolvedBusModelId);
          resolvedBusModelName =
            resolveBusModelDisplayName(model) || resolvedBusName;
        } catch (error) {
          console.warn("Failed to fetch bus model", error);
        }
      }
      state.busModelName = state.busModelName || text(resolvedBusModelName || resolvedBusName || "");

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
      }).filter((trip) => !isDepotTrip(trip));
      state.dailyDistanceKm =
        extractShiftDistanceKm({
          ...shift,
          structure: enrichedStructure,
          trips: state.trips,
        }) ?? state.dailyDistanceKm;

      if (state.dailyDistanceKm == null) {
        state.dailyDistanceKm = await resolveShiftDailyDistanceKm({
          ...shift,
          id: options.shiftId,
          structure: enrichedStructure,
          trips: state.trips,
        });
      }

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
        error?.message ?? t("shifts.unable_to_load_timeline")
      );
    }
  }

  await renderAll();

  let resizeTimeout;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (viewMode === "timeline") {
        renderTimelineView();
      }
    }, 100);
  });
  resizeObserver.observe(timelineContainer);

  cleanupHandlers.push(() => {
    clearTimeout(resizeTimeout);
    resizeObserver.disconnect();
    tripMap?.destroy();
  });

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};

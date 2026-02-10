import "./shifts.css";
import "./shift-visualization.css";
import {
  createShift,
  createAuxiliaryTrip,
  fetchBuses,
  fetchBusById,
  fetchBusModels,
  fetchDepots,
  fetchRoutes,
  fetchRoutesByAgency,
  fetchServiceDays,
  fetchShiftById,
  fetchShiftInfo,
  fetchStopsByTripId,
  fetchTripsByRoute,
  updateShift,
} from "../../../api";
import { resolveUserId, resolveAgencyId } from "../../../api/session";
import { showTripPreview, hideTripPreview } from "./trip-preview";
import { renderTimeline } from "./shift-timeline";
import { triggerPartialLoad } from "../../../events";
import { getOwnedBuses, setOwnedBuses, getModelsById } from "../../../store";
import {
  textContent,
  toggleFormDisabled,
  updateFeedback,
} from "../../../ui-helpers";
import {
  text,
  firstAvailable,
  normalizeTime,
  resolveTripId,
  resolveTripPk,
  normalizeTrip,
  resolveRouteLabel,
  readShiftTripsFromStructure,
  getNextDay,
  DAYS_OF_WEEK,
} from "./shift-utils";
import {
  populateDayOptions,
  renderBusOptions,
  renderDepotOptions,
  renderRouteOptions,
  renderScheduledTrips,
  renderShiftTrips,
  renderTripsLoading,
  updateEmptyState,
  clearNode,
} from "./shift-renderers";

const readTripId = (node) => node?.dataset?.tripId?.trim() ?? "";

// Module-level variable to store loaded depots for use in handleSubmit
let loadedDepots = [];

const buildShiftPayload = ({ form, selectedTrips }) => {
  const formData = new FormData(form);
  const name = formData.get("name")?.toString().trim();
  const busId = formData.get("busId")?.toString().trim();
  const startTime = formData.get("startTime")?.toString().trim() || null;
  const endTime = formData.get("endTime")?.toString().trim() || null;
  const startDepotId = formData.get("startDepot")?.toString().trim() || null;
  const endDepotId = formData.get("endDepot")?.toString().trim() || null;
  // Use the id field (UUID) for shift API, not trip_id (GTFS identifier)
  const tripIds = selectedTrips.map((trip) => trip?.id ?? "");

  return { name, busId, tripIds, startTime, endTime, startDepotId, endDepotId };
};

// Helper function to extract the first day of week from shift info
const getFirstDayOfWeek = (shiftInfo) => {
  if (!shiftInfo) return null;
  
  // shiftInfo should contain days_of_week array - take the first one
  const daysOfWeek = shiftInfo?.days_of_week || shiftInfo?.daysOfWeek || [];
  if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
    return daysOfWeek[0];
  }
  
  // Fallback to single day field
  return shiftInfo?.day_of_week || shiftInfo?.dayOfWeek || null;
};

// Helper function to extract route info from shift info
const getRouteInfoFromShiftInfo = (shiftInfo) => {
  if (!shiftInfo) return { routeId: null, routeLabel: null };
  
  // Extract route information from the shift info response
  const routeId = 
    shiftInfo?.route_id ||
    shiftInfo?.routeId ||
    shiftInfo?.route?.id ||
    null;
  
  const routeLabel = 
    shiftInfo?.route_short_name ||
    shiftInfo?.route_long_name ||
    shiftInfo?.route?.route_short_name ||
    shiftInfo?.route?.route_long_name ||
    shiftInfo?.route?.name ||
    null;
    
  return { routeId, routeLabel };
};

// Helper function to extract depot info from shift info
const getDepotInfoFromShiftInfo = (shiftInfo) => {
  if (!shiftInfo) return { startDepotId: null, startDepotName: null, endDepotId: null, endDepotName: null };
  
  // Extract start depot information
  const startDepotId = 
    shiftInfo?.start_depot_id ||
    shiftInfo?.startDepotId ||
    shiftInfo?.start_depot?.id ||
    null;
  
  const startDepotName = 
    shiftInfo?.start_depot_name ||
    shiftInfo?.startDepotName ||
    shiftInfo?.start_depot?.name ||
    null;
  
  // Extract end depot information
  const endDepotId = 
    shiftInfo?.end_depot_id ||
    shiftInfo?.endDepotId ||
    shiftInfo?.end_depot?.id ||
    null;
  
  const endDepotName = 
    shiftInfo?.end_depot_name ||
    shiftInfo?.endDepotName ||
    shiftInfo?.end_depot?.name ||
    null;
    
  return { startDepotId, startDepotName, endDepotId, endDepotName };
};

// Helper function to extract times from shift info or shift object
// These are the custom depot departure/arrival times set by the user
const getTimesFromShiftInfo = (shiftInfo, shift = null) => {
  // Priority: shiftInfo times, then shift times
  const startTime = 
    shiftInfo?.start_time ||
    shiftInfo?.startTime ||
    shiftInfo?.departure_time ||
    shiftInfo?.departureTime ||
    shift?.start_time ||
    shift?.startTime ||
    null;
  
  const endTime = 
    shiftInfo?.end_time ||
    shiftInfo?.endTime ||
    shiftInfo?.arrival_time ||
    shiftInfo?.arrivalTime ||
    shift?.end_time ||
    shift?.endTime ||
    null;
    
  return { startTime, endTime };
};


const hydrateShift = async (shift, shiftInfo = null) => {
  if (
    !shift ||
    !Array.isArray(shift.structure) ||
    shift.structure.length === 0
  ) {
    // Even if structure is empty, still merge shiftInfo data
    if (shiftInfo) {
      const dayOfWeek = getFirstDayOfWeek(shiftInfo);
      const { routeId, routeLabel } = getRouteInfoFromShiftInfo(shiftInfo);
      const { startDepotId, startDepotName, endDepotId, endDepotName } = getDepotInfoFromShiftInfo(shiftInfo);
      const { startTime, endTime } = getTimesFromShiftInfo(shiftInfo, shift);
      
      return {
        ...shift,
        route_id: routeId || shift.route_id,
        route_short_name: routeLabel || shift.route_short_name,
        day_of_week: dayOfWeek || shift.day_of_week,
        start_depot_id: startDepotId || shift.start_depot_id,
        start_depot: startDepotId ? { id: startDepotId, name: startDepotName } : shift.start_depot,
        end_depot_id: endDepotId || shift.end_depot_id,
        end_depot: endDepotId ? { id: endDepotId, name: endDepotName } : shift.end_depot,
        // Include custom depot times - these are the user-specified departure/arrival times
        start_time: startTime || shift.start_time,
        end_time: endTime || shift.end_time,
      };
    }
    return shift;
  }

  // Extract route, day, depot, and time info from the shift info endpoint
  const dayOfWeek = getFirstDayOfWeek(shiftInfo);
  const { routeId, routeLabel } = getRouteInfoFromShiftInfo(shiftInfo);
  const { startDepotId, startDepotName, endDepotId, endDepotName } = getDepotInfoFromShiftInfo(shiftInfo);
  const { startTime, endTime } = getTimesFromShiftInfo(shiftInfo, shift);

  const structure = await Promise.all(
    shift.structure.map(async (item) => {
      if (!item.trip_id) {
        return item;
      }
      try {
        // Fetch stop times for trip preview/display
        const stopTimes = await fetchStopsByTripId(item.trip_id).catch(() => []);

        return {
          ...item,
          stop_times: stopTimes,
          // Use the info from the shift info endpoint
          day_of_week: dayOfWeek || item.day_of_week,
          route_id: routeId || item.route_id,
          route_short_name: routeLabel || item.route_short_name,
          trip: {
            ...(item.trip || {}),
            stop_times: stopTimes,
            day_of_week: dayOfWeek || item.trip?.day_of_week,
            route_id: routeId || item.trip?.route_id,
            route_short_name: routeLabel || item.trip?.route_short_name,
          },
        };
      } catch (error) {
        console.error(`Failed to load data for trip ${item.trip_id}`, error);
        return item;
      }
    })
  );

  // Add route/day/depot/time info at the shift level for easier access
  return { 
    ...shift, 
    structure,
    route_id: routeId || shift.route_id,
    route_short_name: routeLabel || shift.route_short_name,
    day_of_week: dayOfWeek || shift.day_of_week,
    start_depot_id: startDepotId || shift.start_depot_id,
    start_depot: startDepotId ? { id: startDepotId, name: startDepotName } : shift.start_depot,
    end_depot_id: endDepotId || shift.end_depot_id,
    end_depot: endDepotId ? { id: endDepotId, name: endDepotName } : shift.end_depot,
    // Include custom depot times - these are the user-specified departure/arrival times
    start_time: startTime || shift.start_time,
    end_time: endTime || shift.end_time,
  };
};

export const initializeShiftForm = async (root = document, options = {}) => {
  const section = root.querySelector("section.shift-form");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const form = section.querySelector('form[data-form="shift-form"]');
  if (!form) {
    return null;
  }

  const mode = options.mode === "edit" ? "edit" : "create";
  const shiftId =
    mode === "edit" ? text(options.shiftId ?? options.shift_id ?? "") : "";
  const isEditMode = mode === "edit" && Boolean(shiftId);

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const visualizeButton = form.querySelector('[data-action="visualize-shift"]');
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

  const nameInput = form.querySelector("#shift-name");
  const busSelect = form.querySelector("#shift-bus");
  const startTimeInput = form.querySelector("#shift-start-time");
  const endTimeInput = form.querySelector("#shift-end-time");

  const lineSelect = form.querySelector('[data-filter="line"]');
  const daySelect = form.querySelector('[data-filter="day"]');
  const startDepotSelect = form.querySelector('[data-field="start-depot"]');
  const endDepotSelect = form.querySelector('[data-field="end-depot"]');

  // Shift info display elements (for edit mode)
  const shiftInfoDisplay = section.querySelector('[data-role="shift-info"]');
  const lineDisplayValue = section.querySelector('[data-role="shift-line-display"] [data-value="line"]');
  const dayDisplayValue = section.querySelector('[data-role="shift-day-display"] [data-value="day"]');

  const scheduledTripsBody = form.querySelector(
    'tbody[data-role="scheduled-trips-body"]'
  );
  const scheduledTripsEmpty = form.querySelector(
    '[data-role="scheduled-trips-empty"]'
  );

  const shiftTripsBody = form.querySelector(
    'tbody[data-role="shift-trips-body"]'
  );
  const shiftTripsEmpty = form.querySelector('[data-role="shift-trips-empty"]');
  const timelineContainer = section.querySelector('[data-role="shift-timeline"]');

  // populateDayOptions(daySelect); // Removed, called in loadDays

  const title = section.querySelector("header h1");
  const submitButton = form.querySelector('button[type="submit"]');

  if (title) {
    title.textContent = isEditMode ? "Edit Shift" : "Add Shift";
  }

  if (submitButton) {
    submitButton.textContent = isEditMode ? "Update shift" : "Save shift";
  }

  section.dataset.mode = isEditMode ? "edit" : "create";
  form.dataset.mode = isEditMode ? "edit" : "create";
  if (shiftId) {
    form.dataset.shiftId = shiftId;
  } else {
    delete form.dataset.shiftId;
  }

  let routesById = {};
  let currentTrips = [];
  const selectedTripIds = new Set();
  let selectedTrips = [];

  // Only set times from trips if the inputs are empty
  // Never overwrite user-specified depot times (start_time/end_time from the shift)
  const ensureTimesFromSelected = ({ forceStart = false, forceEnd = false } = {}) => {
    const readTimes = (project) =>
      selectedTrips
        .map((trip = {}) => normalizeTime(project(trip)).trim())
        .filter((value) => value.length > 0);

    if (startTimeInput instanceof HTMLInputElement) {
      // Only set if explicitly forced for start OR if input is empty
      if (forceStart || !startTimeInput.value) {
        const departureTimes = readTimes(
          (trip) => trip?.departure_time ?? trip?.departureTime ?? ""
        );
        if (departureTimes.length > 0) {
          const earliest = [...departureTimes].sort((a, b) =>
            a.localeCompare(b)
          )[0];
          startTimeInput.value = earliest;
        }
      }
    }

    if (endTimeInput instanceof HTMLInputElement) {
      // Only set if explicitly forced for end OR if input is empty
      if (forceEnd || !endTimeInput.value) {
        const arrivalTimes = readTimes(
          (trip) =>
            trip?.arrival_time ??
            trip?.arrivalTime ??
            trip?.end_time ??
            trip?.endTime ??
            trip?.departure_time ??
            trip?.departureTime ??
            ""
        );
        if (arrivalTimes.length > 0) {
          const latest = [...arrivalTimes]
            .sort((a, b) => a.localeCompare(b))
            .pop();
          endTimeInput.value = latest;
        }
      }
    }
  };

  const updateShiftTrips = () => {
    renderShiftTrips(shiftTripsBody, selectedTrips);
    updateEmptyState(shiftTripsEmpty, selectedTrips.length > 0);
  };

  // Update the shift timeline visualization
  const updateTimeline = () => {
    if (!timelineContainer) {
      return;
    }
    
    // Get depot names from the select elements
    const startDepotSelect = form.querySelector('[data-field="start-depot"]');
    const endDepotSelect = form.querySelector('[data-field="end-depot"]');
    const startDepotName = startDepotSelect?.selectedOptions?.[0]?.textContent || "";
    const endDepotName = endDepotSelect?.selectedOptions?.[0]?.textContent || "";
    
    renderTimeline(timelineContainer, selectedTrips, {
      startDepotName: startDepotName !== "Depot name" ? startDepotName : "",
      endDepotName: endDepotName !== "Depot name" ? endDepotName : "",
      startTime: getShiftStartTime() || "",
      endTime: getShiftEndTime() || "",
    });
  };

  const syncSelectedTripsWithCurrent = () => {
    if (!Array.isArray(selectedTrips) || selectedTrips.length === 0) {
      return;
    }

    let changed = false;

    selectedTrips = selectedTrips.map((trip = {}) => {
      const id = resolveTripId(trip);
      if (!id) {
        return trip;
      }
      const current = currentTrips.find(
        (candidate = {}) => resolveTripId(candidate) === id
      );
      if (!current) {
        const normalized = normalizeTrip(trip);
        if (normalized !== trip) {
          changed = true;
        }
        return normalized;
      }
      const merged = normalizeTrip({
        ...trip,
        ...current,
        trip: current.trip ?? trip.trip,
      });
      if (merged !== trip) {
        changed = true;
      }
      return merged;
    });

    if (changed) {
      updateShiftTrips();
      // Don't automatically update times - let user set them manually
    }
  };

  const getLatestEndTime = () => {
    if (!Array.isArray(selectedTrips) || selectedTrips.length === 0) {
      return null;
    }
    return selectedTrips
      .map((t) => t.arrival_time || t.departure_time || "")
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0];
  };

  const getShiftStartTime = () => {
    if (!(startTimeInput instanceof HTMLInputElement)) {
      return null;
    }
    const value = startTimeInput.value?.trim() ?? "";
    return value || null;
  };

  const getShiftEndTime = () => {
    if (!(endTimeInput instanceof HTMLInputElement)) {
      return null;
    }
    const value = endTimeInput.value?.trim() ?? "";
    return value || null;
  };

  // Get the end stop name of the last selected trip (where the bus currently is)
  // Returns normalized (trimmed) string for consistent comparison
  const getLastTripEndStop = () => {
    if (!Array.isArray(selectedTrips) || selectedTrips.length === 0) {
      return null;
    }
    const lastTrip = selectedTrips[selectedTrips.length - 1];
    const stopName = lastTrip?.end_stop_name ?? lastTrip?.endStopName ?? "";
    const normalized = String(stopName).trim();
    return normalized || null;
  };

  const addTrip = (trip) => {
    const normalized = normalizeTrip(trip);
    const id = resolveTripId(normalized);
    if (!id || selectedTripIds.has(id)) {
      return;
    }

    const newDeparture = normalized.departure_time;
    const newArrival = normalized.arrival_time || normalized.departure_time;
    const newStartStop = normalized.start_stop_name || normalized.startStopName || "";
    const shiftStart = getShiftStartTime();
    const shiftEnd = getShiftEndTime();

    // Validate: new trip must not start before the shift start time (depot departure)
    if (shiftStart && newDeparture && newDeparture < shiftStart) {
      updateFeedback(
        feedback,
        `Trip departs at ${newDeparture} but the shift starts at ${shiftStart}. The bus cannot be at a stop before leaving the depot.`,
        "error"
      );
      return;
    }

    // Validate: new trip must not arrive after the shift end time (depot arrival)
    if (shiftEnd && newArrival && newArrival > shiftEnd) {
      updateFeedback(
        feedback,
        `Trip arrives at ${newArrival} but the shift ends at ${shiftEnd}. The bus must return to the depot by the shift end time.`,
        "error"
      );
      return;
    }

    // Validate: new trip must start from where the last trip ended (location continuity)
    const lastEndStop = getLastTripEndStop();
    if (lastEndStop && newStartStop && lastEndStop !== newStartStop) {
      updateFeedback(
        feedback,
        `Trip starts at "${newStartStop}" but the bus is at "${lastEndStop}". The next trip must start from where the previous trip ended.`,
        "error"
      );
      return;
    }

    // Validate: new trip must not start before the latest existing trip ends
    if (selectedTrips.length > 0 && newDeparture) {
      const latestArrival = selectedTrips
        .map((t) => t.arrival_time || t.departure_time || "")
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))[0];

      if (latestArrival && newDeparture < latestArrival) {
        updateFeedback(
          feedback,
          `Trip starts at ${newDeparture} but the latest trip ends at ${latestArrival}. Trips cannot overlap.`,
          "error"
        );
        return;
      }
    }

    selectedTripIds.add(id);
    selectedTrips = [...selectedTrips, normalized];
    updateShiftTrips();
    // Don't automatically update times - let user set them manually
    renderScheduledTrips({
      tbody: scheduledTripsBody,
      trips: currentTrips,
      routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
      selectedTripIds,
      lastTripEndTime: getLatestEndTime(),
      lastTripEndStop: getLastTripEndStop(),
      shiftStartTime: getShiftStartTime(),
      shiftEndTime: getShiftEndTime(),
    });
    updateTimeline();
  };

  const removeTrip = (id) => {
    if (!selectedTripIds.has(id)) {
      return;
    }
    
    // Find the trip being removed before filtering it out
    const removedTrip = selectedTrips.find((trip = {}) => resolveTripId(trip) === id);
    
    // Also get the database UUID (id field) for better duplicate detection
    const removedTripDbId = removedTrip?.id || id;
    
    selectedTripIds.delete(id);
    
    selectedTrips = selectedTrips.filter((trip = {}) => {
      const tripId = resolveTripId(trip);
      return tripId && tripId !== id;
    });
    
    // In edit mode, ensure the removed trip is in currentTrips so it appears in scheduled trips
    // Check if the trip already exists in currentTrips by comparing BOTH trip_id AND database id
    const existsInCurrentTrips = currentTrips.some((t) => {
      const existingTripId = resolveTripId(t);
      const existingDbId = t?.id;
      // Match if either the trip_id matches OR the database id matches
      return (existingTripId && existingTripId === id) || 
             (existingDbId && removedTripDbId && existingDbId === removedTripDbId);
    });
    
    if (removedTrip && !existsInCurrentTrips) {
      // Add the removed trip back to currentTrips
      currentTrips = [...currentTrips, removedTrip];
    }
    
    // Remove any duplicates from currentTrips
    // A trip is considered duplicate if it has the same trip_id OR the same database id
    const seenTripIds = new Set();
    const seenDbIds = new Set();
    currentTrips = currentTrips.filter((trip) => {
      const tripId = resolveTripId(trip);
      const dbId = trip?.id;
      
      // Check if we've seen this trip before (by either ID)
      const isDuplicateByTripId = tripId && seenTripIds.has(tripId);
      const isDuplicateByDbId = dbId && seenDbIds.has(dbId);
      
      if (isDuplicateByTripId || isDuplicateByDbId) {
        return false;
      }
      
      // Mark this trip as seen
      if (tripId) seenTripIds.add(tripId);
      if (dbId) seenDbIds.add(dbId);
      
      return true;
    }).sort((a, b) => {
      const timeA = a.departure_time || "";
      const timeB = b.departure_time || "";
      return timeA.localeCompare(timeB);
    });
    
    updateShiftTrips();
    // Don't automatically update times - let user set them manually
    
    // Create a fresh copy of the Set to ensure the filter sees updated state
    const updatedSelectedTripIds = new Set(selectedTripIds);
    
    renderScheduledTrips({
      tbody: scheduledTripsBody,
      trips: currentTrips,
      routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
      selectedTripIds: updatedSelectedTripIds,
      lastTripEndTime: getLatestEndTime(),
      lastTripEndStop: getLastTripEndStop(),
      shiftStartTime: getShiftStartTime(),
      shiftEndTime: getShiftEndTime(),
    });
    updateTimeline();
  };

  const prefillSelectValue = (select, value, fallbackLabel) => {
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const candidate = text(value);
    if (!candidate) {
      return;
    }
    select.value = candidate;
    if (select.value === candidate) {
      return;
    }
    const option = document.createElement("option");
    option.value = candidate;
    option.textContent =
      fallbackLabel ? textContent(fallbackLabel) : textContent(candidate);
    select.append(option);
    select.value = candidate;
  };

  const applyShiftPrefill = (shift = {}) => {
    const name = firstAvailable(shift?.name);
    if (nameInput instanceof HTMLInputElement && name) {
      nameInput.value = name;
    }

    const busId = firstAvailable(
      shift?.bus_id,
      shift?.busId,
      shift?.bus?.id,
      shift?.bus?.bus_id
    );
    prefillSelectValue(
      busSelect,
      busId,
      shift?.bus?.name ?? shift?.bus_name ?? shift?.busName ?? ""
    );

    const startTime = normalizeTime(
      firstAvailable(
        shift?.start_time,
        shift?.startTime,
        shift?.start?.time,
        shift?.start?.scheduled_time,
        shift?.start?.scheduledTime,
        shift?.start?.planned_time,
        shift?.start?.plannedTime
      )
    );
    if (startTimeInput instanceof HTMLInputElement && startTime) {
      startTimeInput.value = startTime;
    }

    const endTime = normalizeTime(
      firstAvailable(
        shift?.end_time,
        shift?.endTime,
        shift?.end?.time,
        shift?.end?.scheduled_time,
        shift?.end?.scheduledTime,
        shift?.end?.planned_time,
        shift?.end?.plannedTime
      )
    );
    if (endTimeInput instanceof HTMLInputElement && endTime) {
      endTimeInput.value = endTime;
    }
    
    console.debug("[SHIFT DEBUG] applyShiftPrefill times:", {
      startTime,
      endTime,
      "startTimeInput.value": startTimeInput?.value,
      "endTimeInput.value": endTimeInput?.value,
    });

    const startDepotId = firstAvailable(
      shift?.start_depot_id,
      shift?.startDepotId,
      shift?.start_depot?.id,
      shift?.start_depot,
      shift?.startDepot
    );
    prefillSelectValue(
      startDepotSelect,
      startDepotId,
      shift?.start_depot?.name ?? shift?.startDepotName ?? ""
    );

    const endDepotId = firstAvailable(
      shift?.end_depot_id,
      shift?.endDepotId,
      shift?.end_depot?.id,
      shift?.end_depot,
      shift?.endDepot
    );
    prefillSelectValue(
      endDepotSelect,
      endDepotId,
      shift?.end_depot?.name ?? shift?.endDepotName ?? ""
    );

    const trips = readShiftTripsFromStructure(shift);
    selectedTrips = trips;
    selectedTripIds.clear();
    trips.forEach((trip = {}) => {
      const id = resolveTripId(trip);
      if (id) {
        selectedTripIds.add(id);
      }
    });

    // Extract route/line information from the shift (from shiftInfo) or first trip
    const firstTrip = trips[0] ?? {};
    
    let resolvedRouteId = "";
    let resolvedRouteLabel = "";
    
    if (lineSelect instanceof HTMLSelectElement) {
      const routeId = firstAvailable(
        shift?.route_id,
        shift?.routeId,
        shift?.route?.id,
        firstTrip?.route_id,
        firstTrip?.routeId,
        firstTrip?.route?.id,
        firstTrip?.trip?.route_id,
        firstTrip?.trip?.routeId
      );
      
      if (routeId) {
        resolvedRouteId = routeId;
        // Try to get label from routes map, then shift data, then trip data
        resolvedRouteLabel = routesById[routeId] ??
          shift?.route_short_name ??
          shift?.route_long_name ??
          resolveRouteLabel(firstTrip) ??
          shift?.route?.name ??
          shift?.route_name ??
          shift?.routeName ??
          firstAvailable(
            firstTrip?.route_name,
            firstTrip?.routeName,
            firstTrip?.route?.name,
            firstTrip?.route_short_name,
            firstTrip?.route_long_name,
            firstTrip?.trip?.route_short_name,
            firstTrip?.trip?.route_long_name
          ) ??
          routeId;

        prefillSelectValue(
          lineSelect,
          routeId,
          resolvedRouteLabel
        );
      }
    }

    // Extract day of week from the shift (from shiftInfo) or first trip
    let resolvedDay = "";
    let resolvedDayLabel = "";
    
    if (daySelect instanceof HTMLSelectElement) {
      const rawDay = firstAvailable(
        shift?.day_of_week,
        shift?.dayOfWeek,
        shift?.service_day,
        shift?.serviceDay,
        shift?.day,
        firstTrip?.day_of_week,
        firstTrip?.dayOfWeek,
        firstTrip?.service_day,
        firstTrip?.serviceDay,
        firstTrip?.trip?.day_of_week,
        firstTrip?.trip?.dayOfWeek,
        firstTrip?.trip?.service_day,
        firstTrip?.trip?.serviceDay
      );
      
      if (rawDay) {
        resolvedDay = rawDay.toLowerCase();
        resolvedDayLabel = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
        prefillSelectValue(daySelect, resolvedDay, resolvedDayLabel);
      }
    }

    // Always show the shift info display in edit mode with available info
    if (shiftInfoDisplay && isEditMode) {
      // Set line display
      if (lineDisplayValue) {
        lineDisplayValue.textContent = resolvedRouteLabel || resolvedRouteId || "—";
      }
      
      // Set day display
      if (dayDisplayValue) {
        dayDisplayValue.textContent = resolvedDayLabel || "—";
      }
      
      // Show the shift info section - always visible in edit mode
      shiftInfoDisplay.hidden = false;
    }

    updateShiftTrips();
    // Only force times for inputs that are actually empty (don't overwrite user-specified depot times)
    const forceStartTime = startTimeInput instanceof HTMLInputElement && !startTimeInput.value;
    const forceEndTime = endTimeInput instanceof HTMLInputElement && !endTimeInput.value;
    console.debug("[SHIFT DEBUG] Before ensureTimesFromSelected:", {
      forceStartTime,
      forceEndTime,
      "startTimeInput.value": startTimeInput?.value,
      "endTimeInput.value": endTimeInput?.value,
    });
    ensureTimesFromSelected({ forceStart: forceStartTime, forceEnd: forceEndTime });
    console.debug("[SHIFT DEBUG] After ensureTimesFromSelected:", {
      "startTimeInput.value": startTimeInput?.value,
      "endTimeInput.value": endTimeInput?.value,
    });
    renderScheduledTrips({
      tbody: scheduledTripsBody,
      trips: currentTrips,
      routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
      selectedTripIds,
      lastTripEndTime: getLatestEndTime(),
      lastTripEndStop: getLastTripEndStop(),
      shiftStartTime: getShiftStartTime(),
      shiftEndTime: getShiftEndTime(),
    });
    updateTimeline();

    if (
      lineSelect instanceof HTMLSelectElement &&
      daySelect instanceof HTMLSelectElement &&
      lineSelect.value &&
      daySelect.value
    ) {
      // In edit mode, include next day trips for overnight shifts
      loadTrips({ includeNextDay: isEditMode });
    }
  };

  const loadBuses = async () => {
    const cached = getOwnedBuses();
    if (Array.isArray(cached) && cached.length > 0) {
      renderBusOptions(busSelect, cached, getModelsById());
      return;
    }

    try {
      const [payload, modelsPayload, userId] = await Promise.all([
        fetchBuses({ skip: 0, limit: 100 }),
        fetchBusModels({ skip: 0, limit: 100 }),
        resolveUserId().catch(() => null),
      ]);

      const buses =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );
      const models =
        Array.isArray(modelsPayload) ? modelsPayload : (
          (modelsPayload?.items ?? modelsPayload?.results ?? [])
        );

      const filteredBuses =
        userId && Array.isArray(buses) ?
          buses.filter((bus) => bus?.user_id === userId)
        : (buses ?? []);

      const filteredModels =
        userId && Array.isArray(models) ?
          models.filter((model) => model?.user_id === userId)
        : (models ?? []);

      const modelsById = (filteredModels ?? []).reduce((acc, model) => {
        if (model?.id) {
          acc[text(model.id)] = model;
        }
        return acc;
      }, {});

      setOwnedBuses(filteredBuses);
      renderBusOptions(busSelect, filteredBuses, modelsById);
    } catch (error) {
      console.error("Failed to load buses", error);
      renderBusOptions(busSelect, [], {});
      updateFeedback(
        feedback,
        error?.message ?? "Unable to load buses.",
        "error"
      );
    }
  };

  const loadDepots = async () => {
    if (!startDepotSelect && !endDepotSelect) {
      return;
    }

    try {
      const [payload, userId] = await Promise.all([
        fetchDepots({ skip: 0, limit: 100 }),
        resolveUserId().catch(() => null),
      ]);

      const depots =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );

      const filtered =
        userId && Array.isArray(depots) ?
          depots.filter((depot) => depot?.user_id === userId)
        : (depots ?? []);

      // Store depots for use in handleSubmit (for auxiliary trip creation)
      loadedDepots = filtered;
      console.debug("[SHIFT] Loaded depots:", loadedDepots.map((d) => ({ id: d.id, name: d.name, stop_id: d.stop_id })));

      renderDepotOptions(startDepotSelect, filtered);
      renderDepotOptions(endDepotSelect, filtered);
    } catch (error) {
      console.error("Failed to load depots", error);
      loadedDepots = [];
      renderDepotOptions(startDepotSelect, []);
      renderDepotOptions(endDepotSelect, []);
      updateFeedback(
        feedback,
        error?.message ?? "Unable to load depots.",
        "error"
      );
    }
  };

  const loadRoutes = async () => {
    try {
      // Get the user's agency ID to filter routes
      const agencyId = await resolveAgencyId().catch(() => "");
      
      let payload;
      if (agencyId) {
        // Fetch only routes belonging to the user's agency/company
        payload = await fetchRoutesByAgency(agencyId, { skip: 0, limit: 1000 });
      } else {
        // Fallback to all routes if no agency is set (shouldn't happen in production)
        console.warn("No agency ID found - showing all routes. This may include routes from other companies.");
        payload = await fetchRoutes({ skip: 0, limit: 1000 });
      }
      
      const routes =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );
      routesById = renderRouteOptions(lineSelect, routes);
    } catch (error) {
      console.error("Failed to load routes", error);
      routesById = renderRouteOptions(lineSelect, []);
      updateFeedback(
        feedback,
        error?.message ?? "Unable to load routes.",
        "error"
      );
    }
  };

  const loadDays = async () => {
    try {
      const payload = await fetchServiceDays();
      const days =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );
      populateDayOptions(daySelect, days);
    } catch (error) {
      console.warn("Failed to load days from API, falling back to defaults", error);
      populateDayOptions(daySelect, DAYS_OF_WEEK);
    }
  };

  const loadTrips = async ({ includeNextDay = false } = {}) => {
    if (!lineSelect || !daySelect || !scheduledTripsBody) {
      return;
    }

    const routeId = lineSelect.value;
    const day = daySelect.value;

    if (!routeId || !day) {
      currentTrips = [];
      clearNode(scheduledTripsBody);
      updateEmptyState(
        scheduledTripsEmpty,
        false,
        "Select a line and day to view trips."
      );
      return;
    }

    renderTripsLoading(scheduledTripsBody);
    updateEmptyState(scheduledTripsEmpty, true);

    try {
      const daysToFetch = [day];
      if (includeNextDay) {
        const nextDay = getNextDay(day);
        if (nextDay) {
          daysToFetch.push(nextDay);
        }
      }

      const results = await Promise.all(
        daysToFetch.map((d) =>
          fetchTripsByRoute({ routeId, dayOfWeek: d }).catch(() => [])
        )
      );

      const allTrips = results.flatMap((payload) => {
        const trips =
          Array.isArray(payload) ? payload : (
            (payload?.items ?? payload?.results ?? [])
          );
        return Array.isArray(trips) ? trips : [];
      });

      // Normalize and deduplicate trips
      const normalizedTrips = allTrips
        .map((trip) => normalizeTrip(trip))
        .filter((trip) => resolveTripId(trip));
      
      // Remove duplicates by tracking seen IDs (both trip_id and database id)
      const seenTripIds = new Set();
      const seenDbIds = new Set();
      currentTrips = normalizedTrips
        .filter((trip) => {
          const tripId = resolveTripId(trip);
          const dbId = trip?.id;
          
          // Check if we've seen this trip before (by either ID)
          const isDuplicateByTripId = tripId && seenTripIds.has(tripId);
          const isDuplicateByDbId = dbId && seenDbIds.has(dbId);
          
          if (isDuplicateByTripId || isDuplicateByDbId) {
            return false;
          }
          
          // Mark this trip as seen
          if (tripId) seenTripIds.add(tripId);
          if (dbId) seenDbIds.add(dbId);
          
          return true;
        })
        .sort((a, b) => {
          const timeA = a.departure_time || "";
          const timeB = b.departure_time || "";
          return timeA.localeCompare(timeB);
        });

      renderScheduledTrips({
        tbody: scheduledTripsBody,
        trips: currentTrips,
        routeLabel: routesById[routeId] ?? "",
        selectedTripIds,
        lastTripEndTime: getLatestEndTime(),
        lastTripEndStop: getLastTripEndStop(),
        shiftStartTime: getShiftStartTime(),
        shiftEndTime: getShiftEndTime(),
      });
      syncSelectedTripsWithCurrent();
      updateEmptyState(
        scheduledTripsEmpty,
        currentTrips.length > 0,
        "No trips match the current filters."
      );
    } catch (error) {
      console.error("Failed to load trips", error);
      currentTrips = [];
      clearNode(scheduledTripsBody);
      updateEmptyState(
        scheduledTripsEmpty,
        false,
        error?.message ?? "Unable to load trips."
      );
    }
  };

  const handleScheduledTripsClick = (event) => {
    const button = event.target?.closest?.('button[data-action="add-trip"]');
    if (!button || button.disabled) {
      return;
    }

    const row = button.closest("tr");
    const id = readTripId(row);
    if (!id) {
      return;
    }

    const trip = currentTrips.find((item = {}) => {
      const tripId = resolveTripId(item);
      return tripId === id;
    });

    if (trip) {
      addTrip(trip);
    }
  };

  const handleShiftTripsClick = (event) => {
    const button = event.target?.closest?.('button[data-action="remove-trip"]');
    if (!button) {
      return;
    }

    const row = button.closest("tr");
    const id = readTripId(row);
    if (!id) {
      return;
    }

    removeTrip(id);
  };

  // Helper to fetch stops for a trip and extract first/last stop info
  const fetchTripStopEdges = async (tripDbId) => {
    if (!tripDbId) return null;
    try {
      const stops = await fetchStopsByTripId(tripDbId);
      if (!Array.isArray(stops) || stops.length === 0) return null;
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];
      return {
        firstStopId: firstStop?.id || firstStop?.stop_id,
        firstStopArrival: firstStop?.arrival_time || firstStop?.departure_time,
        lastStopId: lastStop?.id || lastStop?.stop_id,
        lastStopDeparture: lastStop?.departure_time || lastStop?.arrival_time,
      };
    } catch (err) {
      console.warn("[SHIFT] Failed to fetch stops for trip:", tripDbId, err);
      return null;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    updateFeedback(feedback, "");

    const { name, busId, tripIds, startTime, endTime, startDepotId, endDepotId } = buildShiftPayload({
      form,
      selectedTrips,
    });

    if (!name || !busId) {
      updateFeedback(feedback, "Shift name and bus are required.", "error");
      return;
    }

    if (!Array.isArray(tripIds) || tripIds.length === 0) {
      updateFeedback(feedback, "Add at least one trip to the shift.", "error");
      return;
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");

    try {
      // Build the complete trip IDs array, including auxiliary depot trips
      let allTripIds = [...tripIds];
      
      // Get route info for auxiliary trips
      const firstTrip = selectedTrips[0];
      const lastTrip = selectedTrips[selectedTrips.length - 1];
      const routeId = lineSelect?.value || firstTrip?.route_id || null;
      
      // Find depot objects to get their stop_id
      const startDepot = loadedDepots.find((d) => d.id === startDepotId);
      const endDepot = loadedDepots.find((d) => d.id === endDepotId);
      
      console.debug("[SHIFT] Depot info:", {
        startDepotId,
        startDepot,
        startDepotStopId: startDepot?.stop_id,
        endDepotId,
        endDepot,
        endDepotStopId: endDepot?.stop_id,
      });
      
      // Create auxiliary trip for depot → first stop (if start depot and time are set)
      if (startDepotId && startTime && firstTrip && routeId) {
        const depotStopId = startDepot?.stop_id;
        if (!depotStopId) {
          console.warn("[SHIFT] Start depot does not have a linked stop_id - cannot create depot trip");
        } else {
          // Fetch actual stops for the first trip to get the first stop ID
          // Use the database UUID (id field), not the GTFS trip_id
          updateFeedback(feedback, "Fetching stops for first trip...", "info");
          const firstTripDbId = firstTrip?.id || resolveTripPk(firstTrip);
          console.debug("[SHIFT] First trip DB ID:", firstTripDbId, "from trip:", { id: firstTrip?.id, trip_id: firstTrip?.trip_id });
          const firstTripEdges = await fetchTripStopEdges(firstTripDbId);
          
          if (firstTripEdges?.firstStopId) {
            try {
              console.debug("[SHIFT] Creating auxiliary trip: depot → first stop", {
                depotStopId,
                firstStopId: firstTripEdges.firstStopId,
                departureTime: startTime,
                arrivalTime: firstTripEdges.firstStopArrival,
                routeId,
              });
              
              const depotToFirstStop = await createAuxiliaryTrip({
                departureStopId: depotStopId,
                arrivalStopId: firstTripEdges.firstStopId,
                departureTime: startTime,
                arrivalTime: firstTripEdges.firstStopArrival || startTime,
                routeId,
                status: "depot",
              });
              
              // Prepend the depot trip ID to the beginning
              if (depotToFirstStop?.id) {
                allTripIds = [depotToFirstStop.id, ...allTripIds];
                console.debug("[SHIFT] Created depot → first stop trip:", depotToFirstStop.id);
              }
            } catch (auxError) {
              console.error("[SHIFT] Failed to create depot → first stop auxiliary trip:", auxError);
              updateFeedback(feedback, `Warning: Could not create depot departure trip: ${auxError.message}`, "error");
              // Continue without the auxiliary trip - the shift will still be created
            }
          } else {
            console.warn("[SHIFT] Could not get first stop ID from first trip");
          }
        }
      }
      
      // Create auxiliary trip for last stop → depot (if end depot and time are set)
      if (endDepotId && endTime && lastTrip && routeId) {
        const depotStopId = endDepot?.stop_id;
        if (!depotStopId) {
          console.warn("[SHIFT] End depot does not have a linked stop_id - cannot create depot trip");
        } else {
          // Fetch actual stops for the last trip to get the last stop ID
          // Use the database UUID (id field), not the GTFS trip_id
          updateFeedback(feedback, "Fetching stops for last trip...", "info");
          const lastTripDbId = lastTrip?.id || resolveTripPk(lastTrip);
          console.debug("[SHIFT] Last trip DB ID:", lastTripDbId, "from trip:", { id: lastTrip?.id, trip_id: lastTrip?.trip_id });
          const lastTripEdges = await fetchTripStopEdges(lastTripDbId);
          
          if (lastTripEdges?.lastStopId) {
            try {
              console.debug("[SHIFT] Creating auxiliary trip: last stop → depot", {
                lastStopId: lastTripEdges.lastStopId,
                depotStopId,
                departureTime: lastTripEdges.lastStopDeparture,
                arrivalTime: endTime,
                routeId,
              });
              
              const lastStopToDepot = await createAuxiliaryTrip({
                departureStopId: lastTripEdges.lastStopId,
                arrivalStopId: depotStopId,
                departureTime: lastTripEdges.lastStopDeparture || endTime,
                arrivalTime: endTime,
                routeId,
                status: "depot",
              });
              
              // Append the depot trip ID to the end
              if (lastStopToDepot?.id) {
                allTripIds = [...allTripIds, lastStopToDepot.id];
                console.debug("[SHIFT] Created last stop → depot trip:", lastStopToDepot.id);
              }
            } catch (auxError) {
              console.error("[SHIFT] Failed to create last stop → depot auxiliary trip:", auxError);
              updateFeedback(feedback, `Warning: Could not create depot return trip: ${auxError.message}`, "error");
              // Continue without the auxiliary trip - the shift will still be created
            }
          } else {
            console.warn("[SHIFT] Could not get last stop ID from last trip");
          }
        }
      }

      updateFeedback(feedback, isEditMode ? "Saving shift..." : "Creating shift...", "info");

      if (isEditMode) {
        await updateShift(shiftId, { name, busId, tripIds: allTripIds, startTime, endTime, startDepotId, endDepotId });
        updateFeedback(feedback, "Shift updated.", "success");
        triggerPartialLoad("shifts", {
          flashMessage: "Shift updated.",
        });
        return;
      }

      await createShift({ name, busId, tripIds: allTripIds, startTime, endTime, startDepotId, endDepotId });
      updateFeedback(feedback, "Shift created.", "success");
      triggerPartialLoad("shifts", { flashMessage: "Shift created." });
    } catch (error) {
      console.error(
        isEditMode ? "Failed to update shift" : "Failed to create shift",
        error
      );
      updateFeedback(
        feedback,
        error?.message ??
          (isEditMode ? "Unable to update shift." : "Unable to save shift."),
        "error"
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  };

  const handleVisualize = (event) => {
    event.preventDefault();

    const payload = {
      mode,
      shiftId,
      name: nameInput instanceof HTMLInputElement ? nameInput.value : "",
      busId: busSelect instanceof HTMLSelectElement ? busSelect.value : "",
      busName:
        busSelect instanceof HTMLSelectElement ?
          (busSelect.selectedOptions?.[0]?.text ?? "")
        : "",
      startTime:
        startTimeInput instanceof HTMLInputElement ? startTimeInput.value : "",
      startDepotId:
        startDepotSelect instanceof HTMLSelectElement ?
          startDepotSelect.value
        : "",
      startDepotName:
        startDepotSelect instanceof HTMLSelectElement ?
          (startDepotSelect.selectedOptions?.[0]?.text ?? "")
        : "",
      endTime:
        endTimeInput instanceof HTMLInputElement ? endTimeInput.value : "",
      endDepotId:
        endDepotSelect instanceof HTMLSelectElement ? endDepotSelect.value : "",
      endDepotName:
        endDepotSelect instanceof HTMLSelectElement ?
          (endDepotSelect.selectedOptions?.[0]?.text ?? "")
        : "",
      trips: selectedTrips,
    };

    triggerPartialLoad("visualize-shift", payload);
  };

  if (scheduledTripsBody) {
    scheduledTripsBody.addEventListener("click", handleScheduledTripsClick);
    cleanupHandlers.push(() => {
      scheduledTripsBody.removeEventListener("click", handleScheduledTripsClick);
    });
    
    // Hover handlers for trip preview - use mouseover/mouseout for better delegation
    let currentHoveredRow = null;
    let hoverCheckTimeout = null;
    
    const handleTripMouseOver = (event) => {
      const row = event.target.closest("tr[data-trip-id]");
      if (!row || row === currentHoveredRow) return;
      
      // Clear any pending hide
      clearTimeout(hoverCheckTimeout);
      
      currentHoveredRow = row;
      const tripId = row.dataset.tripId;
      const routeId = lineSelect?.value ?? "";
      
      // Find the full trip object to get all available IDs
      const trip = currentTrips.find((t) => resolveTripId(t) === tripId);
      
      if (tripId && trip) {
        showTripPreview(trip, routeId, row);
      }
    };
    
    const handleTripMouseOut = (event) => {
      const row = event.target.closest("tr[data-trip-id]");
      if (!row) return;
      
      // Check if we're moving to another element within the same row
      const relatedTarget = event.relatedTarget;
      if (relatedTarget && row.contains(relatedTarget)) {
        return;
      }
      
      // Check if we're moving to the preview row
      if (relatedTarget?.closest?.(".trip-preview-row")) {
        return;
      }
      
      // Check if we're moving to another row in the table
      const newRow = relatedTarget?.closest?.("tr[data-trip-id]");
      if (newRow && scheduledTripsBody.contains(newRow)) {
        // Will be handled by the next mouseover
        return;
      }
      
      // Use a small delay to handle DOM reflow race conditions
      // This gives time for the browser to stabilize after inserting the preview row
      clearTimeout(hoverCheckTimeout);
      hoverCheckTimeout = setTimeout(() => {
        // Double-check if mouse is really not over the table or preview
        const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
        const isOverTable = scheduledTripsBody.contains(hoveredElement);
        const isOverPreview = hoveredElement?.closest?.(".trip-preview-row");
        
        if (!isOverTable && !isOverPreview) {
          currentHoveredRow = null;
          hideTripPreview();
        }
      }, 100);
    };
    
    scheduledTripsBody.addEventListener("mouseover", handleTripMouseOver);
    scheduledTripsBody.addEventListener("mouseout", handleTripMouseOut);
    cleanupHandlers.push(() => {
      scheduledTripsBody.removeEventListener("mouseover", handleTripMouseOver);
      scheduledTripsBody.removeEventListener("mouseout", handleTripMouseOut);
      clearTimeout(hoverCheckTimeout);
    });
  }
  if (shiftTripsBody) {
    shiftTripsBody.addEventListener("click", handleShiftTripsClick);
    cleanupHandlers.push(() => {
      shiftTripsBody.removeEventListener("click", handleShiftTripsClick);
    });
    // Note: Trip preview (map + elevation) is only shown for scheduled trips (left list)
    // to help users decide which trips to add to the shift
  }

  const handleLineChange = () => {
    loadTrips({ includeNextDay: isEditMode });
  };
  if (lineSelect) {
    lineSelect.addEventListener("change", handleLineChange);
    cleanupHandlers.push(() => {
      lineSelect.removeEventListener("change", handleLineChange);
    });
  }
  const handleDayChange = () => {
    loadTrips({ includeNextDay: isEditMode });
  };
  if (daySelect) {
    daySelect.addEventListener("change", handleDayChange);
    cleanupHandlers.push(() => {
      daySelect.removeEventListener("change", handleDayChange);
    });
  }

  // Re-render scheduled trips when start/end time changes to update which trips are available
  const handleShiftTimeChange = () => {
    if (currentTrips.length > 0) {
      renderScheduledTrips({
        tbody: scheduledTripsBody,
        trips: currentTrips,
        routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
        selectedTripIds,
        lastTripEndTime: getLatestEndTime(),
        lastTripEndStop: getLastTripEndStop(),
        shiftStartTime: getShiftStartTime(),
        shiftEndTime: getShiftEndTime(),
      });
    }
    updateTimeline();
  };
  if (startTimeInput) {
    startTimeInput.addEventListener("change", handleShiftTimeChange);
    cleanupHandlers.push(() => {
      startTimeInput.removeEventListener("change", handleShiftTimeChange);
    });
  }
  if (endTimeInput) {
    endTimeInput.addEventListener("change", handleShiftTimeChange);
    cleanupHandlers.push(() => {
      endTimeInput.removeEventListener("change", handleShiftTimeChange);
    });
  }
  
  // Update timeline when depot selection changes
  const handleDepotChange = () => {
    updateTimeline();
  };
  if (startDepotSelect) {
    startDepotSelect.addEventListener("change", handleDepotChange);
    cleanupHandlers.push(() => {
      startDepotSelect.removeEventListener("change", handleDepotChange);
    });
  }
  if (endDepotSelect) {
    endDepotSelect.addEventListener("change", handleDepotChange);
    cleanupHandlers.push(() => {
      endDepotSelect.removeEventListener("change", handleDepotChange);
    });
  }

  const handleCancelClick = () => {
    triggerPartialLoad("shifts");
  };
  if (cancelButton) {
    cancelButton.addEventListener("click", handleCancelClick);
    cleanupHandlers.push(() => {
      cancelButton.removeEventListener("click", handleCancelClick);
    });
  }

  if (visualizeButton) {
    visualizeButton.addEventListener("click", handleVisualize);
    cleanupHandlers.push(() => {
      visualizeButton.removeEventListener("click", handleVisualize);
    });
  }
  form.addEventListener("submit", handleSubmit);
  cleanupHandlers.push(() => {
    form.removeEventListener("submit", handleSubmit);
  });

  updateEmptyState(shiftTripsEmpty, false, "No trips added to this shift yet.");
  updateEmptyState(
    scheduledTripsEmpty,
    false,
    "Select a line and day to view trips."
  );

  if (!isEditMode && nameInput instanceof HTMLInputElement) {
    nameInput.focus();
  }

  if (isEditMode) {
    toggleFormDisabled(form, true);
  }

  const shiftPromise =
    isEditMode ?
      fetchShiftById(shiftId).catch((error) => {
        console.error("Failed to load shift", error);
        return null;
      })
    : Promise.resolve(null);

  const [, , , , shift] = await Promise.all([
    loadBuses(),
    loadRoutes(),
    loadDepots(),
    loadDays(),
    shiftPromise,
  ]);

  if (isEditMode) {
    if (shift) {
      const busId = firstAvailable(
        shift?.bus_id,
        shift?.busId,
        shift?.bus?.id,
        shift?.bus?.bus_id
      );

      // If the bus is not in the loaded list, try to fetch it to get the name
      if (busId && busSelect instanceof HTMLSelectElement) {
        const exists = Array.from(busSelect.options).some(
          (opt) => opt.value === String(busId)
        );
        if (!exists) {
          try {
            const bus = await fetchBusById(busId);
            if (bus) {
              // Patch the shift object so prefill uses the correct name
              shift.bus = { ...(shift.bus || {}), ...bus };
            }
          } catch (error) {
            console.error("Failed to fetch missing bus details", error);
          }
        }
      }

      // Fetch shift info (route and day information) from the dedicated endpoint
      let shiftInfo = null;
      try {
        shiftInfo = await fetchShiftInfo(shiftId);
      } catch (error) {
        console.warn("Could not fetch shift info:", error.message);
      }

      // DEBUG: Log what the API returns to understand the data structure
      console.debug("[SHIFT DEBUG] Raw shift from fetchShiftById:", JSON.stringify(shift, null, 2));
      console.debug("[SHIFT DEBUG] Raw shiftInfo from fetchShiftInfo:", JSON.stringify(shiftInfo, null, 2));
      console.debug("[SHIFT DEBUG] Checking time fields in shift:", {
        start_time: shift?.start_time,
        startTime: shift?.startTime,
        end_time: shift?.end_time,
        endTime: shift?.endTime,
        "start?.time": shift?.start?.time,
        "end?.time": shift?.end?.time,
      });
      console.debug("[SHIFT DEBUG] Checking time fields in shiftInfo:", {
        start_time: shiftInfo?.start_time,
        startTime: shiftInfo?.startTime,
        end_time: shiftInfo?.end_time,
        endTime: shiftInfo?.endTime,
      });

      // Hydrate the shift with stop times and the info from the endpoint
      const hydratedShift = await hydrateShift(shift, shiftInfo);
      
      console.debug("[SHIFT DEBUG] Hydrated shift times:", {
        start_time: hydratedShift?.start_time,
        end_time: hydratedShift?.end_time,
      });
      
      applyShiftPrefill(hydratedShift);
      updateFeedback(feedback, "Shift ready to edit.", "info");
      toggleFormDisabled(form, false);
      if (nameInput instanceof HTMLInputElement) {
        nameInput.focus();
        const length = nameInput.value.length;
        nameInput.setSelectionRange(length, length);
      }
    } else {
      updateFeedback(feedback, "Unable to load shift for editing.", "error");
      toggleFormDisabled(form, false);
      if (submitButton) {
        submitButton.disabled = true;
      }
    }
  }

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};

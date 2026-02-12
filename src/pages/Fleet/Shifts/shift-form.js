import "./shifts.css";
import {
  createShift,
  fetchDepots,
  fetchRoutes,
  fetchShiftById,
  fetchStopsByTripId,
  fetchTripsByRoute,
  updateShift,
} from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import {
  textContent,
  toggleFormDisabled,
  updateFeedback,
  normalizeApiList,
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
  renderDepotOptions,
  renderRouteOptions,
  renderScheduledTrips,
  renderCustomStops,
  renderShiftTrips,
  renderTripsLoading,
  updateEmptyState,
  clearNode,
} from "./shift-renderers";

const readTripId = (node) => node?.dataset?.tripId?.trim() ?? "";

const buildShiftPayload = ({ form, selectedTrips }) => {
  const formData = new FormData(form);
  const name = formData.get("name")?.toString().trim();
  // Use the id field (UUID) for shift API, not trip_id (GTFS identifier)
  const tripIds = selectedTrips.map((trip) => trip?.id ?? "");

  return { name, tripIds };
};

const hydrateShift = async (shift) => {
  if (
    !shift ||
    !Array.isArray(shift.structure) ||
    shift.structure.length === 0
  ) {
    return shift;
  }

  const structure = await Promise.all(
    shift.structure.map(async (item) => {
      if (!item.trip_id) {
        return item;
      }
      try {
        const stopTimes = await fetchStopsByTripId(item.trip_id);
        return {
          ...item,
          stop_times: stopTimes,
          trip: {
            ...(item.trip || {}),
            stop_times: stopTimes,
          },
        };
      } catch (error) {
        console.error(`Failed to load stops for trip ${item.trip_id}`, error);
        return item;
      }
    }),
  );

  return { ...shift, structure };
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
  const startTimeInput = form.querySelector("#shift-start-time");
  const endTimeInput = form.querySelector("#shift-end-time");

  const tabsNav = section.querySelector(".tabs-nav");
  if (tabsNav) {
    tabsNav.addEventListener("click", (e) => {
      const button = e.target.closest(".tab-button");
      if (!button) return;

      const targetId = button.getAttribute("aria-controls");
      const targetPanel = section.querySelector(`#${targetId}`);
      if (!targetPanel) return;

      // Update buttons
      tabsNav.querySelectorAll(".tab-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
        btn.setAttribute("aria-selected", btn === button);
      });

      // Update panels
      section.querySelectorAll(".tabs-content > section").forEach((panel) => {
        panel.hidden = panel.id !== targetId;
        panel.classList.toggle("active", panel.id === targetId);
      });
    });
  }

  const lineSelect = form.querySelector('[data-filter="line"]');
  const daySelect = form.querySelector('[data-filter="day"]');
  const startDepotSelect = form.querySelector('[data-field="start-depot"]');
  const endDepotSelect = form.querySelector('[data-field="end-depot"]');
  const scheduledTripsBody = form.querySelector(
    'tbody[data-role="scheduled-trips-body"]',
  );
  const scheduledTripsEmpty = form.querySelector(
    '[data-role="scheduled-trips-empty"]',
  );

  const shiftTripsBody = form.querySelector(
    'tbody[data-role="shift-trips-body"]',
  );
  const shiftTripsEmpty = form.querySelector('[data-role="shift-trips-empty"]');

  const customStopsBody = form.querySelector(
    'tbody[data-role="custom-stops-body"]',
  );
  const customStopsEmpty = form.querySelector(
    '[data-role="custom-stops-empty"]',
  );
  const addStopDialog = section.querySelector("#dialog-add-stop-time");
  const addStopForm = addStopDialog?.querySelector("form");
  const stopNameDisplay = addStopDialog?.querySelector(".stop-name-display");
  const timeInputs = {
    arrival: addStopDialog?.querySelector("#stop-arrival-time"),
    departure: addStopDialog?.querySelector("#stop-departure-time"),
  };

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
  let currentCustomStops = [];
  const selectedTripIds = new Set();
  let selectedTrips = [];

  const ensureTimesFromSelected = ({ force = false } = {}) => {
    const readTimes = (project) =>
      selectedTrips
        .map((trip = {}) => normalizeTime(project(trip)).trim())
        .filter((value) => value.length > 0);

    if (startTimeInput instanceof HTMLInputElement) {
      if (force || !startTimeInput.value) {
        const departureTimes = readTimes(
          (trip) => trip?.departure_time ?? trip?.departureTime ?? "",
        );
        if (departureTimes.length > 0) {
          const earliest = [...departureTimes].sort((a, b) =>
            a.localeCompare(b),
          )[0];
          startTimeInput.value = earliest;
        }
      }
    }

    if (endTimeInput instanceof HTMLInputElement) {
      if (force || !endTimeInput.value) {
        const arrivalTimes = readTimes(
          (trip) =>
            trip?.arrival_time ??
            trip?.arrivalTime ??
            trip?.end_time ??
            trip?.endTime ??
            trip?.departure_time ??
            trip?.departureTime ??
            "",
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
        (candidate = {}) => resolveTripId(candidate) === id,
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
      ensureTimesFromSelected({ force: false });
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

  const addTrip = (trip) => {
    const normalized = normalizeTrip(trip);
    const id = resolveTripId(normalized);
    if (!id || selectedTripIds.has(id)) {
      return;
    }

    // Validate: new trip must not start before the latest existing trip ends
    const newDeparture = normalized.departure_time;
    if (selectedTrips.length > 0 && newDeparture) {
      const latestArrival = selectedTrips
        .map((t) => t.arrival_time || t.departure_time || "")
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))[0];

      if (latestArrival && newDeparture < latestArrival) {
        updateFeedback(
          feedback,
          `Trip starts at ${newDeparture} but the latest trip ends at ${latestArrival}. Trips cannot overlap.`,
          "error",
        );
        return;
      }
    }

    selectedTripIds.add(id);
    selectedTrips = [...selectedTrips, normalized];
    updateShiftTrips();
    ensureTimesFromSelected();
    renderScheduledTrips({
      tbody: scheduledTripsBody,
      trips: currentTrips,
      routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
      selectedTripIds,
      lastTripEndTime: getLatestEndTime(),
    });
  };

  const removeTrip = (id) => {
    if (!selectedTripIds.has(id)) {
      return;
    }
    selectedTripIds.delete(id);
    selectedTrips = selectedTrips.filter((trip = {}) => {
      const tripId = resolveTripId(trip);
      return tripId && tripId !== id;
    });
    updateShiftTrips();
    ensureTimesFromSelected({ force: true });
    renderScheduledTrips({
      tbody: scheduledTripsBody,
      trips: currentTrips,
      routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
      selectedTripIds,
      lastTripEndTime: getLatestEndTime(),
    });
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

    const startTime = normalizeTime(
      firstAvailable(
        shift?.start_time,
        shift?.startTime,
        shift?.start?.time,
        shift?.start?.scheduled_time,
        shift?.start?.scheduledTime,
        shift?.start?.planned_time,
        shift?.start?.plannedTime,
      ),
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
        shift?.end?.plannedTime,
      ),
    );
    if (endTimeInput instanceof HTMLInputElement && endTime) {
      endTimeInput.value = endTime;
    }

    const startDepotId = firstAvailable(
      shift?.start_depot_id,
      shift?.startDepotId,
      shift?.start_depot?.id,
      shift?.start_depot,
      shift?.startDepot,
    );
    prefillSelectValue(
      startDepotSelect,
      startDepotId,
      shift?.start_depot?.name ?? shift?.startDepotName ?? "",
    );

    const endDepotId = firstAvailable(
      shift?.end_depot_id,
      shift?.endDepotId,
      shift?.end_depot?.id,
      shift?.end_depot,
      shift?.endDepot,
    );
    prefillSelectValue(
      endDepotSelect,
      endDepotId,
      shift?.end_depot?.name ?? shift?.endDepotName ?? "",
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

    if (lineSelect instanceof HTMLSelectElement) {
      const firstTrip = trips[0] ?? {};
      const routeId = firstAvailable(
        shift?.route_id,
        shift?.routeId,
        shift?.route?.id,
        firstTrip?.route_id,
        firstTrip?.routeId,
        firstTrip?.route?.id,
        firstTrip?.trip?.route_id,
        firstTrip?.trip?.routeId,
      );
      if (routeId) {
        prefillSelectValue(
          lineSelect,
          routeId,
          routesById[routeId] ??
            shift?.route?.name ??
            shift?.route_name ??
            shift?.routeName ??
            firstAvailable(
              firstTrip?.route_name,
              firstTrip?.routeName,
              firstTrip?.route?.name,
            ),
        );
      }
    }

    if (daySelect instanceof HTMLSelectElement) {
      const firstTrip = selectedTrips[0] ?? {};
      const rawDay = firstAvailable(
        shift?.day_of_week,
        shift?.dayOfWeek,
        shift?.service_day,
        shift?.serviceDay,
        shift?.day,
        firstTrip?.day_of_week,
        firstTrip?.dayOfWeek,
      );
      if (rawDay) {
        const normalized = rawDay.toLowerCase();
        const label =
          rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
        prefillSelectValue(daySelect, normalized, label);
      }
    }

    updateShiftTrips();
    const shouldForceTimes =
      (startTimeInput instanceof HTMLInputElement && !startTimeInput.value) ||
      (endTimeInput instanceof HTMLInputElement && !endTimeInput.value);
    ensureTimesFromSelected({ force: shouldForceTimes });
    renderScheduledTrips({
      tbody: scheduledTripsBody,
      trips: currentTrips,
      routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
      selectedTripIds,
      lastTripEndTime: getLatestEndTime(),
    });

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

  const loadDepots = async () => {
    try {
      const [payload, userId] = await Promise.all([
        fetchDepots({ skip: 0, limit: 100 }),
        resolveUserId().catch(() => null),
      ]);

      const depots = normalizeApiList(payload);

      const filtered =
        userId && Array.isArray(depots) ?
          depots.filter((depot) => depot?.user_id === userId)
        : (depots ?? []);

      if (startDepotSelect && endDepotSelect) {
        renderDepotOptions(startDepotSelect, filtered);
        renderDepotOptions(endDepotSelect, filtered);
      }

      currentCustomStops = filtered;

      if (customStopsBody) {
        renderCustomStops({
          tbody: customStopsBody,
          stops: currentCustomStops,
        });
        updateEmptyState(
          customStopsEmpty,
          currentCustomStops.length > 0,
          "No custom stops available.",
        );
      }
    } catch (error) {
      console.error("Failed to load depots", error);
      if (startDepotSelect && endDepotSelect) {
        renderDepotOptions(startDepotSelect, []);
        renderDepotOptions(endDepotSelect, []);
      }
      currentCustomStops = [];
      if (customStopsBody) {
        clearNode(customStopsBody);
        updateEmptyState(
          customStopsEmpty,
          false,
          error?.message ?? "Unable to load custom stops.",
        );
      }
      updateFeedback(
        feedback,
        error?.message ?? "Unable to load depots.",
        "error",
      );
    }
  };

  const loadRoutes = async () => {
    try {
      const payload = await fetchRoutes({ skip: 0, limit: 1000 });
      const routes = normalizeApiList(payload);
      routesById = renderRouteOptions(lineSelect, routes);
    } catch (error) {
      console.error("Failed to load routes", error);
      routesById = renderRouteOptions(lineSelect, []);
      updateFeedback(
        feedback,
        error?.message ?? "Unable to load routes.",
        "error",
      );
    }
  };

  const loadDays = async () => {
    // API endpoint for days does not exist, using static list
    populateDayOptions(daySelect, DAYS_OF_WEEK);
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
        "Select a line and day to view trips.",
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
          fetchTripsByRoute({ routeId, dayOfWeek: d }).catch(() => []),
        ),
      );

      const allTrips = results.flatMap((payload) => normalizeApiList(payload));

      currentTrips = allTrips
        .map((trip) => normalizeTrip(trip))
        .filter((trip) => resolveTripId(trip))
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
      });
      syncSelectedTripsWithCurrent();
      updateEmptyState(
        scheduledTripsEmpty,
        currentTrips.length > 0,
        "No trips match the current filters.",
      );
    } catch (error) {
      console.error("Failed to load trips", error);
      currentTrips = [];
      clearNode(scheduledTripsBody);
      updateEmptyState(
        scheduledTripsEmpty,
        false,
        error?.message ?? "Unable to load trips.",
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

  const handleCustomStopsClick = (event) => {
    const button = event.target?.closest?.('button[data-action="add-stop"]');
    if (!button || !addStopDialog) {
      return;
    }

    const row = button.closest("tr");
    const id = row?.dataset?.stopId;
    if (!id) return;

    const stop = currentCustomStops.find((s) => s.id === id);
    if (!stop) return;

    if (stopNameDisplay) {
      stopNameDisplay.textContent = stop.name;
    }
    addStopDialog.dataset.stopId = id;

    // Reset times
    if (timeInputs.arrival) timeInputs.arrival.value = "";
    if (timeInputs.departure) timeInputs.departure.value = "";

    addStopDialog.showModal();
  };

  if (addStopForm) {
    addStopForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const stopId = addStopDialog.dataset.stopId;
      const stop = currentCustomStops.find((s) => s.id === stopId);

      if (!stop) {
        addStopDialog.close();
        return;
      }

      const arrivalTime = timeInputs.arrival?.value;
      const departureTime = timeInputs.departure?.value;

      const tripLike = {
        id: stop.id, // Using stop ID as trip ID for now, as per assumptions
        start_stop_name: stop.name,
        end_stop_name: stop.name,
        departure_time: departureTime,
        arrival_time: arrivalTime,
        // Add other necessary properties to make it look like a trip
      };

      addTrip(tripLike);
      addStopDialog.close();
    });

    addStopForm.addEventListener("click", (e) => {
      const action = e.target?.dataset?.action;
      if (action === "close-dialog" || action === "cancel-dialog") {
        addStopDialog.close();
      }
    });
  }

  if (customStopsBody) {
    customStopsBody.addEventListener("click", handleCustomStopsClick);
    cleanupHandlers.push(() => {
      customStopsBody.removeEventListener("click", handleCustomStopsClick);
    });
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    updateFeedback(feedback, "");

    const { name, tripIds } = buildShiftPayload({
      form,
      selectedTrips,
    });

    if (!name) {
      updateFeedback(feedback, "Shift name is required.", "error");
      return;
    }

    if (!Array.isArray(tripIds) || tripIds.length === 0) {
      updateFeedback(feedback, "Add at least one trip to the shift.", "error");
      return;
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");

    try {
      if (isEditMode) {
        await updateShift(shiftId, { name, tripIds });
        updateFeedback(feedback, "Shift updated.", "success");
        triggerPartialLoad("shifts", {
          flashMessage: "Shift updated.",
        });
        return;
      }

      await createShift({ name, tripIds });
      updateFeedback(feedback, "Shift created.", "success");
      triggerPartialLoad("shifts", { flashMessage: "Shift created." });
    } catch (error) {
      console.error(
        isEditMode ? "Failed to update shift" : "Failed to create shift",
        error,
      );
      updateFeedback(
        feedback,
        error?.message ??
          (isEditMode ? "Unable to update shift." : "Unable to save shift."),
        "error",
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
      scheduledTripsBody.removeEventListener(
        "click",
        handleScheduledTripsClick,
      );
    });
  }
  if (shiftTripsBody) {
    shiftTripsBody.addEventListener("click", handleShiftTripsClick);
    cleanupHandlers.push(() => {
      shiftTripsBody.removeEventListener("click", handleShiftTripsClick);
    });
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
    "Select a line and day to view trips.",
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

  const [, , , shift] = await Promise.all([
    loadRoutes(),
    loadDepots(),
    loadDays(),
    shiftPromise,
  ]);

  if (isEditMode) {
    if (shift) {
      const hydratedShift = await hydrateShift(shift);
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

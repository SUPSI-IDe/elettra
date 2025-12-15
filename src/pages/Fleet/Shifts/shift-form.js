import "./shifts.css";
import {
  createShift,
  fetchBuses,
  fetchBusById,
  fetchDepots,
  fetchRoutes,
  fetchShiftById,
  fetchStopsByTripId,
  fetchTripsByRoute,
  updateShift,
} from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { getOwnedBuses, setOwnedBuses } from "../../../store";
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
  normalizeTrip,
  resolveRouteLabel,
  readShiftTripsFromStructure,
  getNextDay,
} from "./shift-utils";

const readTripId = (node) => node?.dataset?.tripId?.trim() ?? "";

const buildShiftPayload = ({ form, selectedTrips }) => {
  const formData = new FormData(form);
  const name = formData.get("name")?.toString().trim();
  const busId = formData.get("busId")?.toString().trim();
  const tripIds = selectedTrips.map((trip) => resolveTripId(trip) ?? "");

  return { name, busId, tripIds };
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
    })
  );

  return { ...shift, structure };
};

export const initializeShiftForm = async (root = document, options = {}) => {
  const section = root.querySelector("section.shift-form");
  if (!section) {
    return;
  }

  const form = section.querySelector('form[data-form="shift-form"]');
  if (!form) {
    return;
  }

  const mode = options.mode === "edit" ? "edit" : "create";
  const shiftId =
    mode === "edit" ? text(options.shiftId ?? options.shift_id ?? "") : "";
  const isEditMode = mode === "edit" && Boolean(shiftId);

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const visualizeButton = form.querySelector('[data-action="visualize-shift"]');

  const nameInput = form.querySelector("#shift-name");
  const busSelect = form.querySelector("#shift-bus");
  const startTimeInput = form.querySelector("#shift-start-time");
  const endTimeInput = form.querySelector("#shift-end-time");

  const lineSelect = form.querySelector('[data-filter="line"]');
  const daySelect = form.querySelector('[data-filter="day"]');
  const startDepotSelect = form.querySelector('[data-field="start-depot"]');
  const endDepotSelect = form.querySelector('[data-field="end-depot"]');
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

  populateDayOptions(daySelect);

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

  const ensureTimesFromSelected = ({ force = false } = {}) => {
    const readTimes = (project) =>
      selectedTrips
        .map((trip = {}) => normalizeTime(project(trip)).trim())
        .filter((value) => value.length > 0);

    if (startTimeInput instanceof HTMLInputElement) {
      if (force || !startTimeInput.value) {
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
      if (force || !endTimeInput.value) {
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
      ensureTimesFromSelected({ force: false });
    }
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
          "error"
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
        firstTrip?.trip?.routeId
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
              firstTrip?.route?.name
            )
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
        firstTrip?.dayOfWeek
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

  const loadBuses = async () => {
    const cached = getOwnedBuses();
    if (Array.isArray(cached) && cached.length > 0) {
      renderBusOptions(busSelect, cached);
      return;
    }

    try {
      const [payload, userId] = await Promise.all([
        fetchBuses({ skip: 0, limit: 100 }),
        resolveUserId().catch(() => null),
      ]);

      const buses =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );

      const filtered =
        userId && Array.isArray(buses) ?
          buses.filter((bus) => bus?.user_id === userId)
        : (buses ?? []);

      setOwnedBuses(filtered);
      renderBusOptions(busSelect, filtered);
    } catch (error) {
      console.error("Failed to load buses", error);
      renderBusOptions(busSelect, []);
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

      renderDepotOptions(startDepotSelect, filtered);
      renderDepotOptions(endDepotSelect, filtered);
    } catch (error) {
      console.error("Failed to load depots", error);
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
      const payload = await fetchRoutes({ skip: 0, limit: 100 });
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

      currentTrips = allTrips
        .map((trip) => normalizeTrip(trip))
        .filter((trip) => resolveTripId(trip));

      renderScheduledTrips({
        tbody: scheduledTripsBody,
        trips: currentTrips,
        routeLabel: routesById[routeId] ?? "",
        selectedTripIds,
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
      const tripId = text(item?.id ?? item?.trip_id ?? "");
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    updateFeedback(feedback, "");

    const { name, busId, tripIds } = buildShiftPayload({
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
      if (isEditMode) {
        await updateShift(shiftId, { name, busId, tripIds });
        updateFeedback(feedback, "Shift updated.", "success");
        triggerPartialLoad("shifts", {
          flashMessage: "Shift updated.",
        });
        return;
      }

      await createShift({ name, busId, tripIds });
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

  scheduledTripsBody?.addEventListener("click", handleScheduledTripsClick);
  shiftTripsBody?.addEventListener("click", handleShiftTripsClick);

  lineSelect?.addEventListener("change", () => {
    loadTrips({ includeNextDay: isEditMode });
  });
  daySelect?.addEventListener("change", () => {
    loadTrips({ includeNextDay: isEditMode });
  });

  cancelButton?.addEventListener("click", () => {
    triggerPartialLoad("shifts");
  });

  visualizeButton?.addEventListener("click", handleVisualize);
  form.addEventListener("submit", handleSubmit);

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

  const [, , , shift] = await Promise.all([
    loadBuses(),
    loadRoutes(),
    loadDepots(),
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
};

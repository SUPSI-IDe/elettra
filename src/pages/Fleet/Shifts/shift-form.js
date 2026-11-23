import { datasetKey, datasetLabel, datasetSummaryHtml, sortDatasets } from "../../../utils/gtfs-datasets.js";
import "./shifts.css";
import "./shift-visualization.css";
import {
  createShift,
  createAuxiliaryTrip,
  createWeatherTemperatureClusters,
  fetchAllBuses,
  fetchBusById,
  fetchAllBusModels,
  fetchAllDepots,
  fetchPvgisTmy,
  fetchAllRoutes,
  fetchGtfsDatasets,
  fetchRoutesByAgency,
  fetchShiftById,
  fetchShiftInfo,
  fetchStopsByTripId,
  fetchTripsByRoute,
  fetchWeatherTemperatureClusters,
  updateShift,
} from "../../../api";
import { resolveUserId, resolveAgencyId } from "../../../api/session";
import { showTripPreview, hideTripPreview } from "./trip-preview";
import { renderTimeline } from "./shift-timeline";
import { triggerPartialLoad } from "../../../events";
import { invalidateShiftDistanceCache } from "../../../utils/shift-distance";
import { getOwnedBuses, setOwnedBuses, getModelsById } from "../../../store";
import {
  textContent,
  toText,
  toggleFormDisabled,
  updateFeedback as renderFeedback,
} from "../../../ui-helpers";
import { t, I18N_CHANGE_EVENT } from "../../../i18n";
import {
  text,
  firstAvailable,
  normalizeTime,
  resolveTripId,
  resolveTripPk,
  normalizeTrip,
  resolveRouteLabel,
  DAYS_OF_WEEK,
  evaluateTripEligibility,
  getEligibleScheduledTrips,
  normalizeOperationalTripCandidates,
  resolveShiftDepotIds,
  resolveShiftDepotTimes,
  isShiftClosedAtDepot,
  resolveScheduledTripsEmptyMessageKey,
  filterServiceTripsForSave,
  assessEditRouteReconstruction,
} from "./shift-utils";
import {
  populateDayOptions,
  translateShiftSelectOptions,
  renderBusOptions,
  renderDepotOptions,
  renderRouteOptions,
  renderScheduledTrips,
  renderShiftTrips,
  renderTripsLoading,
  updateEmptyState,
  clearNode,
} from "./shift-renderers";
import { splitServicePeriods, readShiftDepotStays, validateDepotStays, periodBounds, buildProgrammeMovements, persistProgrammeMovements } from './shift-depot-stays.js';
import { adjustStayProgramme, mapWithLimit, planPeriodTripInsertion, serviceMinutes } from './shift-stay-adjustment.js';
import { createShiftTransferResolver } from './shift-transfer-routing.js';
import { fetchShiftTransferDuration } from '../../../api/shift-routing.js';
import { rebuildStayProgramme } from './shift-stay-programme.js';
import { initializeShiftStayEditor } from './shift-stay-editor.js';
import { initializeDepotStayControls } from './shift-depot-stay-controls.js';
import { initializeShiftComposer } from "./shift-composer";
import { resolveShiftEndTime, toClockTime } from './shift-time-window';

const readTripId = (node) => node?.dataset?.tripId?.trim() ?? "";

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

// Module-level variable to store loaded depots for use in handleSubmit
let loadedDepots = [];

const buildShiftPayload = ({ form, selectedTrips }) => {
  const formData = new FormData(form);
  const name = formData.get("name")?.toString().trim();
  const busId = formData.get("busId")?.toString().trim();
  const startTime = formData.get("startTime")?.toString().trim() || null;
  const endTime = resolveShiftEndTime(startTime, formData.get("endTime")?.toString().trim()) || null;
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
  const depotTimes = resolveShiftDepotTimes({ shift: shift ?? {}, shiftInfo });
  // Priority: shiftInfo times, then shift times
  const startTime = 
    shiftInfo?.start_time ||
    shiftInfo?.startTime ||
    shiftInfo?.departure_time ||
    shiftInfo?.departureTime ||
    shift?.start_time ||
    shift?.startTime ||
    depotTimes.startTime ||
    null;
  
  const endTime = 
    shiftInfo?.end_time ||
    shiftInfo?.endTime ||
    shiftInfo?.arrival_time ||
    shiftInfo?.arrivalTime ||
    shift?.end_time ||
    shift?.endTime ||
    depotTimes.endTime ||
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

  // Keep invalid metadata available to the reconstruction check below, which
  // reports the problem and blocks saving instead of failing during hydration.
  const metadataTrips = Array.isArray(shiftInfo?.trips) ? shiftInfo.trips : [];
  const infoTrips = new Map(metadataTrips.filter(trip => trip?.id).map(trip => [trip.id, trip]));
  const structure = await Promise.all(
    shift.structure.map(async (item) => {
      if (!item.trip_id) {
        return item;
      }
      try {
        const infoTrip = infoTrips.get(item.trip_id);
        // A block may contain several lines. Its summary route only supplies
        // a fallback; it must never overwrite each trip's own route.
        const tripRouteId = firstAvailable(infoTrip?.route_id, infoTrip?.route?.id, item.route_id, item.trip?.route_id, routeId);
        const tripRouteLabel = firstAvailable(infoTrip?.route_short_name, infoTrip?.route?.route_short_name,
          item.route_short_name, item.trip?.route_short_name, tripRouteId === routeId ? routeLabel : '');
        // Fetch stop times for trip preview/display
        const stopTimes = await fetchStopsByTripId(item.trip_id).catch(() => []);

        return {
          ...item,
          stop_times: stopTimes,
          // Use the info from the shift info endpoint
          day_of_week: dayOfWeek || item.day_of_week,
          route_id: tripRouteId,
          route_short_name: tripRouteLabel,
          trip: {
            ...(item.trip || {}),
            stop_times: stopTimes,
            day_of_week: dayOfWeek || item.trip?.day_of_week,
            route_id: tripRouteId,
            route_short_name: tripRouteLabel,
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
  const translatedMessages = new Map();
  const resolveMessage = message => typeof message === 'function' ? message() : message;
  const updateFeedback = (node, message, tone) => {
    if (!node) return;
    translatedMessages.set(node, { message, tone });
    renderFeedback(node, resolveMessage(message), tone);
  };
  const localizedError = (key, params = {}) => {
    const localize = () => t(key, typeof params === 'function' ? params() : params);
    return Object.assign(new Error(localize()), { localize });
  };
  const errorMessage = (error, fallbackKey) => {
    const key = {
      invalid_auxiliary_trip_response: 'shifts.auxiliary_response_invalid',
      invalid_shift_trip: 'shifts.selected_trip_invalid',
      invalid_depot_stop: 'shifts.depot_stop_required',
      invalid_trip_stops: 'shifts.depot_trip_stops_required',
    }[error?.code];
    return error?.localize?.() || (key ? t(key) : error?.message) || t(fallbackKey);
  };
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const visualizeButton = form.querySelector('[data-action="visualize-shift"]');
  const closeButton = section.querySelector('[data-action="close"]');
  const progressOverlay = section.querySelector('[data-role="shift-progress"]');
  const progressMessage = section.querySelector(
    '[data-role="shift-progress-message"]'
  );

  const showProgress = (message) => {
    if (progressMessage) {
      progressMessage.removeAttribute('data-i18n');
      translatedMessages.set(progressMessage, { message });
      progressMessage.textContent = resolveMessage(message);
    }
    if (progressOverlay) {
      progressOverlay.hidden = false;
    }
  };

  const hideProgress = () => {
    if (progressOverlay) {
      progressOverlay.hidden = true;
    }
  };

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
  const addAllTripsButton = form.querySelector(
    'button[data-action="add-all-trips"]'
  );

  const shiftTripsBody = form.querySelector(
    'tbody[data-role="shift-trips-body"]'
  );
  const shiftTripsEmpty = form.querySelector('[data-role="shift-trips-empty"]');
  const removeAllTripsButton = form.querySelector(
    'button[data-action="remove-all-trips"]'
  );
  const timelineContainer = section.querySelector('[data-role="shift-timeline"]');

  // populateDayOptions(daySelect); // Removed, called in loadDays

  const title = section.querySelector("header h1");
  const submitButton = form.querySelector('button[type="submit"]');

  if (title) {
    title.dataset.i18n = isEditMode ? 'shifts.edit_shift' : 'shifts.add_shift';
    title.textContent = isEditMode ? t("shifts.edit_shift") : t("shifts.add_shift");
  }

  if (submitButton) {
    submitButton.dataset.i18n = isEditMode ? 'shifts.update_shift' : 'shifts.save_shift';
    submitButton.textContent = isEditMode ? t("shifts.update_shift") : t("shifts.save_shift");
  }

  section.dataset.mode = isEditMode ? "edit" : "create";
  form.dataset.mode = isEditMode ? "edit" : "create";
  if (shiftId) {
    form.dataset.shiftId = shiftId;
  } else {
    delete form.dataset.shiftId;
  }

  const datasetSelect = form.querySelector('[data-filter="gtfs-dataset"]');
  const datasetSummary = form.querySelector('[data-role="gtfs-dataset-summary"]');
  let datasets = [];
  let selectedDataset = null;
  let datasetStatus = "loading";
  let savedShiftDatasets;
  let datasetGeneration = 0;
  let tripGeneration = 0;
  let disposed = false;
  if (datasetSelect) datasetSelect.hidden = isEditMode;
  let routesById = {};
  let currentTrips = [];
  let tripsLoading = false;
  let tripLoadError = null;
  const selectedTripIds = new Set();
  let selectedTrips = [];
  let depotStays = [];
  let activePeriod = 0;
  let existingConnections = [];
  let adjustmentRevision = 0;
  let adjustmentPending = false;
  let adjustmentError = '';
  let adjustmentIndex = null;
  let adjustmentSummary = null;
  let stayUndoGroup = null;
  let dirtyStay = null;
  let adjustmentTask = null;
  let stayPreview = null;
  let previewPending = false;
  let previewTimer = null;
  let eligibleGeneration = 0;
  let bulkAdding = false;
  const travelMinutes = createShiftTransferResolver({ fetchStops: fetchStopsByTripId, fetchDuration: fetchShiftTransferDuration });
  const invalidateAdjustment = () => {
    clearTimeout(previewTimer);
    stayPreview = null;
    previewPending = false;
    adjustmentRevision++;
    eligibleGeneration++;
    adjustmentPending = false;
    adjustmentError = '';
    adjustmentIndex = null;
    adjustmentSummary = null;
    dirtyStay = null;
    stayUndoGroup = null;
  };
  const getPeriods = () => splitServicePeriods(selectedTrips, depotStays);
  const getActivePeriod = () => getPeriods()[activePeriod] || getPeriods().at(-1);
  const getActiveBounds = () => periodBounds(getActivePeriod(), { startTime: getShiftStartTime(), endTime: getShiftEndTime() });
  const getDisplayProgramme = () => stayPreview || { trips: selectedTrips, stays: depotStays };
  const getDisplayPeriod = () => {
    const { trips, stays } = getDisplayProgramme();
    const periods = splitServicePeriods(trips, stays);
    return periods[activePeriod] || periods.at(-1);
  };
  const getDisplayBounds = () => periodBounds(getDisplayPeriod(), { startTime: getShiftStartTime(), endTime: getShiftEndTime() });
  const settleStayChanges = async () => {
    if (dirtyStay) await runStayAdjustment(dirtyStay);
    else if (adjustmentPending && adjustmentTask) await adjustmentTask;
    return !disposed && !dirtyStay && !adjustmentPending && !adjustmentError;
  };
  let loadedShiftForDepotState = null;
  let loadedShiftInfoForDepotState = null;
  let initialSelectedTripDbIds = new Set();
  let editRouteReconstructionBlocked = isEditMode;
  let saving = false;
  const composer = initializeShiftComposer({
    form,
    updateFeedback,
    isEditMode,
    onOpenStays: () => stayControls.open(),
    onLeaveStays: () => stayControls.leave(),
    readState: () => ({ ...getDisplayProgramme(), depots: loadedDepots, activeTrips: getDisplayPeriod().trips, activePeriod, activeBounds: periodBounds(getDisplayPeriod(), { startTime: startTimeInput.value, endTime: resolveShiftEndTime(startTimeInput.value, endTimeInput.value) }), adjusting: adjustmentPending || previewPending || bulkAdding }),
    isTimetableReady: () => isEditMode || Boolean(selectedDataset),
    prepareReview: async () => {
      return await settleStayChanges() && !bulkAdding;
    },
    validateTrips: () => {
      if (dirtyStay) {
        const change = dirtyStay;
        dirtyStay = null;
        void runStayAdjustment(change);
        return t('shifts.stay_adjusting');
      }
      if (adjustmentPending) return t('shifts.stay_adjusting');
      if (adjustmentError) return t(adjustmentError);

      const stayError = validateDepotStays({ trips: selectedTrips, stays: depotStays, depots: loadedDepots,
        startTime: getShiftStartTime(), endTime: getShiftEndTime() });
      if (stayError) return t(stayError);
      const seen = new Set();
      for (const period of getPeriods()) {
        let previous = null;
        const bounds = periodBounds(period, { startTime: getShiftStartTime(), endTime: getShiftEndTime() });
        for (const trip of period.trips) {
          const eligibility = evaluateTripEligibility({ trip, selectedTripIds: seen,
            lastTripEndTime: previous?.arrival_time, lastTripEndStop: previous?.end_stop_name,
            shiftStartTime: bounds.startTime, shiftEndTime: bounds.endTime });
          // Uniqueness is global; spatial continuity applies inside each period.
          if (!eligibility.valid) return getTripValidationMessage(eligibility);
          seen.add(resolveTripId(trip));
          previous = trip;
        }
      }
      stayUndoGroup = null;
      return '';
    },
  });
  cleanupHandlers.push(composer.cleanup);
  const searchInput = form.querySelector('#composer-search');
  const undoButton = form.querySelector('[data-action="undo-trips"]');
  let tripHistory = [];
  const rememberTrips = ({ groupKey = null } = {}) => {
    if (groupKey && stayUndoGroup?.key === groupKey && stayUndoGroup.length === tripHistory.length) return;
    tripHistory.push({ trips: [...selectedTrips], stays: structuredClone(depotStays), activePeriod });
    if (tripHistory.length > 30) tripHistory.shift();
    stayUndoGroup = groupKey ? { key: groupKey, length: tripHistory.length } : null;
  };

  const dedupeTrips = (trips = []) => {
    const seenTripIds = new Set();
    const seenDbIds = new Set();

    return (Array.isArray(trips) ? trips : [])
      .filter((trip) => {
        const tripId = resolveTripId(trip);
        const dbId = trip?.id;
        const isDuplicateByTripId = tripId && seenTripIds.has(tripId);
        const isDuplicateByDbId = dbId && seenDbIds.has(dbId);

        if (isDuplicateByTripId || isDuplicateByDbId) {
          return false;
        }

        if (tripId) seenTripIds.add(tripId);
        if (dbId) seenDbIds.add(dbId);
        return true;
      })
      .sort((a, b) => {
        const timeA = a?.departure_time || "";
        const timeB = b?.departure_time || "";
        return timeA.localeCompare(timeB);
      });
  };

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
          startTimeInput.value = toClockTime(earliest);
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
          endTimeInput.value = toClockTime(latest);
        }
      }
    }
  };

  const getScheduledTripsRenderState = () => ({
    trips: currentTrips.filter((trip) => {
      const query = searchInput?.value.trim().toLocaleLowerCase() || '';
      return !query || [trip.start_stop_name, trip.end_stop_name, trip.departure_time, trip.arrival_time]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    }),
    period: getDisplayPeriod(),
    routeLabel: routesById[lineSelect?.value ?? ""] ?? "",
    selectedTripIds: stayPreview ? new Set(stayPreview.trips.map(resolveTripId)) : selectedTripIds,
    lastTripEndTime: getLatestEndTime(),
    lastTripEndStop: getLastTripEndStop(),
    shiftStartTime: getDisplayBounds().startTime,
    shiftEndTime: getDisplayBounds().endTime,
  });

  const getEndDepotId = () =>
    endDepotSelect instanceof HTMLSelectElement ? endDepotSelect.value.trim() : "";

  const getIsShiftClosedAtDepot = () =>
    isShiftClosedAtDepot({
      selectedTrips,
      endDepotId: getEndDepotId(),
      loadedDepots,
      shift: loadedShiftForDepotState,
      shiftInfo: loadedShiftInfoForDepotState,
      initialSelectedTripDbIds,
    });

  const getScheduledTripsEmptyMessage = (eligibleTripsCount = 0) => {
    const messageKey = resolveScheduledTripsEmptyMessageKey({
      eligibleTripsCount,
      currentTripsCount: currentTrips.length,
      isClosedAtDepot: getIsShiftClosedAtDepot(),
    });
    return messageKey ? t(messageKey) : "";
  };

  const insertionPeriod = trip => getPeriods().find(period => {
    const bounds = periodBounds(period, { startTime: getShiftStartTime(), endTime: getShiftEndTime() });
    return serviceMinutes(trip.departure_time) >= serviceMinutes(bounds.startTime)
      && serviceMinutes(trip.arrival_time) <= serviceMinutes(bounds.endTime);
  });
  const periodCandidates = (state) => isEditMode ? state.trips.flatMap(trip => {
    const period = insertionPeriod(trip);
    if (!period) return [];
    const bounds = periodBounds(period, { startTime: getShiftStartTime(), endTime: getShiftEndTime() });
    const insertion = planPeriodTripInsertion({ trip, period, selectedTripIds: state.selectedTripIds, ...bounds });
    return insertion && !insertion.removedTrips.length ? [{ ...trip, programmeInsertion: insertion, programmePeriod: period }] : [];
  }) : depotStays.length ? state.trips.flatMap(trip => {
    const insertion = planPeriodTripInsertion({ trip, period: state.period, selectedTripIds: state.selectedTripIds,
      startTime: state.shiftStartTime, endTime: state.shiftEndTime });
    return insertion ? [{ ...trip, programmeInsertion: insertion }] : [];
  }) : getEligibleScheduledTrips(state);

  const resolvePeriodCandidates = async (state) => {
    const candidates = periodCandidates(state);
    if (!depotStays.length && !isEditMode) return candidates;
    const valid = await mapWithLimit(candidates, async trip => {
      const { index, trips } = trip.programmeInsertion;
      const period = trip.programmePeriod || state.period;
      const replacing = trip.programmeInsertion.removedTrips.length > 0;
      const checkOuter = isEditMode || replacing;
      const start = period.precedingStay || (checkOuter ? { depotId: startDepotSelect.value,
        arrivalTime: getShiftStartTime(), departureTime: getShiftStartTime() } : null);
      const end = period.followingStay || (checkOuter ? { depotId: endDepotSelect.value,
        arrivalTime: getShiftEndTime(), departureTime: getShiftEndTime() } : null);
      for (const [boundary, direction] of [
        [index === 0 && start, 'to_stop'],
        [index === trips.length - 1 && end, 'from_stop'],
      ]) {
        if (!boundary) continue;
        const customStop = loadedDepots.find(stop => stop.id === boundary.depotId);
        if (!customStop || !boundary.arrivalTime || !boundary.departureTime) return null;
        const duration = await travelMinutes(trip, customStop, direction);
        if (direction === 'to_stop' && serviceMinutes(boundary.departureTime) + duration > serviceMinutes(trip.departure_time)) return null;
        if (direction === 'from_stop' && serviceMinutes(trip.arrival_time) + duration > serviceMinutes(boundary.arrivalTime)) return null;
      }
      return trip;
    });
    return valid.filter(Boolean);
  };

  const refreshScheduledTrips = () => {
    const generation = ++eligibleGeneration;
    if (dirtyStay && !stayPreview && !previewPending) {
      clearNode(scheduledTripsBody);
      if (addAllTripsButton) addAllTripsButton.disabled = true;
      updateEmptyState(scheduledTripsEmpty, false, t('shifts.stay_commit_hint'));
      return [];
    }
    if (tripsLoading || adjustmentPending || previewPending || bulkAdding) {
      renderTripsLoading(scheduledTripsBody);
      if (addAllTripsButton) addAllTripsButton.disabled = true;
      updateEmptyState(scheduledTripsEmpty, true);
      return [];
    }
    if (tripLoadError) {
      clearNode(scheduledTripsBody);
      if (addAllTripsButton) addAllTripsButton.disabled = true;
      updateEmptyState(scheduledTripsEmpty, false, `${t('shifts.unable_to_load_trips')} ${errorMessage(tripLoadError, 'common.unknown_error')}`);
      return [];
    }
    const state = getScheduledTripsRenderState();
    const apply = eligibleTrips => {
      if (disposed || generation !== eligibleGeneration) return;
      renderScheduledTrips({ tbody: scheduledTripsBody, ...state, eligibleTrips });
      if (addAllTripsButton) addAllTripsButton.disabled = !eligibleTrips.some(trip => !trip.programmeInsertion?.removedTrips.length) || bulkAdding;
      updateEmptyState(scheduledTripsEmpty, eligibleTrips.length > 0,
        searchInput?.value.trim() ? t('shifts.no_trips_match') : getScheduledTripsEmptyMessage(eligibleTrips.length));
    };
    if (!depotStays.length && !isEditMode) {
      const eligible = periodCandidates(state);
      apply(eligible);
      return eligible;
    }
    renderTripsLoading(scheduledTripsBody);
    if (addAllTripsButton) addAllTripsButton.disabled = true;
    updateEmptyState(scheduledTripsEmpty, true);
    void resolvePeriodCandidates(state).then(apply).catch(() => {
      if (disposed || generation !== eligibleGeneration) return;
      clearNode(scheduledTripsBody);
      updateEmptyState(scheduledTripsEmpty, false, t('shifts.stay_routing_error'));
    });
    return [];
  };

  const updateShiftTrips = ({ renderStays = true } = {}) => {
    if (renderStays) stayControls.render();
    composer.update();
    if (!saving && !editRouteReconstructionBlocked) submitButton.disabled = adjustmentPending || bulkAdding;
    undoButton.disabled = tripHistory.length === 0;
    const shownTrips = isEditMode ? selectedTrips : getDisplayPeriod().trips;
    renderShiftTrips(shiftTripsBody, shownTrips);
    shiftTripsBody.setAttribute('aria-busy', String(previewPending || adjustmentPending));
    if (adjustmentPending || bulkAdding) shiftTripsBody.querySelectorAll('button').forEach(button => { button.disabled = true; });
    updateEmptyState(shiftTripsEmpty, shownTrips.length > 0);
    if (removeAllTripsButton instanceof HTMLButtonElement) {
      removeAllTripsButton.disabled = selectedTrips.length === 0 || adjustmentPending || bulkAdding;
    }
  };

  // Update the shift timeline visualization
  const updateTimeline = () => {
    if (!timelineContainer) {
      return;
    }
    
    const startDepotSel = form.querySelector('[data-field="start-depot"]');
    const endDepotSel = form.querySelector('[data-field="end-depot"]');
    const startDepotName = startDepotSel?.value ? (startDepotSel.selectedOptions?.[0]?.textContent || "") : "";
    const endDepotName = endDepotSel?.value ? (endDepotSel.selectedOptions?.[0]?.textContent || "") : "";
    
    renderTimeline(timelineContainer, selectedTrips, {
      startDepotName,
      endDepotName,
      startTime: getShiftStartTime() || "",
      endTime: getShiftEndTime() || "",
      depotTrips: buildProgrammeMovements({ trips: selectedTrips, stays: depotStays, depots: loadedDepots,
        startDepotId: startDepotSelect.value, endDepotId: endDepotSelect.value,
        startTime: getShiftStartTime(), endTime: getShiftEndTime() }).filter(item => item.kind === 'connection'),
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
    return getActivePeriod().trips.at(-1)?.arrival_time || getActivePeriod().precedingStay?.departureTime || null;
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
    return resolveShiftEndTime(startTimeInput?.value, value) || null;
  };

  const isTripSelectionReady = () => {
    const lineValue = lineSelect instanceof HTMLSelectElement ? lineSelect.value.trim() : "";
    const dayValue = daySelect instanceof HTMLSelectElement ? daySelect.value.trim() : "";
    const startTimeValue = getShiftStartTime() ?? "";
    const endTimeValue = getShiftEndTime() ?? "";
    const startDepotValue =
      startDepotSelect instanceof HTMLSelectElement ? startDepotSelect.value.trim() : "";
    const endDepotValue =
      endDepotSelect instanceof HTMLSelectElement ? endDepotSelect.value.trim() : "";

    return Boolean(
      lineValue &&
      dayValue &&
      startTimeValue &&
      endTimeValue &&
      startDepotValue &&
      endDepotValue
    );
  };

  const resetScheduledTrips = (message) => {
    tripLoadError = null;
    tripsLoading = false;
    currentTrips = [];
    clearNode(scheduledTripsBody);
    if (addAllTripsButton instanceof HTMLButtonElement) {
      addAllTripsButton.disabled = true;
    }
    updateEmptyState(scheduledTripsEmpty, false, message);
  };

  // Get the end stop name of the last selected trip (where the bus currently is)
  // Returns normalized (trimmed) string for consistent comparison
  const getLastTripEndStop = () => {
    return getActivePeriod().trips.at(-1)?.end_stop_name || null;
  };

  const getTripValidationMessage = (eligibility) => {
    switch (eligibility?.reason) {
      case "before_shift_start":
        return (
          t("shifts.trip_departs_before", {
            departure: eligibility?.departure ?? "",
            start: eligibility?.boundary ?? "",
          }) ||
          `Trip departs at ${eligibility?.departure ?? ""} but the vehicle block starts at ${eligibility?.boundary ?? ""}. The bus cannot be at a stop before leaving the custom stop.`
        );
      case "after_shift_end":
        return (
          t("shifts.trip_arrives_after", {
            arrival: eligibility?.arrival ?? "",
            end: eligibility?.boundary ?? "",
          }) ||
          `Trip arrives at ${eligibility?.arrival ?? ""} but the vehicle block ends at ${eligibility?.boundary ?? ""}. The bus must reach the final custom stop by the vehicle block end time.`
        );
      case "location_mismatch":
        return (
          t("shifts.trip_wrong_start", {
            startStop: eligibility?.startStop ?? "",
            endStop: eligibility?.endStop ?? "",
          }) ||
          `Trip starts at "${eligibility?.startStop ?? ""}" but the bus is at "${eligibility?.endStop ?? ""}". The next trip must start from where the previous trip ended.`
        );
      case "overlap":
        return (
          t("shifts.trips_overlap", {
            departure: eligibility?.departure ?? "",
            arrival: eligibility?.boundary ?? "",
          }) ||
          `Trip starts at ${eligibility?.departure ?? ""} but the latest trip ends at ${eligibility?.boundary ?? ""}. Trips cannot overlap.`
        );
      default:
        return "";
    }
  };

  const addTrip = (trip, { silent = false, remember = true, render = true } = {}) => {
    const normalized = normalizeTrip(trip);
    const id = resolveTripId(normalized);
    if (!id || selectedTripIds.has(id) || adjustmentPending || saving || (bulkAdding && remember)) {
      return false;
    }

    const period = isEditMode ? insertionPeriod(normalized) : getActivePeriod();
    if (!period) return false;
    const bounds = periodBounds(period, { startTime: getShiftStartTime(), endTime: getShiftEndTime() });
    const insertion = depotStays.length || isEditMode ? planPeriodTripInsertion({ trip: normalized, period, selectedTripIds,
      startTime: bounds.startTime, endTime: bounds.endTime }) : null;
    const eligibility = depotStays.length || isEditMode ? { valid: Boolean(insertion) && (!isEditMode || !insertion.removedTrips.length) } : evaluateTripEligibility({
      trip: normalized, selectedTripIds, lastTripEndTime: getLatestEndTime(), lastTripEndStop: getLastTripEndStop(),
      shiftStartTime: bounds.startTime, shiftEndTime: bounds.endTime,
    });
    if (!eligibility.valid) {
      if (!silent) updateFeedback(feedback, () => getTripValidationMessage(eligibility), 'error');
      return false;
    }
    if (remember) rememberTrips();
    invalidateAdjustment();
    if (insertion) {
      const offset = period.trips.length ? selectedTrips.indexOf(period.trips[0]) : selectedTrips.length;
      selectedTrips = [...selectedTrips.slice(0, offset), ...insertion.trips, ...selectedTrips.slice(offset + period.trips.length)];
      if (period.followingStay) period.followingStay.afterTripId = insertion.trips.at(-1).id;
      currentTrips = dedupeTrips([...currentTrips, ...insertion.removedTrips]);
      if (insertion.removedTrips.length) {
        const stay = period.precedingStay || period.followingStay;
        adjustmentSummary = { index: depotStays.indexOf(stay), kind: 'trip-insertion', removedTrips: insertion.removedTrips, adjustedTimes: [] };
        if (!silent) updateFeedback(feedback, () => t('shifts.trip_replaced', { count: insertion.removedTrips.length }), 'info');
      }
    } else {
      const last = period.trips.at(-1);
      const insertAt = last ? selectedTrips.indexOf(last) + 1 : selectedTrips.length;
      selectedTrips = [...selectedTrips.slice(0, insertAt), normalized, ...selectedTrips.slice(insertAt)];
    }
    selectedTripIds.clear();
    selectedTrips.forEach(trip => selectedTripIds.add(resolveTripId(trip)));
    if (render) {
      updateShiftTrips();
      refreshScheduledTrips();
      updateTimeline();
    }
    return true;
  };

  const removeTrip = (id) => {
    if (adjustmentPending || bulkAdding || saving) return false;
    if (!selectedTripIds.has(id)) {
      return false;
    }

    rememberTrips();
    invalidateAdjustment();
    const removedTrip = selectedTrips.find((trip = {}) => resolveTripId(trip) === id);
    const removedTripDbId = removedTrip?.id || id;

    const period = getPeriods().find(item => item.trips.some(trip => resolveTripId(trip) === id));
    const remaining = period?.trips.filter(trip => resolveTripId(trip) !== id) || [];
    if (!remaining.length) {
      const adjacent = period?.followingStay || period?.precedingStay;
      depotStays = depotStays.filter(stay => stay !== adjacent);
    } else if (period.followingStay?.afterTripId === removedTripDbId) {
      period.followingStay.afterTripId = remaining.at(-1).id;
    }
    activePeriod = Math.min(activePeriod, depotStays.length);
    selectedTripIds.delete(id);

    selectedTrips = selectedTrips.filter((trip = {}) => {
      const tripId = resolveTripId(trip);
      return tripId && tripId !== id;
    });

    const existsInCurrentTrips = currentTrips.some((trip) => {
      const existingTripId = resolveTripId(trip);
      const existingDbId = trip?.id;
      return (existingTripId && existingTripId === id) ||
        (existingDbId && removedTripDbId && existingDbId === removedTripDbId);
    });

    if (removedTrip && !existsInCurrentTrips) {
      currentTrips = [...currentTrips, removedTrip];
    }

    currentTrips = dedupeTrips(currentTrips);

    updateShiftTrips();
    refreshScheduledTrips();
    updateTimeline();
    return true;
  };

  const addAllTrips = async () => {
    if ((dirtyStay || adjustmentPending) && !await settleStayChanges()) return;
    if (tripsLoading || adjustmentPending || bulkAdding || saving) return;
    bulkAdding = true;
    const before = { trips: [...selectedTrips], stays: structuredClone(depotStays), activePeriod };
    rememberTrips();
    const historyLength = tripHistory.length;
    updateShiftTrips({ renderStays: false });
    refreshScheduledTrips();
    let addedCount = 0;
    let routingFailed = false;
    let expectedRevision = adjustmentRevision;
    const initialPeriod = activePeriod;
    const maxIterations = Array.isArray(currentTrips) ? currentTrips.length : 0;

    for (let index = 0; index < maxIterations; index += 1) {
      let eligibleTrips;
      try { eligibleTrips = await resolvePeriodCandidates(getScheduledTripsRenderState()); }
      catch { routingFailed = true; break; }
      if (disposed || expectedRevision !== adjustmentRevision || initialPeriod !== activePeriod) break;
      const nextTrip = eligibleTrips.find(trip => !trip.programmeInsertion?.removedTrips.length);
      if (!nextTrip) {
        break;
      }
      if (!addTrip(nextTrip, { silent: true, remember: false, render: false })) {
        break;
      }
      expectedRevision = adjustmentRevision;
      addedCount += 1;
    }

    bulkAdding = false;
    if (disposed) return;
    updateShiftTrips();
    refreshScheduledTrips();
    updateTimeline();
    if (expectedRevision !== adjustmentRevision || initialPeriod !== activePeriod) return;
    if (routingFailed) {
      updateFeedback(feedback, () => t('shifts.stay_routing_error'), 'error');
      return;
    }
    if (addedCount === 0) {
      if (tripHistory.length === historyLength && tripHistory.at(-1)?.trips.every((trip, i) => trip === before.trips[i])) tripHistory.pop();
      updateShiftTrips();
      updateFeedback(
        feedback,
        () => getScheduledTripsEmptyMessage(0) ||
          t("shifts.no_valid_trips_to_add") ||
          "No trips can be added with the current period time limits.",
        "info"
      );
      return;
    }

    updateFeedback(
      feedback,
      () => t("shifts.bulk_added_trips", { count: addedCount }) ||
        `${addedCount} trip(s) added to the vehicle block.`,
      "success"
    );
  };

  const removeAllTrips = () => {
    if (selectedTrips.length === 0) {
      updateFeedback(
        feedback,
        () => t("shifts.no_trips_to_remove"),
        "info"
      );
      return;
    }

    const removedCount = selectedTrips.length;
    rememberTrips();
    invalidateAdjustment();
    currentTrips = dedupeTrips([...currentTrips, ...selectedTrips]);
    selectedTrips = [];
    depotStays = [];
    activePeriod = 0;
    selectedTripIds.clear();

    updateShiftTrips();
    refreshScheduledTrips();
    updateTimeline();
    updateFeedback(
      feedback,
      () => t("shifts.bulk_removed_trips", { count: removedCount }) ||
        `${removedCount} trip(s) removed from the vehicle block.`,
      "success"
    );
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
      fallbackLabel ? toText(fallbackLabel) : toText(candidate);
    select.append(option);
    select.value = candidate;
  };

  const applyShiftPrefill = (
    shift = {},
    shiftInfo = null,
    { reconstructRoute = true } = {}
  ) => {
    loadedShiftForDepotState = shift;
    loadedShiftInfoForDepotState = shiftInfo;

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
    const modelsById = getModelsById();
    const modelId = firstAvailable(
      shift?.bus?.bus_model_id,
      shift?.bus_model_id,
      shift?.busModelId
    );
    const modelLabel = modelId ? toText(modelsById?.[text(modelId)]?.name ?? "") : "";
    prefillSelectValue(
      busSelect,
      busId,
      modelLabel
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
      startTimeInput.value = toClockTime(startTime);
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
      endTimeInput.value = toClockTime(endTime);
    }

    const { startDepotId, endDepotId } = resolveShiftDepotIds({
      shift,
      shiftInfo,
      loadedDepots,
    });
    const startDepotLabel = firstAvailable(
      shift?.start_depot_name,
      shift?.startDepotName,
      shift?.start_depot?.name,
      shift?.startDepot?.name,
      loadedDepots.find((depot) => text(depot?.id) === text(startDepotId))?.name
    );
    const endDepotLabel = firstAvailable(
      shift?.end_depot_name,
      shift?.endDepotName,
      shift?.end_depot?.name,
      shift?.endDepot?.name,
      loadedDepots.find((depot) => text(depot?.id) === text(endDepotId))?.name
    );

    prefillSelectValue(startDepotSelect, startDepotId, startDepotLabel);
    prefillSelectValue(endDepotSelect, endDepotId, endDepotLabel);

    let trips = [];
    if (reconstructRoute) {
      const programme = readShiftDepotStays({ shift, shiftInfo, depots: loadedDepots });
      depotStays = programme.stays;
      existingConnections = programme.connections;
      activePeriod = depotStays.length;
      // Service selection and depot stays have independent editable state.
      trips = programme.trips;
      selectedTrips = trips;
      selectedTripIds.clear();
      initialSelectedTripDbIds = new Set([...programme.trips, ...programme.connections].map(trip => trip.id));
      trips.forEach((trip = {}) => {
        const id = resolveTripId(trip);
        const dbId = text(trip?.id).trim();
        if (id) {
          selectedTripIds.add(id);
        }
        if (dbId) {
          initialSelectedTripDbIds.add(dbId);
        }
      });
    } else {
      selectedTrips = [];
      selectedTripIds.clear();
      initialSelectedTripDbIds = new Set();
    }

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
        dayDisplayValue.textContent = daySelect?.selectedOptions?.[0]?.textContent || resolvedDayLabel || "—";
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
    refreshScheduledTrips();
    updateTimeline();

    if (
      lineSelect instanceof HTMLSelectElement &&
      daySelect instanceof HTMLSelectElement &&
      lineSelect.value &&
      daySelect.value
    ) {
      // Overnight GTFS trips use extended hours in the selected service day.
      loadTrips();
    }
  };

  const loadBuses = async () => {
    try {
      const userId = await resolveUserId().catch(() => null);
      if (!userId) {
        throw localizedError("shifts.login_required");
      }
      const [payload, models] = await Promise.all([
        fetchAllBuses(),
        // Bus models are paginated server-side — page through them with
        // the dedicated helper rather than requesting an oversized page.
        fetchAllBusModels({ userId: userId || "" }),
      ]);

      const buses =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );

      const filteredBuses =
        userId && Array.isArray(buses) ?
          buses.filter((bus) => bus?.user_id === userId)
        : (buses ?? []);

      const filteredModels =
        userId && Array.isArray(models) ?
          models.filter((model) => text(model?.user_id) === userId)
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
        () => `${t("shifts.unable_to_load_buses")} ${errorMessage(error, "common.unknown_error")}`,
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
        fetchAllDepots(),
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
        () => `${t("shifts.unable_to_load_depots")} ${errorMessage(error, "common.unknown_error")}`,
        "error"
      );
    }
  };

  const loadRoutes = async () => {
    const generation = datasetGeneration;
    const requestedDataset = selectedDataset;
    if (!requestedDataset) {
      routesById = renderRouteOptions(lineSelect, []);
      return;
    }
    try {
      // Get the user's agency ID to filter routes
      const agencyId = await resolveAgencyId().catch(() => "");
      
      let payload;
      if (agencyId) {
        // Fetch only routes belonging to the user's agency/company
        payload = await fetchRoutesByAgency(agencyId, requestedDataset);
      } else {
        // Fallback to all routes if no agency is set (shouldn't happen in production)
        console.warn("No agency ID found - showing all routes. This may include routes from other companies.");
        payload = await fetchAllRoutes(requestedDataset);
      }
      
      const routes =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );
      if (disposed || generation !== datasetGeneration) return;
      routesById = renderRouteOptions(lineSelect, routes);
    } catch (error) {
      if (disposed || generation !== datasetGeneration) return;
      console.error("Failed to load routes", error);
      routesById = renderRouteOptions(lineSelect, []);
      updateFeedback(
        feedback,
        () => `${t("shifts.unable_to_load_routes")} ${errorMessage(error, "common.unknown_error")}`,
        "error"
      );
    }
  };

  const showDataset = () => {
    if (!datasetSummary) return;
    if (datasetStatus !== "ready") {
      datasetSummary.textContent = t(datasetStatus === "error" ? "gtfs.load_error" : "gtfs.loading");
    } else if (!isEditMode && !datasets.length) {
      datasetSummary.textContent = t("gtfs.no_datasets");
    } else {
      datasetSummary.innerHTML = datasetSummaryHtml(isEditMode ? savedShiftDatasets : [selectedDataset], t);
    }
  };
  const loadDatasets = async (shift) => {
    datasetStatus = "loading";
    if (datasetSummary) datasetSummary.textContent = t("gtfs.loading");
    try {
      datasets = sortDatasets(await fetchGtfsDatasets());
      if (disposed) return;
      datasetStatus = "ready";
      if (isEditMode) {
        const saved = shift?.gtfs_datasets;
        savedShiftDatasets = saved;
        selectedDataset = saved?.length === 1 ? saved[0] : null;
        showDataset();
      } else {
        selectedDataset = datasets[0] ?? null;
        if (datasetSelect) {
          datasetSelect.innerHTML = datasets.map((d) => `<option value="${textContent(datasetKey(d))}">${textContent(datasetLabel(d, t))}</option>`).join("");
          datasetSelect.disabled = datasets.length === 0;
        }
        showDataset();
        if (!datasets.length && datasetSummary) datasetSummary.textContent = t("gtfs.no_datasets");
      }
      await loadRoutes();
    } catch (error) {
      if (disposed) return;
      selectedDataset = null;
      datasetStatus = "error";
      showDataset();
      updateFeedback(feedback, () => t("gtfs.load_error"), "error");
    }
  };
  const handleDatasetChange = async () => {
    if (isEditMode || !datasetSelect) return;
    const next = datasets.find((d) => datasetKey(d) === datasetSelect.value);
    if (!next || datasetKey(next) === datasetKey(selectedDataset)) return;
    if (selectedTrips.length && !window.confirm(t("gtfs.confirm_change"))) {
      datasetSelect.value = datasetKey(selectedDataset);
      return;
    }
    invalidateAdjustment();
    selectedDataset = next;
    tripHistory = [];
    if (searchInput) searchInput.value = '';
    datasetGeneration++;
    tripGeneration++;
    selectedTrips = [];
    depotStays = [];
    activePeriod = 0;
    selectedTripIds.clear();
    currentTrips = [];
    routesById = renderRouteOptions(lineSelect, []);
    resetScheduledTrips(t("shifts.select_line_and_day"));
    updateShiftTrips();
    updateTimeline();
    showDataset();
    await loadRoutes();
  };
  datasetSelect?.addEventListener("change", handleDatasetChange);
  cleanupHandlers.push(() => datasetSelect?.removeEventListener("change", handleDatasetChange));

  const loadDays = async () => {
    // The backend has no /gtfs-days endpoint.  Weekday values are the stable
    // contract consumed by /gtfs-trips/by-route, so populate them locally and
    // avoid a guaranteed 404 every time the form opens.
    populateDayOptions(daySelect, DAYS_OF_WEEK);
  };

  const loadTrips = async () => {
    tripLoadError = null;
    const generation = ++tripGeneration;
    const editionGeneration = datasetGeneration;
    if (!lineSelect || !daySelect || !scheduledTripsBody) {
      return;
    }

    const routeId = lineSelect.value;
    const day = daySelect.value;

    if (!selectedDataset || !routeId || !day) {
      resetScheduledTrips(t("shifts.select_line_and_day"));
      return;
    }

    tripsLoading = true;
    renderTripsLoading(scheduledTripsBody);
    if (addAllTripsButton) addAllTripsButton.disabled = true;
    updateEmptyState(scheduledTripsEmpty, true);

    try {
      const daysToFetch = [day];

      const results = await Promise.all(
        daysToFetch.map((d) =>
          fetchTripsByRoute({ routeId, dayOfWeek: d })
        )
      );

      if (disposed || generation !== tripGeneration || editionGeneration !== datasetGeneration) return;
      tripsLoading = false;
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
      currentTrips = normalizeOperationalTripCandidates(
        normalizedTrips.filter((trip) => {
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
      ).sort((a, b) => {
          const timeA = a.departure_time || "";
          const timeB = b.departure_time || "";
          return timeA.localeCompare(timeB);
        });

      refreshScheduledTrips();
      syncSelectedTripsWithCurrent();
    } catch (error) {
      console.error("Failed to load trips", error);
      if (disposed || generation !== tripGeneration || editionGeneration !== datasetGeneration) return;
      resetScheduledTrips(error?.message ?? t("shifts.unable_to_load_trips"));
      tripLoadError = error;
      refreshScheduledTrips();
    }
  };

  const previewStayAdjustment = async (change, revision) => {
    let result;
    try {
      result = await adjustStayProgramme({ trips: [...selectedTrips], stays: structuredClone(depotStays), ...change,
        depots: loadedDepots, startTime: getShiftStartTime(), endTime: getShiftEndTime(), travelMinutes });
    } catch { result = { status: 'error', key: 'shifts.stay_routing_error' }; }
    if (disposed || revision !== adjustmentRevision || !dirtyStay) return;
    previewPending = false;
    // Preview from the committed selection every time: intermediate keystrokes
    // must never permanently remove trips or rewrite either time input.
    stayPreview = result.status === 'ready' && !result.adjustedTimes.length ? result : null;
    if (result.status === 'error') updateFeedback(feedback, () => t(result.key), 'error');
    updateShiftTrips();
    refreshScheduledTrips();
  };
  const runStayAdjustment = (change) => {
    clearTimeout(previewTimer);
    previewPending = false;
    adjustmentTask = performStayAdjustment(change);
    return adjustmentTask;
  };
  const performStayAdjustment = async ({ index, field, explicitDay = false }) => {
    const revision = ++adjustmentRevision;
    adjustmentIndex = index;
    dirtyStay = null;
    adjustmentPending = true;
    adjustmentError = '';
    updateShiftTrips({ renderStays: false });
    refreshScheduledTrips();
    updateFeedback(feedback, () => t('shifts.stay_adjusting'), 'info');
    let result;
    try {
      result = await adjustStayProgramme({ trips: [...selectedTrips], stays: structuredClone(depotStays), index, field, explicitDay,
        depots: loadedDepots, startTime: getShiftStartTime(), endTime: getShiftEndTime(), travelMinutes });
    } catch { result = { status: 'error', key: 'shifts.stay_routing_error' }; }
    if (disposed || revision !== adjustmentRevision) return;
    adjustmentPending = false;
    stayControls.acceptDraft();
    stayPreview = null;
    if (result.status === 'ready') {
      if (field === 'arrivalTime') activePeriod = index;
      if (field === 'departureTime') activePeriod = index + 1;
      const removed = adjustmentSummary?.index === index ? adjustmentSummary.removedTrips : [];
      selectedTrips = result.trips;
      depotStays = result.stays;
      currentTrips = dedupeTrips([...currentTrips, ...result.removedTrips]);
      selectedTripIds.clear();
      selectedTrips.forEach(trip => selectedTripIds.add(resolveTripId(trip)));
      adjustmentSummary = { index,
        removedTrips: [...new Map([...removed, ...result.removedTrips].map(trip => [trip.id, trip])).values()],
        adjustedTimes: result.adjustedTimes,
      };
      updateFeedback(feedback, () => t('shifts.stay_adjusted', { count: adjustmentSummary?.removedTrips.length || 0 }), 'info');
    } else if (result.status === 'error') {
      adjustmentError = result.key;
      updateFeedback(feedback, () => t(adjustmentError), 'error');
    } else {
      if (result.stays) depotStays = result.stays;
      updateFeedback(feedback, '');
    }
    updateShiftTrips({ renderStays: result.status !== 'incomplete' || Boolean(result.stays) });
    refreshScheduledTrips();
    updateTimeline();
  };

  const proposalCandidates = new Map();
  const loadProposalCandidates = async () => {
    const day = daySelect.value;
    if (!day) throw new Error('Missing service day');
    // Every line already present in the block participates, independently of
    // the line/search filters currently visible in the ordinary trip list.
    const routes = [...new Set(selectedTrips.map(trip => trip.route_id).filter(Boolean))];
    const groups = await mapWithLimit(routes, routeId => {
      const key = JSON.stringify([routeId, day]);
      if (!proposalCandidates.has(key)) proposalCandidates.set(key, fetchTripsByRoute({ routeId, dayOfWeek: day })
        .then(payload => {
          const trips = Array.isArray(payload) ? payload : payload?.items ?? payload?.results;
          if (!Array.isArray(trips)) throw new Error('Invalid trips response');
          return trips;
        })
        .catch(error => { proposalCandidates.delete(key); throw error; }));
      return proposalCandidates.get(key);
    });
    return normalizeOperationalTripCandidates(groups.flat().map(normalizeTrip));
  };
  const stayControls = isEditMode ? initializeShiftStayEditor({ form,
    readState: () => ({ trips: selectedTrips, stays: depotStays, depots: loadedDepots,
      disabled: saving || editRouteReconstructionBlocked || bulkAdding,
      overnight: serviceMinutes(getShiftEndTime()) >= 1440,
      scope: t('shifts.editor_scope', { day: daySelect.selectedOptions[0]?.textContent || '—' }),
    }),
    propose: async stays => {
      if (!daySelect.value) return { status: 'error', key: 'shifts.editor_select_day' };
      let candidates;
      try { candidates = await loadProposalCandidates(); }
      catch { return { status: 'error', key: 'shifts.unable_to_load_trips' }; }
      return rebuildStayProgramme({ trips: selectedTrips, previousStays: depotStays, stays,
        candidates, depots: loadedDepots, existingConnections,
        startDepotId: startDepotSelect.value, endDepotId: endDepotSelect.value,
        startTime: getShiftStartTime(), endTime: getShiftEndTime(), travelMinutes });
    },
    apply: proposal => {
      rememberTrips();
      invalidateAdjustment();
      currentTrips = dedupeTrips([...currentTrips, ...selectedTrips, ...proposal.addedTrips]);
      selectedTrips = proposal.trips;
      depotStays = proposal.stays;
      activePeriod = 0;
      selectedTripIds.clear();
      selectedTrips.forEach(trip => selectedTripIds.add(resolveTripId(trip)));
      updateShiftTrips(); refreshScheduledTrips(); updateTimeline();
      updateFeedback(feedback, () => t('shifts.editor_applied', { added: proposal.addedTrips.length, removed: proposal.removedTrips.length }), 'info');
    },
    close: () => composer.showProgramme(),
  }) : initializeDepotStayControls({ form,
    readState: () => ({ ...getDisplayProgramme(), depots: loadedDepots, activePeriod,
      adjustmentPending, adjustmentError, adjustmentIndex, adjustmentSummary }),
    onAction: ({ action, index, period, afterTripId, field, value, explicitDay }) => {
      if (saving) return;
      if (action === 'draft-stay' || action === 'change-stay') {
        if (stayUndoGroup?.key !== `stay-${index}` || stayUndoGroup.length !== tripHistory.length) adjustmentSummary = null;
        rememberTrips({ groupKey: `stay-${index}` });
        adjustmentRevision++;
        clearTimeout(previewTimer);
        eligibleGeneration++;
        adjustmentPending = false;
        adjustmentError = '';
        depotStays[index][field] = value;
        dirtyStay = { index, field, explicitDay };
        if (action === 'change-stay') void runStayAdjustment(dirtyStay);
        else {
          if (field === 'arrivalTime') activePeriod = index;
          if (field === 'departureTime') activePeriod = index + 1;
          previewPending = true;
          const revision = adjustmentRevision;
          previewTimer = setTimeout(() => void previewStayAdjustment({ index, field, explicitDay }, revision), 150);
          updateFeedback(feedback, '');
          updateShiftTrips();
          refreshScheduledTrips();
        }
        return;
      }
      if (action === 'retry-stay-adjustment') {
        void runStayAdjustment({ index, field: 'depotId' });
        return;
      }
      if (action === 'select-period') { activePeriod = period; stayUndoGroup = null; }
      else {
        rememberTrips();
        invalidateAdjustment();
        if (action === 'add-stay') {
          const trip = selectedTrips.find(item => item.id === afterTripId);
          if (!trip || depotStays.some(stay => stay.afterTripId === afterTripId)) return;
          depotStays.push({ afterTripId, depotId: endDepotSelect.value, arrivalTime: '', departureTime: '' });
          depotStays.sort((a, b) => selectedTrips.findIndex(trip => trip.id === a.afterTripId) - selectedTrips.findIndex(trip => trip.id === b.afterTripId));
          activePeriod = depotStays.findIndex(stay => stay.afterTripId === afterTripId) + 1;
        } else if (action === 'remove-stay') {
          depotStays.splice(index, 1);
          activePeriod = Math.min(activePeriod, depotStays.length);
        }
      }
      updateShiftTrips();
      refreshScheduledTrips();
      updateTimeline();
      updateFeedback(feedback, '');
    },
  });
  cleanupHandlers.push(stayControls.cleanup);

  const handleScheduledTripsClick = async (event) => {
    const button = event.target?.closest?.('button[data-action="add-trip"]');
    if (!button || button.disabled) {
      return;
    }

    const row = button.closest("tr");
    const id = readTripId(row);
    if (!id) {
      return;
    }
    if ((dirtyStay || adjustmentPending) && !await settleStayChanges()) return;

    const trip = currentTrips.find((item = {}) => {
      const tripId = resolveTripId(item);
      return tripId === id;
    });

    if (trip) {
      addTrip(trip);
    }
  };

  const handleShiftTripsClick = async (event) => {
    const button = event.target?.closest?.('button[data-action="remove-trip"]');
    if (!button) {
      return;
    }

    const row = button.closest("tr");
    const id = readTripId(row);
    if (!id) {
      return;
    }

    if ((dirtyStay || adjustmentPending) && !await settleStayChanges()) return;
    removeTrip(id);
  };

  const handleAddAllTripsClick = () => {
    addAllTrips();
  };

  const handleRemoveAllTripsClick = async () => {
    if ((dirtyStay || adjustmentPending) && !await settleStayChanges()) return;
    removeAllTrips();
  };
  const preserveTimeDraftForTripAction = event => {
    if (dirtyStay && event.target.closest('[data-action="add-trip"], [data-action="add-all-trips"], [data-action="remove-trip"], [data-action="remove-all-trips"]')) {
      // Commit from the click handler, after capturing the requested trip.
      // Native blur would otherwise replace that button before click arrives.
      event.preventDefault();
    }
  };
  form.addEventListener('pointerdown', preserveTimeDraftForTripAction);
  cleanupHandlers.push(() => form.removeEventListener('pointerdown', preserveTimeDraftForTripAction));

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
    if (saving) return;
    if (!composer.canSubmit()) return;

    updateFeedback(feedback, "");

    if (isEditMode && editRouteReconstructionBlocked) {
      updateFeedback(feedback, () => t("shifts.unable_to_load_for_edit"), "error");
      return;
    }

    if (!selectedDataset && !isEditMode) {
      updateFeedback(feedback, () => t("gtfs.no_datasets"), "error");
      return;
    }

    const serviceTripsForSave = filterServiceTripsForSave(selectedTrips);

    const { name, busId, tripIds, startTime, endTime, startDepotId, endDepotId } = buildShiftPayload({
      form,
      selectedTrips: serviceTripsForSave,
    });

    if (!name || !busId) {
      updateFeedback(feedback, () => t("shifts.name_bus_required"), "error");
      return;
    }

    if (!Array.isArray(tripIds) || tripIds.length === 0) {
      updateFeedback(feedback, () => t("shifts.add_at_least_one_trip"), "error");
      return;
    }

    if (!startDepotId || !endDepotId || !startTime || !endTime) {
      updateFeedback(feedback, () => t("shifts.depot_details_required"), "error");
      return;
    }

    saving = true;
    toggleFormDisabled(form, true);
    updateFeedback(feedback, () => t(isEditMode ? "shifts.updating" : "shifts.saving"), "info");

    try {
      showProgress(() => t(isEditMode ? "shifts.saving_shift" : "shifts.creating_shift"));

      // Get route info for auxiliary trips
      const firstTrip = serviceTripsForSave[0];
      const routeId = lineSelect?.value || firstTrip?.route_id || null;

      if (!routeId) {
        throw localizedError("shifts.depot_route_required");
      }

      const movements = buildProgrammeMovements({ trips: serviceTripsForSave, stays: depotStays, depots: loadedDepots,
        startDepotId, endDepotId, startTime, endTime });
      const allTripIds = await persistProgrammeMovements({ movements, existingConnections,
        fetchEdges: (tripId, movement) => {
          const key = movement.direction === 'departure' ? 'shifts.fetching_stops_first' : 'shifts.fetching_stops_last';
          updateFeedback(feedback, () => t(key), 'info');
          showProgress(() => t(key));
          return fetchTripStopEdges(tripId);
        },
        createConnection: async (connection) => {
          const key = connection.direction === 'departure' ? 'shifts.depot_departure_error' : 'shifts.depot_return_error';
          try { return await createAuxiliaryTrip(connection); }
          catch (error) { throw localizedError(key, () => ({ message: errorMessage(error, 'shifts.unable_to_save') })); }
        },
        routeId,
      });

      updateFeedback(
        feedback,
        () => isEditMode
          ? t("shifts.saving_shift")
          : t("shifts.creating_shift"),
        "info"
      );
      showProgress(
        () => isEditMode
          ? t("shifts.saving_shift")
          : t("shifts.creating_shift")
      );

      if (isEditMode) {
        await updateShift(shiftId, { name, busId, tripIds: allTripIds, startTime, endTime, startDepotId, endDepotId, gtfsDataset: selectedDataset });
        invalidateShiftDistanceCache(shiftId);
        updateFeedback(feedback, () => t("shifts.shift_updated"), "success");
        triggerPartialLoad("shifts", {
          flashMessage: t("shifts.shift_updated"),
          flashMessageKey: "shifts.shift_updated",
        });
        return;
      }

      await createShift({ name, busId, tripIds: allTripIds, startTime, endTime, startDepotId, endDepotId, gtfsDataset: selectedDataset });

      // Ensure PVGIS TMY + weather clustering data exist for the shift's location
      let weatherDataWarning = "";
      try {
        const pvgisTripId = firstTrip?.id || resolveTripPk(firstTrip);
        console.debug("[SHIFT][PVGIS] firstTrip:", firstTrip, "resolved trip ID:", pvgisTripId);
        if (pvgisTripId) {
          const stops = await fetchStopsByTripId(pvgisTripId);
          console.debug("[SHIFT][PVGIS] stops for trip:", stops?.length, "first stop:", stops?.[0]);
          const firstStop = Array.isArray(stops) && stops.length > 0 ? stops[0] : null;
          if (firstStop?.stop_lat != null && firstStop?.stop_lon != null) {
            const lat = Math.round(firstStop.stop_lat * 1000) / 1000;
            const lon = Math.round(firstStop.stop_lon * 1000) / 1000;
            console.debug("[SHIFT][PVGIS] Rounded coords:", { lat, lon, raw_lat: firstStop.stop_lat, raw_lon: firstStop.stop_lon });

            await fetchPvgisTmy({ latitude: lat, longitude: lon });
            console.debug("[SHIFT][PVGIS] TMY data ensured for:", { lat, lon });

            const existing = await fetchWeatherTemperatureClusters({ latitude: lat, longitude: lon });
            if (!existing) {
              await createWeatherTemperatureClusters({ latitude: lat, longitude: lon });
              console.debug("[SHIFT][PVGIS] Weather temperature clusters created for:", { lat, lon });
            } else {
              console.debug("[SHIFT][PVGIS] Weather temperature clusters already exist for:", { lat, lon });
            }
          } else {
            console.warn("[SHIFT][PVGIS] First stop missing stop_lat/stop_lon:", firstStop);
          }
        } else {
          console.warn("[SHIFT][PVGIS] Could not resolve trip ID from firstTrip:", firstTrip);
        }
      } catch (weatherErr) {
        console.warn("[SHIFT][PVGIS] PVGIS/clustering failed (non-blocking):", weatherErr);
        weatherDataWarning = weatherErr.message || t("common.unknown_error");
      }

      if (weatherDataWarning) {
        const msg =
          t("shifts.weather_data_warning", { message: weatherDataWarning });
        updateFeedback(feedback, () => t("shifts.weather_data_warning", { message: weatherDataWarning }), "error");
        triggerPartialLoad("shifts", { flashMessage: msg, flashType: "error", flashMessageKey: "shifts.weather_data_warning", flashMessageParams: { message: weatherDataWarning } });
      } else {
        updateFeedback(feedback, () => t("shifts.shift_created"), "success");
        triggerPartialLoad("shifts", {
          flashMessage: t("shifts.shift_created"),
          flashMessageKey: "shifts.shift_created",
        });
      }
    } catch (error) {
      console.error(
        isEditMode ? "Failed to update vehicle block" : "Failed to create vehicle block",
        error
      );
      hideProgress();
      updateFeedback(
        feedback,
        () => `${t(isEditMode ? "shifts.unable_to_update" : "shifts.unable_to_save")} ${errorMessage(error, "common.unknown_error")}`,
        "error"
      );
    } finally {
      saving = false;
      hideProgress();
      toggleFormDisabled(form, false);
      if (datasetSelect) datasetSelect.disabled = isEditMode || datasets.length === 0;
      updateShiftTrips();
      refreshScheduledTrips();
    }
  };

  const handleVisualize = (event) => {
    event.preventDefault();

    const payload = {
      mode,
      shiftId,
      name: nameInput instanceof HTMLInputElement ? nameInput.value : "",
      busId: busSelect instanceof HTMLSelectElement ? busSelect.value : "",
      busModelName:
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
        startDepotSelect instanceof HTMLSelectElement && startDepotSelect.value ?
          (startDepotSelect.selectedOptions?.[0]?.text ?? "")
        : "",
      endTime:
        endTimeInput instanceof HTMLInputElement ? endTimeInput.value : "",
      endDepotId:
        endDepotSelect instanceof HTMLSelectElement ? endDepotSelect.value : "",
      endDepotName:
        endDepotSelect instanceof HTMLSelectElement && endDepotSelect.value ?
          (endDepotSelect.selectedOptions?.[0]?.text ?? "")
        : "",
      trips: [...selectedTrips, ...buildProgrammeMovements({ trips: selectedTrips, stays: depotStays, depots: loadedDepots,
        startDepotId: startDepotSelect.value, endDepotId: endDepotSelect.value,
        startTime: getShiftStartTime(), endTime: getShiftEndTime() }).filter(item => item.kind === 'connection')],
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
      if (window.matchMedia('(hover: none)').matches) return;
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
  if (addAllTripsButton) {
    addAllTripsButton.addEventListener("click", handleAddAllTripsClick);
    cleanupHandlers.push(() => {
      addAllTripsButton.removeEventListener("click", handleAddAllTripsClick);
    });
  }
  if (removeAllTripsButton) {
    removeAllTripsButton.addEventListener("click", handleRemoveAllTripsClick);
    cleanupHandlers.push(() => {
      removeAllTripsButton.removeEventListener("click", handleRemoveAllTripsClick);
    });
  }

  const handleTripFiltersChange = () => {
    loadTrips();
  };
  searchInput?.addEventListener('input', refreshScheduledTrips);
  const handleSearchKey = (event) => {
    if (event.key === 'Enter') event.preventDefault();
  };
  searchInput?.addEventListener('keydown', handleSearchKey);
  cleanupHandlers.push(() => searchInput?.removeEventListener('keydown', handleSearchKey));
  const undoTrips = () => {
    const previous = tripHistory.pop();
    if (!previous) return;
    invalidateAdjustment();
    currentTrips = dedupeTrips([...currentTrips, ...selectedTrips]);
    selectedTrips = previous.trips;
    depotStays = previous.stays;
    activePeriod = previous.activePeriod;
    selectedTripIds.clear();
    selectedTrips.forEach((trip) => selectedTripIds.add(resolveTripId(trip)));
    updateShiftTrips();
    refreshScheduledTrips();
    updateTimeline();
    updateFeedback(feedback, '');
  };
  undoButton.addEventListener('click', undoTrips);
  cleanupHandlers.push(() => undoButton.removeEventListener('click', undoTrips));
  cleanupHandlers.push(() => searchInput?.removeEventListener('input', refreshScheduledTrips));
  form.addEventListener('composer:layout', updateTimeline);
  cleanupHandlers.push(() => form.removeEventListener('composer:layout', updateTimeline));
  const handleLanguageChange = () => {
    translateShiftSelectOptions(form);
    for (const option of datasetSelect?.options ?? []) {
      const dataset = datasets.find(item => datasetKey(item) === option.value);
      if (dataset) option.textContent = datasetLabel(dataset, t);
    }
    routesById = Object.fromEntries(Array.from(lineSelect?.options ?? [])
      .filter(option => option.value).map(option => [option.value, option.textContent]));
    if (isEditMode) {
      if (dayDisplayValue && daySelect?.value) dayDisplayValue.textContent = daySelect.selectedOptions[0].textContent;
      if (lineDisplayValue && lineSelect?.value) lineDisplayValue.textContent = lineSelect.selectedOptions[0].textContent;
    }
    showDataset();
    updateShiftTrips();
    refreshScheduledTrips();
    updateTimeline();
    if (saving) toggleFormDisabled(form, true);
    for (const [node, { message, tone }] of translatedMessages) {
      if (node === progressMessage) node.textContent = resolveMessage(message);
      else renderFeedback(node, resolveMessage(message), tone);
    }
  };
  document.addEventListener(I18N_CHANGE_EVENT, handleLanguageChange);
  cleanupHandlers.push(() => document.removeEventListener(I18N_CHANGE_EVENT, handleLanguageChange));
  if (lineSelect) {
    lineSelect.addEventListener("change", handleTripFiltersChange);
    cleanupHandlers.push(() => {
      lineSelect.removeEventListener("change", handleTripFiltersChange);
    });
  }
  if (daySelect) {
    daySelect.addEventListener("change", handleTripFiltersChange);
    cleanupHandlers.push(() => {
      daySelect.removeEventListener("change", handleTripFiltersChange);
    });
  }

  const handleShiftTimeChange = () => {
    invalidateAdjustment();
    if (currentTrips.length > 0) {
      refreshScheduledTrips();
    } else {
      loadTrips();
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
  
  const handleDepotChange = () => {
    invalidateAdjustment();
    if (currentTrips.length > 0) {
      refreshScheduledTrips();
    } else {
      loadTrips();
    }
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

  updateEmptyState(shiftTripsEmpty, false, t("shifts.no_trips_added"));
  updateEmptyState(
    scheduledTripsEmpty,
    false,
    t("shifts.select_line_and_day")
  );
  if (addAllTripsButton instanceof HTMLButtonElement) {
    addAllTripsButton.disabled = true;
  }
  if (removeAllTripsButton instanceof HTMLButtonElement) {
    removeAllTripsButton.disabled = true;
  }

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
    Promise.resolve(),
    loadDepots(),
    loadDays(),
    shiftPromise,
  ]);

  await loadDatasets(shift);

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

      const hydratedShift = await hydrateShift(shift, shiftInfo);
      const reconstruction = assessEditRouteReconstruction({
        shift: hydratedShift,
        shiftInfo,
      });
      if (reconstruction.ok) {
        try { readShiftDepotStays({ shift: hydratedShift, shiftInfo, depots: loadedDepots }); }
        catch { reconstruction.ok = false; reconstruction.reason = 'unrecoverable_depot_stay'; }
      }
      editRouteReconstructionBlocked = !reconstruction.ok;
      if (editRouteReconstructionBlocked) {
        console.warn("[SHIFT] Edit route reconstruction unsafe:", reconstruction);
      }

      applyShiftPrefill(hydratedShift, shiftInfo, {
        reconstructRoute: !editRouteReconstructionBlocked,
      });

      updateTimeline();

      toggleFormDisabled(form, false);
      if (editRouteReconstructionBlocked) {
        updateFeedback(feedback, () => t("shifts.unable_to_load_for_edit"), "error");
        if (submitButton) {
          submitButton.disabled = true;
        }
      } else if (nameInput instanceof HTMLInputElement) {
        nameInput.focus();
        const length = nameInput.value.length;
        nameInput.setSelectionRange(length, length);
      }
    } else {
      updateFeedback(feedback, () => t("shifts.unable_to_load_for_edit"), "error");
      toggleFormDisabled(form, false);
      if (submitButton) {
        submitButton.disabled = true;
      }
    }
  }

  composer.ready();
  return () => {
    disposed = true;
    invalidateAdjustment();
    datasetGeneration++;
    tripGeneration++;
    cleanupHandlers.forEach((handler) => handler());
  };
};

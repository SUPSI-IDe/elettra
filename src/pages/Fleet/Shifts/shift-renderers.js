import { resolveBusModelDisplayName, resolveBusModelLabelI18nKey, textContent } from "../../../ui-helpers";
import { t } from "../../../i18n";
import {
  text,
  normalizeTrip,
  resolveTripId,
  resolveRouteLabel,
  getEligibleScheduledTrips,
} from "./shift-utils";

// Helper to get the consistent trip ID for use in data attributes
const getTripIdForDataAttr = (trip) => resolveTripId(trip);

export const clearNode = (node) => {
  if (!node) {
    return;
  }
  node.innerHTML = "";
};

export const updateEmptyState = (element, hasItems, message) => {
  if (!element) {
    return;
  }

  if (hasItems) {
    element.hidden = true;
    return;
  }

  if (typeof message === "string" && message.length > 0) {
    element.textContent = message;
  }
  element.hidden = false;
};

export const renderTripsLoading = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="time" colspan="4">${textContent(t("common.loading"))}</td>
        </tr>
    `;
};

export const renderShiftTrips = (tbody, trips = []) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    clearNode(tbody);
    return;
  }

  const rows = trips
    .map((trip = {}) => {
      // Use consistent ID resolution (same as resolveTripId used when adding trips)
      const tripId = getTripIdForDataAttr(trip);
      const departureTime = text(trip?.departure_time ?? trip?.departureTime ?? "");
      const arrivalTime = text(trip?.arrival_time ?? trip?.arrivalTime ?? "");
      const start = text(trip?.start_stop_name ?? trip?.startStopName ?? "");
      const end = text(trip?.end_stop_name ?? trip?.endStopName ?? "");

      return `
                <tr data-trip-id="${textContent(tripId)}">
                    <td class="start-time">${textContent(departureTime || "—")}</td>
                    <td class="end-time">${textContent(arrivalTime || "—")}</td>
                    <td class="route">${textContent(
                      start && end ? `${start} – ${end}` : start || end || "—"
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="remove-trip">${textContent(t("shifts.remove_trip"))}</button>
                    </td>
                </tr>
            `;
    })
    .join("");

  tbody.innerHTML = rows;
};

export const renderScheduledTrips = ({
  tbody,
  trips = [],
  routeLabel = "",
  selectedTripIds = new Set(),
  lastTripEndTime = null,
  lastTripEndStop = null,
  shiftStartTime = null,
  shiftEndTime = null,
  eligibleTrips = null,
}) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    clearNode(tbody);
    return;
  }

  const validTrips = Array.isArray(eligibleTrips)
    ? eligibleTrips
    : getEligibleScheduledTrips({
        trips,
        selectedTripIds,
        lastTripEndTime,
        lastTripEndStop,
        shiftStartTime,
        shiftEndTime,
      });

  const rows = validTrips
    .map((trip = {}) => {
      const normalized = normalizeTrip(trip);
      const id = resolveTripId(normalized);
      const departureTime = text(
        normalized?.departure_time ?? normalized?.departureTime ?? ""
      );
      const arrivalTime = text(
        normalized?.arrival_time ?? normalized?.arrivalTime ?? ""
      );
      const startStop = text(
        normalized?.start_stop_name ?? normalized?.startStopName ?? ""
      );
      const endStop = text(
        normalized?.end_stop_name ?? normalized?.endStopName ?? ""
      );

      return `
                <tr data-trip-id="${textContent(id)}">
                    <td class="time">${textContent(departureTime || "—")}</td>
                    <td class="end-time">${textContent(arrivalTime || "—")}</td>
                    <td class="route">${textContent(
                      startStop && endStop ? `${startStop} – ${endStop}` : startStop || endStop || "—"
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="add-trip">${textContent(t("shifts.add_trip"))}</button>
                    </td>
                </tr>
            `;
    })
    .join("");

  tbody.innerHTML = rows;
};

export const renderRouteOptions = (select, routes = []) => {
  if (!select) {
    return {};
  }

  const map = {};
  const seenLabels = new Set();
  const linePrefix = t("shifts.filter_line") || "Line";
  const options = [
    `<option value="" data-i18n="shifts.filter_all_lines">${textContent(t("shifts.filter_all_lines") || "Select a line")}</option>`,
    ...routes
      .filter((route) => route && route.id)
      .map((route) => {
        const id = String(route.id);
        const shortName = text(route?.route_short_name ?? "");
        const longName = text(route?.route_long_name ?? "");
        const label =
          shortName ||
          longName ||
          t("shifts.route_fallback", { id }) ||
          `Route ${id}`;
        const displayLabel = `${linePrefix} ${label}`;
        if (seenLabels.has(displayLabel)) {
          return null;
        }
        seenLabels.add(displayLabel);
        map[id] = displayLabel;
        return `<option value="${textContent(id)}" data-route-label="${textContent(shortName || longName)}">${textContent(displayLabel)}</option>`;
      })
      .filter(Boolean),
  ].join("");

  select.innerHTML = options;
  return map;
};

export const renderBusOptions = (select, buses = [], modelsById = {}) => {
  if (!select) {
    return;
  }

  const busByModelId = {};
  buses
    .filter((bus) => bus && bus.id)
    .forEach((bus) => {
      const modelId = text(bus?.bus_model_id ?? "");
      if (modelId && !busByModelId[modelId]) {
        busByModelId[modelId] = bus;
      }
    });

  const modelOptions = [];

  for (const [modelId, model] of Object.entries(modelsById)) {
    if (!modelId) continue;
    const i18nKey = resolveBusModelLabelI18nKey(model);
    const label = i18nKey ? t(i18nKey) : resolveBusModelDisplayName(model);
    if (!label) continue;

    const bus = busByModelId[modelId];
    const value = bus ? text(bus.id) : text(modelId);
    modelOptions.push(
      `<option value="${textContent(value)}" data-bus-model-id="${textContent(modelId)}"${i18nKey ? ` data-i18n="${textContent(i18nKey)}"` : ''}>${textContent(label)}</option>`
    );
  }

  const options = [
    `<option value="" data-i18n="shifts.placeholder_bus_model">${textContent(t("shifts.placeholder_bus_model"))}</option>`,
    ...modelOptions,
  ].join("");

  select.innerHTML = options;
};

export const renderDepotOptions = (select, depots = []) => {
  if (!select) {
    return;
  }

  const options = [
    `<option value="" data-i18n="shifts.select_depot">${textContent(t("shifts.select_depot"))}</option>`,
    ...depots
      .filter((depot) => depot && depot.id)
      .map((depot) => {
        const fallbackLabel =
          t("shifts.depot_fallback", { id: depot.id }) ||
          `Depot ${depot.id}`;
        const label = depot?.name ?? depot?.label ?? fallbackLabel;
        const fallback = depot?.name == null && depot?.label == null;
        return `<option value="${textContent(depot.id)}"${fallback ? ' data-depot-fallback="true"' : ''}>${textContent(label)}</option>`;
      }),
  ].join("");

  select.innerHTML = options;
};

export const populateDayOptions = (select, days = []) => {
  if (!select) {
    return;
  }

  const options = [
    `<option value="" data-i18n="shifts.filter_all_days">${textContent(t("shifts.filter_all_days") || "Select a day")}</option>`,
    ...days.map((day) => {
      const value = typeof day === "string" ? day : day.id || day.value;
      const label =
        typeof day === "string" ? day : day.name || day.label || day.id || "";
      const dayKey = typeof value === "string" ? `simulation.day_${value.toLowerCase()}` : "";
      const translatedLabel =
        dayKey && t(dayKey) !== dayKey ? t(dayKey) : label;
      const translation = dayKey && t(dayKey) !== dayKey ? ` data-i18n="${textContent(dayKey)}"` : "";
      return `<option value="${textContent(value)}"${translation}>${textContent(
        translatedLabel
      )}</option>`;
    }),
  ].join("");

  select.innerHTML = options;
};

// Change labels in place: selected values, focus and any prefilled options
// absent from the current catalogue must survive a language change.
export const translateShiftSelectOptions = (form) => {
  form.querySelectorAll('option[data-i18n]').forEach(option => {
    option.textContent = t(option.dataset.i18n);
  });
  form.querySelectorAll('option[data-route-label]').forEach(option => {
    const label = option.dataset.routeLabel || t('shifts.route_fallback', { id: option.value });
    option.textContent = `${t('shifts.filter_line')} ${label}`;
  });
  form.querySelectorAll('option[data-depot-fallback]').forEach(option => {
    option.textContent = t('shifts.depot_fallback', { id: option.value });
  });
};

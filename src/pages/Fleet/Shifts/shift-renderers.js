import { textContent } from "../../../ui-helpers";
import {
  text,
  normalizeTrip,
  resolveTripId,
  resolveRouteLabel,
} from "./shift-utils";

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
            <td class="time" colspan="4">Loading…</td>
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
      const time = text(trip?.departure_time ?? trip?.departureTime ?? "");
      const start = text(trip?.start_stop_name ?? trip?.startStopName ?? "");
      const end = text(trip?.end_stop_name ?? trip?.endStopName ?? "");

      return `
                <tr data-trip-id="${text(trip?.id ?? trip?.trip_id ?? "")}">
                    <td class="time">${textContent(time || "—")}</td>
                    <td class="route">${textContent(
                      start && end ? `${start} – ${end}` : start || end || "—"
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="remove-trip">Remove</button>
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
}) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    clearNode(tbody);
    return;
  }

  const rows = trips
    .map((trip = {}) => {
      const normalized = normalizeTrip(trip);
      const id = resolveTripId(normalized);
      const time = text(
        normalized?.departure_time ?? normalized?.departureTime ?? ""
      );
      const start = text(
        normalized?.start_stop_name ?? normalized?.startStopName ?? ""
      );
      const end = text(
        normalized?.end_stop_name ?? normalized?.endStopName ?? ""
      );
      const disabled = selectedTripIds.has(id) ? "disabled" : "";
      const currentRouteLabel =
        routeLabel || resolveRouteLabel(normalized) || "—";

      return `
                <tr data-trip-id="${id}">
                    <td class="time">${textContent(time || "—")}</td>
                    <td class="line">${textContent(currentRouteLabel)}</td>
                    <td class="route">${textContent(
                      start && end ? `${start} – ${end}` : start || end || "—"
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="add-trip" ${disabled}>Add</button>
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
  const options = [
    '<option value="">All lines</option>',
    ...routes
      .filter((route) => route && route.id)
      .map((route) => {
        const id = String(route.id);
        const shortName = text(route?.route_short_name ?? "");
        const longName = text(route?.route_long_name ?? "");
        const label = shortName || longName || `Route ${id}`;
        if (seenLabels.has(label)) {
          return null;
        }
        seenLabels.add(label);
        map[id] = label;
        return `<option value="${id}">${textContent(label)}</option>`;
      })
      .filter(Boolean),
  ].join("");

  select.innerHTML = options;
  return map;
};

export const renderBusOptions = (select, buses = []) => {
  if (!select) {
    return;
  }

  const options = [
    '<option value="">Select a bus</option>',
    ...buses
      .filter((bus) => bus && bus.id)
      .map(
        (bus) =>
          `<option value="${text(bus.id)}">${textContent(
            bus?.name ?? bus?.label ?? `Bus ${bus.id}`
          )}</option>`
      ),
  ].join("");

  select.innerHTML = options;
};

export const renderDepotOptions = (select, depots = []) => {
  if (!select) {
    return;
  }

  const options = [
    '<option value="">Select a depot</option>',
    ...depots
      .filter((depot) => depot && depot.id)
      .map(
        (depot) =>
          `<option value="${text(depot.id)}">${textContent(
            depot?.name ?? depot?.label ?? `Depot ${depot.id}`
          )}</option>`
      ),
  ].join("");

  select.innerHTML = options;
};

export const populateDayOptions = (select, days = []) => {
  if (!select) {
    return;
  }

  const options = [
    '<option value="">All days</option>',
    ...days.map((day) => {
      const value = typeof day === "string" ? day : day.id || day.value;
      const label =
        typeof day === "string" ? day : day.name || day.label || day.id || "";
      return `<option value="${textContent(value)}">${textContent(
        label
      )}</option>`;
    }),
  ].join("");

  select.innerHTML = options;
};

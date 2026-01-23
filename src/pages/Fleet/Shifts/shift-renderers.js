import { textContent } from "../../../ui-helpers";
import {
  text,
  normalizeTrip,
  resolveTripId,
  resolveRouteLabel,
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
      // Use consistent ID resolution (same as resolveTripId used when adding trips)
      const tripId = getTripIdForDataAttr(trip);
      const departureTime = text(trip?.departure_time ?? trip?.departureTime ?? "");
      const arrivalTime = text(trip?.arrival_time ?? trip?.arrivalTime ?? "");
      const start = text(trip?.start_stop_name ?? trip?.startStopName ?? "");
      const end = text(trip?.end_stop_name ?? trip?.endStopName ?? "");

      return `
                <tr data-trip-id="${tripId}">
                    <td class="start-time">${textContent(departureTime || "—")}</td>
                    <td class="end-time">${textContent(arrivalTime || "—")}</td>
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
  lastTripEndTime = null,
  lastTripEndStop = null,
  shiftStartTime = null,
  shiftEndTime = null,
}) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    clearNode(tbody);
    return;
  }

  // Determine the earliest allowed departure time:
  // - If there are already selected trips, use lastTripEndTime (bus must finish previous trip first)
  // - Otherwise, use shiftStartTime (bus must leave the depot first)
  const earliestAllowedTime = lastTripEndTime || shiftStartTime || null;

  // Normalize stop name for consistent comparison (trim whitespace)
  const normalizeStopName = (name) => String(name ?? "").trim();
  const normalizedLastTripEndStop = lastTripEndStop ? normalizeStopName(lastTripEndStop) : null;
  
  // Only apply location filter if there are selected trips (bus is somewhere)
  const hasSelectedTrips = selectedTripIds.size > 0;

  // Filter trips to show only valid options
  const validTrips = trips.filter((trip = {}) => {
    const normalized = normalizeTrip(trip);
    const id = resolveTripId(normalized);
    const startStop = normalizeStopName(
      normalized?.start_stop_name ?? normalized?.startStopName ?? ""
    );

    // Hide already selected trips
    if (selectedTripIds.has(id)) {
      return false;
    }

    // Hide trips that start from a different location than where the bus is
    // Only apply this filter if there are selected trips (bus is at a known location)
    if (hasSelectedTrips && normalizedLastTripEndStop && startStop && startStop !== normalizedLastTripEndStop) {
      return false;
    }

    // Hide trips that depart too early (before shift start or before previous trip ends)
    if (earliestAllowedTime) {
      const departure =
        normalized?.departure_time ?? normalized?.departureTime ?? "";
      if (departure && departure < earliestAllowedTime) {
        return false;
      }
    }

    // Hide trips that arrive too late (after shift end time / depot arrival)
    if (shiftEndTime) {
      const arrival =
        normalized?.arrival_time ?? normalized?.arrivalTime ??
        normalized?.departure_time ?? normalized?.departureTime ?? "";
      if (arrival && arrival > shiftEndTime) {
        return false;
      }
    }

    return true;
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
                <tr data-trip-id="${id}">
                    <td class="time">${textContent(departureTime || "—")}</td>
                    <td class="end-time">${textContent(arrivalTime || "—")}</td>
                    <td class="route">${textContent(
                      startStop && endStop ? `${startStop} – ${endStop}` : startStop || endStop || "—"
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="add-trip">Add</button>
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

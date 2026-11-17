import * as d3 from "d3";

import { t } from "../../../i18n/index.js";
import {
  buildStopOrder,
  firstAvailable,
  mergeStopSequence,
  parseTimeToMinutes,
  resolveRouteId,
  text,
} from "./shift-utils.js";

const stopEntries = (trip = {}) => {
  const candidates = [
    trip?.stop_times,
    trip?.stops,
    trip?.trip?.stop_times,
    trip?.trip?.stops,
  ];
  return candidates.find((entries) => Array.isArray(entries) && entries.length) ?? [];
};

const stopName = (entry = {}) =>
  firstAvailable(
    entry?.stop_name,
    entry?.stopName,
    entry?.name,
    entry?.stop?.stop_name,
    entry?.stop?.name,
    entry?.stop?.label
  );

const stopMinute = (entry = {}) =>
  parseTimeToMinutes(
    firstAvailable(
      entry?.departure_time,
      entry?.departureTime,
      entry?.arrival_time,
      entry?.arrivalTime
    )
  );

const clockLabel = (minutes) => {
  if (!Number.isFinite(minutes)) return "";
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const normalizeDiagramTrip = (trip = {}, index = 0) => {
  let points = stopEntries(trip)
    .map((entry) => ({
      stop: stopName(entry),
      minute: stopMinute(entry),
    }))
    .filter((point) => point.stop && Number.isFinite(point.minute));

  if (points.length < 2) {
    const departure = parseTimeToMinutes(trip?.departure_time);
    const arrival = parseTimeToMinutes(trip?.arrival_time);
    const start = text(trip?.start_stop_name).trim();
    const end = text(trip?.end_stop_name).trim();
    points = [
      { stop: start, minute: departure },
      { stop: end, minute: arrival },
    ].filter((point) => point.stop && Number.isFinite(point.minute));
  }

  const routeId = resolveRouteId(trip);
  const routeLabel = firstAvailable(
    trip?.route_label,
    trip?.route_short_name,
    trip?.route?.short_name,
    trip?.route?.name,
    routeId
  );
  const rawSequence = firstAvailable(
    trip?.sequence_number,
    trip?.sequenceNumber,
    trip?.trip?.sequence_number,
    trip?.trip?.sequenceNumber
  );
  const sequence = rawSequence === "" ? null : Number(rawSequence);

  return {
    id: firstAvailable(trip?.trip_id, trip?.id, `trip-${index + 1}`),
    routeId,
    routeLabel,
    sequence: Number.isFinite(sequence) ? sequence : null,
    points,
  };
};

export const buildSpaceTimeGroups = (trips = []) => {
  const groups = new Map();

  (Array.isArray(trips) ? trips : [])
    .map(normalizeDiagramTrip)
    .filter((trip) => trip.points.length >= 2)
    .sort((left, right) => left.points[0].minute - right.points[0].minute)
    .forEach((trip) => {
      const key = trip.routeId || trip.routeLabel || "all-routes";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: trip.routeLabel,
          stops: [],
          trips: [],
        });
      }
      const group = groups.get(key);
      group.trips.push(trip);
    });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    stops: buildStopOrder(
      group.trips.map((trip) => trip.points.map((point) => point.stop))
    ),
  }));
};

// Merge the route axes, rather than concatenating trip stop lists: each route
// already accounts for its return direction, short workings and terminal loops.
// Shared stops occupy one row; the exclusive stops of each branch stay between
// their common anchors. The points themselves always retain their travel order.
export const combineSpaceTimeGroups = (groups = []) => {
  if (groups.length < 2) return groups[0] ?? null;

  const routes = groups.map((group) => ({
    key: group.key,
    label: group.label,
    tripCount: group.trips.length,
  })).sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { numeric: true }) ||
    left.key.localeCompare(right.key)
  );

  return {
    key: "combined-routes",
    label: routes.map((route) => route.label).join(" / "),
    routes,
    stops: buildStopOrder(groups.map((group) => group.stops)),
    trips: groups.flatMap((group) => group.trips.map((trip) => ({
      ...trip,
      routeKey: group.key,
    }))).sort((left, right) =>
      left.points[0].minute - right.points[0].minute ||
      (left.sequence ?? 0) - (right.sequence ?? 0)
    ),
  };
};

export const buildTransferOnlySpaceTimeGroup = (
  depotTrips = [],
  { startDepotName = "", endDepotName = "" } = {}
) => {
  const depotNames = new Set(
    [startDepotName, endDepotName].map((name) => text(name).trim()).filter(Boolean)
  );
  const transfers = (Array.isArray(depotTrips) ? depotTrips : [])
    .map(normalizeDiagramTrip)
    .filter((trip) => trip.points.length >= 2)
    .sort((left, right) => left.points[0].minute - right.points[0].minute);
  if (!transfers.length) return null;

  let stops = [];
  transfers.forEach((trip) => {
    stops = mergeStopSequence(
      stops,
      trip.points
        .map((point) => point.stop)
        .filter((stop) => !depotNames.has(stop))
    );
  });

  return {
    key: "transfer-only",
    label: "",
    stops,
    trips: [],
    transferOnly: true,
    transferCount: transfers.length,
  };
};

const serviceTripsBySequence = (groups = []) =>
  groups
    .flatMap((group) =>
      group.trips.map((trip) => ({
        groupKey: group.key,
        sequence: trip.sequence,
        startMinute: trip.points[0]?.minute,
        endMinute: trip.points[trip.points.length - 1]?.minute,
      }))
    )
    .sort((left, right) => {
      if (Number.isFinite(left.sequence) && Number.isFinite(right.sequence)) {
        return left.sequence - right.sequence;
      }
      return left.startMinute - right.startMinute;
    });

export const assignDepotTripsToSpaceTimeGroups = (
  groups = [],
  depotTrips = [],
  { startDepotName = "", endDepotName = "" } = {}
) => {
  const assignments = new Map(groups.map((group) => [group.key, []]));
  if (!groups.length) return assignments;

  const serviceTrips = serviceTripsBySequence(groups);
  const depotNames = new Set(
    [startDepotName, endDepotName].map((name) => text(name).trim()).filter(Boolean)
  );

  (Array.isArray(depotTrips) ? depotTrips : []).forEach((sourceTrip) => {
    const trip = normalizeDiagramTrip(sourceTrip);
    if (trip.points.length < 2) return;
    if (groups[0]?.transferOnly) {
      assignments.get(groups[0].key)?.push(sourceTrip);
      return;
    }

    const firstPoint = trip.points[0];
    const lastPoint = trip.points[trip.points.length - 1];
    const hasSequence = Number.isFinite(trip.sequence);
    const previous = [...serviceTrips].reverse().find((serviceTrip) =>
      hasSequence && Number.isFinite(serviceTrip.sequence)
        ? serviceTrip.sequence < trip.sequence
        : serviceTrip.endMinute <= firstPoint.minute
    );
    const next = serviceTrips.find((serviceTrip) =>
      hasSequence && Number.isFinite(serviceTrip.sequence)
        ? serviceTrip.sequence > trip.sequence
        : serviceTrip.startMinute >= lastPoint.minute
    );
    const startsAtDepot = depotNames.has(firstPoint.stop);
    const endsAtDepot = depotNames.has(lastPoint.stop);

    let groupKey = "";
    if (startsAtDepot && next) {
      groupKey = next.groupKey;
    } else if (endsAtDepot && previous) {
      groupKey = previous.groupKey;
    } else if ((previous || next) && previous?.groupKey === next?.groupKey) {
      groupKey = previous.groupKey;
    } else {
      groupKey = next?.groupKey ?? previous?.groupKey ?? groups[0].key;
    }

    assignments.get(groupKey)?.push(sourceTrip);
  });

  return assignments;
};

export const partitionDepotTripsForSpaceTimeGroup = (
  group = { stops: [] },
  depotTrips = []
) => {
  const normalized = (Array.isArray(depotTrips) ? depotTrips : [])
    .map(normalizeDiagramTrip)
    .filter((trip) => trip.points.length >= 2)
    .sort((left, right) => left.points[0].minute - right.points[0].minute);
  const connected = [];
  const disconnected = [];
  if (group.transferOnly) {
    return { connected: normalized, disconnected };
  }
  normalized.forEach((trip) => {
    const target = trip.points.some((point) => group.stops.includes(point.stop))
      ? connected
      : disconnected;
    target.push(trip);
  });
  return { connected, disconnected };
};

export const findDepotConnectionGaps = (serviceTrips = [], depotTrips = []) => {
  const movements = [
    ...(Array.isArray(serviceTrips) ? serviceTrips : []).map((trip) => ({
      ...trip,
      movementType: "service",
    })),
    ...(Array.isArray(depotTrips) ? depotTrips : []).map((trip) => ({
      ...trip,
      movementType: "depot",
    })),
  ]
    .filter((trip) => trip.points?.length >= 2)
    .sort((left, right) => {
      if (Number.isFinite(left.sequence) && Number.isFinite(right.sequence)) {
        return left.sequence - right.sequence;
      }
      return left.points[0].minute - right.points[0].minute;
    });

  return movements.slice(1).flatMap((movement, index) => {
    const previous = movements[index];
    const sequenceIsAdjacent =
      !Number.isFinite(previous.sequence) ||
      !Number.isFinite(movement.sequence) ||
      movement.sequence === previous.sequence + 1;
    if (
      !sequenceIsAdjacent ||
      (previous.movementType !== "depot" && movement.movementType !== "depot")
    ) {
      return [];
    }

    const previousEnd = previous.points[previous.points.length - 1];
    const nextStart = movement.points[0];
    return previousEnd.stop === nextStart.stop
      ? []
      : [[previousEnd, nextStart]];
  });
};

const appendDiagram = (container, group, options = {}) => {
  const {
    connected: depotSeries,
    disconnected: disconnectedDepotSeries,
  } = partitionDepotTripsForSpaceTimeGroup(group, options.depotTrips);
  const depotStops = [];
  depotSeries.forEach((trip) => {
    trip.points.forEach((point) => {
      if (!group.stops.includes(point.stop) && !depotStops.includes(point.stop)) {
        depotStops.push(point.stop);
      }
    });
  });
  const startDepot = text(options.startDepotName).trim();
  const endDepot = text(options.endDepotName).trim();
  const leadingDepot = startDepot && depotStops.includes(startDepot)
    ? startDepot
    : "";
  const trailingDepots = depotStops.filter((stop) => stop !== leadingDepot);
  if (endDepot && trailingDepots.includes(endDepot)) {
    trailingDepots.splice(trailingDepots.indexOf(endDepot), 1);
    trailingDepots.push(endDepot);
  }
  const diagramStops = [
    ...(leadingDepot ? [leadingDepot] : []),
    ...group.stops,
    ...trailingDepots,
  ];
  const depotStopSet = new Set(depotStops);
  const section = document.createElement("section");
  section.className = "shift-space-time__group";

  const header = document.createElement("header");
  header.className = "shift-space-time__group-header";
  const heading = document.createElement("h3");
  const routeName = group.transferOnly
    ? t("shifts.space_time_transfers")
    : group.label || t("shifts.space_time_all_routes");
  heading.textContent = group.transferOnly
    ? routeName
    : group.routes?.length > 1
      ? t("shifts.space_time_routes", { routes: routeName })
      : group.label
        ? t("shifts.space_time_route", { route: routeName })
        : routeName;
  // Reserve orange for non-revenue movements. Keep a line's colour stable
  // across all its trips and both directions within the duty.
  const routePalette = ["#4e79a7", "#b07aa1", "#59a14f", "#e15759", "#76b7b2", "#9c755f", "#edc949", "#af7aa1"];
  const routes = group.routes ?? (group.transferOnly ? [] : [
    { key: group.key, label: routeName },
  ]);
  const routeColors = new Map(routes.map((route, index) => [
    route.key, routePalette[index % routePalette.length],
  ]));
  const summary = document.createElement("span");
  summary.textContent = group.transferOnly
    ? t("shifts.space_time_transfer_summary", {
        transfers: group.transferCount,
        stops: group.stops.length,
      })
    : t("shifts.space_time_summary", {
        trips: group.trips.length,
        stops: group.stops.length,
      });
  const metadata = document.createElement("div");
  metadata.className = "shift-space-time__group-metadata";
  metadata.append(summary);
  if (routes.length) {
    const legend = document.createElement("div");
    legend.className = "shift-space-time__route-legend";
    routes.forEach((route) => {
      const key = document.createElement("span");
      key.className = "shift-space-time__route-key";
      key.style.setProperty("--route-color", routeColors.get(route.key));
      key.textContent = t("shifts.space_time_route", { route: route.label });
      legend.append(key);
    });
    metadata.append(legend);
  }
  if (depotSeries.length) {
    const depotKey = document.createElement("span");
    depotKey.className = "shift-space-time__depot-key";
    depotKey.textContent = t("shifts.timeline_legend_depot");
    metadata.append(depotKey);
  }
  const transferGaps = group.transferOnly
    ? depotSeries.slice(1).flatMap((trip, index) => {
        const previous = depotSeries[index];
        const previousEnd = previous.points[previous.points.length - 1];
        const nextStart = trip.points[0];
        return previousEnd.stop === nextStart.stop
          ? []
          : [[previousEnd, nextStart]];
      })
    : [];
  const depotConnectionGaps = group.transferOnly
    ? []
    : findDepotConnectionGaps(group.trips, depotSeries);
  const gapCount =
    disconnectedDepotSeries.length +
    transferGaps.length +
    depotConnectionGaps.length;
  if (gapCount) {
    const gapKey = document.createElement("span");
    gapKey.className = "shift-space-time__gap-key";
    gapKey.textContent = t("shifts.space_time_unconnected_transfers", {
      count: gapCount,
    });
    const disconnectedDetails = disconnectedDepotSeries.map((trip) => {
        const firstPoint = trip.points[0];
        const lastPoint = trip.points[trip.points.length - 1];
        return `${firstPoint.stop} ${clockLabel(firstPoint.minute)} - ${lastPoint.stop} ${clockLabel(lastPoint.minute)}`;
      });
    const gapDetails = transferGaps.map(
      ([previousEnd, nextStart]) =>
        `${previousEnd.stop} ${clockLabel(previousEnd.minute)} - ${nextStart.stop} ${clockLabel(nextStart.minute)}`
    );
    const depotConnectionDetails = depotConnectionGaps.map(
      ([previousEnd, nextStart]) =>
        `${previousEnd.stop} ${clockLabel(previousEnd.minute)} - ${nextStart.stop} ${clockLabel(nextStart.minute)}`
    );
    gapKey.title = [
      ...disconnectedDetails,
      ...gapDetails,
      ...depotConnectionDetails,
    ].join("\n");
    metadata.append(gapKey);
  }
  header.append(heading, metadata);

  const scroll = document.createElement("div");
  scroll.className = "shift-space-time__scroll";
  // Measure the actual plot area after the responsive legend has wrapped.
  section.append(header, scroll);
  container.append(section);

  const allMinutes = [...group.trips, ...depotSeries].flatMap((trip) =>
    trip.points.map((point) => point.minute)
  );
  const rawStart = Math.min(...allMinutes);
  const rawEnd = Math.max(...allMinutes);
  const axisStart = Math.floor(rawStart / 30) * 30;
  const axisEnd = Math.max(axisStart + 60, Math.ceil(rawEnd / 30) * 30);
  const longestStopLength = diagramStops.reduce(
    (length, stop) => Math.max(length, text(stop).length),
    0
  );
  const stopLabelMargin = Math.min(
    320,
    Math.max(190, Math.ceil(longestStopLength * 7.2 + 28))
  );
  const margin = { top: 54, right: 36, bottom: 48, left: stopLabelMargin };
  const containerStyle = window.getComputedStyle(container);
  const headerStyle = window.getComputedStyle(header);
  const scrollStyle = window.getComputedStyle(scroll);
  const pixels = (value) => Number.parseFloat(value) || 0;
  const paddingBottom = pixels(containerStyle.paddingBottom);
  const scrollBorders = pixels(scrollStyle.borderTopWidth) + pixels(scrollStyle.borderBottomWidth);
  const headerHeight = header.getBoundingClientRect().height + pixels(headerStyle.marginBottom);
  const contentHeight = container.clientHeight - pixels(containerStyle.paddingTop) - paddingBottom;
  const article = container.closest(".layout-article");
  const viewportBottom = Math.min(
    window.innerHeight,
    article?.getBoundingClientRect().bottom ?? window.innerHeight
  );
  const availableHeight = Math.max(
    contentHeight - headerHeight - scrollBorders,
    viewportBottom - Math.max(0, scroll.getBoundingClientRect().top) - paddingBottom - 16 - scrollBorders
  );
  const innerWidth = Math.max(
    720,
    (axisEnd - axisStart) * 2.2,
    scroll.clientWidth - margin.left - margin.right
  );
  const width = innerWidth + margin.left + margin.right;

  const svg = d3
    .create("svg")
    .attr("class", "shift-space-time__chart")
    .attr("width", width)
    .attr("height", 1)
    .attr("role", "img")
    .attr("aria-label", heading.textContent);
  scroll.append(svg.node());
  // Account for classic scrollbars as well as overlay scrollbars. Fill the
  // remaining height without creating a blank strip below a short diagram.
  const scrollbarHeight = scroll.offsetHeight - scroll.clientHeight - scrollBorders;
  const innerHeight = Math.max(
    280,
    Math.max(diagramStops.length - 1, 1) * 34,
    availableHeight - scrollbarHeight - margin.top - margin.bottom
  );
  const height = innerHeight + margin.top + margin.bottom;
  svg.attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([axisStart, axisEnd]).range([0, innerWidth]);
  const y = d3
    .scalePoint()
    .domain(diagramStops)
    .range([0, innerHeight])
    .padding(0.35);
  const tickInterval = axisEnd - axisStart > 8 * 60 ? 60 : 30;
  const ticks = d3.range(axisStart, axisEnd + 1, tickInterval);

  root
    .append("g")
    .attr("class", "shift-space-time__time-grid")
    .selectAll("line")
    .data(ticks)
    .join("line")
    .attr("x1", (minute) => x(minute))
    .attr("x2", (minute) => x(minute))
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const stopRows = root
    .append("g")
    .attr("class", "shift-space-time__stop-grid")
    .selectAll("g")
    .data(diagramStops)
    .join("g")
    .attr("class", (stop) =>
      depotStopSet.has(stop) ? "shift-space-time__stop-row--depot" : null
    )
    .attr("transform", (stop) => `translate(0,${y(stop)})`);
  stopRows
    .append("line")
    .attr("data-role", "space-time-stop-line")
    .attr("x1", 0)
    .attr("x2", innerWidth);
  stopRows
    .append("text")
    .attr("data-stop-name", (stop) => stop)
    .attr("x", -12)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .text((stop) => stop);

  const appendTimeAxis = (position) => {
    const axis = root
      .append("g")
      .attr("class", "shift-space-time__time-axis")
      .attr("transform", `translate(0,${position})`);
    axis
      .selectAll("text")
      .data(ticks)
      .join("text")
      .attr("x", (minute) => x(minute))
      .attr("y", position === 0 ? -16 : 24)
      .attr("text-anchor", "middle")
      .text(clockLabel);
  };
  appendTimeAxis(0);
  appendTimeAxis(innerHeight);

  const line = d3
    .line()
    .x((point) => x(point.minute))
    .y((point) => y(point.stop))
    .curve(d3.curveLinear);
  const tripColor = (trip) =>
    routeColors.get(trip.routeKey) ?? routePalette[0];
  const series = root
    .append("g")
    .attr("class", "shift-space-time__series")
    .selectAll("g")
    .data(group.trips)
    .join("g")
    .attr("class", "shift-space-time__trip")
    .attr("data-role", "space-time-trip")
    .attr("data-route-id", (trip) => trip.routeKey ?? trip.routeId);

  series.append("title").text((trip) =>
    `${t("shifts.space_time_route", { route: trip.routeLabel })} · ${trip.points[0].stop} ${clockLabel(trip.points[0].minute)} → ${trip.points.at(-1).stop} ${clockLabel(trip.points.at(-1).minute)}`
  );

  series
    .append("path")
    .attr("d", (trip) => line(trip.points))
    .attr("stroke", tripColor);
  series.each(function appendTripDetails(trip) {
    const color = tripColor(trip);
    const tripGroup = d3.select(this);
    const points = tripGroup
      .selectAll("g.shift-space-time__point")
      .data(trip.points)
      .join("g")
      .attr("class", "shift-space-time__point")
      .attr("transform", (point) => `translate(${x(point.minute)},${y(point.stop)})`);
    points.append("circle").attr("r", 3).attr("fill", color);
    points
      .append("text")
      .attr("x", 5)
      .attr("y", -4)
      .attr("fill", color)
      .text((point) => String(point.minute % 60).padStart(2, "0"));
    points
      .append("title")
      .text((point) => `${t("shifts.space_time_route", { route: trip.routeLabel })} · ${point.stop} - ${clockLabel(point.minute)}`);
  });

  if (depotSeries.length) {
    const depotGroup = root
      .append("g")
      .attr("class", "shift-space-time__depot-series");
    const depotTrips = depotGroup
      .selectAll("g")
      .data(depotSeries)
      .join("g")
      .attr("data-role", "space-time-depot-trip");
    depotTrips
      .append("path")
      .attr("class", "shift-space-time__depot-line")
      .attr("d", (trip) => line(trip.points));
    depotTrips.each(function appendDepotPoints(trip) {
      const points = d3
        .select(this)
        .selectAll("g")
        .data(trip.points)
        .join("g")
        .attr("class", "shift-space-time__depot-point")
        .attr(
          "transform",
          (point) => `translate(${x(point.minute)},${y(point.stop)})`
        );
      points.append("circle").attr("r", 4);
      points
        .append("text")
        .attr("x", 6)
        .attr("y", -5)
        .text((point) => String(point.minute % 60).padStart(2, "0"));
      points
        .append("title")
        .text((point) => `${point.stop} - ${clockLabel(point.minute)}`);
    });

    const dwellSegments = depotSeries.flatMap((trip, index) => {
      const arrival = trip.points[trip.points.length - 1];
      if (!group.transferOnly && !depotStopSet.has(arrival.stop)) return [];
      const departure = depotSeries
        .slice(index + 1)
        .map((candidate) => candidate.points[0])
        .find(
          (point) =>
            point.stop === arrival.stop && point.minute >= arrival.minute
        );
      return departure ? [[arrival, departure]] : [];
    });
    depotGroup
      .selectAll("path.shift-space-time__depot-dwell")
      .data(dwellSegments)
      .join("path")
      .attr("class", "shift-space-time__depot-dwell")
      .attr("data-role", "space-time-depot-dwell")
      .attr("d", (segment) => line(segment));
  }

};

export const renderSpaceTimeDiagram = (container, trips = [], options = {}) => {
  if (!container) return;
  const previousScroll = container.querySelector(".shift-space-time__scroll");
  const scrollLeft = previousScroll?.scrollLeft ?? 0;
  const scrollTop = previousScroll?.scrollTop ?? 0;
  container.innerHTML = "";
  container.classList.remove("shift-space-time--empty");
  container.setAttribute("aria-busy", "false");
  const combined = combineSpaceTimeGroups(buildSpaceTimeGroups(trips));
  let groups = combined ? [combined] : [];
  if (!groups.length) {
    const transferGroup = buildTransferOnlySpaceTimeGroup(
      options.depotTrips,
      options
    );
    if (transferGroup) groups = [transferGroup];
  }
  if (!groups.length) {
    const popup = document.createElement("div");
    popup.className = "shift-space-time__empty-popup";
    popup.setAttribute("role", "status");
    popup.setAttribute("aria-live", "polite");

    const header = document.createElement("header");
    header.className = "shift-space-time__popup-header";
    const title = document.createElement("h3");
    title.textContent = t("common.data_unavailable");
    header.append(title);

    const content = document.createElement("div");
    content.className = "shift-space-time__popup-content";
    const message = document.createElement("p");
    message.textContent = t("shifts.space_time_no_data");
    content.append(message);

    const footer = document.createElement("footer");
    footer.className = "shift-space-time__popup-footer";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "btn-secondary";
    closeButton.textContent = t("common.close");
    closeButton.addEventListener("click", () => {
      popup.remove();
      container.classList.remove("shift-space-time--empty");
    });
    footer.append(closeButton);

    popup.append(header, content, footer);
    container.classList.add("shift-space-time--empty");
    container.append(popup);
    return;
  }
  const depotAssignments = assignDepotTripsToSpaceTimeGroups(
    groups,
    options.depotTrips,
    options
  );
  groups.forEach((group) =>
    appendDiagram(container, group, {
      ...options,
      depotTrips: depotAssignments.get(group.key),
    })
  );
  const scroll = container.querySelector(".shift-space-time__scroll");
  if (scroll) {
    scroll.scrollLeft = scrollLeft;
    scroll.scrollTop = scrollTop;
  }
};

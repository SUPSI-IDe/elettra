import * as d3 from "d3";

import { t } from "../../../i18n/index.js";
import {
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

  return {
    id: firstAvailable(trip?.trip_id, trip?.id, `trip-${index + 1}`),
    routeId,
    routeLabel,
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
      group.stops = mergeStopSequence(
        group.stops,
        trip.points.map((point) => point.stop)
      );
    });

  return Array.from(groups.values());
};

const appendDiagram = (container, group, groupIndex, options = {}) => {
  const depotSeries = Array.isArray(options.depotTrips)
    ? options.depotTrips
        .map(normalizeDiagramTrip)
        .filter((trip) => trip.points.length >= 2)
        .sort((left, right) => left.points[0].minute - right.points[0].minute)
    : [];
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
  heading.className = "sr-only";
  heading.textContent = group.label || t("shifts.space_time_all_routes");
  const summary = document.createElement("span");
  summary.textContent = t("shifts.space_time_summary", {
    trips: group.trips.length,
    stops: group.stops.length,
  });
  const metadata = document.createElement("div");
  metadata.className = "shift-space-time__group-metadata";
  metadata.append(summary);
  if (depotSeries.length) {
    const depotKey = document.createElement("span");
    depotKey.className = "shift-space-time__depot-key";
    depotKey.textContent = t("shifts.timeline_legend_depot");
    metadata.append(depotKey);
  }
  header.append(heading, metadata);

  const scroll = document.createElement("div");
  scroll.className = "shift-space-time__scroll";

  const allMinutes = [...group.trips, ...depotSeries].flatMap((trip) =>
    trip.points.map((point) => point.minute)
  );
  const rawStart = Math.min(...allMinutes);
  const rawEnd = Math.max(...allMinutes);
  const axisStart = Math.floor(rawStart / 30) * 30;
  const axisEnd = Math.max(axisStart + 60, Math.ceil(rawEnd / 30) * 30);
  const margin = { top: 54, right: 36, bottom: 48, left: 190 };
  const innerWidth = Math.max(720, (axisEnd - axisStart) * 2.2);
  const innerHeight = Math.max(280, Math.max(diagramStops.length - 1, 1) * 34);
  const width = innerWidth + margin.left + margin.right;
  const height = innerHeight + margin.top + margin.bottom;

  const svg = d3
    .create("svg")
    .attr("class", "shift-space-time__chart")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", heading.textContent);
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
  const palette = d3.schemeTableau10;
  const series = root
    .append("g")
    .attr("class", "shift-space-time__series")
    .selectAll("g")
    .data(group.trips)
    .join("g")
    .attr("class", "shift-space-time__trip")
    .attr("data-role", "space-time-trip");

  series
    .append("path")
    .attr("d", (trip) => line(trip.points))
    .attr("stroke", (_trip, index) => palette[(index + groupIndex) % palette.length]);
  series.each(function appendTripDetails(trip, tripIndex) {
    const color = palette[(tripIndex + groupIndex) % palette.length];
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
      .text((point) => `${point.stop} - ${clockLabel(point.minute)}`);
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
      if (!depotStopSet.has(arrival.stop)) return [];
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

  scroll.append(svg.node());
  section.append(header, scroll);
  container.append(section);
};

export const renderSpaceTimeDiagram = (container, trips = [], options = {}) => {
  if (!container) return;
  container.innerHTML = "";
  const groups = buildSpaceTimeGroups(trips);
  if (!groups.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "shift-space-time__placeholder";
    placeholder.textContent = t("shifts.space_time_no_data");
    container.append(placeholder);
    return;
  }
  const depotAssignments = new Map(groups.map((group) => [group.key, []]));
  (Array.isArray(options.depotTrips) ? options.depotTrips : []).forEach((trip) => {
    const normalized = normalizeDiagramTrip(trip);
    const matchingGroup = groups.find((group) =>
      normalized.points.some((point) => group.stops.includes(point.stop))
    );
    depotAssignments.get(matchingGroup?.key ?? groups[0].key).push(trip);
  });
  groups.forEach((group, index) =>
    appendDiagram(container, group, index, {
      ...options,
      depotTrips: depotAssignments.get(group.key),
    })
  );
};

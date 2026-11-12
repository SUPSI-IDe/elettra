import * as d3 from "d3";

import { toText } from "../../../ui-helpers";
import { t } from "../../../i18n";
import {
  text,
  parseTimeToMinutes,
  formatMinutes,
  mergeStopSequence,
} from "./shift-utils";

const ensurePlaceholder = (container, message) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const paragraph = document.createElement("p");
  paragraph.className = "timeline__placeholder";
  paragraph.textContent = toText(message ?? "");
  container.append(paragraph);
};

const AXIS_BASE_INTERVAL_MINUTES = 10;
const AXIS_TICK_INTERVAL_OPTIONS = [10, 15, 20, 30, 60, 120, 180, 240];

const roundDownToInterval = (value, interval = AXIS_BASE_INTERVAL_MINUTES) =>
  Math.max(0, Math.floor(value / interval) * interval);

const roundUpToInterval = (value, interval = AXIS_BASE_INTERVAL_MINUTES) =>
  Math.ceil(value / interval) * interval;

const chooseVisibleTickInterval = (minutesSpan, chartWidth) => {
  const maxVisibleTicks = Math.max(4, Math.floor(chartWidth / 88));
  return (
    AXIS_TICK_INTERVAL_OPTIONS.find(
      (interval) => minutesSpan / interval <= maxVisibleTicks
    ) ?? AXIS_TICK_INTERVAL_OPTIONS[AXIS_TICK_INTERVAL_OPTIONS.length - 1]
  );
};

const buildTickMinutes = (d3, start, end, interval) => {
  const ticks = d3
    .range(start, end + interval, interval)
    .filter((minute) => minute >= start && minute <= end);

  if (!ticks.length || ticks[0] !== start) {
    ticks.unshift(start);
  }
  if (ticks[ticks.length - 1] !== end) {
    ticks.push(end);
  }

  return [...new Set(ticks)];
};

const tripTimelinePoints = (trip = {}) => {
  const stopTimes = Array.isArray(trip?.stop_times) ? trip.stop_times : [];
  if (stopTimes.length) {
    return stopTimes
      .map((stopTime) => ({
        time: parseTimeToMinutes(
          stopTime?.departure_time || stopTime?.arrival_time
        ),
        stop: text(stopTime?.stop_name || stopTime?.stop?.name).trim(),
      }))
      .filter((point) => point.stop && Number.isFinite(point.time));
  }
  return [
    {
      time: parseTimeToMinutes(trip?.departure_time),
      stop: text(trip?.start_stop_name).trim(),
    },
    {
      time: parseTimeToMinutes(trip?.arrival_time),
      stop: text(trip?.end_stop_name).trim(),
    },
  ].filter((point) => point.stop && Number.isFinite(point.time));
};

export const renderTimeline = async (container, trips = [], options = {}) => {
  if (!container) {
    return;
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    ensurePlaceholder(container, t("shifts.timeline_placeholder"));
    return;
  }

  const showAllStops = options.showAllStops === true;
  const depotTrips = Array.isArray(options.depotTrips)
    ? options.depotTrips
    : [];

  let serviceStops = [];
  trips.forEach((trip = {}) => {
    const stopTimes = trip.stop_times || [];
    let sequence = [];
    if (stopTimes.length > 0) {
      if (showAllStops) {
        sequence = stopTimes.map(
          (stopTime) => stopTime?.stop_name || stopTime?.stop?.name
        );
      } else {
        const firstStop = stopTimes[0];
        const lastStop = stopTimes[stopTimes.length - 1];
        sequence = [
          firstStop?.stop_name || firstStop?.stop?.name,
          lastStop?.stop_name || lastStop?.stop?.name,
        ];
      }
    } else {
      sequence = [trip?.start_stop_name, trip?.end_stop_name];
    }
    serviceStops = mergeStopSequence(
      serviceStops,
      sequence.map((stop) => text(stop).trim()).filter(Boolean)
    );
  });

  const startDepot = text(options.startDepotName).trim();
  const endDepot = text(options.endDepotName).trim();
  const depotStops = [];
  depotTrips.forEach((trip) => {
    tripTimelinePoints(trip).forEach((point) => {
      if (
        !serviceStops.includes(point.stop) &&
        !depotStops.includes(point.stop)
      ) {
        depotStops.push(point.stop);
      }
    });
  });
  const leadingDepot = startDepot && depotStops.includes(startDepot)
    ? startDepot
    : "";
  const trailingDepots = depotStops.filter((stop) => stop !== leadingDepot);
  if (endDepot && trailingDepots.includes(endDepot)) {
    trailingDepots.splice(trailingDepots.indexOf(endDepot), 1);
    trailingDepots.push(endDepot);
  }
  const stops = [
    ...(leadingDepot ? [leadingDepot] : []),
    ...serviceStops,
    ...trailingDepots,
  ];
  if (startDepot && !stops.includes(startDepot)) stops.unshift(startDepot);
  if (endDepot && !stops.includes(endDepot)) stops.push(endDepot);

  if (!stops.length) {
    ensurePlaceholder(
      container,
      t("shifts.insufficient_stops")
    );
    return;
  }

  container.innerHTML = "";

  const tooltip = d3
    .select(container)
    .selectAll(".timeline-tooltip")
    .data([null])
    .join("div")
    .attr("class", "timeline-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("display", "none")
    .style("padding", "6px 10px")
    .style("border-radius", "4px")
    .style("background", "rgba(0, 0, 0, 0.8)")
    .style("color", "var(--color-surface)")
    .style("font-size", "0.75rem")
    .style("z-index", "1000")
    .style("white-space", "nowrap");

  const width = Math.max(container.clientWidth || 0, 720);
  const rowHeight = 36;
  const margin = { top: 32, right: 32, bottom: 72, left: 168 };
  let innerHeight = Math.max((stops.length - 1) * rowHeight, rowHeight);

  // In the shift form, the container has a fixed height. If there are only a few
  // stops, the computed innerHeight can be much smaller than the available space,
  // which creates big vertical "wasted space". Expand the Y spacing to fill.
  if (container.classList?.contains("shift-form-timeline")) {
    try {
      const styles = window.getComputedStyle(container);
      const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
      const available =
        (container.clientHeight || 0) -
        paddingTop -
        paddingBottom -
        margin.top -
        margin.bottom;
      if (available > innerHeight) {
        innerHeight = available;
      }
    } catch (e) {
      // ignore (non-browser env / computedStyle failure)
    }
  }

  const height = innerHeight + margin.top + margin.bottom;
  const innerWidth = width - margin.left - margin.right;

  const startMinutes = parseTimeToMinutes(options.startTime) ?? 0;
  let endMinutes = parseTimeToMinutes(options.endTime) ?? 24 * 60;
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  // Ensure at least 1 hour range to avoid zero-width axis
  if (endMinutes <= startMinutes) {
    endMinutes = startMinutes + 60;
  }

  const axisStart = roundDownToInterval(startMinutes);
  const axisEnd =
    roundUpToInterval(endMinutes) > axisStart
      ? roundUpToInterval(endMinutes)
      : axisStart + AXIS_BASE_INTERVAL_MINUTES;

  const xScale = d3
    .scaleLinear()
    .domain([axisStart, axisEnd])
    .range([0, innerWidth]);
  const yScale = d3
    .scalePoint()
    .domain(stops)
    .range([0, innerHeight])
    .padding(0.5);

  const svg = d3
    .create("svg")
    .attr("class", "timeline__chart")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "presentation")
    .attr("aria-hidden", "true")
    // Avoid centering/letterboxing inside taller containers (shift form timeline).
    .attr("preserveAspectRatio", "xMinYMin meet");

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const showTooltip = (event, point) => {
    if (!point || !point.stop) {
      tooltip.style("display", "none");
      return;
    }
    const rect = container.getBoundingClientRect();
    tooltip
      .text(`${formatMinutes(point.time)} — ${point.stop}`)
      .style("display", "block")
      .style("left", `${event.clientX - rect.left + 12}px`)
      .style("top", `${event.clientY - rect.top + 12}px`);
  };

  const hideTooltip = () => tooltip.style("display", "none");

  const horizontal = root
    .append("g")
    .attr("class", "timeline__grid timeline__grid--horizontal");
  horizontal
    .selectAll("line")
    .data(stops)
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", (stop) => yScale(stop))
    .attr("y2", (stop) => yScale(stop));

  const visibleTickInterval = chooseVisibleTickInterval(
    axisEnd - axisStart,
    innerWidth
  );
  const tickMinutes = buildTickMinutes(
    d3,
    axisStart,
    axisEnd,
    visibleTickInterval
  );
  const vertical = root
    .append("g")
    .attr("class", "timeline__grid timeline__grid--vertical");
  vertical
    .selectAll("line")
    .data(tickMinutes)
    .join("line")
    .attr("x1", (minute) => xScale(minute))
    .attr("x2", (minute) => xScale(minute))
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const xAxis = root
    .append("g")
    .attr("class", "timeline__axis timeline__axis--x")
    .attr("transform", `translate(0,${innerHeight})`);
  const rotateTickLabels = innerWidth / tickMinutes.length < 78;
  const tickLabelY = rotateTickLabels ? 18 : 10;
  xAxis
    .selectAll("text")
    .data(tickMinutes)
    .join("text")
    .attr("x", (minute) => xScale(minute))
    .attr("y", tickLabelY)
    .attr("text-anchor", rotateTickLabels ? "end" : "middle")
    .attr("dominant-baseline", rotateTickLabels ? "middle" : "hanging")
    .attr("transform", (minute) => {
      if (!rotateTickLabels) {
        return null;
      }
      return `rotate(-45,${xScale(minute)},${tickLabelY})`;
    })
    .text((minute) => formatMinutes(minute));

  const yAxis = root
    .append("g")
    .attr("class", "timeline__axis timeline__axis--y");
  yAxis
    .selectAll("foreignObject")
    .data(stops)
    .join("foreignObject")
    .attr("x", -margin.left)
    .attr("y", (stop) => yScale(stop) - rowHeight / 2)
    .attr("width", margin.left - 16)
    .attr("height", rowHeight)
    .append("xhtml:div")
    .attr("class", "timeline__stop-label")
    .style("height", "100%")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "flex-end")
    .style("text-align", "right")
    .style("line-height", "1.2")
    .text((stop) => toText(stop));

  const serieGroup = root.append("g").attr("class", "timeline__series");

  const line = d3
    .line()
    .x((point) => xScale(point.time))
    .y((point) => yScale(point.stop))
    .curve(d3.curveMonotoneX);

  // Draw lines connecting stops for each trip
  serieGroup
    .selectAll("path")
    .data(trips)
    .join("path")
    .attr("class", "timeline__trip-line")
    .attr("d", (trip) => {
      const stopTimes = trip.stop_times || [];
      
      if (stopTimes.length > 0 && showAllStops) {
        // Draw line through ALL stops
        const allPoints = stopTimes.map((stopTime) => {
          const time = parseTimeToMinutes(stopTime?.departure_time || stopTime?.arrival_time) ?? 0;
          const stopName = stopTime?.stop_name || stopTime?.stop?.name || "";
          return { time, stop: stopName };
        }).filter((pt) => pt.stop);
        
        return allPoints.length > 1 ? line(allPoints) : null;
      } else if (stopTimes.length > 0) {
        // Draw line connecting only start and end stops
        const firstStop = stopTimes[0];
        const lastStop = stopTimes[stopTimes.length - 1];
        const departure = parseTimeToMinutes(firstStop?.departure_time || firstStop?.arrival_time) ?? 0;
        const arrival = parseTimeToMinutes(lastStop?.arrival_time || lastStop?.departure_time) ?? departure + 10;
        const startStop = firstStop?.stop_name || firstStop?.stop?.name || "";
        const endStop = lastStop?.stop_name || lastStop?.stop?.name || "";
        
        return line([
          { time: departure, stop: startStop },
          { time: arrival, stop: endStop },
        ]);
      } else {
        // Fallback for trips without stop_times
        const departure = parseTimeToMinutes(trip?.departure_time) ?? 0;
        const arrival = parseTimeToMinutes(trip?.arrival_time) ?? Math.min(departure + 10, 24 * 60);
        const startStop = trip?.start_stop_name ?? "";
        const endStop = trip?.end_stop_name ?? "";
        
        return line([
          { time: departure, stop: startStop },
          { time: arrival, stop: endStop },
        ]);
      }
    });

  // Draw depot connection lines (in orange)
  const depotGroup = root.append("g").attr("class", "timeline__depot-connections");

  const startDepotName = text(options.startDepotName).trim();
  const endDepotName = text(options.endDepotName).trim();
  const shiftStartTime = parseTimeToMinutes(options.startTime);
  const shiftEndTime = parseTimeToMinutes(options.endTime);

  const depotSeries = depotTrips
    .map((trip) => ({ trip, points: tripTimelinePoints(trip) }))
    .filter((entry) => entry.points.length >= 2)
    .sort((left, right) => left.points[0].time - right.points[0].time);

  if (depotSeries.length) {
    depotGroup
      .selectAll("path.timeline__depot-line")
      .data(depotSeries)
      .join("path")
      .attr("class", "timeline__depot-line")
      .attr("d", (entry) => line(entry.points));

    const depotStopSet = new Set(depotStops);
    const dwellSegments = depotSeries.flatMap((entry, index) => {
      const arrival = entry.points[entry.points.length - 1];
      if (!depotStopSet.has(arrival.stop)) return [];
      const nextDeparture = depotSeries
        .slice(index + 1)
        .map((candidate) => candidate.points[0])
        .find(
          (departure) =>
            departure.stop === arrival.stop && departure.time >= arrival.time
        );
      return nextDeparture
        ? [[arrival, nextDeparture]]
        : [];
    });
    depotGroup
      .selectAll("path.timeline__depot-dwell")
      .data(dwellSegments)
      .join("path")
      .attr("class", "timeline__depot-dwell")
      .attr("d", (segment) => line(segment));
  } else {
    const firstTripPoints = tripTimelinePoints(trips[0]);
    const lastTripPoints = tripTimelinePoints(trips[trips.length - 1]);
    const firstTripPoint = firstTripPoints[0];
    const lastTripPoint = lastTripPoints[lastTripPoints.length - 1];

    if (
      startDepotName &&
      firstTripPoint &&
      Number.isFinite(shiftStartTime)
    ) {
      depotGroup
        .append("path")
        .attr("class", "timeline__depot-line")
        .attr("d", line([
          { time: shiftStartTime, stop: startDepotName },
          firstTripPoint,
        ]));
    }
    if (
      endDepotName &&
      lastTripPoint &&
      Number.isFinite(shiftEndTime)
    ) {
      depotGroup
        .append("path")
        .attr("class", "timeline__depot-line")
        .attr("d", line([
          lastTripPoint,
          { time: shiftEndTime, stop: endDepotName },
        ]));
    }
  }

  // Draw points for stops
  const points = root.append("g").attr("class", "timeline__points");
  points
    .selectAll("g")
    .data(trips)
    .join("g")
    .each(function drawPoints(trip) {
      const group = d3.select(this);
      const stopTimes = trip.stop_times || [];
      
      if (stopTimes.length > 0 && showAllStops) {
        // Draw points for ALL stops
        stopTimes.forEach((stopTime, index) => {
          const time = parseTimeToMinutes(stopTime?.departure_time || stopTime?.arrival_time) ?? 0;
          const stopName = stopTime?.stop_name || stopTime?.stop?.name || "";
          if (!stopName) return;
          
          const isFirst = index === 0;
          const isLast = index === stopTimes.length - 1;
          const pointClass = isFirst ? "timeline__point timeline__point--start" :
                            isLast ? "timeline__point timeline__point--end" :
                            "timeline__point timeline__point--intermediate";
          
          group
            .append("circle")
            .attr("class", pointClass)
            .attr("cx", xScale(time))
            .attr("cy", yScale(stopName))
            .attr("r", isFirst || isLast ? 5 : 3)
            .datum({ time, stop: stopName })
            .on("mouseover", showTooltip)
            .on("mousemove", showTooltip)
            .on("mouseout", hideTooltip);
        });
      } else if (stopTimes.length > 0) {
        // Draw points only for start and end stops
        const firstStop = stopTimes[0];
        const lastStop = stopTimes[stopTimes.length - 1];
        const departure = parseTimeToMinutes(firstStop?.departure_time || firstStop?.arrival_time) ?? 0;
        const arrival = parseTimeToMinutes(lastStop?.arrival_time || lastStop?.departure_time) ?? departure + 10;
        const startStop = firstStop?.stop_name || firstStop?.stop?.name || "";
        const endStop = lastStop?.stop_name || lastStop?.stop?.name || "";

        group
          .append("circle")
          .attr("class", "timeline__point timeline__point--start")
          .attr("cx", xScale(departure))
          .attr("cy", yScale(startStop))
          .attr("r", 5)
          .datum({ time: departure, stop: startStop })
          .on("mouseover", showTooltip)
          .on("mousemove", showTooltip)
          .on("mouseout", hideTooltip);

        group
          .append("circle")
          .attr("class", "timeline__point timeline__point--end")
          .attr("cx", xScale(arrival))
          .attr("cy", yScale(endStop))
          .attr("r", 5)
          .datum({ time: arrival, stop: endStop })
          .on("mouseover", showTooltip)
          .on("mousemove", showTooltip)
          .on("mouseout", hideTooltip);
      } else {
        // Fallback for trips without stop_times
        const departure = parseTimeToMinutes(trip?.departure_time) ?? 0;
        const arrival = parseTimeToMinutes(trip?.arrival_time) ?? Math.min(departure + 10, 24 * 60);
        const startStop = trip?.start_stop_name ?? "";
        const endStop = trip?.end_stop_name ?? "";

        group
          .append("circle")
          .attr("class", "timeline__point timeline__point--start")
          .attr("cx", xScale(departure))
          .attr("cy", yScale(startStop))
          .attr("r", 5)
          .datum({ time: departure, stop: startStop })
          .on("mouseover", showTooltip)
          .on("mousemove", showTooltip)
          .on("mouseout", hideTooltip);

        group
          .append("circle")
          .attr("class", "timeline__point timeline__point--end")
          .attr("cx", xScale(arrival))
          .attr("cy", yScale(endStop))
          .attr("r", 5)
          .datum({ time: arrival, stop: endStop })
          .on("mouseover", showTooltip)
          .on("mousemove", showTooltip)
          .on("mouseout", hideTooltip);
      }
    });

  // Draw depot points
  const depotPoints = root.append("g").attr("class", "timeline__depot-points");

  const depotPointData = depotSeries.length
    ? depotSeries.flatMap((entry) => [
        entry.points[0],
        entry.points[entry.points.length - 1],
      ])
    : [
        { time: shiftStartTime, stop: startDepotName },
        { time: shiftEndTime, stop: endDepotName },
      ].filter((point) => point.stop && Number.isFinite(point.time));
  depotPoints
    .selectAll("circle")
    .data(depotPointData)
    .join("circle")
    .attr("class", "timeline__point timeline__point--depot")
    .attr("cx", (point) => xScale(point.time))
    .attr("cy", (point) => yScale(point.stop))
    .attr("r", 6)
    .on("mouseover", showTooltip)
    .on("mousemove", showTooltip)
    .on("mouseout", hideTooltip);

  container.append(svg.node());
};

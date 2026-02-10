import { textContent } from "../../../ui-helpers";
import { text, parseTimeToMinutes, formatMinutes } from "./shift-utils";

const ensureD3 = (() => {
  let loader = null;
  return () => {
    if (!loader) {
      loader = import("https://cdn.jsdelivr.net/npm/d3@7/+esm").catch(
        (error) => {
          console.error("Unable to load d3", error);
          loader = null;
          throw error;
        }
      );
    }
    return loader;
  };
})();

const ensurePlaceholder = (container, message) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const paragraph = document.createElement("p");
  paragraph.className = "timeline__placeholder";
  paragraph.textContent = textContent(message ?? "");
  container.append(paragraph);
};

export const renderTimeline = async (container, trips = [], options = {}) => {
  if (!container) {
    return;
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    ensurePlaceholder(container, "Add trips to visualize the shift timeline.");
    return;
  }

  const showAllStops = options.showAllStops === true;

  // Collect stops for the timeline
  const stopsSet = new Map();
  const addStop = (label) => {
    const normalized = text(label).trim();
    if (!normalized || stopsSet.has(normalized)) {
      return;
    }
    stopsSet.set(normalized, stopsSet.size);
  };

  // Add start depot
  addStop(options.startDepotName);
  
  // Add stops for each trip
  trips.forEach((trip = {}) => {
    const stopTimes = trip.stop_times || [];
    if (stopTimes.length > 0) {
      if (showAllStops) {
        // Add ALL stops for each trip
        stopTimes.forEach((stopTime) => {
          addStop(stopTime?.stop_name || stopTime?.stop?.name);
        });
      } else {
        // Only add start and end stops (simplified view)
        const firstStop = stopTimes[0];
        addStop(firstStop?.stop_name || firstStop?.stop?.name);
        const lastStop = stopTimes[stopTimes.length - 1];
        addStop(lastStop?.stop_name || lastStop?.stop?.name);
      }
    } else {
      // Fallback for trips without stop_times
      addStop(trip?.start_stop_name);
      addStop(trip?.end_stop_name);
    }
  });
  
  // Add end depot
  addStop(options.endDepotName);

  const stops = Array.from(stopsSet.keys());

  if (!stops.length) {
    ensurePlaceholder(
      container,
      "Insufficient stop information to render timeline."
    );
    return;
  }

  let d3;
  try {
    d3 = await ensureD3();
  } catch (error) {
    ensurePlaceholder(container, "Unable to load visualization library.");
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
    .style("color", "#fff")
    .style("font-size", "0.75rem")
    .style("z-index", "1000")
    .style("white-space", "nowrap");

  const width = Math.max(container.clientWidth || 0, 720);
  const rowHeight = 56;
  const margin = { top: 32, right: 32, bottom: 48, left: 168 };
  const innerHeight = Math.max((stops.length - 1) * rowHeight, rowHeight);
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

  const tickInterval = 10;
  const roundDownToInterval = (value) =>
    Math.max(0, Math.floor(value / tickInterval) * tickInterval);
  const roundUpToInterval = (value) =>
    Math.ceil(value / tickInterval) * tickInterval;

  const axisStart = roundDownToInterval(startMinutes);
  const axisEnd =
    roundUpToInterval(endMinutes) > axisStart
      ? roundUpToInterval(endMinutes)
      : axisStart + tickInterval;

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
    .attr("preserveAspectRatio", "xMidYMid meet");

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

  const tickMinutes = d3.range(axisStart, axisEnd + 1, tickInterval);
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
    .attr("class", "timeline__axis timeline__axis--x");
  xAxis
    .selectAll("text")
    .data(tickMinutes)
    .join("text")
    .attr("x", (minute) => xScale(minute))
    .attr("y", innerHeight + 24)
    .attr(
      "transform",
      (minute) =>
        `translate(${xScale(minute)},${innerHeight + 24}) rotate(-90)`
    )
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
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
    .style("height", "100%")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "flex-end")
    .style("text-align", "right")
    .style("font-size", "0.85rem")
    .style("line-height", "1.2")
    .style("color", "#334")
    .style("font-family", "inherit")
    .text((stop) => textContent(stop));

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
  
  // Get first trip's first stop info
  const firstTrip = trips[0];
  const firstTripStopTimes = firstTrip?.stop_times || [];
  let firstTripFirstStop = "";
  let firstTripDeparture = null;
  
  if (firstTripStopTimes.length > 0) {
    const firstStop = firstTripStopTimes[0];
    firstTripFirstStop = firstStop?.stop_name || firstStop?.stop?.name || "";
    firstTripDeparture = parseTimeToMinutes(firstStop?.departure_time || firstStop?.arrival_time);
  } else {
    firstTripFirstStop = firstTrip?.start_stop_name || "";
    firstTripDeparture = parseTimeToMinutes(firstTrip?.departure_time);
  }
  
  // Get last trip's last stop info
  const lastTrip = trips[trips.length - 1];
  const lastTripStopTimes = lastTrip?.stop_times || [];
  let lastTripLastStop = "";
  let lastTripArrival = null;
  
  if (lastTripStopTimes.length > 0) {
    const lastStop = lastTripStopTimes[lastTripStopTimes.length - 1];
    lastTripLastStop = lastStop?.stop_name || lastStop?.stop?.name || "";
    lastTripArrival = parseTimeToMinutes(lastStop?.arrival_time || lastStop?.departure_time);
  } else {
    lastTripLastStop = lastTrip?.end_stop_name || "";
    lastTripArrival = parseTimeToMinutes(lastTrip?.arrival_time);
  }
  
  // Draw line from start depot to first trip's first stop
  if (startDepotName && firstTripFirstStop && shiftStartTime !== null && firstTripDeparture !== null) {
    depotGroup
      .append("path")
      .attr("class", "timeline__depot-line")
      .attr("d", line([
        { time: shiftStartTime, stop: startDepotName },
        { time: firstTripDeparture, stop: firstTripFirstStop },
      ]));
  }
  
  // Draw line from last trip's last stop to end depot
  if (endDepotName && lastTripLastStop && lastTripArrival !== null && shiftEndTime !== null) {
    depotGroup
      .append("path")
      .attr("class", "timeline__depot-line")
      .attr("d", line([
        { time: lastTripArrival, stop: lastTripLastStop },
        { time: shiftEndTime, stop: endDepotName },
      ]));
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
  
  // Start depot point
  if (startDepotName && shiftStartTime !== null) {
    depotPoints
      .append("circle")
      .attr("class", "timeline__point timeline__point--depot")
      .attr("cx", xScale(shiftStartTime))
      .attr("cy", yScale(startDepotName))
      .attr("r", 6)
      .datum({ time: shiftStartTime, stop: startDepotName })
      .on("mouseover", showTooltip)
      .on("mousemove", showTooltip)
      .on("mouseout", hideTooltip);
  }
  
  // End depot point
  if (endDepotName && shiftEndTime !== null) {
    depotPoints
      .append("circle")
      .attr("class", "timeline__point timeline__point--depot")
      .attr("cx", xScale(shiftEndTime))
      .attr("cy", yScale(endDepotName))
      .attr("r", 6)
      .datum({ time: shiftEndTime, stop: endDepotName })
      .on("mouseover", showTooltip)
      .on("mousemove", showTooltip)
      .on("mouseout", hideTooltip);
  }

  container.append(svg.node());
};

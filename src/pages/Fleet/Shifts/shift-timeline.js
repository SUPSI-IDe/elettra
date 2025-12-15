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

  const stopsSet = new Map();
  const addStop = (label) => {
    const normalized = text(label).trim();
    if (!normalized || stopsSet.has(normalized)) {
      return;
    }
    stopsSet.set(normalized, stopsSet.size);
  };

  addStop(options.startDepotName);
  trips.forEach((trip = {}) => {
    const stopTimes = trip.stop_times || [];
    if (stopTimes.length > 0) {
      stopTimes.forEach((st) => addStop(st.stop_name || st.stop?.name));
    } else {
      // Fallback for trips without stop_times (shouldn't happen with correct fetching but safety first)
      addStop(trip?.start_stop_name);
      addStop(trip?.end_stop_name);
    }
  });
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

  const xScale = d3
    .scaleLinear()
    .domain([startMinutes, endMinutes])
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

  const tickMinutes = xScale.ticks(5);
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
    .attr("text-anchor", "middle")
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

  serieGroup
    .selectAll("path")
    .data(trips)
    .join("path")
    .attr("class", "timeline__trip-line")
    .attr("d", (trip) => {
      const stopTimes = trip.stop_times || [];
      if (stopTimes.length > 0) {
        const points = stopTimes.map((st) => ({
          time: parseTimeToMinutes(st.departure_time || st.arrival_time) ?? 0,
          stop: st.stop_name || st.stop?.name || "",
        }));
        return line(points);
      } else {
        // Fallback
        const departure = parseTimeToMinutes(trip?.departure_time) ?? 0;
        const arrival =
          parseTimeToMinutes(trip?.arrival_time) ??
          Math.min(departure + 10, 24 * 60);
        return line([
          { time: departure, stop: trip?.start_stop_name ?? "" },
          { time: arrival, stop: trip?.end_stop_name ?? "" },
        ]);
      }
    });

  const points = root.append("g").attr("class", "timeline__points");
  points
    .selectAll("g")
    .data(trips)
    .join("g")
    .each(function drawPoints(trip) {
      const group = d3.select(this);
      const stopTimes = trip.stop_times || [];

      if (stopTimes.length > 0) {
        stopTimes.forEach((st, index) => {
          const time =
            parseTimeToMinutes(st.departure_time || st.arrival_time) ?? 0;
          const stop = st.stop_name || st.stop?.name || "";
          const isStart = index === 0;
          const isEnd = index === stopTimes.length - 1;
          const className =
            isStart
              ? "timeline__point timeline__point--start"
              : isEnd
              ? "timeline__point timeline__point--end"
              : "timeline__point";

          group
            .append("circle")
            .attr("class", className)
            .attr("cx", xScale(time))
            .attr("cy", yScale(stop))
            .attr("r", 4);
        });
      } else {
        // Fallback
        const departure = parseTimeToMinutes(trip?.departure_time) ?? 0;
        const arrival =
          parseTimeToMinutes(trip?.arrival_time) ??
          Math.min(departure + 10, 24 * 60);
        const startStop = trip?.start_stop_name ?? "";
        const endStop = trip?.end_stop_name ?? "";

        group
          .append("circle")
          .attr("class", "timeline__point timeline__point--start")
          .attr("cx", xScale(departure))
          .attr("cy", yScale(startStop))
          .attr("r", 4);

        group
          .append("circle")
          .attr("class", "timeline__point timeline__point--end")
          .attr("cx", xScale(arrival))
          .attr("cy", yScale(endStop))
          .attr("r", 4);
      }
    });

  container.append(svg.node());
};

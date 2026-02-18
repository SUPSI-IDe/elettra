/**
 * D3 chart renderers for the simulation result page.
 */

const ensureD3 = (() => {
  let loader = null;
  return () => {
    if (!loader) {
      loader = import("https://cdn.jsdelivr.net/npm/d3@7/+esm").catch(
        (error) => {
          console.error("Unable to load d3", error);
          loader = null;
          throw error;
        },
      );
    }
    return loader;
  };
})();

// Color palette
const COLORS = {
  consumptionAndMaintenance: "#e8782a", // orange
  chargers: "#f5c542", // yellow
  otherCosts: "#4caf50", // green
  diesel: "#9e9e9e", // gray
  dieselLine: "#9e9e9e",
  electric: "#4caf50", // green
  electricLine: "#4caf50",
  directEmissions: "#e57373", // red
  indirectEmissions: "#ffb74d", // amber
  tooltipBg: "rgba(30, 30, 30, 0.92)",
};

const formatCHF = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
};

/* ────────────────────────────────────────────────────────────
   Tooltip helpers
   ──────────────────────────────────────────────────────────── */

const createTooltip = (container) => {
  let tip = container.querySelector(".chart-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "chart-tooltip";
    container.appendChild(tip);
  }
  return tip;
};

const showTooltip = (tip, html, event, container) => {
  tip.innerHTML = html;
  tip.style.display = "block";

  const rect = container.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = event.clientX - rect.left + 12;
  let top = event.clientY - rect.top - 10;

  if (left + tipRect.width > rect.width) left = left - tipRect.width - 24;
  if (top + tipRect.height > rect.height) top = top - tipRect.height;
  if (top < 0) top = 4;

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
};

const hideTooltip = (tip) => {
  tip.style.display = "none";
};

/* ────────────────────────────────────────────────────────────
   1. Average annual costs – stacked bar chart
   ──────────────────────────────────────────────────────────── */

export const renderAnnualCostsChart = async (container, data) => {
  if (!container || !data) return;

  let d3;
  try {
    d3 = await ensureD3();
  } catch {
    container.textContent = "Unable to load chart library.";
    return;
  }

  container.innerHTML = "";
  const tip = createTooltip(container);

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = Math.max(container.clientWidth || 0, 400);
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const categories = ["diesel", "electric"];
  const labels = { diesel: "Equivalent diesel bus", electric: "Electric bus" };
  const stackKeys = ["consumptionAndMaintenance", "chargers", "otherCosts"];
  const stackLabels = {
    consumptionAndMaintenance: "Consumption and maintenance",
    chargers: "Chargers",
    otherCosts: "Other costs",
  };
  const stackColors = {
    consumptionAndMaintenance: COLORS.consumptionAndMaintenance,
    chargers: COLORS.chargers,
    otherCosts: COLORS.otherCosts,
  };

  const barData = categories.map((cat) => ({
    category: cat,
    label: labels[cat],
    consumptionAndMaintenance: data[cat].consumptionAndMaintenance,
    chargers: data[cat].chargers,
    otherCosts: data[cat].otherCosts,
    total: data[cat].total,
  }));

  const maxVal = d3.max(barData, (d) => d.total);

  const x = d3.scaleBand().domain(categories).range([0, innerW]).padding(0.45);

  const y = d3
    .scaleLinear()
    .domain([0, maxVal * 1.15])
    .range([innerH, 0]);

  const stack = d3.stack().keys(stackKeys);
  const series = stack(barData);

  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Y axis
  g.append("g")
    .attr("class", "axis axis--y")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => formatCHF(d)),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // Y axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 14)
    .attr("x", -innerH / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("CHF / year");

  // X axis
  g.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat((d) => labels[d]))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // Grid lines
  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => y(d))
    .attr("y2", (d) => y(d))
    .attr("stroke", "#eee")
    .attr("stroke-dasharray", "3,3");

  // Bars
  g.selectAll("g.layer")
    .data(series)
    .join("g")
    .attr("class", "layer")
    .attr("fill", (d) => stackColors[d.key])
    .selectAll("rect")
    .data((d) => d.map((v) => ({ ...v, key: d.key })))
    .join("rect")
    .attr("x", (d) => x(d.data.category))
    .attr("y", (d) => y(d[1]))
    .attr("height", (d) => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth())
    .attr("rx", 2)
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => {
      const value = d[1] - d[0];
      const html = `
        <strong>${d.data.label}</strong><br/>
        ${stackLabels[d.key]}: <strong>CHF ${value.toLocaleString("de-CH")}</strong><br/>
        Total: CHF ${d.data.total.toLocaleString("de-CH")}
      `;
      showTooltip(tip, html, event, container);
    })
    .on("mouseleave", () => hideTooltip(tip));

  container.appendChild(svg.node());
};

/* ────────────────────────────────────────────────────────────
   2. Break point analysis – line chart
   ──────────────────────────────────────────────────────────── */

export const renderBreakPointChart = async (container, data) => {
  if (!container || !data?.length) return;

  let d3;
  try {
    d3 = await ensureD3();
  } catch {
    container.textContent = "Unable to load chart library.";
    return;
  }

  container.innerHTML = "";
  const tip = createTooltip(container);

  const margin = { top: 20, right: 80, bottom: 40, left: 60 };
  const width = Math.max(container.clientWidth || 0, 400);
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxVal = d3.max(data, (d) => Math.max(d.diesel, d.electric));

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.year)])
    .range([0, innerW]);

  const y = d3
    .scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([innerH, 0]);

  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Grid
  g.append("g")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => y(d))
    .attr("y2", (d) => y(d))
    .attr("stroke", "#eee")
    .attr("stroke-dasharray", "3,3");

  // Y axis
  g.append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => formatCHF(d)),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // Y label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 14)
    .attr("x", -innerH / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("M CHF");

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(data.length - 1)
        .tickFormat((d) => d),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // X label
  g.append("text")
    .attr("x", innerW)
    .attr("y", innerH + 34)
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("Years");

  // Line generators
  const dieselLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.diesel))
    .curve(d3.curveMonotoneX);

  const electricLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.electric))
    .curve(d3.curveMonotoneX);

  // Area fill for electric line
  const electricArea = d3
    .area()
    .x((d) => x(d.year))
    .y0(innerH)
    .y1((d) => y(d.electric))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("d", electricArea)
    .attr("fill", COLORS.electric)
    .attr("fill-opacity", 0.08);

  // Diesel line
  g.append("path")
    .datum(data)
    .attr("d", dieselLine)
    .attr("fill", "none")
    .attr("stroke", COLORS.dieselLine)
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Electric line
  g.append("path")
    .datum(data)
    .attr("d", electricLine)
    .attr("fill", "none")
    .attr("stroke", COLORS.electricLine)
    .attr("stroke-width", 2.5);

  // Line labels
  const last = data[data.length - 1];
  g.append("text")
    .attr("x", innerW + 6)
    .attr("y", y(last.diesel))
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("fill", COLORS.dieselLine)
    .style("font-weight", "600")
    .text("Diesel bus");

  g.append("text")
    .attr("x", innerW + 6)
    .attr("y", y(last.electric))
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("fill", COLORS.electricLine)
    .style("font-weight", "600")
    .text("Electric bus");

  // Hover dots & tooltip
  const hoverGroup = g.append("g").style("display", "none");

  const hoverLine = hoverGroup
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", "#aaa")
    .attr("stroke-dasharray", "3,3");

  const dieselDot = hoverGroup
    .append("circle")
    .attr("r", 5)
    .attr("fill", COLORS.dieselLine)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  const electricDot = hoverGroup
    .append("circle")
    .attr("r", 5)
    .attr("fill", COLORS.electricLine)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  // Invisible overlay for mouse events
  g.append("rect")
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const yearVal = x.invert(mx);
      const bisect = d3.bisector((d) => d.year).left;
      const idx = Math.min(
        Math.max(bisect(data, yearVal, 0), 0),
        data.length - 1,
      );
      // Snap to closest point
      const d0 = data[Math.max(idx - 1, 0)];
      const d1 = data[idx];
      const d = yearVal - d0.year > d1.year - yearVal ? d1 : d0;

      hoverGroup.style("display", null);
      hoverLine.attr("x1", x(d.year)).attr("x2", x(d.year));
      dieselDot.attr("cx", x(d.year)).attr("cy", y(d.diesel));
      electricDot.attr("cx", x(d.year)).attr("cy", y(d.electric));

      const html = `
        <strong>Year ${d.year}</strong><br/>
        Diesel: <span style="color:${COLORS.dieselLine}">CHF ${d.diesel.toLocaleString("de-CH")}</span><br/>
        Electric: <span style="color:${COLORS.electricLine}">CHF ${d.electric.toLocaleString("de-CH")}</span>
      `;
      showTooltip(tip, html, event, container);
    })
    .on("mouseleave", () => {
      hoverGroup.style("display", "none");
      hideTooltip(tip);
    });

  container.appendChild(svg.node());
};

/* ────────────────────────────────────────────────────────────
   3. Efficiency – CHF/km stacked bar chart
   ──────────────────────────────────────────────────────────── */

export const renderEfficiencyBarChart = async (container, data) => {
  if (!container || !data) return;

  let d3;
  try {
    d3 = await ensureD3();
  } catch {
    container.textContent = "Unable to load chart library.";
    return;
  }

  container.innerHTML = "";
  const tip = createTooltip(container);

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = Math.max(container.clientWidth || 0, 400);
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const categories = ["diesel", "electric"];
  const labels = { diesel: "Equivalent diesel bus", electric: "Electric bus" };
  const stackKeys = ["consumptionAndMaintenance", "chargers", "otherCosts"];
  const stackLabels = {
    consumptionAndMaintenance: "Consumption and maintenance",
    chargers: "Chargers",
    otherCosts: "Other costs",
  };
  const stackColors = {
    consumptionAndMaintenance: COLORS.consumptionAndMaintenance,
    chargers: COLORS.chargers,
    otherCosts: COLORS.otherCosts,
  };

  const barData = categories.map((cat) => ({
    category: cat,
    label: labels[cat],
    consumptionAndMaintenance: data[cat].consumptionAndMaintenance,
    chargers: data[cat].chargers,
    otherCosts: data[cat].otherCosts,
    total: data[cat].total,
  }));

  const maxVal = d3.max(barData, (d) => d.total);

  const x = d3.scaleBand().domain(categories).range([0, innerW]).padding(0.45);

  const y = d3
    .scaleLinear()
    .domain([0, maxVal * 1.15])
    .range([innerH, 0]);

  const stack = d3.stack().keys(stackKeys);
  const series = stack(barData);

  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Y axis
  g.append("g")
    .attr("class", "axis axis--y")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => d.toFixed(2)),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // Y axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 14)
    .attr("x", -innerH / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("CHF / km");

  // X axis
  g.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat((d) => labels[d]))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // Grid lines
  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => y(d))
    .attr("y2", (d) => y(d))
    .attr("stroke", "#eee")
    .attr("stroke-dasharray", "3,3");

  // Bars
  g.selectAll("g.layer")
    .data(series)
    .join("g")
    .attr("class", "layer")
    .attr("fill", (d) => stackColors[d.key])
    .selectAll("rect")
    .data((d) => d.map((v) => ({ ...v, key: d.key })))
    .join("rect")
    .attr("x", (d) => x(d.data.category))
    .attr("y", (d) => y(d[1]))
    .attr("height", (d) => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth())
    .attr("rx", 2)
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => {
      const value = d[1] - d[0];
      const html = `
        <strong>${d.data.label}</strong><br/>
        ${stackLabels[d.key]}: <strong>CHF ${value.toFixed(3)}/km</strong><br/>
        Total: CHF ${d.data.total.toFixed(3)}/km
      `;
      showTooltip(tip, html, event, container);
    })
    .on("mouseleave", () => hideTooltip(tip));

  container.appendChild(svg.node());
};

/* ────────────────────────────────────────────────────────────
   3b. Efficiency comparison – line chart
   ──────────────────────────────────────────────────────────── */

export const renderEfficiencyLineChart = async (container, data) => {
  if (!container || !data?.length) return;

  let d3;
  try {
    d3 = await ensureD3();
  } catch {
    container.textContent = "Unable to load chart library.";
    return;
  }

  container.innerHTML = "";
  const tip = createTooltip(container);

  const margin = { top: 20, right: 80, bottom: 40, left: 60 };
  const width = Math.max(container.clientWidth || 0, 400);
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxVal = d3.max(data, (d) => Math.max(d.diesel, d.electric));

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.year)])
    .range([0, innerW]);

  const y = d3
    .scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([innerH, 0]);

  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Grid
  g.append("g")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => y(d))
    .attr("y2", (d) => y(d))
    .attr("stroke", "#eee")
    .attr("stroke-dasharray", "3,3");

  // Y axis
  g.append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => d.toFixed(1)),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // Y label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 14)
    .attr("x", -innerH / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("M CHF");

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(data.length - 1)
        .tickFormat((d) => d),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // X label
  g.append("text")
    .attr("x", innerW)
    .attr("y", innerH + 34)
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("Years");

  // Line generators
  const dieselLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.diesel))
    .curve(d3.curveMonotoneX);

  const electricLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.electric))
    .curve(d3.curveMonotoneX);

  // Area fill for electric line
  const electricArea = d3
    .area()
    .x((d) => x(d.year))
    .y0(innerH)
    .y1((d) => y(d.electric))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("d", electricArea)
    .attr("fill", COLORS.electric)
    .attr("fill-opacity", 0.08);

  // Diesel line (dashed)
  g.append("path")
    .datum(data)
    .attr("d", dieselLine)
    .attr("fill", "none")
    .attr("stroke", COLORS.dieselLine)
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4");

  // Electric line (solid)
  g.append("path")
    .datum(data)
    .attr("d", electricLine)
    .attr("fill", "none")
    .attr("stroke", COLORS.electricLine)
    .attr("stroke-width", 2.5);

  // Line labels
  const last = data[data.length - 1];
  g.append("text")
    .attr("x", innerW + 6)
    .attr("y", y(last.diesel))
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("fill", COLORS.dieselLine)
    .style("font-weight", "600")
    .text("Diesel bus");

  g.append("text")
    .attr("x", innerW + 6)
    .attr("y", y(last.electric))
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("fill", COLORS.electricLine)
    .style("font-weight", "600")
    .text("Electric bus");

  // Hover dots & tooltip
  const hoverGroup = g.append("g").style("display", "none");

  const hoverLine = hoverGroup
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", "#aaa")
    .attr("stroke-dasharray", "3,3");

  const dieselDot = hoverGroup
    .append("circle")
    .attr("r", 5)
    .attr("fill", COLORS.dieselLine)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  const electricDot = hoverGroup
    .append("circle")
    .attr("r", 5)
    .attr("fill", COLORS.electricLine)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  // Invisible overlay for mouse events
  g.append("rect")
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const yearVal = x.invert(mx);
      const bisect = d3.bisector((d) => d.year).left;
      const idx = Math.min(
        Math.max(bisect(data, yearVal, 0), 0),
        data.length - 1,
      );
      const d0 = data[Math.max(idx - 1, 0)];
      const d1 = data[idx];
      const d = yearVal - d0.year > d1.year - yearVal ? d1 : d0;

      hoverGroup.style("display", null);
      hoverLine.attr("x1", x(d.year)).attr("x2", x(d.year));
      dieselDot.attr("cx", x(d.year)).attr("cy", y(d.diesel));
      electricDot.attr("cx", x(d.year)).attr("cy", y(d.electric));

      const html = `
        <strong>Year ${d.year}</strong><br/>
        Diesel: <span style="color:${COLORS.dieselLine}">CHF ${d.diesel.toFixed(2)}/km</span><br/>
        Electric: <span style="color:${COLORS.electricLine}">CHF ${d.electric.toFixed(2)}/km</span>
      `;
      showTooltip(tip, html, event, container);
    })
    .on("mouseleave", () => {
      hoverGroup.style("display", "none");
      hideTooltip(tip);
    });

  container.appendChild(svg.node());
};

/* ────────────────────────────────────────────────────────────
   4. Emissions saved – bar chart (CO2, NO, PM10)
   ──────────────────────────────────────────────────────────── */

const EMISSION_COLORS = {
  co2: "#e8782a", // orange
  no: "#f5c542", // yellow
  pm10: "#9e9e7a", // olive/gray
  line: "#4caf50", // green
};

export const renderEmissionsBarChart = async (container, data) => {
  if (!container || !data) return;

  let d3;
  try {
    d3 = await ensureD3();
  } catch {
    container.textContent = "Unable to load chart library.";
    return;
  }

  container.innerHTML = "";
  const tip = createTooltip(container);

  const margin = { top: 20, right: 20, bottom: 40, left: 70 };
  const width = Math.max(container.clientWidth || 0, 350);
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Two groups: ton/year (CO2 + NO) and kg/year (PM10)
  const groups = [
    {
      label: "ton/year",
      metrics: [
        {
          key: "co2",
          label: "CO2",
          value: data.co2,
          color: EMISSION_COLORS.co2,
        },
        { key: "no", label: "NO", value: data.no, color: EMISSION_COLORS.no },
      ],
    },
    {
      label: "kg/year",
      metrics: [
        {
          key: "pm10",
          label: "PM10",
          value: data.pm10,
          color: EMISSION_COLORS.pm10,
        },
      ],
    },
  ];

  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Y scale: group labels
  const y0 = d3
    .scaleBand()
    .domain(groups.map((gr) => gr.label))
    .range([0, innerH])
    .padding(0.35);

  // Within each group, bars for each metric
  const maxBarsPerGroup = Math.max(...groups.map((gr) => gr.metrics.length));
  const y1 = d3
    .scaleBand()
    .domain(d3.range(maxBarsPerGroup))
    .range([0, y0.bandwidth()])
    .padding(0.15);

  // X scale: max value across all metrics
  const allValues = groups.flatMap((gr) => gr.metrics.map((m) => m.value));
  const maxVal = d3.max(allValues);

  const x = d3
    .scaleLinear()
    .domain([0, maxVal * 1.2])
    .range([0, innerW]);

  // Y axis labels
  g.append("g")
    .selectAll("text")
    .data(groups)
    .join("text")
    .attr("x", -8)
    .attr("y", (d) => y0(d.label) + y0.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .style("font-size", "12px")
    .style("fill", "#333")
    .style("font-weight", "600")
    .text((d) => d.label);

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // X axis label
  g.append("text")
    .attr("x", innerW)
    .attr("y", innerH + 34)
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("Electric bus");

  // Grid lines
  g.append("g")
    .selectAll("line")
    .data(x.ticks(5))
    .join("line")
    .attr("x1", (d) => x(d))
    .attr("x2", (d) => x(d))
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", "#eee")
    .attr("stroke-dasharray", "3,3");

  // Bars
  groups.forEach((group) => {
    const groupG = g
      .append("g")
      .attr("transform", `translate(0,${y0(group.label)})`);

    group.metrics.forEach((metric, i) => {
      groupG
        .append("rect")
        .attr("x", 0)
        .attr("y", y1(i))
        .attr("width", x(metric.value))
        .attr("height", y1.bandwidth())
        .attr("fill", metric.color)
        .attr("rx", 2)
        .style("cursor", "pointer")
        .on("mousemove", (event) => {
          const html = `
            <strong>${metric.label}</strong><br/>
            Saved: <strong>${metric.value.toFixed(2)} ${group.label}</strong>
          `;
          showTooltip(tip, html, event, container);
        })
        .on("mouseleave", () => hideTooltip(tip));
    });
  });

  container.appendChild(svg.node());
};

/* ────────────────────────────────────────────────────────────
   4b. Emissions saved – cumulative line chart
   ──────────────────────────────────────────────────────────── */

export const renderEmissionsLineChart = async (container, data) => {
  if (!container || !data?.length) return;

  let d3;
  try {
    d3 = await ensureD3();
  } catch {
    container.textContent = "Unable to load chart library.";
    return;
  }

  container.innerHTML = "";
  const tip = createTooltip(container);

  const margin = { top: 20, right: 80, bottom: 40, left: 60 };
  const width = Math.max(container.clientWidth || 0, 400);
  const height = 280;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxVal = d3.max(data, (d) => d.saved);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.year)])
    .range([0, innerW]);

  const y = d3
    .scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([innerH, 0]);

  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Grid
  g.append("g")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => y(d))
    .attr("y2", (d) => y(d))
    .attr("stroke", "#eee")
    .attr("stroke-dasharray", "3,3");

  // Y axis
  g.append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => d.toFixed(0)),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // Y label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 14)
    .attr("x", -innerH / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("ton");

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(data.length - 1)
        .tickFormat((d) => d),
    )
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#666");

  // X label
  g.append("text")
    .attr("x", innerW)
    .attr("y", innerH + 34)
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .style("fill", "#999")
    .text("Years");

  // Area fill
  const areaGenerator = d3
    .area()
    .x((d) => x(d.year))
    .y0(innerH)
    .y1((d) => y(d.saved))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("d", areaGenerator)
    .attr("fill", EMISSION_COLORS.line)
    .attr("fill-opacity", 0.1);

  // Line
  const lineGenerator = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.saved))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("d", lineGenerator)
    .attr("fill", "none")
    .attr("stroke", EMISSION_COLORS.line)
    .attr("stroke-width", 2.5);

  // End label
  const last = data[data.length - 1];
  g.append("text")
    .attr("x", innerW + 6)
    .attr("y", y(last.saved))
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("fill", EMISSION_COLORS.line)
    .style("font-weight", "600")
    .text("Electric bus");

  // Hover dot & tooltip
  const hoverGroup = g.append("g").style("display", "none");

  const hoverLine = hoverGroup
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", "#aaa")
    .attr("stroke-dasharray", "3,3");

  const dot = hoverGroup
    .append("circle")
    .attr("r", 5)
    .attr("fill", EMISSION_COLORS.line)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  // Invisible overlay
  g.append("rect")
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const yearVal = x.invert(mx);
      const bisect = d3.bisector((d) => d.year).left;
      const idx = Math.min(
        Math.max(bisect(data, yearVal, 0), 0),
        data.length - 1,
      );
      const d0 = data[Math.max(idx - 1, 0)];
      const d1 = data[idx];
      const d = yearVal - d0.year > d1.year - yearVal ? d1 : d0;

      hoverGroup.style("display", null);
      hoverLine.attr("x1", x(d.year)).attr("x2", x(d.year));
      dot.attr("cx", x(d.year)).attr("cy", y(d.saved));

      const html = `
        <strong>Year ${d.year}</strong><br/>
        Emissions saved: <span style="color:${EMISSION_COLORS.line}"><strong>${d.saved.toFixed(1)} ton</strong></span>
      `;
      showTooltip(tip, html, event, container);
    })
    .on("mouseleave", () => {
      hoverGroup.style("display", "none");
      hideTooltip(tip);
    });

  container.appendChild(svg.node());
};

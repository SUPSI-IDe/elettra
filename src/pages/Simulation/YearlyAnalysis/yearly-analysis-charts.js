import * as d3 from "d3";
import { t } from "../../../i18n";

const tr = (key, fallback, params = {}) => {
  const value = t(key, params);
  return value !== key ? value : fallback;
};

const FUEL_COLORS = { diesel: "#c0392b", electric: "#2e7d32" };
const COST_COLORS = { vehicle: "#4f86c6", usage: "#d4881f", maintenance: "#5f8f2f" };
const EFF_COLORS = {
  efficiency: "#00639a",
  energy: "#6fbeec",
  dieselHeating: "#c0392b",
};
const PHASE_COLORS = {
  production: "#6fbeec",
  maintenance: "#4f86c6",
  use: "#27ae60",
  operation: "#27ae60",
  infrastructure: "#f5a623",
  endOfLife: "#95a5a6",
};
const PRIMARY_ENERGY_COLORS = {
  renewable: "#6fbeec",
  nonRenewable: "#1f4e79",
};

const PHASE_KEYS = [
  { key: "production", i18n: "simulation.emissions_phase_production" },
  { key: "maintenance", i18n: "simulation.emissions_phase_maintenance" },
  { key: "use", i18n: "simulation.emissions_phase_use" },
  { key: "operation", i18n: "simulation.emissions_phase_operation" },
  { key: "infrastructure", i18n: "simulation.emissions_phase_infrastructure" },
  { key: "endOfLife", i18n: "simulation.emissions_phase_end_of_life" },
];

const phaseLabel = (phase) => tr(phase.i18n, phase.key);

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const formatFixed = (value, digits = 2) => {
  const numeric = toFiniteNumber(value);
  return numeric != null
    ? numeric.toLocaleString("de-CH", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "—";
};

const formatInt = (value) => {
  const numeric = toFiniteNumber(value);
  return numeric != null ? Math.round(numeric).toLocaleString("de-CH") : "—";
};

const formatK = (value) => {
  const numeric = toFiniteNumber(value) ?? 0;
  return Math.abs(numeric) >= 1000 ? `${Math.round(numeric / 1000)}k` : `${Math.round(numeric)}`;
};

const svgBase = (width, height, ariaLabel) =>
  d3
    .create("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", ariaLabel);

const clearEl = (el, legendEl) => {
  if (el) el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
};

const setLegend = (legendEl, items = []) => {
  if (!legendEl) return;
  legendEl.innerHTML = items
    .map(
      ({ label, color }) =>
        `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${color}"></span>${label}</div>`
    )
    .join("");
};

const addGridLines = (g, y, innerWidth, ticks = 5) => {
  g.selectAll(".grid-line")
    .data(y.ticks(ticks))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", (d) => y(d))
    .attr("y2", (d) => y(d))
    .attr("stroke", "#e5e5e5")
    .attr("stroke-dasharray", "3,3");
};

const attachTooltip = (layer, { title, lines = [] }, x, y) => {
  const group = layer.append("g").attr("pointer-events", "none");
  const bg = group
    .append("rect")
    .attr("fill", "#fff")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 1)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("opacity", 0.97)
    .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,.12))");
  const textNode = group.append("text").attr("fill", "#1c1c1c").attr("font-size", "10px");

  textNode
    .append("tspan")
    .attr("x", 8)
    .attr("dy", 14)
    .attr("font-weight", "600")
    .text(title);
  lines.forEach((line, index) => {
    textNode
      .append("tspan")
      .attr("x", 8)
      .attr("dy", index === 0 ? 13 : 13)
      .text(line);
  });

  const bbox = textNode.node().getBBox();
  const width = bbox.width + 16;
  const height = bbox.height + 10;
  bg.attr("width", width).attr("height", height);
  group.attr("transform", `translate(${x},${y})`);
  return group;
};

export const renderEfficiencyByTemperatureChart = (el, legendEl, data = []) => {
  clearEl(el, legendEl);
  if (!el || !Array.isArray(data) || !data.length) return;

  const chartData = data.filter((item) => toFiniteNumber(item.efficiency) != null);
  if (!chartData.length) return;

  const width = 560;
  const height = 280;
  const margin = { top: 18, right: 22, bottom: 38, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xExtent = d3.extent(chartData, (d) => d.temperature);
  const yMax = d3.max(chartData, (d) => d.efficiency) * 1.12 || 1;

  const svg = svgBase(
    width,
    height,
    tr(
      "yearly_analysis.chart_aria_efficiency_temperature",
      "Scenario efficiency by temperature chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3
    .scaleLinear()
    .domain([xExtent[0] - 1, xExtent[1] + 1])
    .range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

  addGridLines(g, y, innerWidth, 6);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(chartData.length).tickFormat((d) => `${d}°C`))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat((d) => d.toFixed(2)))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(tr("yearly_analysis.axis_kwh_km", "kWh/km"));

  const line = d3
    .line()
    .x((d) => x(d.temperature))
    .y((d) => y(d.efficiency))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(chartData)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", EFF_COLORS.efficiency)
    .attr("stroke-width", 2.4);

  const tooltipLayer = g.append("g").style("display", "none");

  g.selectAll(".eff-point")
    .data(chartData)
    .join("circle")
    .attr("cx", (d) => x(d.temperature))
    .attr("cy", (d) => y(d.efficiency))
    .attr("r", 4.5)
    .attr("fill", EFF_COLORS.efficiency)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .on("pointerenter", (_, d) => {
      tooltipLayer.style("display", null).selectAll("*").remove();
      const tx = Math.min(innerWidth - 170, Math.max(0, x(d.temperature) + 10));
      const ty = Math.max(4, y(d.efficiency) - 40);
      attachTooltip(
        tooltipLayer,
        {
          title: `${d.label} (${formatFixed(d.temperature, 1)}°C)`,
          lines: [
            tr("yearly_analysis.tooltip_days_year", "Days/year: {value}", { value: formatInt(d.occurrences) }),
            tr("yearly_analysis.chart_tooltip_electric_energy", "Electric energy: {value} kWh", { value: formatFixed(d.electricEnergyKwh, 1) }),
            tr("yearly_analysis.tooltip_distance", "Distance: {value} km", { value: formatFixed(d.distanceKm, 1) }),
            tr("yearly_analysis.tooltip_efficiency", "Efficiency: {value} kWh/km", { value: formatFixed(d.efficiency, 3) }),
          ],
        },
        tx,
        ty
      );
    })
    .on("pointerleave", () => {
      tooltipLayer.style("display", "none");
    });

  el.appendChild(svg.node());
  setLegend(legendEl, [
    {
      label: tr("yearly_analysis.legend_electric_efficiency", "Electric efficiency"),
      color: EFF_COLORS.efficiency,
    },
  ]);
};

export const renderScenarioContributionChart = (el, legendEl, data = []) => {
  clearEl(el, legendEl);
  if (!el || !Array.isArray(data) || !data.length) return;

  const chartData = data.filter((item) => toFiniteNumber(item.electricAnnualKwh) != null);
  if (!chartData.length) return;

  const width = 560;
  const height = 300;
  const margin = { top: 20, right: 56, bottom: 56, left: 62 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const labels = chartData.map((item) => `${formatFixed(item.temperature, 1)}°C`);
  const xBand = d3.scaleBand().domain(labels).range([0, innerWidth]).padding(0.28);
  const yEnergy = d3
    .scaleLinear()
    .domain([0, d3.max(chartData, (d) => d.electricAnnualKwh) * 1.12 || 1])
    .nice()
    .range([innerHeight, 0]);

  const maxDiesel = d3.max(chartData, (d) => toFiniteNumber(d.dieselHeatingAnnualLiters) ?? 0) || 0;
  const hasDieselHeating = maxDiesel > 0;
  const yDiesel = hasDieselHeating
    ? d3.scaleLinear().domain([0, maxDiesel * 1.12]).nice().range([innerHeight, 0])
    : null;

  const svg = svgBase(
    width,
    height,
    tr(
      "yearly_analysis.chart_aria_annual_energy",
      "Annual energy contribution by temperature scenario chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  addGridLines(g, yEnergy, innerWidth, 6);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xBand))
    .selectAll("text")
    .attr("font-size", "10px")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-30)");
  g.append("g")
    .call(d3.axisLeft(yEnergy).ticks(6).tickFormat((d) => formatK(d)))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(tr("yearly_analysis.axis_electric_kwh", "Electric kWh"));

  if (hasDieselHeating) {
    g.append("g")
      .attr("transform", `translate(${innerWidth},0)`)
      .call(d3.axisRight(yDiesel).ticks(5).tickFormat((d) => formatK(d)))
      .selectAll("text")
      .attr("font-size", "10px");
    g.append("text")
      .attr("transform", `translate(${innerWidth + 40},${innerHeight / 2}) rotate(90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#666")
      .text(tr("yearly_analysis.diesel_heating_liters", "Diesel heating liters"));
  }

  const tooltipLayer = g.append("g").style("display", "none");

  g.selectAll(".contrib-bar")
    .data(chartData)
    .join("rect")
    .attr("x", (_, index) => xBand(labels[index]))
    .attr("y", (d) => yEnergy(d.electricAnnualKwh))
    .attr("width", xBand.bandwidth())
    .attr("height", (d) => innerHeight - yEnergy(d.electricAnnualKwh))
    .attr("fill", EFF_COLORS.energy)
    .attr("rx", 4)
    .style("cursor", "pointer")
    .on("pointerenter", (_, d) => {
      tooltipLayer.style("display", null).selectAll("*").remove();
      const tx = Math.min(innerWidth - 170, Math.max(0, xBand(`${formatFixed(d.temperature, 1)}°C`) + 10));
      const ty = Math.max(4, yEnergy(d.electricAnnualKwh) - 46);
      attachTooltip(
        tooltipLayer,
        {
          title: `${d.label} (${formatFixed(d.temperature, 1)}°C)`,
          lines: [
            tr("yearly_analysis.tooltip_days_year", "Days/year: {value}", { value: formatInt(d.occurrences) }),
            tr("yearly_analysis.chart_tooltip_electric_contribution", "Electric contribution: {value} kWh", { value: formatInt(d.electricAnnualKwh) }),
            hasDieselHeating
              ? tr("yearly_analysis.chart_tooltip_diesel_heating", "Diesel heating: {value} L", { value: formatFixed(d.dieselHeatingAnnualLiters, 1) })
              : tr("yearly_analysis.tooltip_distance", "Distance: {value} km", { value: formatFixed(d.distanceKm, 1) }),
          ],
        },
        tx,
        ty
      );
    })
    .on("pointerleave", () => tooltipLayer.style("display", "none"));

  if (hasDieselHeating) {
    const line = d3
      .line()
      .x((d, index) => xBand(labels[index]) + xBand.bandwidth() / 2)
      .y((d) => yDiesel(d.dieselHeatingAnnualLiters))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(chartData)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", EFF_COLORS.dieselHeating)
      .attr("stroke-width", 2);

    g.selectAll(".diesel-point")
      .data(chartData)
      .join("circle")
      .attr("cx", (_, index) => xBand(labels[index]) + xBand.bandwidth() / 2)
      .attr("cy", (d) => yDiesel(d.dieselHeatingAnnualLiters))
      .attr("r", 3.5)
      .attr("fill", EFF_COLORS.dieselHeating)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.2);
  }

  el.appendChild(svg.node());
  setLegend(legendEl, [
    { label: tr("yearly_analysis.electric_energy", "Electric energy"), color: EFF_COLORS.energy },
    ...(hasDieselHeating
      ? [
          {
            label: tr("yearly_analysis.diesel_heating_liters", "Diesel heating liters"),
            color: EFF_COLORS.dieselHeating,
          },
        ]
      : []),
  ]);
};

export const renderCostComparisonBar = (el, legendEl, data) => {
  clearEl(el, legendEl);
  if (!el || !data) return;

  const chartData = [
    {
      category: tr("yearly_analysis.ebus", "E-bus"),
      vehicle: toFiniteNumber(data.ebusCapexAnnual) ?? 0,
      usage: (toFiniteNumber(data.ebusEnergy) ?? 0) + (toFiniteNumber(data.ebusDieselHeatingFuel) ?? 0),
      maintenance:
        (toFiniteNumber(data.ebusMaintenance) ?? 0) +
        (toFiniteNumber(data.ebusDieselHeatingMaintenance) ?? 0),
    },
    {
      category: tr("yearly_analysis.diesel_comparator", "Diesel comparator"),
      vehicle: toFiniteNumber(data.dieselCapexAnnual) ?? 0,
      usage: toFiniteNumber(data.dieselFuel) ?? 0,
      maintenance: toFiniteNumber(data.dieselMaintenance) ?? 0,
    },
  ];

  const width = 560;
  const height = 220;
  const margin = { top: 22, right: 20, bottom: 36, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const svg = svgBase(
    width,
    height,
    tr("yearly_analysis.total_annual_cost_comparison", "Total annual cost comparison")
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleBand().domain(chartData.map((d) => d.category)).range([0, innerWidth]).padding(0.34);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(chartData, (row) => row.vehicle + row.usage + row.maintenance) * 1.15 || 1])
    .nice()
    .range([innerHeight, 0]);
  addGridLines(g, y, innerWidth, 5);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => formatK(d)))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -52)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(tr("yearly_analysis.axis_chf_year", "CHF / year"));

  const layers = d3.stack().keys(["vehicle", "usage", "maintenance"])(chartData);
  layers.forEach((layer) => {
    const color =
      layer.key === "vehicle"
        ? COST_COLORS.vehicle
        : layer.key === "usage"
          ? COST_COLORS.usage
          : COST_COLORS.maintenance;
    g.selectAll(`.cost-bar-${layer.key}`)
      .data(layer)
      .join("rect")
      .attr("x", (d) => x(d.data.category))
      .attr("y", (d) => y(d[1]))
      .attr("width", x.bandwidth())
      .attr("height", (d) => Math.max(0, y(d[0]) - y(d[1])))
      .attr("fill", color)
      .attr("rx", 3);
  });

  el.appendChild(svg.node());
  setLegend(legendEl, [
    {
      label: tr("simulation.cost_stack_capex_annualized", "CAPEX annualized"),
      color: COST_COLORS.vehicle,
    },
    {
      label: tr("simulation.cost_stack_opex_usage", "OPEX usage"),
      color: COST_COLORS.usage,
    },
    {
      label: tr("simulation.cost_stack_opex_maintenance", "OPEX maintenance"),
      color: COST_COLORS.maintenance,
    },
  ]);
};

const buildProjectedTrend = (data) => {
  const raw = data?.raw ?? {};
  const rawSeries =
    raw.projected_cost_trend ??
    raw.projectedCostTrend ??
    raw.yearly ??
    raw.trend ??
    null;

  if (Array.isArray(rawSeries) && rawSeries.length) {
    return rawSeries
      .map((point) => ({
        year: toFiniteNumber(point.year),
        ebus:
          toFiniteNumber(point.ebus) ??
          toFiniteNumber(point.electric) ??
          toFiniteNumber(point.electricChf),
        dieselComparator:
          toFiniteNumber(point.dieselComparator) ??
          toFiniteNumber(point.diesel) ??
          toFiniteNumber(point.dieselChf),
      }))
      .filter((point) => point.year != null && point.ebus != null && point.dieselComparator != null);
  }

  const years = d3.range(0, 13);
  const ebusCapex = toFiniteNumber(data?.ebus?.capex) ?? 0;
  const dieselCapex = toFiniteNumber(data?.dieselComparator?.capex) ?? 0;
  const ebusOpex = toFiniteNumber(data?.ebus?.opex?.total) ?? 0;
  const dieselOpex = toFiniteNumber(data?.dieselComparator?.opex?.total) ?? 0;

  return years.map((year) => ({
    year,
    ebus: ebusCapex + ebusOpex * year,
    dieselComparator: dieselCapex + dieselOpex * year,
  }));
};

export const renderProjectedCostTrend = (el, legendEl, data) => {
  clearEl(el, legendEl);
  if (!el || !data) return;

  const series = buildProjectedTrend(data);
  if (!series.length) return;

  const width = 560;
  const height = 220;
  const margin = { top: 18, right: 22, bottom: 34, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const svg = svgBase(
    width,
    height,
    tr("simulation.chart_aria_cost_trend", "Projected cumulative cost trend chart")
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3
    .scaleLinear()
    .domain(d3.extent(series, (d) => d.year))
    .range([0, innerWidth]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(series, (d) => Math.max(d.ebus, d.dieselComparator)) * 1.08 || 1])
    .nice()
    .range([innerHeight, 0]);
  addGridLines(g, y, innerWidth, 5);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(series.length).tickFormat(String))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => formatK(d)))
    .selectAll("text")
    .attr("font-size", "10px");

  const line = (key, color) =>
    g
      .append("path")
      .datum(series)
      .attr(
        "d",
        d3
          .line()
          .x((d) => x(d.year))
          .y((d) => y(d[key]))
          .curve(d3.curveMonotoneX)
      )
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2.4);

  line("ebus", FUEL_COLORS.electric);
  line("dieselComparator", FUEL_COLORS.diesel);

  el.appendChild(svg.node());
  setLegend(legendEl, [
    {
      label: tr("yearly_analysis.cumulative_cost_ebus", "E-bus cumulative cost"),
      color: FUEL_COLORS.electric,
    },
    {
      label: tr("yearly_analysis.cumulative_cost_diesel", "Diesel comparator cumulative cost"),
      color: FUEL_COLORS.diesel,
    },
  ]);
};

export const renderEmissionsHistogram = (el, legendEl, data = []) => {
  clearEl(el, legendEl);
  if (!el || !Array.isArray(data) || !data.length) return;

  const width = 560;
  const rowHeight = 22;
  const gap = 16;
  const margin = { top: 16, right: 120, bottom: 28, left: 132 };
  const innerWidth = width - margin.left - margin.right;
  const height = margin.top + margin.bottom + data.length * rowHeight * 2 + (data.length - 1) * gap;

  const values = data.flatMap((item) => [item.ebusTotal, item.dieselComparatorTotal].filter((value) => value != null));
  const max = d3.max(values) * 1.1 || 1;

  const svg = svgBase(
    width,
    height,
    tr("yearly_analysis.chart_aria_emissions_saved", "Emissions saved horizontal bar chart")
  );
  const x = d3.scaleLinear().domain([0, max]).nice().range([0, innerWidth]);

  data.forEach((item, index) => {
    const yBase = margin.top + index * (rowHeight * 2 + gap);
    svg.append("text")
      .attr("x", margin.left - 8)
      .attr("y", yBase + rowHeight)
      .attr("text-anchor", "end")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#333")
      .text(item.label);

    svg
      .append("rect")
      .attr("x", margin.left)
      .attr("y", yBase)
      .attr("width", x(item.dieselComparatorTotal))
      .attr("height", rowHeight - 4)
      .attr("rx", 3)
      .attr("fill", FUEL_COLORS.diesel)
      .attr("opacity", 0.55);
    svg
      .append("rect")
      .attr("x", margin.left)
      .attr("y", yBase + rowHeight)
      .attr("width", x(item.ebusTotal))
      .attr("height", rowHeight - 4)
      .attr("rx", 3)
      .attr("fill", FUEL_COLORS.electric)
      .attr("opacity", 0.85);

    svg.append("text")
      .attr("x", margin.left + x(item.dieselComparatorTotal) + 4)
      .attr("y", yBase + 10)
      .attr("font-size", "9px")
      .attr("fill", "#666")
      .text(formatFixed(item.dieselComparatorTotal, 1));
    svg.append("text")
      .attr("x", margin.left + x(item.ebusTotal) + 4)
      .attr("y", yBase + rowHeight + 10)
      .attr("font-size", "9px")
      .attr("fill", "#333")
      .text(formatFixed(item.ebusTotal, 1));
  });

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((d) => formatK(d)))
    .selectAll("text")
    .attr("font-size", "9px");

  el.appendChild(svg.node());
  setLegend(legendEl, [
    {
      label: tr("yearly_analysis.diesel_comparator", "Diesel comparator"),
      color: FUEL_COLORS.diesel,
    },
    { label: tr("yearly_analysis.ebus", "E-bus"), color: FUEL_COLORS.electric },
  ]);
};

const readPhaseTotal = (indicator = {}, phaseKey) => {
  const direct = toFiniteNumber(indicator?.[phaseKey]);
  if (direct != null) return direct;
  const electric = toFiniteNumber(indicator?.electric?.[phaseKey]) ?? 0;
  const dieselHeating = toFiniteNumber(indicator?.dieselHeating?.[phaseKey]) ?? 0;
  const total = electric + dieselHeating;
  return total > 0 ? total : null;
};

export const renderCo2PhaseBreakdown = (el, legendEl, co2Data) => {
  clearEl(el, legendEl);
  if (!el || !co2Data?.ebus || !co2Data?.dieselComparator) return;

  const bars = [
    { label: tr("yearly_analysis.ebus", "E-bus"), indicator: co2Data.ebus },
    { label: tr("simulation.label_diesel", "Diesel"), indicator: co2Data.dieselComparator },
  ];

  const width = 520;
  const height = 150;
  const margin = { top: 16, right: 80, bottom: 26, left: 78 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const totals = bars.map((bar) =>
    PHASE_KEYS.reduce((sum, phase) => sum + (readPhaseTotal(bar.indicator, phase.key) ?? 0), 0)
  );
  const x = d3.scaleLinear().domain([0, d3.max(totals) * 1.12 || 1]).nice().range([0, innerWidth]);
  const svg = svgBase(
    width,
    height,
    tr("simulation.chart_aria_co2_phase", "CO₂ lifecycle phase breakdown chart")
  );

  bars.forEach((bar, index) => {
    const y = margin.top + index * 48;
    svg.append("text")
      .attr("x", margin.left - 8)
      .attr("y", y + 16)
      .attr("text-anchor", "end")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#333")
      .text(bar.label);
    let offset = 0;
    PHASE_KEYS.forEach((phase) => {
      const value = readPhaseTotal(bar.indicator, phase.key);
      if (value == null || value <= 0) return;
      const segmentWidth = x(value);
      svg.append("rect")
        .attr("x", margin.left + offset)
        .attr("y", y)
        .attr("width", segmentWidth)
        .attr("height", 24)
        .attr("fill", PHASE_COLORS[phase.key] ?? "#95a5a6")
        .attr("rx", offset === 0 ? 3 : 0);
      offset += segmentWidth;
    });
    svg.append("text")
      .attr("x", margin.left + offset + 6)
      .attr("y", y + 16)
      .attr("font-size", "9px")
      .attr("fill", "#666")
      .text(formatFixed(totals[index], 1));
  });

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((d) => formatK(d)))
    .selectAll("text")
    .attr("font-size", "9px");

  el.appendChild(svg.node());
  setLegend(
    legendEl,
    PHASE_KEYS.map((phase) => ({
      label: phaseLabel(phase),
      color: PHASE_COLORS[phase.key] ?? "#95a5a6",
    }))
  );
};

export const renderPrimaryEnergyChart = (el, legendEl, energyData) => {
  clearEl(el, legendEl);
  if (!el || !energyData?.ebusTotal || !energyData?.dieselComparatorTotal) return;

  const bars = [
    {
      label: tr("yearly_analysis.ebus", "E-bus"),
      total: energyData.ebusTotal,
      nonRenewable: energyData.ebusNonRenewable ?? 0,
    },
    {
      label: tr("simulation.label_diesel", "Diesel"),
      total: energyData.dieselComparatorTotal,
      nonRenewable: energyData.dieselComparatorNonRenewable ?? 0,
    },
  ];

  const width = 520;
  const height = 150;
  const margin = { top: 16, right: 80, bottom: 26, left: 78 };
  const innerWidth = width - margin.left - margin.right;
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(bars, (bar) => bar.total) * 1.12 || 1])
    .nice()
    .range([0, innerWidth]);
  const svg = svgBase(
    width,
    height,
    tr("simulation.chart_aria_primary_energy", "Primary energy consumption chart")
  );

  bars.forEach((bar, index) => {
    const y = margin.top + index * 48;
    const renewable = Math.max(0, bar.total - bar.nonRenewable);
    const renewableWidth = x(renewable);
    const nonRenewableWidth = x(bar.nonRenewable);

    svg.append("text")
      .attr("x", margin.left - 8)
      .attr("y", y + 16)
      .attr("text-anchor", "end")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#333")
      .text(bar.label);
    svg.append("rect")
      .attr("x", margin.left)
      .attr("y", y)
      .attr("width", renewableWidth)
      .attr("height", 24)
      .attr("fill", PRIMARY_ENERGY_COLORS.renewable)
      .attr("rx", 3);
    svg.append("rect")
      .attr("x", margin.left + renewableWidth)
      .attr("y", y)
      .attr("width", nonRenewableWidth)
      .attr("height", 24)
      .attr("fill", PRIMARY_ENERGY_COLORS.nonRenewable);
    svg.append("text")
      .attr("x", margin.left + renewableWidth + nonRenewableWidth + 6)
      .attr("y", y + 16)
      .attr("font-size", "9px")
      .attr("fill", "#666")
      .text(formatFixed(bar.total, 1));
  });

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((d) => formatK(d)))
    .selectAll("text")
    .attr("font-size", "9px");

  el.appendChild(svg.node());
  setLegend(legendEl, [
    {
      label: tr("simulation.emissions_energy_renewable", "Renewable"),
      color: PRIMARY_ENERGY_COLORS.renewable,
    },
    {
      label: tr("simulation.emissions_energy_non_renewable", "Non-renewable"),
      color: PRIMARY_ENERGY_COLORS.nonRenewable,
    },
  ]);
};

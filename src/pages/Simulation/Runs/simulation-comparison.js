import * as d3 from "d3";
import { t } from "../../../i18n";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import "./simulation-comparison.css";

/* ── i18n label helpers ───────────────────────────────────────── */

const busCategoryLabel = (key) =>
  ({
    equivalent_diesel_bus: t("simulation.label_equivalent_diesel_bus"),
    electric_bus: t("simulation.label_electric_bus"),
  })[key] ?? key;

const fuelLabel = (key) =>
  ({
    diesel: t("simulation.label_diesel"),
    electric: t("simulation.label_electric"),
  })[key] ?? key;

const costStackLabel = (key) =>
  ({
    vehicle: t("simulation.cost_stack_vehicle"),
    energy: t("simulation.cost_stack_energy"),
    maintenance: t("simulation.cost_stack_maintenance"),
  })[key] ?? key;

const segmentLabel = (key) =>
  ({
    urban: t("simulation.segment_urban"),
    suburban: t("simulation.segment_suburban"),
    hilly: t("simulation.segment_hilly"),
    flat: t("simulation.segment_flat"),
  })[key] ?? key;

const chartAriaLabel = (key, fallback) => t(key) || fallback;

/* ── Fake data generators (seeded by index for variety) ───────── */

const COST_STACK_KEYS = ["vehicle", "energy", "maintenance"];
const FUEL_COLORS = {
  diesel: "#c0392b",
  electric: "#2e7d32",
};
const COST_COLORS = { vehicle: "#4f86c6", energy: "#d4881f", maintenance: "#5f8f2f" };

const makeTCOData = (seed) => [
  {
    category: "equivalent_diesel_bus",
    vehicle: 1_400_000 + seed * 50_000,
    energy: 1_200_000 + seed * 30_000,
    maintenance: 600_000 + seed * 20_000,
  },
  {
    category: "electric_bus",
    vehicle: 1_600_000 + seed * 60_000,
    energy: 400_000 + seed * 15_000,
    maintenance: 400_000 + seed * 10_000,
  },
];

const makeYearlyData = (seed) =>
  Array.from({ length: 15 }, (_, i) => ({
    year: i + 1,
    diesel: 180_000 + seed * 5_000 + i * 12_000,
    electric: 140_000 + seed * 3_000 + i * 4_000,
  }));

const makeSOCData = (seed) => {
  const pts = [];
  let soc = 95 - seed * 2;
  for (let h = 0; h <= 8; h += 0.25) {
    if (h > 0) {
      const charging = (h > 3 && h < 3.5) || (h > 6 && h < 6.5);
      soc += charging ? (14 - seed) : -(3 + seed * 0.3 + Math.sin(h + seed) * 1.5);
      soc = Math.max(10, Math.min(100, soc));
    }
    pts.push({ hour: h, soc });
  }
  return pts;
};

const makeEnergyData = (seed) => [
  { segment: "urban", diesel: 0.42 + seed * 0.02, electric: 1.25 + seed * 0.05 },
  { segment: "suburban", diesel: 0.35 + seed * 0.01, electric: 0.95 + seed * 0.03 },
  { segment: "hilly", diesel: 0.52 + seed * 0.03, electric: 1.50 + seed * 0.06 },
  { segment: "flat", diesel: 0.30 + seed * 0.01, electric: 0.80 + seed * 0.02 },
];

const makeCO2Annual = (seed) => [
  { category: "equivalent_diesel_bus", value: 85 + seed * 3, color: "#6fbeec" },
  { category: "electric_bus", value: 12 + seed * 2, color: "#abe828" },
];

const makeCO2Cum = (seed) =>
  Array.from({ length: 15 }, (_, i) => ({
    year: i + 1,
    saved: (i + 1) * (73 - seed * 4),
  }));

/* ── SVG helpers ──────────────────────────────────────────────── */

const svgBase = (w, h, ariaLabel) =>
  d3.create("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img").attr("aria-label", ariaLabel);

const gridLines = (g, scale, innerW, ticks = 5) => {
  g.selectAll(".grid-line")
    .data(scale.ticks(ticks))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => scale(d))
    .attr("y2", (d) => scale(d))
    .attr("stroke", "#e5e5e5")
    .attr("stroke-dasharray", "3,3");
};

/* ── Chart renderers (same logic as results page) ─────────────── */

const renderCostsBar = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 20, bottom: 40, left: 70 };
  const W = 480, H = 260;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const stacked = d3.stack().keys(COST_STACK_KEYS)(data);
  const svg = svgBase(
    W,
    H,
    chartAriaLabel("simulation.chart_aria_tco_stacked", "TCO stacked bar chart")
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map((d) => d.category)).range([0, iW]).padding(0.35);
  const maxVal = d3.max(data, (d) => COST_STACK_KEYS.reduce((s, k) => s + d[k], 0));
  const y = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d))).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(d / 1e6).toFixed(1)}M`)).selectAll("text").attr("font-size", "10px");

  stacked.forEach((layer) => {
    g.selectAll(`.bar-${layer.key}`).data(layer).join("rect")
      .attr("x", (d) => x(d.data.category)).attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1])).attr("width", x.bandwidth())
      .attr("fill", COST_COLORS[layer.key]);
  });

  data.forEach((d) => {
    const total = COST_STACK_KEYS.reduce((s, k) => s + d[k], 0);
    g.append("text").attr("x", x(d.category) + x.bandwidth() / 2).attr("y", y(total) - 5)
      .attr("text-anchor", "middle").attr("font-size", "11px").attr("font-weight", "600").attr("fill", "#1c1c1c")
      .text(`CHF ${(total / 1e6).toFixed(1)}M`);
  });

  el.appendChild(svg.node());
};

const renderCostsLegend = (el) => {
  if (!el) return;
  el.innerHTML = Object.entries(COST_COLORS).map(([key, color]) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${color}"></span>
      ${textContent(costStackLabel(key))}
    </div>`).join("");
};

const renderCostsLine = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 25, bottom: 40, left: 60 };
  const W = 480, H = 220;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_cost_trend",
      "Yearly cost comparison line chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, 15]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => Math.max(d.diesel, d.electric)) * 1.1]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(15).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "9px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(d / 1e3).toFixed(0)}k`)).selectAll("text").attr("font-size", "9px");
  gridLines(g, y, iW);

  g.append("path").datum(data).attr("d", d3.line().x((d) => x(d.year)).y((d) => y(d.diesel)).curve(d3.curveMonotoneX)).attr("fill", "none").attr("stroke", FUEL_COLORS.diesel).attr("stroke-width", 2);
  g.append("path").datum(data).attr("d", d3.line().x((d) => x(d.year)).y((d) => y(d.electric)).curve(d3.curveMonotoneX)).attr("fill", "none").attr("stroke", FUEL_COLORS.electric).attr("stroke-width", 2);

  g.append("text").attr("x", iW + 3).attr("y", y(data.at(-1).diesel)).attr("font-size", "9px").attr("fill", FUEL_COLORS.diesel).attr("dominant-baseline", "middle").text(fuelLabel("diesel"));
  g.append("text").attr("x", iW + 3).attr("y", y(data.at(-1).electric)).attr("font-size", "9px").attr("fill", FUEL_COLORS.electric).attr("dominant-baseline", "middle").text(fuelLabel("electric"));

  el.appendChild(svg.node());
};

const renderSOCChart = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 20, bottom: 40, left: 45 };
  const W = 480, H = 220;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel("simulation.chart_aria_soc_line", "State of charge line chart")
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, 8]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, 100]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(9).tickFormat((d) => `${d}h`)).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`)).selectAll("text").attr("font-size", "10px");
  gridLines(g, y, iW);

  const area = d3.area().x((d) => x(d.hour)).y0(iH).y1((d) => y(d.soc)).curve(d3.curveCatmullRom);
  const line = d3.line().x((d) => x(d.hour)).y((d) => y(d.soc)).curve(d3.curveCatmullRom);

  g.append("path").datum(data).attr("d", area).attr("fill", "rgba(171,232,40,0.15)");
  g.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", "#abe828").attr("stroke-width", 2);

  g.selectAll(".dot").data(data.filter((_, i) => i % 4 === 0)).join("circle")
    .attr("cx", (d) => x(d.hour)).attr("cy", (d) => y(d.soc)).attr("r", 3)
    .attr("fill", "#abe828").attr("stroke", "#fff").attr("stroke-width", 1.5);

  el.appendChild(svg.node());
};

const renderEnergyChart = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 20, bottom: 50, left: 55 };
  const W = 480, H = 240;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_energy_grouped",
      "Energy consumption grouped bar chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand().domain(data.map((d) => d.segment)).range([0, iW]).padding(0.25);
  const x1 = d3.scaleBand().domain(["diesel", "electric"]).range([0, x0.bandwidth()]).padding(0.08);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => Math.max(d.diesel, d.electric)) * 1.15]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x0).tickFormat((d) => segmentLabel(d))).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "10px");
  g.append("text").attr("transform", "rotate(-90)").attr("y", -42).attr("x", -iH / 2).attr("text-anchor", "middle").attr("font-size", "9px").attr("fill", "#666").text(t("simulation.axis_energy_units"));

  data.forEach((d) => {
    g.append("rect").attr("x", x0(d.segment) + x1("diesel")).attr("y", y(d.diesel)).attr("width", x1.bandwidth()).attr("height", iH - y(d.diesel)).attr("rx", 3).attr("fill", FUEL_COLORS.diesel);
    g.append("rect").attr("x", x0(d.segment) + x1("electric")).attr("y", y(d.electric)).attr("width", x1.bandwidth()).attr("height", iH - y(d.electric)).attr("rx", 3).attr("fill", FUEL_COLORS.electric);
  });

  el.appendChild(svg.node());
};

const renderCO2Bar = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 20, bottom: 40, left: 55 };
  const W = 480, H = 240;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_co2_bar",
      "CO2 emissions comparison bar chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map((d) => d.category)).range([0, iW]).padding(0.4);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) * 1.2]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d))).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "10px");
  g.append("text").attr("transform", "rotate(-90)").attr("y", -40).attr("x", -iH / 2).attr("text-anchor", "middle").attr("font-size", "9px").attr("fill", "#666").text(t("simulation.axis_co2_t_per_year"));

  g.selectAll(".bar").data(data).join("rect")
    .attr("x", (d) => x(d.category)).attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth()).attr("height", (d) => iH - y(d.value))
    .attr("rx", 4).attr("fill", (d) => d.color);

  g.selectAll(".bar-label").data(data).join("text")
    .attr("x", (d) => x(d.category) + x.bandwidth() / 2).attr("y", (d) => y(d.value) - 5)
    .attr("text-anchor", "middle").attr("font-size", "11px").attr("font-weight", "600").attr("fill", "#1c1c1c")
    .text((d) => `${d.value} ${t("simulation.unit_tonnes_short")}`);

  el.appendChild(svg.node());
};

const renderCO2Legend = (el, data) => {
  if (!el) return;
  el.innerHTML = data.map((d) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${d.color}"></span>
      ${textContent(busCategoryLabel(d.category))}
    </div>`).join("");
};

const renderCO2Cumulative = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 20, bottom: 40, left: 55 };
  const W = 480, H = 220;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_co2_cumulative",
      "Cumulative CO2 savings area chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, 15]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.saved) * 1.1]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(15).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "9px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "9px");
  g.append("text").attr("transform", "rotate(-90)").attr("y", -40).attr("x", -iH / 2).attr("text-anchor", "middle").attr("font-size", "9px").attr("fill", "#666").text(t("simulation.axis_co2_saved_t"));
  gridLines(g, y, iW);

  const areaGen = d3.area().x((d) => x(d.year)).y0(iH).y1((d) => y(d.saved)).curve(d3.curveMonotoneX);
  const lineGen = d3.line().x((d) => x(d.year)).y((d) => y(d.saved)).curve(d3.curveMonotoneX);

  g.append("path").datum(data).attr("d", areaGen).attr("fill", "rgba(171,232,40,0.15)");
  g.append("path").datum(data).attr("d", lineGen).attr("fill", "none").attr("stroke", "#abe828").attr("stroke-width", 2);

  g.selectAll(".dot").data(data).join("circle")
    .attr("cx", (d) => x(d.year)).attr("cy", (d) => y(d.saved)).attr("r", 2.5)
    .attr("fill", "#abe828").attr("stroke", "#fff").attr("stroke-width", 1);

  el.appendChild(svg.node());
};

/* ── Init ──────────────────────────────────────────────────────── */

export const initializeSimulationComparison = (root = document, options = {}) => {
  const section = root.querySelector("section.simulation-comparison-page");
  if (!section) return null;

  const cleanupHandlers = [];
  const renderedTabs = new Set();

  const simA = options.simA ?? {};
  const simB = options.simB ?? {};

  const labelA =
    simA.shiftName || t("simulation.compare_simulation_a") || "Simulation A";
  const labelB =
    simB.shiftName || t("simulation.compare_simulation_b") || "Simulation B";
  const busA = simA.busModelName || "—";
  const busB = simB.busModelName || "—";
  const createdA = simA.createdAt || "—";
  const createdB = simB.createdAt || "—";
  const fullLabelA = `${labelA} — ${busA} — ${createdA}`;
  const fullLabelB = `${labelB} — ${busB} — ${createdB}`;

  const labelElA = section.querySelector('[data-role="label-sim-a"]');
  const labelElB = section.querySelector('[data-role="label-sim-b"]');
  if (labelElA) {
    labelElA.textContent = `${t("simulation.compare_label_prefix_a") || "A"}: ${fullLabelA}`;
  }
  if (labelElB) {
    labelElB.textContent = `${t("simulation.compare_label_prefix_b") || "B"}: ${fullLabelB}`;
  }

  const dataA = {
    tco: makeTCOData(0),
    yearly: makeYearlyData(0),
    soc: makeSOCData(0),
    energy: makeEnergyData(0),
    co2Annual: makeCO2Annual(0),
    co2Cum: makeCO2Cum(0),
  };
  const dataB = {
    tco: makeTCOData(1),
    yearly: makeYearlyData(1),
    soc: makeSOCData(1),
    energy: makeEnergyData(1),
    co2Annual: makeCO2Annual(1),
    co2Cum: makeCO2Cum(1),
  };

  const tcoTitle = t("simulation.results_tco_title") || "Total Cost of Ownership";
  const yearlyTitle = t("simulation.results_costs_yearly") || "Yearly cost breakdown";
  const socTitle = t("simulation.results_soc_title") || "State of Charge over shift";
  const energyTitle = t("simulation.results_energy_title") || "Energy consumption per km";
  const co2Title = t("simulation.results_co2_title") || "CO₂ emissions comparison";
  const co2CumTitle = t("simulation.results_co2_yearly") || "Cumulative CO₂ savings over time";

  const setTitle = (role, text) => {
    const el = section.querySelector(`[data-role="${role}"]`);
    if (el) el.textContent = text;
  };

  setTitle("costs-bar-title-a", `${tcoTitle} — ${fullLabelA}`);
  setTitle("costs-bar-title-b", `${tcoTitle} — ${fullLabelB}`);
  setTitle("costs-line-title-a", `${yearlyTitle} — ${fullLabelA}`);
  setTitle("costs-line-title-b", `${yearlyTitle} — ${fullLabelB}`);
  setTitle("soc-title-a", `${socTitle} — ${fullLabelA}`);
  setTitle("soc-title-b", `${socTitle} — ${fullLabelB}`);
  setTitle("energy-title-a", `${energyTitle} — ${fullLabelA}`);
  setTitle("energy-title-b", `${energyTitle} — ${fullLabelB}`);
  setTitle("co2-bar-title-a", `${co2Title} — ${fullLabelA}`);
  setTitle("co2-bar-title-b", `${co2Title} — ${fullLabelB}`);
  setTitle("co2-cum-title-a", `${co2CumTitle} — ${fullLabelA}`);
  setTitle("co2-cum-title-b", `${co2CumTitle} — ${fullLabelB}`);

  const TAB_RENDERERS = {
    costs: () => {
      renderCostsBar(section.querySelector('[data-role="costs-bar-chart-a"]'), dataA.tco);
      renderCostsLegend(section.querySelector('[data-role="costs-legend-a"]'));
      renderCostsBar(section.querySelector('[data-role="costs-bar-chart-b"]'), dataB.tco);
      renderCostsLegend(section.querySelector('[data-role="costs-legend-b"]'));
      renderCostsLine(section.querySelector('[data-role="costs-line-chart-a"]'), dataA.yearly);
      renderCostsLine(section.querySelector('[data-role="costs-line-chart-b"]'), dataB.yearly);
    },
    efficiency: () => {
      renderSOCChart(section.querySelector('[data-role="efficiency-soc-chart-a"]'), dataA.soc);
      renderSOCChart(section.querySelector('[data-role="efficiency-soc-chart-b"]'), dataB.soc);
      renderEnergyChart(section.querySelector('[data-role="efficiency-energy-chart-a"]'), dataA.energy);
      renderEnergyChart(section.querySelector('[data-role="efficiency-energy-chart-b"]'), dataB.energy);
    },
    emissions: () => {
      renderCO2Bar(section.querySelector('[data-role="emissions-bar-chart-a"]'), dataA.co2Annual);
      renderCO2Legend(section.querySelector('[data-role="emissions-legend-a"]'), dataA.co2Annual);
      renderCO2Bar(section.querySelector('[data-role="emissions-bar-chart-b"]'), dataB.co2Annual);
      renderCO2Legend(section.querySelector('[data-role="emissions-legend-b"]'), dataB.co2Annual);
      renderCO2Cumulative(section.querySelector('[data-role="emissions-line-chart-a"]'), dataA.co2Cum);
      renderCO2Cumulative(section.querySelector('[data-role="emissions-line-chart-b"]'), dataB.co2Cum);
    },
  };

  const activateTab = (tabName) => {
    section.querySelectorAll(".results-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    section.querySelectorAll(".tab-panel").forEach((panel) => {
      const active = panel.dataset.panel === tabName;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    if (!renderedTabs.has(tabName)) {
      renderedTabs.add(tabName);
      TAB_RENDERERS[tabName]?.();
    }
  };

  activateTab("costs");

  const handleTabClick = (e) => {
    const btn = e.target.closest(".results-tab");
    if (!btn) return;
    activateTab(btn.dataset.tab);
  };
  const tabList = section.querySelector(".results-tabs");
  if (tabList) {
    tabList.addEventListener("click", handleTabClick);
    cleanupHandlers.push(() => tabList.removeEventListener("click", handleTabClick));
  }

  const handleBack = () => triggerPartialLoad("simulation-runs");
  section.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener("click", handleBack);
    cleanupHandlers.push(() => btn.removeEventListener("click", handleBack));
  });

  return () => cleanupHandlers.forEach((h) => h());
};

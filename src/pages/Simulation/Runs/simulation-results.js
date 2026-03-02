import * as d3 from "d3";
import { t } from "../../../i18n";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import "./simulation-results.css";

/* ── Fake simulation-data fields ──────────────────────────────── */

const FAKE_GENERAL_INFO = {
  creation_date: "23.01.2025 14:00",
  update_date: "23.01.2025 14:00",
  day: "Monday",
  lines: "1, 2, 3",
  shift_name: "Shift 01",
};

const FAKE_BUS_INFO = {
  bus_name: "Bus 01",
  manufacturer: "Manufacturer 01",
  cost_chf: "999'999",
  bus_length_m: 99,
  max_passengers: 99,
  bus_lifetime_years: 99,
  single_pack_battery_cost_chf: "999'999",
  battery_pack_lifetime_years: 99,
};

const FAKE_CHARGING_INFO = {
  location: "Stop 99",
  address: "Via Zorzi n. 1, Mendrisio",
  cost_chf: "999'999",
  max_charging_power_kw: 999,
  connection_cost_chf_kw: 999,
  charger_lifetime_years: 99,
  charging_efficiency_pct: 98,
};

const GENERAL_LABELS = {
  creation_date: "Creation date",
  update_date: "Update date",
  day: "Day",
  lines: "Lines",
  shift_name: "Shift name",
  external_temp_celsius: "External temperature",
  occupancy_percent: "Avg. passenger occupancy",
  heating_type: "Auxiliary heating type",
  battery_packs: "Number of battery packs",
};
const BUS_LABELS = {
  bus_name: "Bus name",
  manufacturer: "Manufacturer",
  cost_chf: "Cost (CHF)",
  bus_length_m: "Bus length (m)",
  max_passengers: "Maximum number of passengers",
  bus_lifetime_years: "Bus lifetime (years)",
  single_pack_battery_cost_chf: "Single pack battery cost (CHF)",
  battery_pack_lifetime_years: "Battery pack lifetime (years)",
};
const CHARGING_LABELS = {
  location: "Location",
  address: "Address",
  cost_chf: "Cost (CHF)",
  max_charging_power_kw: "Maximum charging power (kW)",
  connection_cost_chf_kw: "Connection cost (CHF/kW)",
  charger_lifetime_years: "Charger lifetime (years)",
  charging_efficiency_pct: "Charging efficiency (%)",
};

/* ── Fake chart data ──────────────────────────────────────────── */

const COSTS_TCO = [
  {
    category: "equivalent_diesel_bus",
    vehicle: 1_400_000,
    energy: 1_200_000,
    maintenance: 600_000,
  },
  {
    category: "electric_bus",
    vehicle: 1_600_000,
    energy: 400_000,
    maintenance: 400_000,
  },
];
const COST_STACK_KEYS = ["vehicle", "energy", "maintenance"];
const COST_COLORS = { vehicle: "#6fbeec", energy: "#f5a623", maintenance: "#abe828" };

const COSTS_YEARLY = Array.from({ length: 15 }, (_, i) => ({
  year: i + 1,
  diesel: 180_000 + i * 12_000,
  electric: 140_000 + i * 4_000,
}));

const generateSOCData = () => {
  const pts = [];
  let soc = 95;
  for (let h = 0; h <= 8; h += 0.25) {
    if (h > 0) {
      const charging = (h > 3 && h < 3.5) || (h > 6 && h < 6.5);
      soc += charging ? 14 : -(3 + Math.random() * 2);
      soc = Math.max(10, Math.min(100, soc));
    }
    pts.push({ hour: h, soc });
  }
  return pts;
};
const SOC_DATA = generateSOCData();

const ENERGY_PER_KM = [
  { segment: "urban", diesel: 0.42, electric: 1.25 },
  { segment: "suburban", diesel: 0.35, electric: 0.95 },
  { segment: "hilly", diesel: 0.52, electric: 1.50 },
  { segment: "flat", diesel: 0.30, electric: 0.80 },
];

const CO2_ANNUAL = [
  { category: "equivalent_diesel_bus", value: 85, color: "#6fbeec" },
  { category: "electric_bus", value: 12, color: "#abe828" },
];

const CO2_CUM = Array.from({ length: 15 }, (_, i) => ({
  year: i + 1,
  saved: (i + 1) * 73,
}));

/* ── Shared helpers ───────────────────────────────────────────── */

const formatCHF = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("de-CH");
};

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

const renderFieldsInto = (container, dataObj, labelMap = {}) => {
  if (!container) return;
  container.innerHTML = Object.entries(dataObj)
    .map(([key, value]) => {
      const label = labelMap[key] ?? key.replace(/_/g, " ");
      return `
        <div class="sim-data-field">
          <div class="sim-data-field-label">${textContent(label)}</div>
          <div class="sim-data-field-value">${textContent(String(value))}</div>
        </div>`;
    })
    .join("");
};

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

/* ── Costs tab charts ─────────────────────────────────────────── */

const renderCostsBar = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 40, left: 80 };
  const W = 620, H = 300;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const stacked = d3.stack().keys(COST_STACK_KEYS)(COSTS_TCO);

  const svg = svgBase(W, H, "TCO stacked bar chart");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(COSTS_TCO.map((d) => d.category)).range([0, iW]).padding(0.35);
  const y = d3.scaleLinear().domain([0, 3_600_000]).nice().range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d)))
    .selectAll("text")
    .attr("font-size", "11px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(d / 1e6).toFixed(1)}M`)).selectAll("text").attr("font-size", "11px");

  stacked.forEach((layer) => {
    g.selectAll(`.bar-${layer.key}`)
      .data(layer)
      .join("rect")
      .attr("x", (d) => x(d.data.category))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("fill", COST_COLORS[layer.key]);
  });

  COSTS_TCO.forEach((d) => {
    const total = COST_STACK_KEYS.reduce((s, k) => s + d[k], 0);
    g.append("text")
      .attr("x", x(d.category) + x.bandwidth() / 2)
      .attr("y", y(total) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#1c1c1c")
      .text(`CHF ${(total / 1e6).toFixed(1)}M`);
  });

  el.appendChild(svg.node());
};

const renderCostsLegend = (el) => {
  if (!el) return;
  el.innerHTML = Object.entries(COST_COLORS)
    .map(
      ([key, color]) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${color}"></span>
      ${textContent(costStackLabel(key))}
    </div>`
    )
    .join("");
};

const renderCostsLine = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 40, left: 70 };
  const W = 620, H = 260;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, "Yearly cost comparison line chart");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, 15]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, d3.max(COSTS_YEARLY, (d) => Math.max(d.diesel, d.electric)) * 1.1]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(15).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(d / 1e3).toFixed(0)}k`)).selectAll("text").attr("font-size", "10px");
  gridLines(g, y, iW);

  const dieselLine = d3.line().x((d) => x(d.year)).y((d) => y(d.diesel)).curve(d3.curveMonotoneX);
  const elecLine = d3.line().x((d) => x(d.year)).y((d) => y(d.electric)).curve(d3.curveMonotoneX);

  g.append("path").datum(COSTS_YEARLY).attr("d", dieselLine).attr("fill", "none").attr("stroke", "#6fbeec").attr("stroke-width", 2.5);
  g.append("path").datum(COSTS_YEARLY).attr("d", elecLine).attr("fill", "none").attr("stroke", "#abe828").attr("stroke-width", 2.5);

  g.append("text").attr("x", iW + 4).attr("y", y(COSTS_YEARLY.at(-1).diesel)).attr("font-size", "10px").attr("fill", "#6fbeec").attr("dominant-baseline", "middle").text(fuelLabel("diesel"));
  g.append("text").attr("x", iW + 4).attr("y", y(COSTS_YEARLY.at(-1).electric)).attr("font-size", "10px").attr("fill", "#abe828").attr("dominant-baseline", "middle").text(fuelLabel("electric"));

  el.appendChild(svg.node());
};

/* ── Efficiency tab charts ────────────────────────────────────── */

const renderSOCChart = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const W = 620, H = 260;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, "State of charge line chart");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, 8]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, 100]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(9).tickFormat((d) => `${d}h`)).selectAll("text").attr("font-size", "11px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`)).selectAll("text").attr("font-size", "11px");
  gridLines(g, y, iW);

  const area = d3.area().x((d) => x(d.hour)).y0(iH).y1((d) => y(d.soc)).curve(d3.curveCatmullRom);
  const line = d3.line().x((d) => x(d.hour)).y((d) => y(d.soc)).curve(d3.curveCatmullRom);

  g.append("path").datum(SOC_DATA).attr("d", area).attr("fill", "rgba(171,232,40,0.15)");
  g.append("path").datum(SOC_DATA).attr("d", line).attr("fill", "none").attr("stroke", "#abe828").attr("stroke-width", 2.5);

  g.selectAll(".dot").data(SOC_DATA.filter((_, i) => i % 4 === 0)).join("circle")
    .attr("cx", (d) => x(d.hour)).attr("cy", (d) => y(d.soc)).attr("r", 3.5)
    .attr("fill", "#abe828").attr("stroke", "#fff").attr("stroke-width", 1.5);

  el.appendChild(svg.node());
};

const renderEnergyChart = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };
  const W = 620, H = 280;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, "Energy consumption grouped bar chart");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand().domain(ENERGY_PER_KM.map((d) => d.segment)).range([0, iW]).padding(0.25);
  const x1 = d3.scaleBand().domain(["diesel", "electric"]).range([0, x0.bandwidth()]).padding(0.08);
  const y = d3.scaleLinear().domain([0, 1.8]).nice().range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x0).tickFormat((d) => segmentLabel(d)))
    .selectAll("text")
    .attr("font-size", "11px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "11px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -48)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_energy_units"));

  ENERGY_PER_KM.forEach((d) => {
    g.append("rect").attr("x", x0(d.segment) + x1("diesel")).attr("y", y(d.diesel)).attr("width", x1.bandwidth()).attr("height", iH - y(d.diesel)).attr("rx", 3).attr("fill", "#6fbeec");
    g.append("rect").attr("x", x0(d.segment) + x1("electric")).attr("y", y(d.electric)).attr("width", x1.bandwidth()).attr("height", iH - y(d.electric)).attr("rx", 3).attr("fill", "#abe828");
  });

  el.appendChild(svg.node());
};

/* ── Emissions tab charts ─────────────────────────────────────── */

const renderCO2Bar = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const W = 620, H = 280;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, "CO2 emissions comparison bar chart");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(CO2_ANNUAL.map((d) => d.category)).range([0, iW]).padding(0.4);
  const y = d3.scaleLinear().domain([0, 100]).nice().range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d)))
    .selectAll("text")
    .attr("font-size", "11px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "11px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_co2_t_per_year"));

  g.selectAll(".bar").data(CO2_ANNUAL).join("rect")
    .attr("x", (d) => x(d.category)).attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth()).attr("height", (d) => iH - y(d.value))
    .attr("rx", 4).attr("fill", (d) => d.color);

  g.selectAll(".bar-label").data(CO2_ANNUAL).join("text")
    .attr("x", (d) => x(d.category) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.value) - 6)
    .attr("text-anchor", "middle").attr("font-size", "12px").attr("font-weight", "600").attr("fill", "#1c1c1c")
    .text((d) => `${d.value} ${t("simulation.unit_tonnes_short")}`);

  el.appendChild(svg.node());
};

const renderCO2Legend = (el) => {
  if (!el) return;
  el.innerHTML = CO2_ANNUAL.map(
    (d) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${d.color}"></span>
      ${textContent(busCategoryLabel(d.category))}
    </div>`
  ).join("");
};

const renderCO2Cumulative = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const W = 620, H = 260;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, "Cumulative CO2 savings area chart");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, 15]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, d3.max(CO2_CUM, (d) => d.saved) * 1.1]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(15).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "10px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_co2_saved_t"));
  gridLines(g, y, iW);

  const area = d3.area().x((d) => x(d.year)).y0(iH).y1((d) => y(d.saved)).curve(d3.curveMonotoneX);
  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.saved)).curve(d3.curveMonotoneX);

  g.append("path").datum(CO2_CUM).attr("d", area).attr("fill", "rgba(171,232,40,0.15)");
  g.append("path").datum(CO2_CUM).attr("d", line).attr("fill", "none").attr("stroke", "#abe828").attr("stroke-width", 2.5);

  g.selectAll(".dot").data(CO2_CUM).join("circle")
    .attr("cx", (d) => x(d.year)).attr("cy", (d) => y(d.saved)).attr("r", 3)
    .attr("fill", "#abe828").attr("stroke", "#fff").attr("stroke-width", 1.5);

  el.appendChild(svg.node());
};

/* ── Chart render registry (lazy per tab) ─────────────────────── */

const TAB_RENDERERS = {
  costs: (section) => {
    renderCostsBar(section.querySelector('[data-role="costs-bar-chart"]'));
    renderCostsLegend(section.querySelector('[data-role="costs-legend"]'));
    renderCostsLine(section.querySelector('[data-role="costs-line-chart"]'));
  },
  efficiency: (section) => {
    renderSOCChart(section.querySelector('[data-role="efficiency-soc-chart"]'));
    renderEnergyChart(section.querySelector('[data-role="efficiency-energy-chart"]'));
  },
  emissions: (section) => {
    renderCO2Bar(section.querySelector('[data-role="emissions-bar-chart"]'));
    renderCO2Legend(section.querySelector('[data-role="emissions-legend"]'));
    renderCO2Cumulative(section.querySelector('[data-role="emissions-line-chart"]'));
  },
};

/* ── Init ──────────────────────────────────────────────────────── */

export const initializeSimulationResults = (root = document, options = {}) => {
  const section = root.querySelector("section.simulation-results-page");
  if (!section) return null;

  const cleanupHandlers = [];
  const renderedTabs = new Set();

  const simNameEl = section.querySelector('[data-role="sim-name"]');
  const busModelEl = section.querySelector('[data-role="sim-bus-model"]');
  const overlay = section.querySelector('[data-role="sim-data-overlay"]');
  const subtitleEl = section.querySelector('[data-role="sim-data-subtitle"]');

  const shiftName = options.shiftName || "Shift 01";
  const busModelName = options.busModelName || "Model A";

  if (simNameEl) simNameEl.textContent = shiftName;
  if (busModelEl) busModelEl.textContent = busModelName;

  const generalInfo = {
    ...FAKE_GENERAL_INFO,
    shift_name: shiftName,
    ...(options.createdAt ? { creation_date: options.createdAt, update_date: options.createdAt } : {}),
    ...(options.externalTemp != null ? { external_temp_celsius: `${options.externalTemp} °C` } : {}),
    ...(options.occupancyPercent != null ? { occupancy_percent: `${options.occupancyPercent}%` } : {}),
    ...(options.heatingType ? { heating_type: options.heatingType } : {}),
    ...(options.numBatteryPacks != null ? { battery_packs: options.numBatteryPacks } : {}),
  };
  const bmd = options.busModelData ?? {};
  const busInfo = {
    ...FAKE_BUS_INFO,
    bus_name: busModelName,
    ...(bmd.manufacturer ? { manufacturer: bmd.manufacturer } : {}),
    ...(bmd.cost != null && bmd.cost !== "" ? { cost_chf: formatCHF(bmd.cost) } : {}),
    ...(bmd.bus_length_m != null && bmd.bus_length_m !== "" ? { bus_length_m: bmd.bus_length_m } : {}),
    ...(bmd.max_passengers != null && bmd.max_passengers !== "" ? { max_passengers: bmd.max_passengers } : {}),
    ...(bmd.bus_lifetime != null && bmd.bus_lifetime !== "" ? { bus_lifetime_years: bmd.bus_lifetime } : {}),
    ...(bmd.battery_pack_lifetime != null && bmd.battery_pack_lifetime !== "" ? { battery_pack_lifetime_years: bmd.battery_pack_lifetime } : {}),
  };

  if (subtitleEl) {
    subtitleEl.textContent = "";
    subtitleEl.hidden = true;
  }

  renderFieldsInto(section.querySelector('[data-role="general-info"]'), generalInfo, GENERAL_LABELS);
  renderFieldsInto(section.querySelector('[data-role="bus-info"]'), busInfo, BUS_LABELS);
  renderFieldsInto(section.querySelector('[data-role="charging-info"]'), FAKE_CHARGING_INFO, CHARGING_LABELS);

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
      TAB_RENDERERS[tabName]?.(section);
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

  const toggleOverlay = () => { if (overlay) overlay.hidden = !overlay.hidden; };
  section.querySelectorAll('[data-action="toggle-sim-data"]').forEach((btn) => {
    btn.addEventListener("click", toggleOverlay);
    cleanupHandlers.push(() => btn.removeEventListener("click", toggleOverlay));
  });

  const closeOverlay = () => { if (overlay) overlay.hidden = true; };
  section.querySelectorAll('[data-action="close-sim-data"]').forEach((btn) => {
    btn.addEventListener("click", closeOverlay);
    cleanupHandlers.push(() => btn.removeEventListener("click", closeOverlay));
  });

  if (overlay) {
    const onBg = (e) => { if (e.target === overlay) closeOverlay(); };
    overlay.addEventListener("click", onBg);
    cleanupHandlers.push(() => overlay.removeEventListener("click", onBg));
  }

  return () => cleanupHandlers.forEach((h) => h());
};

import * as d3 from "d3";
import "./yearly-analysis-results.css";
import { openPartialInNewTab, triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import {
  fetchYearlyAnalysis,
  fetchYearlyAnalysisCosts,
  fetchYearlyAnalysisEmissions,
  fetchOptimizationRun,
  fetchPredictionRun,
  fetchPredictionRuns,
} from "../../../api/simulation";
import { fetchBusModelById } from "../../../api/bus-models";
import {
  fetchLcaVehicles,
  fetchVehicleImpact,
  fetchShiftYearlyImpact,
} from "../../../api/environmental";
import { ADDITIVE_KPIS, MODE_LABELS, MODE_LABEL_KEYS } from "./yearly-analysis-store";
import { t } from "../../../i18n";
import {
  enrichAllScenarios,
  computeYearlySummary,
  computeContributions,
  buildEfficiencyByTemp,
  buildAnnualContribution,
  hasQuantiles,
  formatUncertainty,
} from "./yearly-analysis-helpers";
import {
  DEFAULT_OPEX_ANNUALIZATION_RATE,
  DEFAULT_BUS_LIFETIME_YEARS,
  DEFAULT_DIESEL_BUS_LIFETIME_YEARS,
  DEFAULT_BATTERY_LIFETIME_YEARS,
  getEquivalentDieselBusCapexForLength,
  getDieselEfficiencyForLength,
  getDieselMaintenanceCostForLength,
  getElectricMaintenanceCostForLength,
  getBusParameterDefaults,
} from "../../../config/economic-defaults";
import {
  buildDiscountedProjectedCostTrend,
  computeEquivalentAnnualCost,
  computeScheduleResidualValue,
} from "../../../utils/economic-costs";

/* ── Shared helpers ────────────────────────────────────────────── */

const text = (v) => (v === null || v === undefined ? "" : String(v));

const modeLabel = (mode, fallback = "") => {
  const key = MODE_LABEL_KEYS[mode];
  return key ? t(key) : fallback || MODE_LABELS[mode] || mode || "—";
};

const translateOr = (key, fallback, params = {}) => {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
};

const ENV_INDICATOR_LABEL_KEYS = {
  gwp100a: "yearly_analysis.env_kpi_co2_equiv",
  co2: "yearly_analysis.env_kpi_co2_equiv",
  nox: "simulation.env_kpi_nox",
  pm10: "simulation.env_kpi_pm10",
};

const resolveEnvIndicatorLabel = (ind) => {
  const key = ind?.key ?? ind?.indicator;
  const i18nKey = ENV_INDICATOR_LABEL_KEYS[key];
  if (i18nKey) {
    const translated = t(i18nKey);
    if (translated !== i18nKey) return translated;
  }
  return ind?.label || key || "—";
};

const quantileHelpText = () =>
  translateOr(
    "yearly_analysis.quantile_help",
    "Q50 is the median scenario prediction. Q05 is a low-demand estimate and Q95 is a high-demand estimate. Q05-Q95 shows the prediction spread across simulations; wider intervals indicate higher uncertainty."
  );

const annualContributionHelpText = () =>
  translateOr(
    "yearly_analysis.annual_contribution_uncertainty_help",
    "Yearly-scaled Q05/Q50/Q95 values are obtained by weighting temperature scenarios by their annual occurrence. This is a scenario-weighted prediction-spread envelope, not a true annual exceedance probability."
  );

const scenarioTableUncertaintyHelpText = () =>
  translateOr(
    "yearly_analysis.scenario_table_uncertainty_help",
    "The uncertainty column reports Q50 with the Q05-Q95 spread for specific consumption in each temperature scenario."
  );

const heatingLabel = (value) => {
  const normalized = text(value).trim().toLowerCase();
  const key = {
    default: "simulation.heating_default",
    heat_pump: "simulation.heating_hp",
    hp: "simulation.heating_hp",
    diesel: "simulation.heating_diesel",
    electric: "simulation.heating_electric",
  }[normalized];
  return key ? t(key) : value || "—";
};

const toFiniteNumber = (v) => {
  if (v === "" || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatFixed = (v, d = 2) => {
  const n = toFiniteNumber(v);
  return n != null ? n.toLocaleString("de-CH", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—";
};

const formatInt = (v) => {
  const n = toFiniteNumber(v);
  return n != null ? Math.round(n).toLocaleString("de-CH") : "—";
};

const formatCHF = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("de-CH");
};

const feasibilityBadge = (v) => {
  if (v === true) return `<span class="ya-badge ya-badge--ok">${textContent(t("simulation.feasibility_feasible"))}</span>`;
  if (v === false) return `<span class="ya-badge ya-badge--err">${textContent(t("simulation.feasibility_infeasible"))}</span>`;
  return `<span class="ya-badge ya-badge--neutral">—</span>`;
};

const MOBITOOL_URL = "https://www.i14y.admin.ch/en/catalog/dataservices/171b09a4-5b5f-4577-8921-3af7fc6eee39/description";
const MOBITOOL_LINK_HTML = `<a href="${MOBITOOL_URL}" target="_blank" rel="noopener noreferrer">Mobitool</a>`;
const linkifyMobitoolHtml = (value) => text(value).replace(/Mobitool/g, MOBITOOL_LINK_HTML);

/* ── Overview helpers ──────────────────────────────────────────── */

const overviewRowHtml = (label, value, raw = false) =>
  `<div class="ya-overview-row">
    <span class="ya-overview-row__label">${textContent(label)}</span>
    <span class="ya-overview-row__value">${raw ? value : textContent(value)}</span>
  </div>`;

const overviewColShell = (icon, title, bodyHtml) =>
  `<div class="ya-overview-col">
    <div class="ya-overview-col__header">
      <span class="ya-overview-col__icon" aria-hidden="true">${icon}</span>
      <h3 class="ya-overview-col__title">${textContent(title)}</h3>
    </div>
    ${bodyHtml}
  </div>`;

const summarizeShiftNames = (names = []) => {
  const items = (Array.isArray(names) ? names : []).map((name) => text(name).trim()).filter(Boolean);
  if (!items.length) return "—";
  if (items.length === 1) return items[0];
  return `${items[0]} +${items.length - 1}`;
};

const formatCompactNumber = (value, decimals = 1) => {
  const numeric = toFiniteNumber(value);
  if (numeric == null) return "—";
  if (Number.isInteger(numeric)) return formatInt(numeric);
  return formatFixed(numeric, decimals);
};

const formatBatterySummary = (busModelData, optimizedPacks) => {
  const packSizeKwh = toFiniteNumber(busModelData?.battery_pack_size_kwh);
  const packs = toFiniteNumber(optimizedPacks);
  if (packSizeKwh != null && packs != null) {
    const totalCapacityKwh = packSizeKwh * packs;
    return t("yearly_analysis.battery_capacity_summary", {
      packSize: formatCompactNumber(packSizeKwh),
      packs: formatCompactNumber(packs, 0),
      total: formatCompactNumber(totalCapacityKwh),
    });
  }
  if (packSizeKwh != null) return t("yearly_analysis.battery_pack_only", { packSize: formatCompactNumber(packSizeKwh) });
  if (packs != null) return t("yearly_analysis.packs_value", { count: formatCompactNumber(packs, 0) });
  return "—";
};

const buildShiftLink = (features) => {
  const cfg = features.config ?? {};
  const meta = features.meta ?? {};
  const shiftIds = Array.isArray(cfg.shift_ids) ? cfg.shift_ids.map((id) => text(id).trim()).filter(Boolean) : [];
  const label = summarizeShiftNames(meta.shiftNames ?? []);
  if (!label || label === "—") return "—";
  if (shiftIds.length === 1) {
    return `<a class="ya-overview-link" href="#visualize-shift" data-action="open-partial" data-partial="visualize-shift" data-shift-id="${textContent(shiftIds[0])}">${textContent(label)}</a>`;
  }
  if (shiftIds.length > 1) {
    return `<a class="ya-overview-link" href="#shifts" data-action="open-partial" data-partial="shifts">${textContent(label)}</a>`;
  }
  return textContent(label);
};

/* ── Chart / slider helpers ─────────────────────────────────────── */

const FUEL_COLORS = { diesel: "var(--color-danger)", electric: "#2e7d32" };
const COST_COLORS = { vehicle: "#4f86c6", energy: "#d4881f", maintenance: "#5f8f2f" };
const COST_STACK_KEYS = ["vehicle", "energy", "maintenance"];
const COST_VARIABLE_DEBOUNCE_MS = 300;

const setRangeProgress = (input, value) => {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const num = Number(value);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(num)) {
    input.style.setProperty("--slider-progress", "0%");
    return;
  }
  const pct = ((num - min) / (max - min)) * 100;
  input.style.setProperty("--slider-progress", `${Math.min(100, Math.max(0, pct))}%`);
};

const applyYaSliderRange = (input, range) => {
  if (!input || !range) return;
  input.min = String(range.min);
  input.max = String(range.max);
  if (range.step != null) input.step = String(range.step);
  const format = typeof range.format === "function" ? range.format : (value) => String(value);
  const scaleEl = input.closest(".ya-cost-variables__field")?.querySelector(".ya-cost-variables__range-scale");
  if (scaleEl) {
    const spans = scaleEl.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = format(range.min);
    if (spans[1]) spans[1].textContent = format(range.max);
  }
};

const YEARLY_DISTANCE_BOUND_STEP_KM = 10000;

const roundToNearestStep = (value, step) => Math.round(value / step) * step;

const buildYearlyDistanceSliderRange = (distanceKm) => {
  const base = toFiniteNumber(distanceKm);
  if (base == null || base <= 0) return null;
  const boundStep = YEARLY_DISTANCE_BOUND_STEP_KM;
  let min = roundToNearestStep(base * 0.5, boundStep);
  let max = roundToNearestStep(base * 1.8, boundStep);

  if (min >= base) {
    min = Math.max(0, Math.floor((base - 1) / boundStep) * boundStep);
  }
  if (max <= base) {
    max = Math.ceil((base + 1) / boundStep) * boundStep;
  }
  return { min, max, step: 1, format: formatInt };
};

const formatKmPerYear = (distanceKm) =>
  distanceKm != null ? t("simulation.km_per_year_value", { value: formatInt(distanceKm) }) : "—";

const syncYaRangeInput = (input, valueEl, value, fmt) => {
  if (!input) return;
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) {
    input.disabled = true;
    setRangeProgress(input, null);
    if (valueEl) valueEl.textContent = "—";
    return;
  }
  input.disabled = false;
  input.value = numericValue;
  setRangeProgress(input, numericValue);
  if (valueEl) valueEl.textContent = fmt(numericValue);
};

const svgBase = (w, h, ariaLabel) =>
  d3.create("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img").attr("aria-label", ariaLabel);

const gridLines = (g, scale, innerW, ticks = 5) => {
  g.selectAll(".grid-line")
    .data(scale.ticks(ticks))
    .join("line")
    .attr("x1", 0).attr("x2", innerW)
    .attr("y1", (d) => scale(d)).attr("y2", (d) => scale(d))
    .attr("stroke", "var(--color-border-light)").attr("stroke-dasharray", "3,3");
};

const formatChfAxis = (value) => {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(Math.round(value));
};

const formatChfAxisWithUnit = (value) => `${formatChfAxis(value)} CHF`;
const formatKChfAxis = (value) => String(Math.round(value / 1000));
const formatKChfLabel = (value) => `${Math.round(value / 1000)} kCHF`;

const findClosestPointOnPath = (pathNode, pointer) => {
  const totalLength = pathNode.getTotalLength();
  if (!Number.isFinite(totalLength) || totalLength <= 0) return null;
  const samples = Math.max(48, Math.ceil(totalLength / 8));
  let bestLength = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const len = (totalLength * i) / samples;
    const pt = pathNode.getPointAtLength(len);
    const dSq = (pt.x - pointer[0]) ** 2 + (pt.y - pointer[1]) ** 2;
    if (dSq < bestDistSq) { bestLength = len; bestDistSq = dSq; }
  }
  let step = totalLength / samples;
  while (step > 0.5) {
    const bLen = Math.max(0, bestLength - step);
    const aLen = Math.min(totalLength, bestLength + step);
    const bPt = pathNode.getPointAtLength(bLen);
    const aPt = pathNode.getPointAtLength(aLen);
    const bD = (bPt.x - pointer[0]) ** 2 + (bPt.y - pointer[1]) ** 2;
    const aD = (aPt.x - pointer[0]) ** 2 + (aPt.y - pointer[1]) ** 2;
    if (bD < bestDistSq) { bestLength = bLen; bestDistSq = bD; }
    else if (aD < bestDistSq) { bestLength = aLen; bestDistSq = aD; }
    else step /= 2;
  }
  return pathNode.getPointAtLength(bestLength);
};

/* ── Stacked bar chart: annual cost comparison ─────────────────── */

const costStackLabel = (key) => ({
  vehicle: t("simulation.cost_stack_capex"),
  energy: t("simulation.cost_stack_opex_usage"),
  maintenance: t("simulation.cost_stack_opex_maintenance"),
}[key] ?? key);
const hasDieselHeatingCosts = (cd) =>
  (toFiniteNumber(cd?.electric?.dieselHeatingFuelOpex) ?? 0) > 0
  || (toFiniteNumber(cd?.electric?.dieselHeatingMaintOpex) ?? 0) > 0;
const getElectricCostLabel = (cd) =>
  hasDieselHeatingCosts(cd) ? t("yearly_analysis.ebus_diesel_heating") : t("yearly_analysis.ebus");
const getDieselCostLabel = () => t("yearly_analysis.diesel_comparator");

const renderYaCostsBar = (el, cd) => {
  if (!el) return;
  el.innerHTML = "";
  if (!cd) return;

  const yearlyKm = toFiniteNumber(cd.yearlyDistanceKm);
  const dhFuel = toFiniteNumber(cd.electric.dieselHeatingFuelOpex) ?? 0;
  const dhMaint = toFiniteNumber(cd.electric.dieselHeatingMaintOpex) ?? 0;
  const data = [
    { category: getElectricCostLabel(cd), vehicle: cd.electric.capexAnnual, energy: cd.electric.energyOpex + dhFuel, maintenance: cd.electric.maintOpex + dhMaint },
    { category: getDieselCostLabel(), vehicle: cd.diesel.capexAnnual, energy: cd.diesel.fuelOpex, maintenance: cd.diesel.maintOpex },
  ];

  const margin = { top: 28, right: 24, bottom: 32, left: 72 };
  const W = 620, H = 180;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const stacked = d3.stack().keys(COST_STACK_KEYS)(data);
  const maxVal = d3.max(data, (row) => COST_STACK_KEYS.reduce((s, k) => s + (row[k] ?? 0), 0));

  const svg = svgBase(W, H, t("simulation.chart_aria_tco_stacked"));
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map((d) => d.category)).range([0, iW]).padding(0.35);
  const y = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x)).selectAll("text").attr("font-size", "11px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(formatKChfAxis)).selectAll("text").attr("font-size", "11px");
  g.append("text").attr("transform", "rotate(-90)").attr("y", -54).attr("x", -iH / 2)
    .attr("text-anchor", "middle").attr("font-size", "11px").attr("fill", "#666").text(t("simulation.axis_cost_kchf_per_year"));

  let tooltipGroup, tooltipBg, tooltipText;

  const showBarTooltip = (event, d, layerKey) => {
    const segVal = Math.max(0, (d[1] ?? 0) - (d[0] ?? 0));
    const totalVal = COST_STACK_KEYS.reduce((s, k) => s + (d.data[k] ?? 0), 0);
    const pct = totalVal > 0 ? ((segVal / totalVal) * 100).toFixed(0) : "0";
    const perKm = yearlyKm > 0
      ? t("yearly_analysis.cost_per_km_segment", { value: formatFixed(segVal / yearlyKm, 3) })
      : "";

    tooltipText.selectAll("*").remove();
    tooltipText.append("tspan")
      .attr("x", 8).attr("dy", 14)
      .attr("font-weight", "600").attr("fill", "#1c1c1c")
      .text(`${costStackLabel(layerKey)}: ${formatKChfLabel(segVal)}${perKm} (${pct}%)`);

    const bbox = tooltipText.node().getBBox();
    const tw = bbox.width + 16, th = bbox.height + 8;
    tooltipBg.attr("width", tw).attr("height", th);

    const barCX = x(d.data.category) + x.bandwidth() / 2;
    const barTopY = y(d[1]);
    let tx = barCX - tw / 2, ty = barTopY - th - 6;
    if (tx < 0) tx = 0;
    if (tx + tw > iW) tx = iW - tw;
    if (ty < 0) ty = barTopY + (y(d[0]) - y(d[1])) + 6;

    tooltipGroup.attr("transform", `translate(${tx},${ty})`).style("display", null);
  };

  const hideBarTooltip = () => tooltipGroup.style("display", "none");

  stacked.forEach((layer) => {
    g.selectAll(`.bar-${layer.key}`).data(layer).join("rect")
      .attr("x", (d) => x(d.data.category)).attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1])).attr("width", x.bandwidth())
      .attr("fill", COST_COLORS[layer.key])
      .style("cursor", "pointer")
      .on("pointerenter", function (event, d) { d3.select(this).attr("opacity", 0.82); showBarTooltip(event, d, layer.key); })
      .on("pointermove", function (event, d) { showBarTooltip(event, d, layer.key); })
      .on("pointerleave", function () { d3.select(this).attr("opacity", 1); hideBarTooltip(); });
  });

  data.forEach((d) => {
    const total = COST_STACK_KEYS.reduce((s, k) => s + (d[k] ?? 0), 0);
    const perKm = yearlyKm > 0 ? formatFixed(total / yearlyKm, 3) : null;
    const labelY = Math.max(10, y(total) - (perKm ? 18 : 6));
    const label = g.append("text")
      .attr("x", x(d.category) + x.bandwidth() / 2).attr("y", labelY)
      .attr("text-anchor", "middle").attr("font-size", "12px").attr("font-weight", "600")
      .attr("fill", "#1c1c1c").attr("pointer-events", "none");
    label.append("tspan").attr("x", x(d.category) + x.bandwidth() / 2).text(formatKChfLabel(total));
    if (perKm) {
      label.append("tspan").attr("x", x(d.category) + x.bandwidth() / 2)
        .attr("dy", "1.1em").attr("font-size", "10px").attr("font-weight", "500")
        .text(t("yearly_analysis.cost_per_km_bar_suffix", { value: perKm }));
    }
  });

  tooltipGroup = g.append("g").style("display", "none").attr("pointer-events", "none");
  tooltipBg = tooltipGroup.append("rect")
    .attr("fill", "var(--color-surface)").attr("stroke", "#94a3b8").attr("stroke-width", 1)
    .attr("rx", 6).attr("ry", 6).attr("opacity", 0.97)
    .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,.12))");
  tooltipText = tooltipGroup.append("text").attr("fill", "#1c1c1c").attr("font-size", "10px");

  el.appendChild(svg.node());
};

const renderYaCostsBarLegend = (el) => {
  if (!el) return;
  el.innerHTML = Object.entries(COST_COLORS).map(([key, color]) =>
    `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${color}"></span>${textContent(costStackLabel(key))}</div>`
  ).join("");
};

/* ── Line chart: projected cost trend ──────────────────────────── */

const attachLineHover = ({ layer, lineData, lineGen, x, y, iW, iH, color, seriesLabel }) => {
  if (!lineData.length) return;
  layer.append("path").datum(lineData).attr("d", lineGen)
    .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.5);
  const hitPath = layer.append("path").datum(lineData).attr("d", lineGen)
    .attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 14).style("cursor", "pointer");

  const focus = layer.append("g").style("display", "none").attr("pointer-events", "none");
  focus.append("circle").attr("r", 4).attr("fill", "var(--color-surface)").attr("stroke", color).attr("stroke-width", 2);

  const tooltip = focus.append("g");
  const tooltipBg = tooltip.append("rect").attr("fill", "var(--color-surface)").attr("stroke", color).attr("stroke-width", 1)
    .attr("rx", 6).attr("ry", 6).attr("opacity", 0.96);
  const tooltipText = tooltip.append("text").attr("fill", "#1c1c1c").attr("font-size", "10px");

  const update = (event) => {
    const ptr = d3.pointer(event, layer.node());
    const closest = findClosestPointOnPath(hitPath.node(), ptr);
    if (!closest) return;
    const yr = x.invert(closest.x);
    const cost = y.invert(closest.y);
    focus.attr("transform", `translate(${closest.x},${closest.y})`);
    tooltipText.selectAll("*").remove();
    tooltipText.append("tspan").attr("x", 8).attr("y", 14).attr("font-weight", "700").text(seriesLabel);
    tooltipText.append("tspan").attr("x", 8).attr("dy", "1.25em").text(`${t("simulation.general_year")} ${formatFixed(Math.round(yr), 0)}`);
    tooltipText.append("tspan").attr("x", 8).attr("dy", "1.25em").text(`CHF ${formatCHF(Math.round(cost))}`);
    const bbox = tooltipText.node().getBBox();
    const tw = bbox.width + 16, th = bbox.height + 10;
    tooltipBg.attr("width", tw).attr("height", th);
    let tx = closest.x + 12, ty = closest.y - th - 12;
    if (tx + tw > iW) tx = closest.x - tw - 12;
    if (tx < 0) tx = Math.max(0, iW - tw);
    if (ty < 0) ty = closest.y + 12;
    tooltip.attr("transform", `translate(${tx - closest.x},${ty - closest.y})`);
    focus.style("display", null);
  };

  hitPath.on("pointerenter", update).on("pointermove", update)
    .on("pointerleave", () => focus.style("display", "none"));
};

const renderYaCostsLine = (el, data, cd) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) return;

  const margin = { top: 14, right: 24, bottom: 30, left: 84 };
  const W = 620, H = 140;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, t("simulation.chart_aria_cost_trend"));
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const tickYears = Array.from(new Set(data.map((d) => d.year)));

  const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([0, iW]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => Math.max(d.diesel, d.electric)) * 1.1]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).tickValues(tickYears).tickFormat(String)).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(formatChfAxisWithUnit)).selectAll("text").attr("font-size", "10px");
  gridLines(g, y, iW);

  attachLineHover({
    layer: g.append("g"),
    lineData: data,
    lineGen: d3.line().x((d) => x(d.year)).y((d) => y(d.diesel)),
    x,
    y,
    iW,
    iH,
    color: FUEL_COLORS.diesel,
    seriesLabel: getDieselCostLabel(),
  });
  attachLineHover({
    layer: g.append("g"),
    lineData: data,
    lineGen: d3.line().x((d) => x(d.year)).y((d) => y(d.electric)),
    x,
    y,
    iW,
    iH,
    color: FUEL_COLORS.electric,
    seriesLabel: getElectricCostLabel(cd),
  });

  el.appendChild(svg.node());
};

const renderYaCostsLineLegend = (el, cd) => {
  if (!el) return;
  el.innerHTML = ["diesel", "electric"].map((key) =>
    `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${FUEL_COLORS[key]}"></span>${textContent(key === "diesel" ? getDieselCostLabel() : getElectricCostLabel(cd))}</div>`
  ).join("");
};

/* ── Quantile backfill from prediction runs ───────────────────── */

const readQuantilesFromSummary = (s, candidateKeys) => {
  const src = candidateKeys.find((k) => {
    const v = s?.[k];
    return v && typeof v === "object" && !Array.isArray(v);
  });
  if (!src) return null;
  const obj = s[src];
  const q05 = toFiniteNumber(obj.q05);
  const q50 = toFiniteNumber(obj.q50);
  const q95 = toFiniteNumber(obj.q95);
  return q05 != null || q50 != null || q95 != null ? { q05, q50, q95 } : null;
};

const patchKpisFromSummary = (kpis, summary) => {
  const patched = { ...kpis };
  patched.quantiles = patched.quantiles ?? readQuantilesFromSummary(summary, ["quantiles", "total_quantiles", "consumption_quantiles"]);
  patched.drivetrainQuantiles = patched.drivetrainQuantiles ?? readQuantilesFromSummary(summary, ["drivetrain_quantiles"]);
  patched.consumptionPerKmQuantiles = patched.consumptionPerKmQuantiles ?? readQuantilesFromSummary(summary, [
    "consumption_per_km_kwh_quantiles", "total_consumption_per_km_kwh_quantiles", "total_per_km_kwh_quantiles",
  ]);
  patched.drivetrainPerKmQuantiles = patched.drivetrainPerKmQuantiles ?? readQuantilesFromSummary(summary, ["drivetrain_per_km_kwh_quantiles"]);
  patched.auxiliaryPerKmKwh = patched.auxiliaryPerKmKwh ?? toFiniteNumber(summary.auxiliary_per_km_kwh);
  patched.drivetrainPerKmKwh = patched.drivetrainPerKmKwh ?? toFiniteNumber(summary.drivetrain_per_km_kwh);
  return patched;
};

const backfillQuantiles = async (scenarioResults, analysisId) => {
  const needsBackfill = scenarioResults.filter(
    (sr) => !sr.error && sr.kpis && !sr.kpis.quantiles,
  );
  if (!needsBackfill.length) return scenarioResults;

  const hasPredRunIds = needsBackfill.some((sr) => sr.predRunId);

  let summaryByTemp = null;

  if (hasPredRunIds) {
    const fetches = await Promise.allSettled(
      needsBackfill.filter((sr) => sr.predRunId).map((sr) => fetchPredictionRun(sr.predRunId)),
    );
    const byId = new Map();
    const idsWithPred = needsBackfill.filter((sr) => sr.predRunId);
    fetches.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value?.summary) {
        byId.set(idsWithPred[i].predRunId, result.value.summary);
      }
    });

    return scenarioResults.map((sr) => {
      if (sr.error || !sr.predRunId || sr.kpis?.quantiles) return sr;
      const summary = byId.get(sr.predRunId);
      if (!summary) return sr;
      return { ...sr, kpis: patchKpisFromSummary(sr.kpis, summary) };
    });
  }

  if (analysisId) {
    const allRuns = await fetchPredictionRuns({ yearly_analysis_id: analysisId });
    const runs = Array.isArray(allRuns) ? allRuns : allRuns?.items ?? allRuns?.results ?? [];
    summaryByTemp = new Map();
    for (const run of runs) {
      const temp = toFiniteNumber(
        run?.contextual_parameters?.external_temp_celsius ??
        run?.input_params?.external_temp_celsius ??
        run?.external_temp_celsius,
      );
      if (temp != null && run?.summary) summaryByTemp.set(temp, run.summary);
    }
  }

  if (!summaryByTemp || !summaryByTemp.size) return scenarioResults;

  return scenarioResults.map((sr) => {
    if (sr.error || !sr.kpis || sr.kpis.quantiles) return sr;
    const summary = summaryByTemp.get(sr.temperature);
    if (!summary) return sr;
    return { ...sr, kpis: patchKpisFromSummary(sr.kpis, summary) };
  });
};

/* ── Efficiency rendering ──────────────────────────────────────── */

const renderConfig = (features) => {
  const cfg = features.config ?? {};
  const meta = features.meta ?? {};
  const items = [
    { label: t("yearly_analysis.col_shifts"), value: (meta.shiftNames ?? []).join(", ") || "—" },
    { label: t("yearly_analysis.col_mode"), value: modeLabel(cfg.mode, meta.modeLabel) },
    { label: t("yearly_analysis.occupancy"), value: cfg.occupancy_percent != null ? `${cfg.occupancy_percent}%` : "—" },
    { label: t("yearly_analysis.heating"), value: heatingLabel(cfg.auxiliary_heating_type) },
    { label: t("yearly_analysis.soc_range"), value: `${((cfg.min_soc ?? 0) * 100).toFixed(0)}–${((cfg.max_soc ?? 1) * 100).toFixed(0)}%` },
  ];
  return `<div class="ya-res-config">
    <h3 class="ya-res-config-title">${textContent(t("yearly_analysis.configuration"))}</h3>
    <div class="ya-res-params">${items.map(({ label, value }) =>
      `<div class="ya-res-param"><span class="ya-res-param-label">${textContent(label)}</span><span>${textContent(String(value))}</span></div>`
    ).join("")}</div>
  </div>`;
};

const renderBatterySizing = (features, optimizationRunId) => {
  const results = features.results ?? {};
  const meta = features.meta ?? {};
  const packs = results.optimizedPacks;
  const baseFeasible = results.baseFeasible;
  const sizingTemp = meta.sizingTemp;
  if (packs == null) return "";

  const items = [];
  if (sizingTemp != null) items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">${textContent(t("yearly_analysis.sizing_temperature"))}</span><span class="ya-highlight-value">${formatFixed(sizingTemp, 1)} °C</span></div>`);
  items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">${textContent(t("simulation.inv_opt_packs"))}</span><span class="ya-highlight-value">${packs}</span></div>`);
  if (baseFeasible != null) items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">${textContent(t("yearly_analysis.feasibility_result"))}</span><span>${textContent(baseFeasible ? t("simulation.feasibility_feasible") : t("simulation.feasibility_infeasible"))}</span></div>`);
  if (optimizationRunId) items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">${textContent(t("yearly_analysis.base_evaluation"))}</span><span class="ya-mono">${textContent(text(optimizationRunId).slice(0, 8))}…</span></div>`);

  return `<div class="ya-res-section">
    <h3 class="ya-res-section-title">${textContent(t("simulation.opt_battery_results"))}</h3>
    <div class="ya-non-additive">${items.join("")}</div>
    <p class="ya-sizing-note">${textContent(t("yearly_analysis.battery_sizing_note"))}</p>
  </div>`;
};

/* ── Table A: Scenario results ─────────────────────────────────── */

const renderScenarioTable = (enriched = []) => {
  const anyUncertainty = enriched.some((s) => s.derived && hasQuantiles(s.kpis?.consumptionPerKmQuantiles));

  const headers = [
    t("yearly_analysis.scenario"), t("yearly_analysis.temp_celsius"), t("yearly_analysis.days_year"),
    t("yearly_analysis.total_energy_kwh"), t("yearly_analysis.drivetrain_kwh"), t("yearly_analysis.auxiliary_kwh"),
    t("yearly_analysis.simulated_distance_km"), t("simulation.efficiency_col_per_km"),
    ...(anyUncertainty
      ? [translateOr(
          "yearly_analysis.efficiency_uncertainty",
          "Specific Q50 (Q05-Q95)"
        )]
      : []),
  ];
  const headerHtml = headers.map((h) => `<th>${textContent(h)}</th>`).join("");

  const colSpan = headers.length - 2;
  const rows = enriched.map((sr) => {
    if (sr.error) {
      return `<tr><td>${textContent(sr.label)}</td><td>${formatFixed(sr.temperature, 1)}</td><td>${sr.occurrences}</td><td colspan="${colSpan}" class="ya-scenario-error">${textContent(sr.error)}</td></tr>`;
    }
    const k = sr.kpis ?? {};
    const d = sr.derived ?? {};
    const uncert = anyUncertainty
      ? `<td class="ya-uncertainty">${formatUncertainty(k.consumptionPerKmQuantiles, 3) ?? "—"}</td>`
      : "";
    return `<tr>
      <td>${textContent(sr.label)}</td>
      <td>${formatFixed(sr.temperature, 1)}</td>
      <td>${sr.occurrences}</td>
      <td>${formatFixed(k.totalEnergyKwh, 1)}</td>
      <td>${formatFixed(k.drivetrainEnergyKwh, 1)}</td>
      <td>${formatFixed(k.auxiliaryEnergyKwh, 1)}</td>
      <td>${formatFixed(k.distanceKm, 1)}</td>
      <td>${formatFixed(d.efficiencyMedian ?? k.energyPerKm, 3)}</td>
      ${uncert}
    </tr>`;
  }).join("");

  return `<div class="ya-res-section">
    <h3 class="ya-res-section-title">${textContent(t("yearly_analysis.scenario_results"))}</h3>
    ${anyUncertainty
      ? `<p class="ya-sizing-note">${textContent(scenarioTableUncertaintyHelpText())}</p>`
      : ""}
    <div class="ya-res-table-wrap"><table class="ya-res-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
};

const buildCriticalUncertaintyScenarios = (annualContrib = []) => {
  const rows = (Array.isArray(annualContrib) ? annualContrib : [])
    .map((row) => {
      const dailyQ05 = toFiniteNumber(row.dailyQ05);
      const dailyQ95 = toFiniteNumber(row.dailyQ95);
      const yearlyQ05 = toFiniteNumber(row.yearlyQ05);
      const yearlyQ50 = toFiniteNumber(row.yearlyQ50);
      const yearlyQ95 = toFiniteNumber(row.yearlyQ95);
      const dailySpread =
        dailyQ05 != null && dailyQ95 != null ? dailyQ95 - dailyQ05 : null;
      const yearlySpread =
        yearlyQ05 != null && yearlyQ95 != null ? yearlyQ95 - yearlyQ05 : null;

      return {
        label: row.label,
        temperature: toFiniteNumber(row.temperature),
        occurrences: toFiniteNumber(row.occurrences),
        dailyQ05,
        dailyQ95,
        yearlyQ05,
        yearlyQ50,
        yearlyQ95,
        dailySpread,
        yearlySpread,
      };
    });

  const maxBy = (items, key) =>
    items.reduce((best, item) => {
      const value = toFiniteNumber(item?.[key]);
      if (value == null) return best;
      const bestValue = toFiniteNumber(best?.[key]);
      return bestValue == null || value > bestValue ? item : best;
    }, null);

  return {
    highestQ95: maxBy(rows, "yearlyQ95"),
    widestSpread: maxBy(rows, "dailySpread"),
    largestWeightedSpread: maxBy(rows, "yearlySpread"),
  };
};

const scenarioDescriptor = (row = {}) => {
  const parts = [
    row.temperature != null ? `${formatFixed(row.temperature, 1)} °C` : text(row.label),
    row.occurrences != null ? `${formatInt(row.occurrences)} ${translateOr("yearly_analysis.days_per_year_short", "days/year")}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
};

const temperatureDescriptor = (row = {}) =>
  row.temperature != null ? `${formatFixed(row.temperature, 1)} °C` : text(row.label);

const renderCriticalUncertaintyScenarios = (annualContrib = []) => {
  const critical = buildCriticalUncertaintyScenarios(annualContrib);
  const items = [];

  if (critical.highestQ95) {
    items.push({
      label: translateOr("yearly_analysis.critical_highest_q95", "Highest Q95 energy scenario"),
      value: `${formatInt(critical.highestQ95.yearlyQ95)} kWh/year`,
      detail: t("yearly_analysis.critical_detail_yearly_q95", {
        temperature: temperatureDescriptor(critical.highestQ95),
        value: formatInt(critical.highestQ95.yearlyQ95),
      }),
    });
  }

  if (critical.widestSpread) {
    items.push({
      label: translateOr("yearly_analysis.critical_widest_spread", "Widest prediction spread"),
      value: `${formatFixed(critical.widestSpread.dailySpread, 1)} kWh/day`,
      detail: t("yearly_analysis.critical_detail_daily_q05_q95", {
        scenario: scenarioDescriptor(critical.widestSpread),
        low: formatFixed(critical.widestSpread.dailyQ05, 1),
        high: formatFixed(critical.widestSpread.dailyQ95, 1),
      }),
    });
  }

  if (critical.largestWeightedSpread) {
    items.push({
      label: translateOr("yearly_analysis.critical_weighted_spread", "Largest yearly prediction spread"),
      value: `${formatInt(critical.largestWeightedSpread.yearlySpread)} kWh/year`,
      detail: t("yearly_analysis.critical_detail_yearly_q05_q95", {
        temperature: temperatureDescriptor(critical.largestWeightedSpread),
        low: formatInt(critical.largestWeightedSpread.yearlyQ05),
        high: formatInt(critical.largestWeightedSpread.yearlyQ95),
      }),
    });
  }

  const bodyHtml = items.length
    ? `<div class="kpi-grid ya-critical-grid">${items.map((item) => `
        <div class="ya-critical-item">
          <span class="ya-critical-item__label">${textContent(item.label)}</span>
          <strong class="ya-critical-item__value">${textContent(item.value)}</strong>
          <span class="ya-critical-item__detail">${textContent(item.detail)}</span>
        </div>`
      ).join("")}</div>`
    : `<p class="ya-critical-empty">${textContent(
        translateOr(
          "yearly_analysis.critical_uncertainty_empty",
          "No Q05/Q50/Q95 scenario uncertainty is available for this analysis."
        )
      )}</p>`;

  return `<div class="ya-res-section ya-critical-panel">
    <h3 class="ya-res-section-title">${textContent(
      translateOr("yearly_analysis.critical_uncertainty_title", "Critical uncertainty scenarios")
    )}</h3>
    <p class="ya-sizing-note">${textContent(
      translateOr(
        "yearly_analysis.critical_uncertainty_help",
        "Highlights use the same scenario-weighted Q05/Q50/Q95 values shown by the annual energy chart. Yearly spread means yearly Q95 minus yearly Q05, not a true annual exceedance probability."
      )
    )}</p>
    ${bodyHtml}
  </div>`;
};

const buildYearlyUncertaintySummary = (annualContrib = []) => {
  const rows = (Array.isArray(annualContrib) ? annualContrib : []).map((row) => ({
    q05: toFiniteNumber(row?.yearlyQ05),
    q50: toFiniteNumber(row?.yearlyQ50),
    q95: toFiniteNumber(row?.yearlyQ95),
  }));
  const completeRows = rows.filter(
    (row) => row.q05 != null && row.q50 != null && row.q95 != null
  );

  if (!rows.length || completeRows.length !== rows.length) return null;

  const q05 = completeRows.reduce((sum, row) => sum + row.q05, 0);
  const q50 = completeRows.reduce((sum, row) => sum + row.q50, 0);
  const q95 = completeRows.reduce((sum, row) => sum + row.q95, 0);
  const spread = q95 - q05;
  const relativeSpread = q50 > 0 ? (spread / q50) * 100 : null;

  return {
    q05,
    q50,
    q95,
    spread,
    relativeSpread,
  };
};

const renderYearlyUncertaintySummary = (annualContrib = []) => {
  if (!Array.isArray(annualContrib) || !annualContrib.length) return "";

  const summary = buildYearlyUncertaintySummary(annualContrib);
  const bodyHtml = summary
    ? `<div class="kpi-grid ya-uncertainty-summary-grid">
        <div class="ya-uncertainty-summary-item">
          <span class="ya-uncertainty-summary-item__label">${textContent(
            translateOr("yearly_analysis.yearly_uncertainty_q50", "Scenario-weighted Q50 annual energy")
          )}</span>
          <strong class="ya-uncertainty-summary-item__value">${textContent(formatInt(summary.q50))} kWh/year</strong>
          <span class="ya-uncertainty-summary-item__detail">${textContent(
            translateOr("yearly_analysis.yearly_uncertainty_q50_detail", "Median estimate from stochastic simulations")
          )}</span>
        </div>
        <div class="ya-uncertainty-summary-item">
          <span class="ya-uncertainty-summary-item__label">${textContent(
            translateOr("yearly_analysis.yearly_uncertainty_envelope", "Scenario-weighted Q05-Q95 envelope")
          )}</span>
          <strong class="ya-uncertainty-summary-item__value">${textContent(formatInt(summary.q05))}-${textContent(formatInt(summary.q95))} kWh/year</strong>
        </div>
        <div class="ya-uncertainty-summary-item">
          <span class="ya-uncertainty-summary-item__label">${textContent(
            translateOr("yearly_analysis.yearly_uncertainty_spread", "Prediction spread")
          )}</span>
          <strong class="ya-uncertainty-summary-item__value">${textContent(formatInt(summary.spread))} kWh/year</strong>
        </div>
        ${summary.relativeSpread != null
          ? `<div class="ya-uncertainty-summary-item">
              <span class="ya-uncertainty-summary-item__label">${textContent(
                translateOr("yearly_analysis.yearly_uncertainty_relative_spread", "Relative spread")
              )}</span>
              <strong class="ya-uncertainty-summary-item__value">${textContent(t("yearly_analysis.relative_spread_of_q50", { value: formatFixed(summary.relativeSpread, 1) }))}</strong>
            </div>`
          : ""}
      </div>`
    : `<p class="ya-critical-empty">${textContent(
        translateOr(
          "yearly_analysis.yearly_uncertainty_empty",
          "Yearly uncertainty summary is unavailable because scenario quantiles are missing."
        )
      )}</p>`;

  return `<div class="ya-res-section ya-yearly-uncertainty-summary">
    <h3 class="ya-res-section-title">${textContent(
      translateOr("yearly_analysis.yearly_uncertainty_title", "Yearly uncertainty summary")
    )}</h3>
    <p class="ya-sizing-note">${textContent(
      translateOr(
        "yearly_analysis.yearly_uncertainty_help",
        "Scenario-weighted annual estimate based on temperature-scenario Q05/Q50/Q95 values. This is a scenario-weighted prediction-spread envelope, not a true annual exceedance probability."
      )
    )}</p>
    ${bodyHtml}
  </div>`;
};

/* ── Table B: Yearly aggregated summary (cards) ───────────────── */

const renderYearlySummary = (summary) => {
  const card = (label, value, sub) => `<div class="ya-summary-card">
    <div class="ya-summary-card__label">${textContent(label)}</div>
    <div class="ya-summary-card__value">${value}</div>
    ${sub ? `<div class="ya-summary-card__sub">${sub}</div>` : ""}
  </div>`;
  const efficiencySub = [
    summary.minEfficiency != null ? textContent(t("yearly_analysis.best_efficiency", { value: formatFixed(summary.minEfficiency, 3) })) : null,
    summary.maxEfficiency != null ? textContent(t("yearly_analysis.worst_efficiency", { value: formatFixed(summary.maxEfficiency, 3) })) : null,
  ].filter(Boolean).join("<br>");

  const cards = [
    card(t("yearly_analysis.yearly_simulated_distance"), summary.dist != null ? `${formatInt(summary.dist)} km` : "—"),
    card(
      translateOr("yearly_analysis.point_estimate_yearly_energy", "Yearly energy (point estimate)"),
      summary.energy != null ? `${formatInt(summary.energy)} kWh` : "—"
    ),
    card(translateOr("yearly_analysis.point_estimate_drivetrain_energy", "Point-estimate drivetrain energy"), summary.drv != null ? `${formatInt(summary.drv)} kWh` : "—",
      summary.drvShare != null ? t("yearly_analysis.percent_of_total", { value: formatFixed(summary.drvShare, 1) }) : null),
    card(translateOr("yearly_analysis.point_estimate_auxiliary_energy", "Point-estimate auxiliary energy"), summary.aux != null ? `${formatInt(summary.aux)} kWh` : "—",
      summary.auxShare != null ? t("yearly_analysis.percent_of_total", { value: formatFixed(summary.auxShare, 1) }) : null),
    card(
      translateOr("yearly_analysis.point_estimate_average_yearly_efficiency", "Point-estimate average yearly efficiency"),
      summary.avgEfficiency != null ? `${formatFixed(summary.avgEfficiency, 3)} kWh/km` : "—",
      efficiencySub || null,
    ),
  ];

  return `<div class="ya-res-section">
    <h3 class="ya-res-section-title">${textContent(t("yearly_analysis.yearly_aggregated_summary"))}</h3>
    <div class="kpi-grid ya-summary-cards">${cards.join("")}</div>
    <p class="ya-sizing-note ya-summary-transition-note">${textContent(
      translateOr(
        "yearly_analysis.point_estimate_vs_uncertainty_note",
        "The yearly aggregated summary reports point estimates. The uncertainty summary reports scenario-weighted quantiles from stochastic simulations, so the point estimate and Q50 median may differ."
      )
    )}</p>
  </div>`;
};

/* ── Plot 1: Scenario efficiency by temperature ───────────────── */

const EFF_COLORS = { total: "#00639a", auxiliary: "#f5a623", drivetrain: "#6fbeec", range: "rgba(0,99,154,0.15)" };

const renderEfficiencyByTempChart = (el, legendEl, data) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
  if (!data || !data.length) return;

  const margin = { top: 16, right: 24, bottom: 38, left: 56 };
  const W = 560, H = 300;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, t("yearly_analysis.chart_aria_efficiency_temperature"));
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const temps = data.map((d) => d.temperature);
  const xExtent = [d3.min(temps) - 2, d3.max(temps) + 2];
  const allY = data.flatMap((d) => [d.efficiency, d.q05, d.q95, d.auxPerKm, d.drvPerKm].filter((v) => v != null));
  const yMax = d3.max(allY) * 1.12 || 1;

  const x = d3.scaleLinear().domain(xExtent).range([0, iW]);
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(data.length).tickFormat((d) => `${d}°C`)).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(6).tickFormat((d) => d.toFixed(2))).selectAll("text").attr("font-size", "10px");
  g.append("text").attr("transform", "rotate(-90)").attr("y", -44).attr("x", -iH / 2).attr("text-anchor", "middle").attr("font-size", "10px").attr("fill", "#666").text(t("yearly_analysis.axis_kwh_km"));

  gridLines(g, y, iW, 6);

  const hasRange = data.some((d) => d.q05 != null && d.q95 != null);
  if (hasRange) {
    const area = d3.area()
      .defined((d) => d.q05 != null && d.q95 != null)
      .x((d) => x(d.temperature))
      .y0((d) => y(d.q05))
      .y1((d) => y(d.q95))
      .curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("d", area).attr("fill", EFF_COLORS.range).attr("stroke", "none");
  }

  const line = d3.line().defined((d) => d.efficiency != null).x((d) => x(d.temperature)).y((d) => y(d.efficiency)).curve(d3.curveMonotoneX);
  g.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", EFF_COLORS.total).attr("stroke-width", 2.2);

  const hasAux = data.some((d) => d.auxPerKm != null);
  const hasDrv = data.some((d) => d.drvPerKm != null);

  if (hasDrv) {
    const drvLine = d3.line().defined((d) => d.drvPerKm != null).x((d) => x(d.temperature)).y((d) => y(d.drvPerKm)).curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("d", drvLine).attr("fill", "none").attr("stroke", EFF_COLORS.drivetrain).attr("stroke-width", 1.4).attr("stroke-dasharray", "5,3");
  }
  if (hasAux) {
    const auxLine = d3.line().defined((d) => d.auxPerKm != null).x((d) => x(d.temperature)).y((d) => y(d.auxPerKm)).curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("d", auxLine).attr("fill", "none").attr("stroke", EFF_COLORS.auxiliary).attr("stroke-width", 1.4).attr("stroke-dasharray", "5,3");
  }

  if (hasRange) {
    data.forEach((d) => {
      if (d.q05 == null || d.q95 == null) return;
      const cx = x(d.temperature);
      g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(d.q05)).attr("y2", y(d.q95)).attr("stroke", EFF_COLORS.total).attr("stroke-width", 1.2);
      g.append("line").attr("x1", cx - 3).attr("x2", cx + 3).attr("y1", y(d.q05)).attr("y2", y(d.q05)).attr("stroke", EFF_COLORS.total).attr("stroke-width", 1.2);
      g.append("line").attr("x1", cx - 3).attr("x2", cx + 3).attr("y1", y(d.q95)).attr("y2", y(d.q95)).attr("stroke", EFF_COLORS.total).attr("stroke-width", 1.2);
    });
  }

  let tooltipGroup, tooltipBg, tooltipText;

  const showTooltip = (d) => {
    tooltipText.selectAll("*").remove();
    const lines = [
      `${d.label} (${d.temperature}°C)`,
      t("yearly_analysis.tooltip_days_year", { value: d.occurrences }),
      t("yearly_analysis.tooltip_efficiency", { value: d.efficiency != null ? d.efficiency.toFixed(3) : "—" }),
    ];
    if (d.q05 != null) {
      lines.push(t("yearly_analysis.tooltip_q05_q95_band", {
        low: d.q05.toFixed(3),
        high: (d.q95 ?? 0).toFixed(3),
      }));
    }
    if (d.auxPerKm != null) lines.push(t("yearly_analysis.tooltip_auxiliary", { value: d.auxPerKm.toFixed(3) }));
    if (d.drvPerKm != null) lines.push(t("yearly_analysis.tooltip_drivetrain", { value: d.drvPerKm.toFixed(3) }));
    if (d.distanceKm != null) lines.push(t("yearly_analysis.tooltip_distance", { value: d.distanceKm.toFixed(1) }));

    lines.forEach((txt, i) => {
      tooltipText.append("tspan").attr("x", 8).attr("dy", i === 0 ? 14 : 13).attr("font-weight", i === 0 ? "600" : "400").attr("fill", "#1c1c1c").text(txt);
    });

    const bbox = tooltipText.node().getBBox();
    const tw = bbox.width + 16, th = bbox.height + 10;
    tooltipBg.attr("width", tw).attr("height", th);

    let tx = x(d.temperature) + 10, ty = y(d.efficiency ?? 0) - th / 2;
    if (tx + tw > iW) tx = x(d.temperature) - tw - 10;
    if (ty < 0) ty = 4;
    if (ty + th > iH) ty = iH - th;

    tooltipGroup.attr("transform", `translate(${tx},${ty})`).style("display", null);
  };
  const hideTooltip = () => tooltipGroup.style("display", "none");

  data.forEach((d) => {
    if (d.efficiency == null) return;
    g.append("circle")
      .attr("cx", x(d.temperature)).attr("cy", y(d.efficiency))
      .attr("r", 4.5).attr("fill", EFF_COLORS.total).attr("stroke", "var(--color-surface)").attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("pointerenter", () => showTooltip(d))
      .on("pointerleave", hideTooltip);
  });

  tooltipGroup = g.append("g").style("display", "none").attr("pointer-events", "none");
  tooltipBg = tooltipGroup.append("rect").attr("fill", "var(--color-surface)").attr("stroke", "#94a3b8").attr("stroke-width", 1).attr("rx", 6).attr("ry", 6).attr("opacity", 0.97).attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,.12))");
  tooltipText = tooltipGroup.append("text").attr("fill", "#1c1c1c").attr("font-size", "10px");

  el.appendChild(svg.node());

  if (legendEl) {
    let html = `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${EFF_COLORS.total}"></span>${textContent(t("yearly_analysis.total_consumption"))}</div>`;
    if (hasDrv) html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${EFF_COLORS.drivetrain}"></span>${textContent(t("simulation.predictions_consumption_drivetrain"))}</div>`;
    if (hasAux) html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${EFF_COLORS.auxiliary}"></span>${textContent(t("simulation.predictions_consumption_auxiliary"))}</div>`;
    if (hasRange) html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${EFF_COLORS.range}"></span>${textContent(t("yearly_analysis.q05_q95_range"))}</div>`;
    legendEl.innerHTML = html;
  }
};

/* ── Plot 2: Annual energy contribution by scenario ───────────── */

const CONTRIB_COLORS = { drivetrain: "#6fbeec", auxiliary: "#f5a623", errorBar: "var(--color-text-main)" };

const normalizeAnnualContributionMode = (mode) => (mode === "daily" ? "daily" : "yearly");

const getAnnualContributionConfig = (mode) => {
  const normalizedMode = normalizeAnnualContributionMode(mode);
  const isDaily = normalizedMode === "daily";
  return {
    mode: normalizedMode,
    axisLabel: t(isDaily ? "yearly_analysis.energy_axis_day" : "yearly_analysis.energy_axis_year"),
    unitLabel: t(isDaily ? "yearly_analysis.energy_unit_day" : "yearly_analysis.energy_unit_year"),
    fields: isDaily
      ? { drv: "dailyDrv", aux: "dailyAux", total: "dailyTotal", q05: "dailyQ05", q50: "dailyQ50", q95: "dailyQ95" }
      : { drv: "yearlyDrv", aux: "yearlyAux", total: "yearlyTotal", q05: "yearlyQ05", q50: "yearlyQ50", q95: "yearlyQ95" },
  };
};

const formatContributionValue = (value, mode) =>
  normalizeAnnualContributionMode(mode) === "daily" ? formatFixed(value, 1) : formatInt(value);

const formatContributionTick = (value, mode) => {
  const n = toFiniteNumber(value);
  if (n == null) return "";
  if (Math.abs(n) >= 1000) {
    const scaled = n / 1000;
    const digits = normalizeAnnualContributionMode(mode) === "daily" && Math.abs(scaled) < 10 ? 1 : 0;
    return `${scaled.toFixed(digits)}k`;
  }
  if (normalizeAnnualContributionMode(mode) === "daily" && Math.abs(n) > 0 && Math.abs(n) < 10) {
    return n.toFixed(1);
  }
  return n.toFixed(0);
};

const contributionPointLabel = (mode) =>
  normalizeAnnualContributionMode(mode) === "daily"
    ? translateOr("yearly_analysis.tooltip_point_estimate_daily", "Point estimate")
    : translateOr("yearly_analysis.tooltip_point_estimate_yearly", "Scenario-weighted point estimate");

const renderAnnualContributionChart = (el, legendEl, data, mode = "yearly") => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
  if (!data || !data.length) return;

  const config = getAnnualContributionConfig(mode);
  const readValue = (item, field, fallback = 0) => {
    const value = toFiniteNumber(item?.[config.fields[field]]);
    return value != null ? value : fallback;
  };

  const margin = { top: 16, right: 24, bottom: 54, left: 64 };
  const W = 560, H = 300;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(W, H, t("yearly_analysis.chart_aria_annual_energy_unit", { unit: config.unitLabel }));
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const labels = data.map((d) => `${d.temperature}°C`);
  const xBand = d3.scaleBand().domain(labels).range([0, iW]).padding(0.3);

  const allMaxes = data.map((d) => Math.max(readValue(d, "total"), readValue(d, "q95", 0)));
  const yMax = d3.max(allMaxes) * 1.12 || 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(xBand)).selectAll("text").attr("font-size", "10px").attr("text-anchor", "end").attr("transform", "rotate(-30)");
  g.append("g").call(d3.axisLeft(y).ticks(6).tickFormat((d) => formatContributionTick(d, config.mode))).selectAll("text").attr("font-size", "10px");
  g.append("text").attr("transform", "rotate(-90)").attr("y", -52).attr("x", -iH / 2).attr("text-anchor", "middle").attr("font-size", "10px").attr("fill", "#666").text(config.axisLabel);

  gridLines(g, y, iW, 6);

  const stackKeys = ["drivetrain", "auxiliary"];
  const stackData = data.map((d, i) => ({
    index: i,
    label: labels[i],
    drivetrain: readValue(d, "drv"),
    auxiliary: readValue(d, "aux"),
  }));
  const stacked = d3.stack().keys(stackKeys)(stackData);
  const stackColors = { drivetrain: CONTRIB_COLORS.drivetrain, auxiliary: CONTRIB_COLORS.auxiliary };

  let tooltipGroup, tooltipBg, tooltipText;

  const showTooltip = (d, idx) => {
    const item = data[idx];
    const drv = readValue(item, "drv");
    const aux = readValue(item, "aux");
    const total = readValue(item, "total");
    const q05 = readValue(item, "q05", null);
    const q50 = readValue(item, "q50", null);
    const q95 = readValue(item, "q95", null);
    tooltipText.selectAll("*").remove();
    const pointLabel = contributionPointLabel(config.mode);
    const lines = [
      `${item.label} (${item.temperature}°C)`,
      t("yearly_analysis.tooltip_days_year", { value: formatInt(item.occurrences) }),
      t("yearly_analysis.tooltip_contribution_total", {
        label: pointLabel,
        value: formatContributionValue(total, config.mode),
        unit: config.unitLabel,
      }),
      t("yearly_analysis.tooltip_contribution_drivetrain", {
        label: pointLabel,
        value: formatContributionValue(drv, config.mode),
        unit: config.unitLabel,
      }),
      t("yearly_analysis.tooltip_contribution_auxiliary", {
        label: pointLabel,
        value: formatContributionValue(aux, config.mode),
        unit: config.unitLabel,
      }),
    ];
    if (q50 != null) {
      lines.push(t("yearly_analysis.tooltip_q50_median", {
        value: formatContributionValue(q50, config.mode),
        unit: config.unitLabel,
      }));
    }
    if (q05 != null && q95 != null) {
      lines.push(t("yearly_analysis.tooltip_prediction_spread", {
        low: formatContributionValue(q05, config.mode),
        high: formatContributionValue(q95, config.mode),
        unit: config.unitLabel,
      }));
    }

    lines.forEach((txt, i) => {
      tooltipText.append("tspan").attr("x", 8).attr("dy", i === 0 ? 14 : 13).attr("font-weight", i === 0 ? "600" : "400").attr("fill", "#1c1c1c").text(txt);
    });

    const bbox = tooltipText.node().getBBox();
    const tw = bbox.width + 16, th = bbox.height + 10;
    tooltipBg.attr("width", tw).attr("height", th);

    const barCX = xBand(labels[idx]) + xBand.bandwidth() / 2;
    let tx = barCX + 10, ty = y(total) - th / 2;
    if (tx + tw > iW) tx = barCX - tw - 10;
    if (ty < 0) ty = 4;
    if (ty + th > iH) ty = iH - th;

    tooltipGroup.attr("transform", `translate(${tx},${ty})`).style("display", null);
  };
  const hideTooltip = () => tooltipGroup.style("display", "none");

  stacked.forEach((layer) => {
    g.selectAll(`.bar-${layer.key}`).data(layer).join("rect")
      .attr("x", (d) => xBand(labels[d.data.index]))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => Math.max(0, y(d[0]) - y(d[1])))
      .attr("width", xBand.bandwidth())
      .attr("fill", stackColors[layer.key])
      .style("cursor", "pointer")
      .on("pointerenter", function (event, d) { d3.select(this).attr("opacity", 0.82); showTooltip(d, d.data.index); })
      .on("pointerleave", function () { d3.select(this).attr("opacity", 1); hideTooltip(); });
  });

  const hasErrBars = data.some((d) => readValue(d, "q05", null) != null && readValue(d, "q95", null) != null);
  if (hasErrBars) {
    data.forEach((d, i) => {
      const cx = xBand(labels[i]) + xBand.bandwidth() / 2;
      const q05 = readValue(d, "q05", null);
      const q50 = readValue(d, "q50", null);
      const q95 = readValue(d, "q95", null);
      if (q05 == null || q95 == null) return;
      const center = q50 ?? readValue(d, "total");
      g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(q05)).attr("y2", y(q95)).attr("stroke", CONTRIB_COLORS.errorBar).attr("stroke-width", 1.2);
      g.append("line").attr("x1", cx - 4).attr("x2", cx + 4).attr("y1", y(q05)).attr("y2", y(q05)).attr("stroke", CONTRIB_COLORS.errorBar).attr("stroke-width", 1.2);
      g.append("line").attr("x1", cx - 4).attr("x2", cx + 4).attr("y1", y(q95)).attr("y2", y(q95)).attr("stroke", CONTRIB_COLORS.errorBar).attr("stroke-width", 1.2);
      g.append("circle").attr("cx", cx).attr("cy", y(center)).attr("r", 2.5).attr("fill", CONTRIB_COLORS.errorBar);
    });
  }

  tooltipGroup = g.append("g").style("display", "none").attr("pointer-events", "none");
  tooltipBg = tooltipGroup.append("rect").attr("fill", "var(--color-surface)").attr("stroke", "#94a3b8").attr("stroke-width", 1).attr("rx", 6).attr("ry", 6).attr("opacity", 0.97).attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,.12))");
  tooltipText = tooltipGroup.append("text").attr("fill", "#1c1c1c").attr("font-size", "10px");

  el.appendChild(svg.node());

  if (legendEl) {
    let html = `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${CONTRIB_COLORS.drivetrain}"></span>${textContent(`${t("simulation.predictions_consumption_drivetrain")} (${config.unitLabel})`)}</div>`;
    html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${CONTRIB_COLORS.auxiliary}"></span>${textContent(`${t("simulation.predictions_consumption_auxiliary")} (${config.unitLabel})`)}</div>`;
    if (hasErrBars) html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${CONTRIB_COLORS.errorBar}"></span>${textContent(t("yearly_analysis.q05_q95_range"))}</div>`;
    legendEl.innerHTML = html;
  }
};

/* ── Costs: scenario-based computation ──────────────────────────── */

const DEFAULT_FUEL_COST_PER_L = 1.85;
const DEFAULT_ENERGY_PRICE_PER_KWH = 0.20;
// Fallback horizon only. The projected discounted lifecycle trend now uses the
// actual e-bus lifespan as its horizon (see resolveTrendHorizonYears usage).
const PROJECTED_COST_TREND_HORIZON_YEARS = 20;

const LCA_SIZE_BUCKETS = ["9m", "13m", "18m"];

const inferLcaSize = (busLengthM, busModelName) => {
  const lengthNum = toFiniteNumber(busLengthM);
  if (lengthNum != null) {
    if (lengthNum <= 10) return "9m";
    if (lengthNum <= 15) return "13m";
    return "18m";
  }
  const nameStr = String(busModelName || "").toLowerCase();
  for (const bucket of LCA_SIZE_BUCKETS) {
    if (nameStr.includes(bucket)) return bucket;
  }
  return null;
};

const computeReplacementYears = (busLifetimeYears, batteryLifetimeYears) => {
  const busLifetime = toFiniteNumber(busLifetimeYears);
  const batteryLifetime = toFiniteNumber(batteryLifetimeYears);
  if (busLifetime == null || batteryLifetime == null || busLifetime <= 0 || batteryLifetime <= 0) return [];
  const count = Math.floor((busLifetime - 1) / batteryLifetime);
  return Array.from({ length: count }, (_, i) => (i + 1) * batteryLifetime);
};

const computeRecurringReplacementYears = (lifetimeYears, horizonYears) => {
  const life = toFiniteNumber(lifetimeYears);
  const horizon = toFiniteNumber(horizonYears);
  if (life == null || horizon == null || life <= 0) return [];
  const years = [];
  let year = life;
  while (year < horizon) { years.push(year); year += life; }
  return years;
};

const computeBatteryReplacementYearsOverHorizon = (busLifetime, batteryLifetime, horizon) => {
  const bLife = toFiniteNumber(busLifetime);
  const batLife = toFiniteNumber(batteryLifetime);
  if (bLife == null || batLife == null || batLife <= 0) return [];
  const years = [];
  let busStart = 0;
  while (busStart < horizon) {
    const busEnd = busStart + bLife;
    let year = busStart + batLife;
    while (year < busEnd && year < horizon) { years.push(year); year += batLife; }
    busStart = busEnd;
  }
  return years;
};

const computeBreakEvenYear = (yearlyData) => {
  if (!Array.isArray(yearlyData) || yearlyData.length < 2) return null;
  for (let i = 1; i < yearlyData.length; i += 1) {
    const prev = yearlyData[i - 1];
    const curr = yearlyData[i];
    if (prev.diesel <= prev.electric && curr.diesel >= curr.electric) {
      const dDiff = (curr.diesel - prev.diesel) - (curr.electric - prev.electric);
      if (Math.abs(dDiff) < 1e-6) return curr.year;
      return prev.year + (prev.electric - prev.diesel) / dDiff;
    }
  }
  return null;
};

/**
 * Compute yearly costs directly from the 8 scenario prediction results.
 * Each scenario gives per-day energy/distance at a specific temperature,
 * weighted by its occurrence (days/year). This is the core advantage of the
 * yearly analysis over a single worst-case simulation.
 */
export const computeYearlyCosts = (features, busModelData, overrides = {}) => {
  const results = features.results ?? {};
  const yearlyTotals = results.yearlyTotals ?? {};
  const scenarioResults = results.scenarioResults ?? [];
  const optimizedPacks = results.optimizedPacks;

  const ov = (key) => overrides[key] != null ? toFiniteNumber(overrides[key]) : null;
  const fn = (v) => v != null ? toFiniteNumber(v) : null;

  const busLengthM = toFiniteNumber(busModelData?.bus_length_m);
  const energyPricePerKwh = ov("energyPricePerKwh") ?? DEFAULT_ENERGY_PRICE_PER_KWH;
  const fuelPricePerL = ov("fuelCostPerL") ?? DEFAULT_FUEL_COST_PER_L;
  const annualizationRateOverride = ov("interestRate");

  const dieselEfficiencyLPerKm = ov("dieselEfficiency") ?? (busLengthM != null ? getDieselEfficiencyForLength(busLengthM) : null);
  const dieselMaintPerKm = ov("dieselMaintCost") ?? (busLengthM != null ? getDieselMaintenanceCostForLength(busLengthM) : null);
  const electricMaintPerKm = ov("electricMaintCost") ?? (busLengthM != null ? getElectricMaintenanceCostForLength(busLengthM) : null);

  const baseYearlyEnergyKwh = toFiniteNumber(yearlyTotals.totalEnergyKwh);
  const baseYearlyDistanceKm = toFiniteNumber(yearlyTotals.distanceKm);
  const yearlyDistanceKm = ov("yearlyDistanceKm") ?? baseYearlyDistanceKm;
  const distanceScale =
    baseYearlyDistanceKm != null && baseYearlyDistanceKm > 0 && yearlyDistanceKm != null
      ? yearlyDistanceKm / baseYearlyDistanceKm
      : 1;
  const yearlyEnergyKwh = baseYearlyEnergyKwh != null ? baseYearlyEnergyKwh * distanceScale : null;

  if (yearlyEnergyKwh == null || yearlyEnergyKwh <= 0) return null;
  if (busLengthM == null) return null;

  const scenarioCosts = scenarioResults
    .filter((sr) => !sr.error && sr.kpis)
    .map((sr) => {
      const dailyEnergy = (toFiniteNumber(sr.kpis.totalEnergyKwh) ?? 0) * distanceScale;
      const dailyDrivetrain = (toFiniteNumber(sr.kpis.drivetrainEnergyKwh) ?? 0) * distanceScale;
      const dailyAuxiliary = (toFiniteNumber(sr.kpis.auxiliaryEnergyKwh) ?? 0) * distanceScale;
      const dailyDistance = (toFiniteNumber(sr.kpis.distanceKm) ?? 0) * distanceScale;
      const annualEnergy = dailyEnergy * sr.occurrences;
      const annualDistance = dailyDistance * sr.occurrences;
      const annualEnergyCost = annualEnergy * energyPricePerKwh;
      return {
        label: sr.label,
        temperature: sr.temperature,
        occurrences: sr.occurrences,
        dailyEnergy,
        dailyDrivetrain,
        dailyAuxiliary,
        dailyDistance,
        energyPerKm: dailyDistance > 0 ? dailyEnergy / dailyDistance : null,
        annualEnergy,
        annualDistance,
        annualEnergyCost,
      };
    });

  const totalScenarioEnergyCost = scenarioCosts.reduce((s, sc) => s + sc.annualEnergyCost, 0);

  const electricEnergyOpex = totalScenarioEnergyCost;
  const electricMaintOpex = yearlyDistanceKm != null && electricMaintPerKm != null
    ? yearlyDistanceKm * electricMaintPerKm : 0;
  const electricTotalOpex = electricEnergyOpex + electricMaintOpex;

  const dieselFuelOpex = yearlyDistanceKm != null && dieselEfficiencyLPerKm != null
    ? yearlyDistanceKm * dieselEfficiencyLPerKm * fuelPricePerL : 0;
  const dieselMaintOpex = yearlyDistanceKm != null && dieselMaintPerKm != null
    ? yearlyDistanceKm * dieselMaintPerKm : 0;
  const dieselTotalOpex = dieselFuelOpex + dieselMaintOpex;

  const busCostChf = fn(busModelData?.cost) ?? 0;
  const packCostChf = fn(busModelData?.battery_pack_cost) ?? 0;
  const totalBatteryCostChf = packCostChf * (optimizedPacks ?? 0);
  const electricCapexChf = busCostChf + totalBatteryCostChf;
  const dieselCapexChf = ov("dieselCapex") ?? getEquivalentDieselBusCapexForLength(busLengthM) ?? 0;

  const annualizationRate = annualizationRateOverride ?? DEFAULT_OPEX_ANNUALIZATION_RATE;
  const busLifetime = fn(busModelData?.bus_lifetime) ?? DEFAULT_BUS_LIFETIME_YEARS;
  const dieselBusLifetime = DEFAULT_DIESEL_BUS_LIFETIME_YEARS;
  const batteryLifetime = fn(busModelData?.battery_pack_lifetime) ?? DEFAULT_BATTERY_LIFETIME_YEARS;

  const batteryReplacementYears = computeReplacementYears(busLifetime, batteryLifetime);
  const batteryReplacementPv = batteryReplacementYears.reduce((total, year) => {
    if (annualizationRate <= 0) return total + totalBatteryCostChf;
    return total + totalBatteryCostChf / Math.pow(1 + annualizationRate, year);
  }, 0);
  const electricCapexPv = electricCapexChf + batteryReplacementPv;

  const electricCapexAnnual = computeEquivalentAnnualCost(electricCapexPv, annualizationRate, busLifetime);
  const dieselCapexAnnual = computeEquivalentAnnualCost(dieselCapexChf, annualizationRate, dieselBusLifetime);

  const electricAnnual = electricCapexAnnual + electricTotalOpex;
  const dieselAnnual = dieselCapexAnnual + dieselTotalOpex;
  const annualSaving = dieselAnnual - electricAnnual;

  // Default horizon = e-bus lifespan. A full e-bus replacement would land
  // exactly at the horizon; the exclusive `< horizon` schedule below drops it
  // because it belongs to the next lifecycle.
  const trendHorizon = busLifetime;
  const electricBusReplYears = computeRecurringReplacementYears(busLifetime, trendHorizon);
  const dieselBusReplYears = computeRecurringReplacementYears(dieselBusLifetime, trendHorizon);
  const trendBatteryReplYears = computeBatteryReplacementYearsOverHorizon(busLifetime, batteryLifetime, trendHorizon);

  // Residual value credited at the horizon for any asset still holding useful
  // life (typically the diesel comparator replaced at year 10 for a 12-yr horizon).
  const dieselResidualValue = computeScheduleResidualValue({
    purchaseCost: dieselCapexChf,
    lifetimeYears: dieselBusLifetime,
    purchaseYears: [0, ...dieselBusReplYears],
    horizonYears: trendHorizon,
  });
  const electricResidualValue =
    computeScheduleResidualValue({
      purchaseCost: busCostChf,
      lifetimeYears: busLifetime,
      purchaseYears: [0, ...electricBusReplYears],
      horizonYears: trendHorizon,
    }) +
    computeScheduleResidualValue({
      purchaseCost: totalBatteryCostChf,
      lifetimeYears: batteryLifetime,
      purchaseYears: [0, ...trendBatteryReplYears],
      horizonYears: trendHorizon,
    });

  const yearly = buildDiscountedProjectedCostTrend({
    horizonYears: trendHorizon,
    discountRate: annualizationRate,
    dieselBusCapexChf: dieselCapexChf,
    dieselAnnualOpex: dieselTotalOpex,
    dieselBusReplacementCostByYear: dieselBusReplYears.reduce((a, y) => { a[y] = dieselCapexChf; return a; }, {}),
    dieselResidualValue,
    electricBusCapexChf: electricCapexChf,
    electricAnnualOpex: electricTotalOpex,
    electricBusReplacementCostByYear: electricBusReplYears.reduce((a, y) => { a[y] = busCostChf; return a; }, {}),
    batteryReplacementCostByYear: trendBatteryReplYears.reduce((a, y) => { a[y] = (a[y] ?? 0) + totalBatteryCostChf; return a; }, {}),
    electricResidualValue,
  });

  return {
    scenarioCosts,
    assumptions: { energyPricePerKwh, fuelPricePerL, dieselEfficiencyLPerKm, dieselMaintPerKm, electricMaintPerKm },
    yearlyEnergyKwh,
    yearlyDistanceKm,
    electric: {
      energyOpex: electricEnergyOpex, maintOpex: electricMaintOpex,
      totalOpex: electricTotalOpex, capex: electricCapexChf,
      capexPv: electricCapexPv,
      capexAnnual: electricCapexAnnual, totalAnnual: electricAnnual,
      busCost: busCostChf,
      packCost: packCostChf,
      packs: optimizedPacks ?? 0,
      totalBatteryCost: totalBatteryCostChf,
      batteryReplacementPv: batteryReplacementPv,
      batteryReplacementYears: batteryReplacementYears,
      busLifetime: busLifetime,
      batteryLifetime: batteryLifetime,
    },
    diesel: {
      fuelOpex: dieselFuelOpex, maintOpex: dieselMaintOpex,
      totalOpex: dieselTotalOpex, capex: dieselCapexChf,
      capexAnnual: dieselCapexAnnual, totalAnnual: dieselAnnual,
    },
    annualSaving,
    breakEvenYear: computeBreakEvenYear(yearly),
    lifecycle: yearly.lifecycle,
    yearly,
  };
};

/* ── Bridge: map raw backend /costs response → existing cd structure ── */

const opexItemCost = (items, name) => {
  if (!Array.isArray(items)) return 0;
  const lc = name.toLowerCase();
  const entry = items.find((it) => (it.name ?? "").toLowerCase() === lc);
  return toFiniteNumber(entry?.cost_chf_per_year) ?? 0;
};

export const mapBackendCostsToLocal = (raw, yearlyDistanceKm, yearlyEnergyKwh, busModelData, { optimizedPacks, overrides } = {}) => {
  const fn = (v) => toFiniteNumber(v);
  const ov = (key) => overrides?.[key] != null ? toFiniteNumber(overrides[key]) : null;
  const e = raw.ebus ?? {};
  const d = raw.diesel_comparator ?? {};
  const a = raw.assumptions ?? {};

  /* ── Effective unit prices (slider overrides take precedence) ── */
  const baseFuelPerL = fn(a.fuel_cost_per_l) ?? DEFAULT_FUEL_COST_PER_L;
  const baseEnergyPerKwh = fn(a.energy_price_per_kwh) ?? DEFAULT_ENERGY_PRICE_PER_KWH;
  const baseDieselEffLPerKm = fn(a.diesel_comparator_consumption_l_per_km) ?? 0;
  const baseDieselMaintPerKm = fn(a.diesel_comparator_maint_cost_per_km_chf) ?? 0;
  const baseElecMaintPerKm = fn(a.electric_maint_cost_per_km_chf) ?? 0;
  const dhMaintFactor = fn(a.diesel_heating_maintenance_factor) ?? 0;

  const fuelPerL = ov("fuelCostPerL") ?? baseFuelPerL;
  const energyPerKwh = ov("energyPricePerKwh") ?? baseEnergyPerKwh;
  const dieselEffLPerKm = ov("dieselEfficiency") ?? baseDieselEffLPerKm;
  const dieselMaintPerKm = ov("dieselMaintCost") ?? baseDieselMaintPerKm;
  const elecMaintPerKm = ov("electricMaintCost") ?? baseElecMaintPerKm;

  const baseYDistKm = fn(yearlyDistanceKm ?? a.yearly_distance_km) ?? 0;
  const yDistKm = ov("yearlyDistanceKm") ?? baseYDistKm;
  const distanceScale = baseYDistKm > 0 ? yDistKm / baseYDistKm : 1;
  const yElecKwh = (fn(yearlyEnergyKwh ?? a.yearly_electric_kwh) ?? 0) * distanceScale;
  const yDhLiters = (fn(a.yearly_diesel_heating_liters) ?? 0) * distanceScale;
  const yDhFuelKwh = (fn(a.yearly_diesel_heating_fuel_kwh) ?? 0) * distanceScale;
  const isDieselHeating = yDhLiters > 0;

  /* ── OPEX: recalculate from physical quantities × unit prices ── */
  const electricEnergyOpex = yElecKwh * energyPerKwh;
  const electricMaintOpex = yDistKm * elecMaintPerKm;
  const dhFuelOpex = yDhLiters * fuelPerL;
  const dhMaintOpex = isDieselHeating ? electricMaintOpex * dhMaintFactor : 0;
  const electricTotalOpex = electricEnergyOpex + electricMaintOpex + dhFuelOpex + dhMaintOpex;

  const dieselFuelOpex = yDistKm * dieselEffLPerKm * fuelPerL;
  const dieselMaintOpex = yDistKm * dieselMaintPerKm;
  const dieselTotalOpex = dieselFuelOpex + dieselMaintOpex;

  /* ── CAPEX: use backend if available, else compute from bus model ── */
  const annualizationRate = ov("interestRate") ?? fn(a.interest_rate) ?? DEFAULT_OPEX_ANNUALIZATION_RATE;
  const busLengthM = fn(busModelData?.bus_length_m);

  const busCostChf = fn(busModelData?.cost) ?? 0;
  const packCostChf = fn(busModelData?.battery_pack_cost) ?? 0;
  const packs = fn(optimizedPacks) ?? 0;
  const totalBatteryCostChf = packCostChf * packs;
  const electricCapexUpfront = busCostChf + totalBatteryCostChf;
  const busLifetime = fn(busModelData?.bus_lifetime) ?? DEFAULT_BUS_LIFETIME_YEARS;
  const batteryLifetime = fn(busModelData?.battery_pack_lifetime) ?? DEFAULT_BATTERY_LIFETIME_YEARS;
  const dieselBusLifetime = DEFAULT_DIESEL_BUS_LIFETIME_YEARS;

  const batteryReplacementYears = computeReplacementYears(busLifetime, batteryLifetime);
  const batteryReplacementPv = batteryReplacementYears.reduce((total, year) => {
    if (annualizationRate <= 0) return total + totalBatteryCostChf;
    return total + totalBatteryCostChf / Math.pow(1 + annualizationRate, year);
  }, 0);
  const electricCapexPv = electricCapexUpfront + batteryReplacementPv;

  const electricCapexAnnual = computeEquivalentAnnualCost(electricCapexPv, annualizationRate, busLifetime);
  const dieselCapexChf = ov("dieselCapex") ?? (busLengthM != null ? (getEquivalentDieselBusCapexForLength(busLengthM) ?? 0) : 0);
  const dieselCapexAnnual = computeEquivalentAnnualCost(dieselCapexChf, annualizationRate, dieselBusLifetime);

  const electricAnnual = electricCapexAnnual + electricTotalOpex;
  const dieselAnnual = dieselCapexAnnual + dieselTotalOpex;
  const annualSaving = dieselAnnual - electricAnnual;

  /* ── Projected discounted lifecycle cost trend over the e-bus lifespan ── */
  // Horizon = e-bus lifespan; `< horizon` schedules exclude a full e-bus
  // replacement exactly at the horizon (it belongs to the next lifecycle).
  const trendHorizon = busLifetime;
  const electricBusReplYears = computeRecurringReplacementYears(busLifetime, trendHorizon);
  const dieselBusReplYears = computeRecurringReplacementYears(dieselBusLifetime, trendHorizon);
  const trendBatteryReplYears = computeBatteryReplacementYearsOverHorizon(busLifetime, batteryLifetime, trendHorizon);

  const dieselResidualValue = computeScheduleResidualValue({
    purchaseCost: dieselCapexChf,
    lifetimeYears: dieselBusLifetime,
    purchaseYears: [0, ...dieselBusReplYears],
    horizonYears: trendHorizon,
  });
  const electricResidualValue =
    computeScheduleResidualValue({
      purchaseCost: busCostChf,
      lifetimeYears: busLifetime,
      purchaseYears: [0, ...electricBusReplYears],
      horizonYears: trendHorizon,
    }) +
    computeScheduleResidualValue({
      purchaseCost: totalBatteryCostChf,
      lifetimeYears: batteryLifetime,
      purchaseYears: [0, ...trendBatteryReplYears],
      horizonYears: trendHorizon,
    });

  const yearly = buildDiscountedProjectedCostTrend({
    horizonYears: trendHorizon,
    discountRate: annualizationRate,
    dieselBusCapexChf: dieselCapexChf,
    dieselAnnualOpex: dieselTotalOpex,
    dieselBusReplacementCostByYear: dieselBusReplYears.reduce((acc, y) => { acc[y] = dieselCapexChf; return acc; }, {}),
    dieselResidualValue,
    electricBusCapexChf: electricCapexUpfront,
    electricAnnualOpex: electricTotalOpex,
    electricBusReplacementCostByYear: electricBusReplYears.reduce((acc, y) => { acc[y] = busCostChf; return acc; }, {}),
    batteryReplacementCostByYear: trendBatteryReplYears.reduce((acc, y) => { acc[y] = (acc[y] ?? 0) + totalBatteryCostChf; return acc; }, {}),
    electricResidualValue,
  });

  /* ── Scenarios: recalculate costs from physical quantities ──── */
  const scenarioCosts = (raw.scenarios ?? []).map((sc, i) => {
    const dailyElKwh = (fn(sc.daily_electric_kwh) ?? 0) * distanceScale;
    const dailyDist = (fn(sc.daily_distance_km) ?? 0) * distanceScale;
    const annElKwh = (fn(sc.annual_electric_kwh) ?? 0) * distanceScale;
    const annDist = (fn(sc.annual_distance_km) ?? 0) * distanceScale;
    const dailyDhLiters = (fn(sc.daily_diesel_heating_liters) ?? 0) * distanceScale;
    const annDhLiters = (fn(sc.annual_diesel_heating_liters) ?? 0) * distanceScale;
    const annElecMaint = annDist * elecMaintPerKm;
    return {
      label: sc.label ?? t("yearly_analysis.scenario_fallback", { index: i + 1 }),
      temperature: fn(sc.temperature_celsius) ?? 0,
      occurrences: fn(sc.occurrences) ?? 0,
      dailyEnergy: dailyElKwh,
      dailyDrivetrain: 0,
      dailyAuxiliary: 0,
      dailyDistance: dailyDist,
      energyPerKm: dailyDist > 0 ? dailyElKwh / dailyDist : null,
      annualEnergy: annElKwh,
      annualDistance: annDist,
      annualEnergyCost: annElKwh * energyPerKwh,
      annualElectricMaintCost: annElecMaint,
      dailyDieselHeatingLiters: dailyDhLiters,
      annualDieselHeatingLiters: annDhLiters,
      annualDieselHeatingFuelCost: annDhLiters * fuelPerL,
      annualDieselHeatingMaintCost: isDieselHeating ? annElecMaint * dhMaintFactor : 0,
    };
  });

  return {
    _fromBackend: true,
    scenarioCosts,
    assumptions: {
      energyPricePerKwh: energyPerKwh,
      fuelPricePerL: fuelPerL,
      dieselEfficiencyLPerKm: dieselEffLPerKm,
      dieselMaintPerKm: dieselMaintPerKm,
      electricMaintPerKm: elecMaintPerKm,
      dieselHeatingMaintenanceFactor: dhMaintFactor,
      yearlyDieselHeatingLiters: yDhLiters,
      yearlyDieselHeatingFuelKwh: yDhFuelKwh,
    },
    yearlyEnergyKwh: yElecKwh,
    yearlyDistanceKm: yDistKm,
    electric: {
      energyOpex: electricEnergyOpex,
      maintOpex: electricMaintOpex,
      dieselHeatingFuelOpex: dhFuelOpex,
      dieselHeatingMaintOpex: dhMaintOpex,
      totalOpex: electricTotalOpex,
      capex: electricCapexUpfront,
      capexPv: electricCapexPv,
      capexAnnual: electricCapexAnnual,
      totalAnnual: electricAnnual,
      busCost: busCostChf,
      packCost: packCostChf,
      packs,
      totalBatteryCost: totalBatteryCostChf,
      batteryReplacementPv,
      batteryReplacementYears,
      busLifetime,
      batteryLifetime,
    },
    diesel: {
      fuelOpex: dieselFuelOpex,
      maintOpex: dieselMaintOpex,
      totalOpex: dieselTotalOpex,
      capex: dieselCapexChf,
      capexAnnual: dieselCapexAnnual,
      totalAnnual: dieselAnnual,
    },
    annualSaving,
    breakEvenYear: computeBreakEvenYear(yearly),
    lifecycle: yearly.lifecycle,
    yearly,
  };
};

/* ── Costs rendering (into structured HTML panels) ─────────────── */

const renderCostsKpis = (el, cd) => {
  if (!el || !cd) return;
  const yearlyKm = toFiniteNumber(cd.yearlyDistanceKm);
  const savingCls = cd.annualSaving > 0 ? "ya-costs-kpi-value--positive" : cd.annualSaving < 0 ? "ya-costs-kpi-value--negative" : "";
  const lastPoint = Array.isArray(cd.yearly) ? cd.yearly[cd.yearly.length - 1] : null;
  const lifecycle = cd.lifecycle ?? cd.yearly?.lifecycle;
  const lifetimeSaving =
    toFiniteNumber(lifecycle?.lifecycleSaving) ??
    (lastPoint != null ? (toFiniteNumber(lastPoint.diesel) ?? 0) - (toFiniteNumber(lastPoint.electric) ?? 0) : null);
  // Lifecycle horizon = e-bus lifespan, read from the final trend point so the
  // KPI label stays in sync with whatever lifespan the selected model uses.
  const lifecycleYears =
    toFiniteNumber(lifecycle?.horizonYears) ??
    toFiniteNumber(lastPoint?.year) ??
    PROJECTED_COST_TREND_HORIZON_YEARS;

  el.innerHTML = `
    <div class="ya-costs-kpi-card">
      <span class="ya-costs-kpi-label">${textContent(t("simulation.costs_kpi_annual_saving"))}</span>
      <span class="ya-costs-kpi-value ${savingCls}">CHF ${formatCHF(Math.round(cd.annualSaving))}</span>
    </div>
    <div class="ya-costs-kpi-card">
      <span class="ya-costs-kpi-label">${textContent(t("yearly_analysis.lifetime_saving_years", { years: lifecycleYears }))}</span>
      <span class="ya-costs-kpi-value ${lifetimeSaving != null && lifetimeSaving > 0 ? "ya-costs-kpi-value--positive" : ""}">${lifetimeSaving != null ? `CHF ${formatCHF(Math.round(lifetimeSaving))}` : "—"}</span>
    </div>
    <div class="ya-costs-kpi-card">
      <span class="ya-costs-kpi-label">${textContent(t("yearly_analysis.yearly_simulated_distance"))}</span>
      <span class="ya-costs-kpi-value">${yearlyKm != null ? `${formatInt(yearlyKm)} km` : "—"}</span>
    </div>`;
};

const renderElectricOpexBreakdown = (el, cd) => {
  if (!el || !cd) { if (el) el.innerHTML = ""; return; }
  const km = toFiniteNumber(cd.yearlyDistanceKm);
  const energyKm = km > 0 ? cd.electric.energyOpex / km : null;
  const maintKm = km > 0 ? cd.electric.maintOpex / km : null;
  const totalKm = km > 0 ? cd.electric.totalOpex / km : null;
  const avgKwhKm = cd.yearlyEnergyKwh > 0 && km > 0 ? cd.yearlyEnergyKwh / km : null;

  const nSc = (cd.scenarioCosts ?? []).length;
  const energyTip = `<span class="ya-info-icon" tabindex="0">i<span class="ya-info-tooltip">${textContent(t("yearly_analysis.energy_cost_tooltip", { count: nSc, energy: formatInt(cd.yearlyEnergyKwh), distance: formatInt(km), average: avgKwhKm != null ? formatFixed(avgKwhKm, 3) : "—", price: formatFixed(cd.assumptions.energyPricePerKwh, 2) }))}</span></span>`;
  const maintTip = `<span class="ya-info-icon" tabindex="0">i<span class="ya-info-tooltip">${formatInt(km)} km × ${formatFixed(cd.assumptions.electricMaintPerKm, 4)} CHF/km.</span></span>`;

  const dhFuel = toFiniteNumber(cd.electric.dieselHeatingFuelOpex) ?? 0;
  const dhMaint = toFiniteNumber(cd.electric.dieselHeatingMaintOpex) ?? 0;
  const showDh = dhFuel > 0 || dhMaint > 0;
  const dhFuelKm = km > 0 && dhFuel > 0 ? dhFuel / km : null;
  const dhMaintKm = km > 0 && dhMaint > 0 ? dhMaint / km : null;
  const dhLiters = toFiniteNumber(cd.assumptions?.yearlyDieselHeatingLiters) ?? 0;
  const dhMaintFactor = toFiniteNumber(cd.assumptions?.dieselHeatingMaintenanceFactor) ?? 0;

  const dhFuelTip = showDh ? `<span class="ya-info-icon" tabindex="0">i<span class="ya-info-tooltip">${textContent(t("yearly_analysis.diesel_heating_fuel_tooltip", { liters: formatFixed(dhLiters, 1), price: formatFixed(cd.assumptions.fuelPricePerL, 2) }))}</span></span>` : "";
  const dhMaintTip = showDh ? `<span class="ya-info-icon" tabindex="0">i<span class="ya-info-tooltip">${textContent(t("yearly_analysis.diesel_heating_maintenance_tooltip", { maintenance: formatFixed(cd.assumptions.electricMaintPerKm, 4), factor: dhMaintFactor, distance: formatInt(km) }))}</span></span>` : "";

  const dhRows = showDh ? `
            <tr>
              <td>${textContent(t("yearly_analysis.diesel_heating_fuel"))}</td>
              <td>CHF ${formatCHF(Math.round(dhFuel))}</td>
              <td>${dhFuelKm != null ? `(${formatFixed(dhFuelKm, 3)} CHF/km)` : "—"} ${dhFuelTip}</td>
            </tr>
            <tr>
              <td>${textContent(t("yearly_analysis.diesel_heating_maintenance"))}</td>
              <td>CHF ${formatCHF(Math.round(dhMaint))}</td>
              <td>${dhMaintKm != null ? `(${formatFixed(dhMaintKm, 3)} CHF/km)` : "—"} ${dhMaintTip}</td>
            </tr>` : "";

  el.innerHTML = `
    <div class="ya-res-section">
      <h3 class="ya-res-section-title">${textContent(t("yearly_analysis.ebus_opex_breakdown"))}</h3>
      <div class="ya-costs-table-wrap">
        <table class="ya-costs-table">
          <thead><tr><th>${textContent(t("yearly_analysis.component"))}</th><th>${textContent(t("yearly_analysis.annual_cost"))}</th><th>${textContent(t("yearly_analysis.cost_per_km"))}</th></tr></thead>
          <tbody>
            <tr>
              <td>${textContent(t("yearly_analysis.electric_energy"))}</td>
              <td>CHF ${formatCHF(Math.round(cd.electric.energyOpex))}</td>
              <td>${energyKm != null ? `(${formatFixed(energyKm, 3)} CHF/km)` : "—"} ${energyTip}</td>
            </tr>
            <tr>
              <td>${textContent(t("yearly_analysis.electric_maintenance"))}</td>
              <td>CHF ${formatCHF(Math.round(cd.electric.maintOpex))}</td>
              <td>${maintKm != null ? `(${formatFixed(maintKm, 3)} CHF/km)` : "—"} ${maintTip}</td>
            </tr>${dhRows}
            <tr class="ya-opex-summary"><td>${textContent(t("yearly_analysis.total_ebus_opex"))}</td><td><strong>CHF ${formatCHF(Math.round(cd.electric.totalOpex))}</strong></td><td>${totalKm != null ? `<strong>(${formatFixed(totalKm, 3)} CHF/km)</strong>` : "—"}</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
};

const renderDieselOpexBreakdown = (el, cd) => {
  if (!el || !cd) { if (el) el.innerHTML = ""; return; }
  const km = toFiniteNumber(cd.yearlyDistanceKm);
  const fuelKm = km > 0 ? cd.diesel.fuelOpex / km : null;
  const maintKm = km > 0 ? cd.diesel.maintOpex / km : null;
  const totalUsageKm = km > 0 ? cd.diesel.fuelOpex / km : null;
  const totalMaintKm = km > 0 ? cd.diesel.maintOpex / km : null;
  const totalKm = km > 0 ? cd.diesel.totalOpex / km : null;

  const dieselEff = cd.assumptions?.dieselEfficiencyLPerKm ?? 0;
  const fuelPrice = cd.assumptions?.fuelPricePerL ?? 0;
  const dieselMaintPerKm = cd.assumptions?.dieselMaintPerKm ?? 0;

  const fuelTip = `<span class="ya-info-icon" tabindex="0">i<span class="ya-info-tooltip">${textContent(t("yearly_analysis.diesel_fuel_tooltip", { distance: formatInt(km), efficiency: formatFixed(dieselEff, 4), price: formatFixed(fuelPrice, 2) }))}</span></span>`;
  const maintTip = `<span class="ya-info-icon" tabindex="0">i<span class="ya-info-tooltip">${formatInt(km)} km × ${formatFixed(dieselMaintPerKm, 4)} CHF/km.</span></span>`;

  el.innerHTML = `
    <div class="ya-res-section">
      <h3 class="ya-res-section-title">${textContent(t("yearly_analysis.diesel_opex_breakdown"))}</h3>
      <div class="ya-costs-table-wrap">
        <table class="ya-costs-table">
          <thead><tr><th>${textContent(t("yearly_analysis.component"))}</th><th>${textContent(t("yearly_analysis.annual_cost"))}</th><th>${textContent(t("yearly_analysis.cost_per_km"))}</th></tr></thead>
          <tbody>
            <tr>
              <td>${textContent(t("yearly_analysis.maintenance"))}</td>
              <td>CHF ${formatCHF(Math.round(cd.diesel.maintOpex))}</td>
              <td>${maintKm != null ? `(${formatFixed(maintKm, 3)} CHF/km)` : "—"} ${maintTip}</td>
            </tr>
            <tr>
              <td>${textContent(t("yearly_analysis.fuel"))}</td>
              <td>CHF ${formatCHF(Math.round(cd.diesel.fuelOpex))}</td>
              <td>${fuelKm != null ? `(${formatFixed(fuelKm, 3)} CHF/km)` : "—"} ${fuelTip}</td>
            </tr>
            <tr class="ya-opex-summary"><td>${textContent(t("yearly_analysis.total_opex_usage"))}</td><td>CHF ${formatCHF(Math.round(cd.diesel.fuelOpex))}</td><td>${totalUsageKm != null ? `<strong>(${formatFixed(totalUsageKm, 3)} CHF/km)</strong>` : "—"}</td></tr>
            <tr class="ya-opex-summary"><td>${textContent(t("yearly_analysis.total_opex_maintenance"))}</td><td>CHF ${formatCHF(Math.round(cd.diesel.maintOpex))}</td><td>${totalMaintKm != null ? `<strong>(${formatFixed(totalMaintKm, 3)} CHF/km)</strong>` : "—"}</td></tr>
            <tr class="ya-opex-summary"><td>${textContent(t("yearly_analysis.total_opex"))}</td><td>CHF ${formatCHF(Math.round(cd.diesel.totalOpex))}</td><td>${totalKm != null ? `<strong>(${formatFixed(totalKm, 3)} CHF/km)</strong>` : "—"}</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
};

const renderCostsOpexTables = (el, cd) => {
  if (!el || !cd) { if (el) el.innerHTML = ""; return; }
  const yearlyKm = toFiniteNumber(cd.yearlyDistanceKm);
  const electricPerKm = yearlyKm > 0 ? cd.electric.totalAnnual / yearlyKm : null;
  const dieselPerKm = yearlyKm > 0 ? cd.diesel.totalAnnual / yearlyKm : null;
  const savingCls = cd.annualSaving > 0 ? "ya-costs-kpi-value--positive" : cd.annualSaving < 0 ? "ya-costs-kpi-value--negative" : "";

  const dhFuel = toFiniteNumber(cd.electric.dieselHeatingFuelOpex) ?? 0;
  const dhMaint = toFiniteNumber(cd.electric.dieselHeatingMaintOpex) ?? 0;
  const showDh = dhFuel > 0 || dhMaint > 0;

  const dhOpexRows = showDh ? `
            <tr>
              <td>${textContent(t("yearly_analysis.diesel_heating_fuel"))}</td>
              <td>CHF ${formatCHF(Math.round(dhFuel))}</td>
              <td></td>
            </tr>
            <tr>
              <td>${textContent(t("yearly_analysis.diesel_heating_maintenance"))}</td>
              <td>CHF ${formatCHF(Math.round(dhMaint))}</td>
              <td></td>
            </tr>` : "";

  el.innerHTML = `
    <div class="ya-res-section">
      <h3 class="ya-res-section-title">${textContent(t("yearly_analysis.annual_opex_breakdown"))}</h3>
      <div class="ya-costs-table-wrap">
        <table class="ya-costs-table">
          <thead><tr><th>${textContent(t("yearly_analysis.opex_component"))}</th><th>${textContent(t("yearly_analysis.ebus"))}</th><th>${textContent(t("yearly_analysis.diesel_comparator"))}</th></tr></thead>
          <tbody>
            <tr>
              <td>${textContent(t("yearly_analysis.energy_fuel"))}</td>
              <td>CHF ${formatCHF(Math.round(cd.electric.energyOpex))} <span class="ya-costs-detail">(${formatInt(cd.yearlyEnergyKwh)} kWh × ${formatFixed(cd.assumptions.energyPricePerKwh, 2)} CHF/kWh)</span></td>
              <td>CHF ${formatCHF(Math.round(cd.diesel.fuelOpex))} <span class="ya-costs-detail">(${formatInt(yearlyKm)} km × ${formatFixed(cd.assumptions.dieselEfficiencyLPerKm, 3)} l/km × ${formatFixed(cd.assumptions.fuelPricePerL, 2)} CHF/l)</span></td>
            </tr>
            <tr>
              <td>${textContent(t("yearly_analysis.maintenance"))}</td>
              <td>CHF ${formatCHF(Math.round(cd.electric.maintOpex))} <span class="ya-costs-detail">(${formatFixed(cd.assumptions.electricMaintPerKm, 3)} CHF/km)</span></td>
              <td>CHF ${formatCHF(Math.round(cd.diesel.maintOpex))} <span class="ya-costs-detail">(${formatFixed(cd.assumptions.dieselMaintPerKm, 3)} CHF/km)</span></td>
            </tr>${dhOpexRows}
            <tr class="ya-costs-saving-row">
              <td><strong>${textContent(t("yearly_analysis.total_opex_year"))}</strong></td>
              <td><strong>CHF ${formatCHF(Math.round(cd.electric.totalOpex))}</strong></td>
              <td><strong>CHF ${formatCHF(Math.round(cd.diesel.totalOpex))}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="ya-res-section">
      <h3 class="ya-res-section-title">${textContent(t("yearly_analysis.total_annual_cost_comparison"))}</h3>
      <div class="ya-costs-table-wrap">
        <table class="ya-costs-table">
          <thead><tr><th>${textContent(t("yearly_analysis.metric"))}</th><th>${textContent(t("yearly_analysis.ebus"))}</th><th>${textContent(t("yearly_analysis.diesel_comparator"))}</th></tr></thead>
          <tbody>
            <tr><td>${textContent(t("yearly_analysis.bus_cost"))}${cd.electric.totalBatteryCost > 0 ? ` ${textContent(t("yearly_analysis.excluding_battery"))}` : ""}</td><td>CHF ${formatCHF(Math.round(cd.electric.busCost))}</td><td rowspan="${cd.electric.totalBatteryCost > 0 ? 3 : 2}" style="vertical-align:middle">CHF ${formatCHF(Math.round(cd.diesel.capex))}</td></tr>
            <tr><td>${textContent(t("yearly_analysis.battery"))} (${textContent(t("yearly_analysis.packs_value", { count: cd.electric.packs }))}${cd.electric.packCost > 0 ? ` × CHF ${formatCHF(Math.round(cd.electric.packCost))}` : ""}, ${textContent(t("yearly_analysis.life_years", { years: cd.electric.batteryLifetime }))})</td><td>${cd.electric.totalBatteryCost > 0 ? `CHF ${formatCHF(Math.round(cd.electric.totalBatteryCost))}` : `<span class="ya-costs-detail">${textContent(t("yearly_analysis.included_in_bus_cost"))}</span>`}</td></tr>
            ${cd.electric.totalBatteryCost > 0 ? `<tr><td>${textContent(t("yearly_analysis.capex_upfront"))}</td><td><strong>CHF ${formatCHF(Math.round(cd.electric.capex))}</strong></td></tr>` : ""}
            <tr><td>${textContent(t("yearly_analysis.battery_replacement"))} <span class="ya-costs-detail">(${cd.electric.batteryReplacementYears.length > 0 ? cd.electric.batteryReplacementYears.map(yr => t("yearly_analysis.year_short_value", { year: yr })).join(", ") : t("yearly_analysis.none_within_bus_life")}, ${t("yearly_analysis.bus_life_years", { years: cd.electric.busLifetime })})</span></td><td>${cd.electric.batteryReplacementPv > 0 ? `CHF ${formatCHF(Math.round(cd.electric.batteryReplacementPv))} <span class="ya-costs-detail">(PV)</span>` : `CHF 0`}</td><td></td></tr>
            <tr><td>${textContent(t("yearly_analysis.total_capex_replacements"))}</td><td><strong>CHF ${formatCHF(Math.round(cd.electric.capexPv))}</strong></td><td><strong>CHF ${formatCHF(Math.round(cd.diesel.capex))}</strong></td></tr>
            <tr><td>${textContent(t("yearly_analysis.capex_annualized"))}</td><td>CHF ${formatCHF(Math.round(cd.electric.capexAnnual))}</td><td>CHF ${formatCHF(Math.round(cd.diesel.capexAnnual))}</td></tr>
            <tr><td>${textContent(t("yearly_analysis.opex_year"))}</td><td>CHF ${formatCHF(Math.round(cd.electric.totalOpex))}</td><td>CHF ${formatCHF(Math.round(cd.diesel.totalOpex))}</td></tr>
            <tr><td>${textContent(t("yearly_analysis.total_annual_cost"))}</td><td>CHF ${formatCHF(Math.round(cd.electric.totalAnnual))}</td><td>CHF ${formatCHF(Math.round(cd.diesel.totalAnnual))}</td></tr>
            <tr><td>${textContent(t("yearly_analysis.cost_per_km"))}</td><td>${electricPerKm != null ? `${formatFixed(electricPerKm, 3)} CHF` : "—"}</td><td>${dieselPerKm != null ? `${formatFixed(dieselPerKm, 3)} CHF` : "—"}</td></tr>
            <tr class="ya-costs-saving-row"><td>${textContent(t("yearly_analysis.annual_saving_vs_diesel"))}</td><td colspan="2"><span class="${savingCls}">CHF ${formatCHF(Math.round(cd.annualSaving))}</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
};

const renderCostsScenarioTable = (el, cd) => {
  if (!el || !cd) { if (el) el.innerHTML = ""; return; }
  const scenarios = cd.scenarioCosts ?? [];
  if (!scenarios.length) { el.innerHTML = ""; return; }

  const yearlyKm = toFiniteNumber(cd.yearlyDistanceKm);
  const showDh = scenarios.some((sc) =>
    (toFiniteNumber(sc.annualDieselHeatingFuelCost) ?? 0) > 0 ||
    (toFiniteNumber(sc.annualDieselHeatingMaintCost) ?? 0) > 0
  );

  const baseHeaders = [t("yearly_analysis.scenario"), t("yearly_analysis.temp_celsius_short"), t("yearly_analysis.days_year_short"), t("yearly_analysis.energy_day_kwh"), t("yearly_analysis.aux_day_kwh"), t("yearly_analysis.simulated_distance_day_km"), t("simulation.efficiency_col_per_km"), t("yearly_analysis.annual_energy_kwh"), t("yearly_analysis.annual_energy_cost_chf")];
  const dhHeaders = showDh ? [t("yearly_analysis.dh_fuel_chf"), t("yearly_analysis.dh_maintenance_chf")] : [];
  const headers = [...baseHeaders, ...dhHeaders];

  const rows = scenarios.map((sc) => {
    const dhCells = showDh
      ? `<td>${formatCHF(Math.round(toFiniteNumber(sc.annualDieselHeatingFuelCost) ?? 0))}</td><td>${formatCHF(Math.round(toFiniteNumber(sc.annualDieselHeatingMaintCost) ?? 0))}</td>`
      : "";
    return `<tr>
      <td>${textContent(sc.label)}</td><td>${formatFixed(sc.temperature, 1)}</td><td>${sc.occurrences}</td>
      <td>${formatFixed(sc.dailyEnergy, 1)}</td><td>${formatFixed(sc.dailyAuxiliary, 1)}</td>
      <td>${formatFixed(sc.dailyDistance, 1)}</td><td>${sc.energyPerKm != null ? formatFixed(sc.energyPerKm, 3) : "—"}</td>
      <td>${formatInt(sc.annualEnergy)}</td><td>${formatCHF(Math.round(sc.annualEnergyCost))}</td>${dhCells}
    </tr>`;
  }).join("");

  const totalDays = scenarios.reduce((s, sc) => s + sc.occurrences, 0);
  const totalEnergy = scenarios.reduce((s, sc) => s + sc.annualEnergy, 0);
  const totalCost = scenarios.reduce((s, sc) => s + sc.annualEnergyCost, 0);
  const avgEpk = yearlyKm > 0 ? totalEnergy / yearlyKm : null;
  const totalDhFuel = showDh ? scenarios.reduce((s, sc) => s + (toFiniteNumber(sc.annualDieselHeatingFuelCost) ?? 0), 0) : 0;
  const totalDhMaint = showDh ? scenarios.reduce((s, sc) => s + (toFiniteNumber(sc.annualDieselHeatingMaintCost) ?? 0), 0) : 0;
  const dhTotalCells = showDh ? `<td><strong>${formatCHF(Math.round(totalDhFuel))}</strong></td><td><strong>${formatCHF(Math.round(totalDhMaint))}</strong></td>` : "";

  el.innerHTML = `
    <div class="ya-res-section">
      <h3 class="ya-res-section-title">${textContent(t("yearly_analysis.energy_cost_by_temperature"))}</h3>
      <p class="ya-costs-note">${textContent(t("yearly_analysis.energy_cost_note", { price: formatFixed(cd.assumptions.energyPricePerKwh, 2) }))}</p>
      <div class="ya-costs-table-wrap">
        <table class="ya-costs-table ya-costs-table--scenario">
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows}
            <tr class="ya-costs-scenario-total">
              <td><strong>${textContent(t("yearly_analysis.total_average"))}</strong></td><td></td><td><strong>${totalDays}</strong></td>
              <td></td><td></td><td></td><td><strong>${avgEpk != null ? formatFixed(avgEpk, 3) : "—"}</strong></td>
              <td><strong>${formatInt(totalEnergy)}</strong></td><td><strong>${formatCHF(Math.round(totalCost))}</strong></td>${dhTotalCells}
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
};

const refreshCostsPanelElements = (section, cd) => {
  renderCostsKpis(section.querySelector('[data-role="ya-costs-kpis"]'), cd);
  renderYaCostsBar(section.querySelector('[data-role="ya-costs-bar-chart"]'), cd);
  renderYaCostsBarLegend(section.querySelector('[data-role="ya-costs-bar-legend"]'));
  renderYaCostsLine(section.querySelector('[data-role="ya-costs-line-chart"]'), cd?.yearly ?? [], cd);
  renderYaCostsLineLegend(section.querySelector('[data-role="ya-costs-line-legend"]'), cd);
  renderElectricOpexBreakdown(section.querySelector('[data-role="ya-costs-electric-opex"]'), cd);
  renderDieselOpexBreakdown(section.querySelector('[data-role="ya-costs-diesel-opex"]'), cd);
  renderCostsOpexTables(section.querySelector('[data-role="ya-costs-opex-tables"]'), cd);
  renderCostsScenarioTable(section.querySelector('[data-role="ya-costs-scenario-table"]'), cd);
};

/* ── Emissions: loading and rendering ──────────────────────────── */

const LCA_INDICATORS = [
  { key: "gwp100a", i18n: "simulation.emissions_lca_gwp100a", fallback: "GWP₁₀₀ₐ" },
  { key: "primaryEnergy", i18n: "simulation.emissions_lca_primary_energy", fallback: "Primary energy" },
  { key: "primaryEnergyNonRenewable", i18n: "simulation.emissions_lca_primary_energy_nr", fallback: "Prim. energy (non-ren.)" },
  { key: "pm10", i18n: "simulation.emissions_lca_pm10", fallback: "PM₁₀" },
  { key: "nox", i18n: "simulation.emissions_lca_nox", fallback: "NOx" },
];

const LCA_PHASES = [
  { key: "direct", i18n: "simulation.emissions_phase_direct", label: "Direct", color: "#e74c3c" },
  { key: "directNonExhaust", i18n: "simulation.emissions_phase_direct_non_exhaust", label: "Non-exhaust", color: "#e67e22" },
  { key: "energyChain", i18n: "simulation.emissions_phase_energy_chain", label: "Energy chain", color: "#f1c40f" },
  { key: "maintenance", i18n: "simulation.emissions_phase_maintenance", label: "Maintenance", color: "#3498db" },
  { key: "vehicle", i18n: "simulation.emissions_phase_vehicle", label: "Vehicle mfg.", color: "#9b59b6" },
  { key: "endOfLife", i18n: "simulation.emissions_phase_end_of_life", label: "End of life", color: "var(--color-chart-neutral)" },
  { key: "infrastructure", i18n: "simulation.emissions_phase_infrastructure", label: "Infrastructure", color: "#1abc9c" },
];

const scaleLcaImpactToYearly = (perUnitImpact, yearlyDistanceKm, passengers = 1) => {
  if (!perUnitImpact || !yearlyDistanceKm) return null;
  const factor = yearlyDistanceKm * passengers;
  const yearly = {};
  for (const ind of LCA_INDICATORS) {
    const bd = perUnitImpact[ind.key];
    if (!bd) continue;
    const entry = { unit: "" };
    let total = 0;
    for (const phase of LCA_PHASES) {
      const val = toFiniteNumber(bd[phase.key]);
      entry[phase.key] = val != null ? val * factor : null;
      if (entry[phase.key] != null) total += entry[phase.key];
    }
    entry.total = total;
    yearly[ind.key] = entry;
  }
  return yearly;
};

const loadEmissionsForAnalysis = async (features, busModelData) => {
  const config = features.config ?? {};
  const yearlyTotals = features.results?.yearlyTotals ?? {};
  const shiftId = (config.shift_ids ?? [])[0] ?? "";
  const yearlyDistanceKm = toFiniteNumber(yearlyTotals.distanceKm);
  const busLengthM = toFiniteNumber(busModelData?.bus_length_m);
  const busModelName = busModelData?.name ?? busModelData?.model ?? "";

  if (!yearlyDistanceKm || yearlyDistanceKm <= 0) {
    throw new Error(t("yearly_analysis.yearly_distance_not_available"));
  }

  let electricYearly = null;
  let yearlyImpact = null;

  try {
    yearlyImpact = await fetchShiftYearlyImpact(shiftId, { recurrence: "daily", passengers: 1 });
    electricYearly = yearlyImpact?.yearly_impact ?? {};

    const apiYearlyKm = toFiniteNumber(yearlyImpact?.yearly_distance_km);
    if (apiYearlyKm && Math.abs(apiYearlyKm - yearlyDistanceKm) / apiYearlyKm > 0.05) {
      const scaleFactor = yearlyDistanceKm / apiYearlyKm;
      const scaled = {};
      for (const [key, indicator] of Object.entries(electricYearly)) {
        if (!indicator || typeof indicator !== "object") continue;
        const scaledIndicator = { ...indicator };
        for (const phase of [...LCA_PHASES, { key: "total" }]) {
          const val = toFiniteNumber(indicator[phase.key]);
          if (val != null) scaledIndicator[phase.key] = val * scaleFactor;
        }
        scaled[key] = scaledIndicator;
      }
      electricYearly = scaled;
    }
  } catch {
    const lcaSize = inferLcaSize(busLengthM, busModelName);
    if (!lcaSize) throw new Error(t("yearly_analysis.cannot_determine_bus_size_env"));

    const allVehicles = await fetchLcaVehicles();
    const electricMatch = findVehicleByPtAndSize(allVehicles, "bev", lcaSize);
    if (!electricMatch) throw new Error(t("yearly_analysis.no_matching_electric_vehicle"));

    const electricPerUnit = await fetchVehicleImpact(electricMatch.id, { passengers: 1 });
    electricYearly = scaleLcaImpactToYearly(electricPerUnit, yearlyDistanceKm) ?? {};
    yearlyImpact = {
      yearly_distance_km: yearlyDistanceKm,
      lca_vehicle: { lca_size: lcaSize, powertrain: "electric" },
      bus_model_name: busModelName,
      bus_model_size: lcaSize,
    };
  }

  let dieselYearly = null;
  try {
    const electricSize =
      yearlyImpact?.lca_vehicle?.lca_size ||
      yearlyImpact?.bus_model_size ||
      inferLcaSize(busLengthM, busModelName);
    if (electricSize) {
      const allVehicles = await fetchLcaVehicles();
      const dieselMatch = findDieselEquivalent(allVehicles, electricSize);
      if (dieselMatch) {
        const dieselPerUnit = await fetchVehicleImpact(dieselMatch.id, { passengers: 1 });
        dieselYearly = scaleLcaImpactToYearly(dieselPerUnit, yearlyDistanceKm);
      }
    }
  } catch { /* diesel comparison is best-effort */ }

  return { yearlyImpact, electricYearly, dieselYearly, yearlyDistanceKm };
};

const ELECTRIC_PT_KEYWORDS = ["bev", "electric", "battery"];
const DIESEL_PT_KEYWORDS = ["icev-d", "diesel", "ice-d"];

const findVehicleByPtAndSize = (vehicles, powertrain, size) => {
  if (!Array.isArray(vehicles) || !size) return null;
  const sizeLower = size.toLowerCase();
  const ptLower = powertrain.toLowerCase();
  const ptKeywords = ELECTRIC_PT_KEYWORDS.some((k) => ptLower.includes(k))
    ? ELECTRIC_PT_KEYWORDS
    : DIESEL_PT_KEYWORDS.some((k) => ptLower.includes(k))
      ? DIESEL_PT_KEYWORDS
      : [ptLower];

  const isBus = (v) => { const vt = (v.vehicleType || "").toLowerCase(); return vt.includes("bus") || vt.includes("coach") || vt === ""; };
  const ptMatches = (v) => { const vPt = (v.powertrain || "").toLowerCase(); return ptKeywords.some((k) => vPt.includes(k)); };
  const candidates = vehicles.filter((v) => isBus(v) && ptMatches(v));
  if (!candidates.length) return null;

  const exactMatch = candidates.find((v) => (v.size || "").toLowerCase() === sizeLower);
  if (exactMatch) return exactMatch;

  const sizePrefix = sizeLower.replace(/m$/, "").replace(/-.*/, "");
  const prefixMatches = candidates.filter((v) => {
    const vSz = (v.size || "").toLowerCase();
    return vSz.startsWith(sizeLower) || vSz.startsWith(sizePrefix + "m");
  });
  const preferCity = prefixMatches.find((v) =>
    (v.size || "").toLowerCase().includes("city") &&
    !(v.size || "").toLowerCase().includes("double")
  );
  return preferCity || prefixMatches[0] || null;
};

const findDieselEquivalent = (vehicles, electricSize) =>
  findVehicleByPtAndSize(vehicles, "icev-d", electricSize) ||
  findVehicleByPtAndSize(vehicles, "diesel", electricSize);

/* ── Diesel-heating mixed-case emissions loader ────────────────── */

const DH_FUEL_PHASES = new Set(["direct", "energyChain"]);

const loadDieselHeatingEmissions = async (features, busModelData) => {
  const energySummary = features.energy_summary ?? {};
  const yearlyTotals = features.results?.yearlyTotals ?? {};
  const esYT = energySummary.yearly_totals ?? {};

  const yearlyDistanceKm = toFiniteNumber(yearlyTotals.distanceKm ?? esYT.distance_km);
  const yearlyElectricKwh = toFiniteNumber(esYT.electric_kwh ?? esYT.electricEnergyKwh);
  const yearlyDhLiters = toFiniteNumber(esYT.diesel_liters) ?? 0;
  const yearlyDhFuelKwh = toFiniteNumber(esYT.diesel_fuel_kwh) ?? 0;

  const busLengthM = toFiniteNumber(busModelData?.bus_length_m);
  const busModelName = busModelData?.name ?? busModelData?.model ?? "";
  const optimizedPacks = toFiniteNumber(features.results?.optimizedPacks);
  const packSizeKwh = toFiniteNumber(busModelData?.battery_pack_size_kwh);
  const busLifetime = toFiniteNumber(busModelData?.bus_lifetime) ?? 12;
  const packLifetime = toFiniteNumber(busModelData?.battery_pack_lifetime) ?? 8;

  if (!yearlyDistanceKm || yearlyDistanceKm <= 0) {
    throw new Error(t("yearly_analysis.yearly_distance_not_available"));
  }
  if (yearlyElectricKwh == null || yearlyElectricKwh <= 0) {
    throw new Error(t("yearly_analysis.diesel_heating_energy_not_available"));
  }

  const lcaSize = inferLcaSize(busLengthM, busModelName);
  if (!lcaSize) throw new Error(t("yearly_analysis.cannot_determine_bus_size_env"));

  const allVehicles = await fetchLcaVehicles();

  const electricMatch = findVehicleByPtAndSize(allVehicles, "bev", lcaSize);
  if (!electricMatch) {
    throw new Error(t("yearly_analysis.no_matching_electric_vehicle"));
  }

  const dhElecConsumption =
    yearlyElectricKwh && yearlyDistanceKm
      ? (yearlyElectricKwh / yearlyDistanceKm) * 100
      : null;
  const dhElecEnergyStored =
    optimizedPacks != null && packSizeKwh != null
      ? optimizedPacks * packSizeKwh
      : null;
  const dhBattReplacements =
    busLifetime > 0 && packLifetime > 0
      ? Math.max(0, Math.ceil(busLifetime / packLifetime) - 1)
      : null;

  const bevParams = { passengers: 1 };
  if (dhElecConsumption != null) bevParams.electricityConsumption = dhElecConsumption;
  if (dhElecEnergyStored != null) bevParams.electricEnergyStored = dhElecEnergyStored;
  if (dhBattReplacements != null) bevParams.batteryLifetimeReplacements = dhBattReplacements;

  const electricPerUnit = await fetchVehicleImpact(electricMatch.id, bevParams);
  const electricOnlyYearly = scaleLcaImpactToYearly(electricPerUnit, yearlyDistanceKm) ?? {};

  const dieselMatch = findDieselEquivalent(allVehicles, lcaSize);
  let dieselYearly = null;
  let dieselHeatingYearly = null;

  if (dieselMatch) {
    const dieselPerUnit = await fetchVehicleImpact(dieselMatch.id, { passengers: 1 });
    dieselYearly = scaleLcaImpactToYearly(dieselPerUnit, yearlyDistanceKm);

    const dieselDefaultFuel = toFiniteNumber(
      dieselMatch.fuelConsumption?.defaultValue,
    );

    if (dieselDefaultFuel > 0 && yearlyDhLiters > 0) {
      const dhLPer100km = (yearlyDhLiters / yearlyDistanceKm) * 100;
      const fuelRatio = dhLPer100km / dieselDefaultFuel;

      dieselHeatingYearly = {};
      for (const ind of LCA_INDICATORS) {
        const dInd = dieselPerUnit[ind.key];
        if (!dInd) continue;
        const entry = { unit: "" };
        let total = 0;
        for (const phase of LCA_PHASES) {
          if (DH_FUEL_PHASES.has(phase.key)) {
            const val = toFiniteNumber(dInd[phase.key]);
            entry[phase.key] = val != null ? val * fuelRatio * yearlyDistanceKm : null;
          } else {
            entry[phase.key] = null;
          }
          if (entry[phase.key] != null) total += entry[phase.key];
        }
        entry.total = total;
        dieselHeatingYearly[ind.key] = entry;
      }
    }
  }

  const totalEbusYearly = {};
  for (const ind of LCA_INDICATORS) {
    const elInd = electricOnlyYearly[ind.key];
    const dhInd = dieselHeatingYearly?.[ind.key];
    if (!elInd) continue;
    const entry = { unit: "" };
    let total = 0;
    for (const phase of LCA_PHASES) {
      const elVal = toFiniteNumber(elInd[phase.key]) ?? 0;
      const dhVal = toFiniteNumber(dhInd?.[phase.key]) ?? 0;
      const sum = elVal + dhVal;
      entry[phase.key] = sum;
      total += sum;
    }
    entry.total = total;
    totalEbusYearly[ind.key] = entry;
  }

  return {
    electricOnlyYearly,
    dieselHeatingYearly,
    totalEbusYearly,
    dieselYearly,
    yearlyDistanceKm,
    yearlyImpact: {
      yearly_distance_km: yearlyDistanceKm,
      lca_vehicle: { lca_size: lcaSize, powertrain: "electric (diesel-heating mixed)" },
      bus_model_name: busModelName,
      bus_model_size: lcaSize,
    },
    metadata: {
      auxiliaryHeatingType: "diesel",
      yearlyDhLiters,
      yearlyDhFuelKwh,
      yearlyElectricKwh,
      yearlyDistanceKm,
      optimizedPacks,
      busLengthM,
      busModelName: busModelName || null,
      electricEnergyStoredKwh: dhElecEnergyStored,
      electricConsumptionKwhPer100km: dhElecConsumption,
      batteryLifetimeReplacements: dhBattReplacements,
      lcaSize,
      electricLcaVehicleId: text(electricMatch.id).trim() || null,
      electricLcaVehicleName: text(electricMatch.name).trim() || null,
      electricLcaVehiclePowertrain: text(electricMatch.powertrain).trim() || null,
      dieselHeatingLifecyclePhases: [...DH_FUEL_PHASES],
      bevOverrides: bevParams,
      electricInputsAppliedNote: t("yearly_analysis.electric_inputs_applied_note"),
      dieselHeatingContributionNote: t("yearly_analysis.diesel_heating_contribution_note"),
      upstreamApiLimitationNote: t("yearly_analysis.upstream_api_limitation_note"),
      dhFuelFactorSource: t("yearly_analysis.dh_fuel_factor_source"),
    },
  };
};

const hasEmissionPhaseData = (indicator = {}) => {
  const vals = LCA_PHASES.map((phase) => toFiniteNumber(indicator?.[phase.key])).filter((v) => v != null);
  if (!vals.length) return false;
  return vals.some((v) => Math.abs(v) > 1e-9);
};

const EPS = 1e-9;

const hasPositiveMixedCaseDieselHeating = (mixedCase = {}) =>
  Object.values(mixedCase?.indicators ?? {}).some((indicator) =>
    Math.abs(toFiniteNumber(indicator?.diesel_heating) ?? 0) > EPS
  );

const isDieselHeatingCase = (rawEmissions = {}) => {
  const assumptions = rawEmissions?.assumptions ?? {};
  const heatingType = text(
    assumptions.auxiliaryHeatingType ??
    assumptions.auxiliary_heating_type ??
    rawEmissions?.auxiliaryHeatingType ??
    rawEmissions?.auxiliary_heating_type
  ).trim().toLowerCase();
  const yearlyDhLiters = toFiniteNumber(
    assumptions.yearlyDieselHeatingLiters ?? assumptions.yearly_diesel_heating_liters
  ) ?? 0;
  if (heatingType === "diesel" && yearlyDhLiters > EPS) return true;

  const mixedCase = rawEmissions?.mixed_case_decomposition;
  if (mixedCase?.available === true && hasPositiveMixedCaseDieselHeating(mixedCase)) return true;

  return (toFiniteNumber(rawEmissions?.lifecycle_breakdown?.ebus?.diesel_heating) ?? 0) > EPS;
};

const resolveBackendEmissionChannel = (indicator, channelKey = null) => {
  if (!channelKey) return indicator;
  if (channelKey === "electric") {
    return indicator?.electric ?? indicator?.ebusElectric ?? indicator?.ebus_electric;
  }
  if (channelKey === "dieselHeating") {
    return indicator?.dieselHeating ?? indicator?.diesel_heating ?? indicator?.heating;
  }
  return indicator?.[channelKey];
};

const mapBackendEmissionIndicator = (indicator, channelKey = null) => {
  const source = resolveBackendEmissionChannel(indicator, channelKey);
  if (!source || (typeof source !== "object" && toFiniteNumber(source) == null)) {
    return null;
  }

  const mapped = {};
  const unit = text(source?.unit ?? indicator?.unit).trim();
  if (unit) mapped.unit = unit;

  let total = toFiniteNumber(source?.total ?? source);
  for (const phase of LCA_PHASES) {
    const val = toFiniteNumber(source?.[phase.key]);
    if (val == null) continue;
    mapped[phase.key] = val;
  }

  if (total == null) {
    const phaseValues = LCA_PHASES
      .map((phase) => toFiniteNumber(source?.[phase.key]))
      .filter((value) => value != null);
    if (phaseValues.length) {
      total = phaseValues.reduce((sum, value) => sum + value, 0);
    }
  }

  if (total != null) mapped.total = total;
  return mapped.total != null ? mapped : null;
};

const mapBackendEmissionIndicators = (indicators = {}, channelKey = null) =>
  Object.entries(indicators).reduce((acc, [key, indicator]) => {
    const mapped = mapBackendEmissionIndicator(indicator, channelKey);
    if (mapped) acc[key] = mapped;
    return acc;
  }, {});

const mapBackendEmissionsToState = (rawEmissions, features, busModelData) => {
  const assumptions = rawEmissions?.assumptions ?? {};
  const ebusIndicators =
    rawEmissions?.ebus ??
    rawEmissions?.electric ??
    rawEmissions?.ebus_emissions ??
    {};
  const dieselIndicators =
    rawEmissions?.diesel_comparator ??
    rawEmissions?.dieselComparator ??
    rawEmissions?.diesel ??
    rawEmissions?.comparator ??
    {};

  const yearlyDistanceKm = toFiniteNumber(
    assumptions.yearlyDistanceKm ??
    assumptions.yearly_distance_km ??
    rawEmissions?.annualKm ??
    rawEmissions?.annual_km
  );
  const yearlyElectricKwh = toFiniteNumber(
    assumptions.yearlyElectricKwh ?? assumptions.yearly_electric_kwh
  );
  const yearlyDhLiters = toFiniteNumber(
    assumptions.yearlyDieselHeatingLiters ?? assumptions.yearly_diesel_heating_liters
  ) ?? 0;
  const yearlyDhFuelKwh = toFiniteNumber(
    assumptions.yearlyDieselHeatingFuelKwh ?? assumptions.yearly_diesel_heating_fuel_kwh
  ) ?? 0;

  const electricYearly = mapBackendEmissionIndicators(ebusIndicators);
  if (!Object.keys(electricYearly).length) {
    throw new Error(t("yearly_analysis.no_emissions_data"));
  }

  const isDieselHeating = isDieselHeatingCase(rawEmissions);

  const electricOnlyYearly = isDieselHeating
    ? mapBackendEmissionIndicators(ebusIndicators, "electric")
    : null;
  const dieselHeatingYearly = isDieselHeating
    ? mapBackendEmissionIndicators(ebusIndicators, "dieselHeating")
    : null;
  const dieselYearly = mapBackendEmissionIndicators(dieselIndicators);

  const optimizedPacks = toFiniteNumber(features.results?.optimizedPacks);
  const packSizeKwh = toFiniteNumber(busModelData?.battery_pack_size_kwh);
  const busLengthM = toFiniteNumber(busModelData?.bus_length_m);
  const busModelName =
    busModelData?.name ??
    busModelData?.model ??
    features.meta?.busModelName ??
    "";
  const busLifetime = toFiniteNumber(busModelData?.bus_lifetime) ?? 12;
  const packLifetime = toFiniteNumber(busModelData?.battery_pack_lifetime) ?? 8;

  const electricConsumptionKwhPer100km =
    yearlyElectricKwh != null && yearlyDistanceKm > 0
      ? (yearlyElectricKwh / yearlyDistanceKm) * 100
      : null;
  const electricEnergyStoredKwh =
    optimizedPacks != null && packSizeKwh != null
      ? optimizedPacks * packSizeKwh
      : null;
  const batteryLifetimeReplacements =
    busLifetime > 0 && packLifetime > 0
      ? Math.max(0, Math.ceil(busLifetime / packLifetime) - 1)
      : null;

  return {
    electricYearly,
    electricOnlyYearly:
      electricOnlyYearly && Object.keys(electricOnlyYearly).length
        ? electricOnlyYearly
        : null,
    dieselHeatingYearly:
      dieselHeatingYearly && Object.keys(dieselHeatingYearly).length
        ? dieselHeatingYearly
        : null,
    dieselYearly:
      dieselYearly && Object.keys(dieselYearly).length ? dieselYearly : null,
    yearlyImpact: yearlyDistanceKm != null ? { yearly_distance_km: yearlyDistanceKm } : null,
    yearlyDistanceKm,
    isDieselHeating,
    emissionsMetadata: isDieselHeating
      ? {
          auxiliaryHeatingType: "diesel",
          yearlyDhLiters,
          yearlyDhFuelKwh,
          yearlyElectricKwh,
          yearlyDistanceKm,
          optimizedPacks,
          busLengthM,
          busModelName: text(busModelName).trim() || null,
          electricConsumptionKwhPer100km,
          electricEnergyStoredKwh,
          batteryLifetimeReplacements,
          lcaSize: inferLcaSize(busLengthM, busModelName),
          electricLcaVehicleId: null,
          electricLcaVehicleName: null,
          electricLcaVehiclePowertrain: null,
          dieselHeatingLifecyclePhases: null,
          bevOverrides: { passengers: 1 },
          electricInputsAppliedNote: null,
          dieselHeatingContributionNote: null,
          upstreamApiLimitationNote: null,
          dhFuelFactorSource: null,
        }
      : null,
  };
};

/* ── Structured backend block extraction ─────────────────────── */

const extractStructuredBlocks = (raw) => {
  if (!raw) return null;
  const indicators = Array.isArray(raw.indicators) ? raw.indicators : null;
  const savings = raw.savings?.items ? raw.savings : null;
  const lifecycleBreakdown = raw.lifecycle_breakdown ?? null;
  const primaryEnergyBreakdown = raw.primary_energy_breakdown ?? null;
  const mixedCaseDecomposition = raw.mixed_case_decomposition ?? null;
  const assumptions = raw.assumptions ?? null;
  if (!indicators && !savings && !lifecycleBreakdown) return null;
  return { indicators, savings, lifecycleBreakdown, primaryEnergyBreakdown, mixedCaseDecomposition, assumptions };
};

const indicatorByKey = (indicators, key) =>
  indicators?.find((ind) => ind.key === key) ?? null;

const displayDivisor = (rawUnit, displayUnit) => {
  const r = text(rawUnit).toLowerCase().replace(/[^a-z0-9]/g, "");
  const d = text(displayUnit).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!r || !d) return 1;
  if (r.startsWith("g") && d.startsWith("t")) return 1e6;
  if (r.startsWith("mg") && d.startsWith("kg")) return 1e6;
  if (r.startsWith("g") && d.startsWith("kg")) return 1e3;
  if (r.startsWith("mj") && d.startsWith("gj")) return 1e3;
  return 1;
};

const getComparisonDirection = (indicator) => {
  const ebus = toFiniteNumber(indicator?.ebus_total);
  const diesel = toFiniteNumber(indicator?.diesel_comparator);
  if (ebus == null || diesel == null || diesel === 0) return null;

  const rawPct = ((ebus - diesel) / Math.abs(diesel)) * 100;
  if (Math.abs(rawPct) < EPS) {
    return { direction: "flat", arrow: "→", kind: "same", percent: 0 };
  }
  if (rawPct < 0) {
    return { direction: "down", arrow: "↓", kind: "reduction", percent: Math.abs(rawPct) };
  }
  return { direction: "up", arrow: "↑", kind: "increase", percent: Math.abs(rawPct) };
};

const INDICATOR_DISPLAY_DECIMALS = {
  gwp100a: 1,
  nox: 1,
  pm10: 2,
  primaryEnergyNonRenewable: 0,
  primaryEnergy: 0,
};

const scaleEmissionIndicatorYearly = (indicator, scale) => {
  if (!indicator || typeof indicator !== "object") return indicator;
  const scaled = { ...indicator };
  for (const phase of [...LCA_PHASES, { key: "total" }]) {
    const value = toFiniteNumber(indicator[phase.key]);
    if (value != null) scaled[phase.key] = value * scale;
  }
  return scaled;
};

const scaleEmissionIndicatorMap = (indicators, scale) => {
  if (!indicators || typeof indicators !== "object") return indicators;
  return Object.entries(indicators).reduce((acc, [key, indicator]) => {
    acc[key] = scaleEmissionIndicatorYearly(indicator, scale);
    return acc;
  }, {});
};

const scaleStructuredIndicatorEntry = (indicator, scale) => {
  if (!indicator || typeof indicator !== "object") return indicator;
  const scaled = { ...indicator };
  [
    "ebus_total",
    "diesel_comparator",
    "delta_vs_diesel",
    "ebus_display",
    "diesel_display",
    "saved_display",
    "saved",
    "electric_side",
    "diesel_heating",
    "total",
  ].forEach((key) => {
    const value = toFiniteNumber(indicator[key]);
    if (value != null) scaled[key] = value * scale;
  });
  return scaled;
};

const scaleLifecyclePhases = (phases, scale) => {
  if (!phases || typeof phases !== "object") return phases;
  const scaled = { ...phases };
  for (const phase of LCA_PHASES) {
    const value = toFiniteNumber(phases[phase.key]);
    if (value != null) scaled[phase.key] = value * scale;
  }
  return scaled;
};

const scaleStructuredLifecycleBreakdown = (breakdown, scale) => {
  if (!breakdown || typeof breakdown !== "object") return breakdown;
  const scaled = { ...breakdown };
  if (breakdown.ebus) {
    scaled.ebus = { ...breakdown.ebus };
    if (breakdown.ebus.phases) {
      scaled.ebus.phases = scaleLifecyclePhases(breakdown.ebus.phases, scale);
    }
    const ebusDh = toFiniteNumber(breakdown.ebus.diesel_heating);
    if (ebusDh != null) scaled.ebus.diesel_heating = ebusDh * scale;
    const ebusTotal = toFiniteNumber(breakdown.ebus.total);
    if (ebusTotal != null) scaled.ebus.total = ebusTotal * scale;
  }
  if (breakdown.diesel_comparator) {
    scaled.diesel_comparator = { ...breakdown.diesel_comparator };
    if (breakdown.diesel_comparator.phases) {
      scaled.diesel_comparator.phases = scaleLifecyclePhases(breakdown.diesel_comparator.phases, scale);
    }
    const dieselTotal = toFiniteNumber(breakdown.diesel_comparator.total);
    if (dieselTotal != null) scaled.diesel_comparator.total = dieselTotal * scale;
  }
  return scaled;
};

const scaleStructuredPrimaryEnergyBreakdown = (breakdown, scale) => {
  if (!breakdown || typeof breakdown !== "object") return breakdown;
  const scaleBucket = (bucket) => {
    if (!bucket || typeof bucket !== "object") return bucket;
    const scaled = { ...bucket };
    ["renewable", "non_renewable", "total"].forEach((key) => {
      const value = toFiniteNumber(bucket[key]);
      if (value != null) scaled[key] = value * scale;
    });
    return scaled;
  };
  return {
    ...breakdown,
    ebus: scaleBucket(breakdown.ebus),
    diesel_comparator: scaleBucket(breakdown.diesel_comparator),
  };
};

const scaleStructuredMixedCaseDecomposition = (mixedCase, scale) => {
  if (!mixedCase || typeof mixedCase !== "object") return mixedCase;
  const scaled = { ...mixedCase };
  const yearlyElectricKwh = toFiniteNumber(mixedCase.yearly_electric_kwh);
  if (yearlyElectricKwh != null) scaled.yearly_electric_kwh = yearlyElectricKwh * scale;
  const yearlyDhLiters = toFiniteNumber(mixedCase.yearly_diesel_heating_liters);
  if (yearlyDhLiters != null) scaled.yearly_diesel_heating_liters = yearlyDhLiters * scale;
  const yearlyDhFuelKwh = toFiniteNumber(mixedCase.yearly_diesel_heating_fuel_kwh);
  if (yearlyDhFuelKwh != null) scaled.yearly_diesel_heating_fuel_kwh = yearlyDhFuelKwh * scale;
  if (mixedCase.indicators && typeof mixedCase.indicators === "object") {
    scaled.indicators = Object.entries(mixedCase.indicators).reduce((acc, [key, indicator]) => {
      acc[key] = scaleStructuredIndicatorEntry(indicator, scale);
      return acc;
    }, {});
  }
  return scaled;
};

const scaleEmissionsAssumptions = (assumptions, scale, selectedDistanceKm) => {
  if (!assumptions || typeof assumptions !== "object") return assumptions;
  const scaled = { ...assumptions };
  if (selectedDistanceKm != null) {
    scaled.yearlyDistanceKm = selectedDistanceKm;
    scaled.yearly_distance_km = selectedDistanceKm;
  }

  const yearlyElectricKwh = toFiniteNumber(
    assumptions.yearlyElectricKwh ?? assumptions.yearly_electric_kwh
  );
  if (yearlyElectricKwh != null) {
    const scaledValue = yearlyElectricKwh * scale;
    scaled.yearlyElectricKwh = scaledValue;
    scaled.yearly_electric_kwh = scaledValue;
  }

  const yearlyDhLiters = toFiniteNumber(
    assumptions.yearlyDieselHeatingLiters ?? assumptions.yearly_diesel_heating_liters
  );
  if (yearlyDhLiters != null) {
    const scaledValue = yearlyDhLiters * scale;
    scaled.yearlyDieselHeatingLiters = scaledValue;
    scaled.yearly_diesel_heating_liters = scaledValue;
  }

  const yearlyDhFuelKwh = toFiniteNumber(
    assumptions.yearlyDieselHeatingFuelKwh ?? assumptions.yearly_diesel_heating_fuel_kwh
  );
  if (yearlyDhFuelKwh != null) {
    const scaledValue = yearlyDhFuelKwh * scale;
    scaled.yearlyDieselHeatingFuelKwh = scaledValue;
    scaled.yearly_diesel_heating_fuel_kwh = scaledValue;
  }

  return scaled;
};

const scaleEmissionsMetadata = (metadata, scale, selectedDistanceKm) => {
  if (!metadata || typeof metadata !== "object") return metadata;
  const scaled = { ...metadata };
  if (selectedDistanceKm != null) scaled.yearlyDistanceKm = selectedDistanceKm;
  ["yearlyDhLiters", "yearlyDhFuelKwh", "yearlyElectricKwh"].forEach((key) => {
    const value = toFiniteNumber(metadata[key]);
    if (value != null) scaled[key] = value * scale;
  });
  return scaled;
};

const scaleStructuredEmissions = (structured, scale, selectedDistanceKm) => {
  if (!structured || typeof structured !== "object") return structured;
  const scaled = { ...structured };
  if (Array.isArray(structured.indicators)) {
    scaled.indicators = structured.indicators.map((indicator) =>
      scaleStructuredIndicatorEntry(indicator, scale)
    );
  }
  if (structured.savings?.items) {
    scaled.savings = {
      ...structured.savings,
      items: structured.savings.items.map((item) =>
        scaleStructuredIndicatorEntry(item, scale)
      ),
    };
  }
  if (structured.lifecycleBreakdown) {
    scaled.lifecycleBreakdown = scaleStructuredLifecycleBreakdown(
      structured.lifecycleBreakdown,
      scale
    );
  }
  if (structured.primaryEnergyBreakdown) {
    scaled.primaryEnergyBreakdown = scaleStructuredPrimaryEnergyBreakdown(
      structured.primaryEnergyBreakdown,
      scale
    );
  }
  if (structured.mixedCaseDecomposition) {
    scaled.mixedCaseDecomposition = scaleStructuredMixedCaseDecomposition(
      structured.mixedCaseDecomposition,
      scale
    );
  }
  if (structured.assumptions) {
    scaled.assumptions = scaleEmissionsAssumptions(
      structured.assumptions,
      scale,
      selectedDistanceKm
    );
  }
  return scaled;
};

const deriveScaledEmissionsState = (emState, baseDistanceKm, selectedDistanceKm) => {
  if (!emState || emState.status !== "done" || !emState.electricYearly) return emState;

  const baseKm = toFiniteNumber(
    baseDistanceKm ?? emState.yearlyDistanceKm ?? emState.yearlyImpact?.yearly_distance_km
  );
  const selectedKm = toFiniteNumber(selectedDistanceKm ?? baseKm);
  if (baseKm == null || baseKm <= 0 || selectedKm == null || selectedKm <= 0) return emState;

  const scale = selectedKm / baseKm;
  return {
    ...emState,
    electricYearly: scaleEmissionIndicatorMap(emState.electricYearly, scale),
    electricOnlyYearly: scaleEmissionIndicatorMap(emState.electricOnlyYearly, scale),
    dieselHeatingYearly: scaleEmissionIndicatorMap(emState.dieselHeatingYearly, scale),
    dieselYearly: scaleEmissionIndicatorMap(emState.dieselYearly, scale),
    yearlyImpact: emState.yearlyImpact
      ? { ...emState.yearlyImpact, yearly_distance_km: selectedKm }
      : { yearly_distance_km: selectedKm },
    yearlyDistanceKm: selectedKm,
    emissionsMetadata: scaleEmissionsMetadata(emState.emissionsMetadata, scale, selectedKm),
    structured: scaleStructuredEmissions(emState.structured, scale, selectedKm),
  };
};

/* ── Emissions panel rendering ─────────────────────────────────── */

const EMISSIONS_POLLUTANTS = [
  { key: "gwp100a", i18n: "simulation.emissions_co2_label", fallback: "CO₂ (carbon dioxide)", color: "var(--color-danger)", unitGroup: "ton", divisor: 1e6, perKmUnit: "g/km" },
  { key: "nox", i18n: "simulation.emissions_nox_label", fallback: "NOx (nitric oxide)", color: "#d4a017", unitGroup: "kg", divisor: 1e6, perKmUnit: "mg/km" },
  { key: "pm10", i18n: "simulation.emissions_pm10_label", fallback: "PM₁₀", color: "#8b6914", unitGroup: "kg", divisor: 1e6, perKmUnit: "mg/km" },
];

const DIESEL_BAR_COLOR = "var(--color-danger)";
const ELECTRIC_BAR_COLOR = "var(--color-success)";
const DH_BAR_COLOR = "#e67e22";
const CO2_PHASE_DIVISOR = 1e6;
const ENERGY_COLORS = { renewable: "var(--color-success)", nonRenewable: "#e67e22" };

const inferUnitDivisor = (indicator, fallbackDivisor = CO2_PHASE_DIVISOR) => {
  const u = text(indicator?.unit).trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!u) return fallbackDivisor;
  if (/^kg/.test(u) || /kg\b/.test(u)) return 1e3;
  if (/^ton/.test(u) || /^t[^a-z]/.test(u) || u === "t/a" || u === "t/year" || u === "t") return 1;
  if (/^mj/.test(u)) return 1e3;
  if (/^gj/.test(u)) return 1;
  return fallbackDivisor;
};
const getEmissionsTotalLabel = (emState) =>
  emState?.isDieselHeating ? t("yearly_analysis.ebus_diesel_heating") : t("yearly_analysis.ebus");
const getEmissionsElectricLabel = (emState) =>
  emState?.isDieselHeating ? t("yearly_analysis.electric_diesel_heating") : t("yearly_analysis.ebus");

const ENV_KPI_DEFS = [
  { key: "gwp100a", i18n: "yearly_analysis.env_kpi_co2_equiv", label: "CO₂ equiv.", unit: "t/yr", divisor: 1e6 },
  { key: "nox", i18n: "simulation.env_kpi_nox", label: "NOx", unit: "kg/yr", divisor: 1e6 },
  { key: "pm10", i18n: "simulation.env_kpi_pm10", label: "PM₁₀", unit: "kg/yr", divisor: 1e6 },
];

const ENV_TABLE_ROWS = [
  { key: "gwp100a", i18n: "yearly_analysis.env_kpi_co2_equiv", label: "CO₂ equivalent", unit: "t/yr", divisor: 1e6, decimals: 1, perKmUnit: "g/km" },
  { key: "nox", i18n: "simulation.env_kpi_nox", label: "NOx", unit: "kg/yr", divisor: 1e6, decimals: 1, perKmUnit: "mg/km" },
  { key: "pm10", i18n: "simulation.env_kpi_pm10", label: "PM₁₀", unit: "kg/yr", divisor: 1e6, decimals: 2, perKmUnit: "mg/km" },
];

/* ── Emissions: D3 chart renderers ────────────────────────────── */

const renderYaEmissionsHistogram = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
  if (!emState || emState.status !== "done" || !emState.electricYearly) return;

  const savingsItems = emState.structured?.savings?.items;
  const totalLabel = getEmissionsTotalLabel(emState);
  const hasDiesel = !!emState.dieselYearly;

  let data;
  if (savingsItems?.length) {
    const CHART_KEYS = new Set(["gwp100a", "co2", "nox", "pm10"]);
    const COLORS = { gwp100a: "var(--color-danger)", co2: "var(--color-danger)", nox: "#d4a017", pm10: "#8b6914" };
    data = savingsItems
      .filter((it) => CHART_KEYS.has(it.key))
      .map((it) => ({
        key: it.key,
        label: resolveEnvIndicatorLabel(it),
        color: COLORS[it.key] || "#888",
        unitLabel: it.unit || "",
        electric: toFiniteNumber(it.ebus_display) ?? 0,
        diesel: toFiniteNumber(it.diesel_display) ?? 0,
        saved: toFiniteNumber(it.saved_display) ?? 0,
        pctReduction: toFiniteNumber(it.saved_percent) ?? 0,
      }));
  } else {
    const electricY = emState.electricYearly;
    const dieselY = emState.dieselYearly;
    data = EMISSIONS_POLLUTANTS
      .filter((p) => electricY[p.key]?.total != null)
      .map((p) => {
        const eTotal = toFiniteNumber(electricY[p.key]?.total) ?? 0;
        const dTotal = dieselY ? (toFiniteNumber(dieselY[p.key]?.total) ?? 0) : 0;
        const div = inferUnitDivisor(electricY[p.key], p.divisor);
        const displayElectric = eTotal / div;
        const displayDiesel = dTotal / div;
        const displaySaved = displayDiesel - displayElectric;
        const pctReduction = dTotal !== 0 ? ((dTotal - eTotal) / Math.abs(dTotal)) * 100 : 0;
        const unitLabel = p.unitGroup === "ton" ? t("simulation.emissions_unit_ton_year") : t("simulation.emissions_unit_kg_year");
        return { key: p.key, label: t(p.i18n), color: p.color, unitLabel, saved: displaySaved, pctReduction, electric: displayElectric, diesel: displayDiesel };
      });
  }
  if (!data.length) return;

  const labelWidth = 108;
  const subBarHeight = 16;
  const subBarGap = 3;
  const groupHeight = hasDiesel ? subBarHeight * 2 + subBarGap : subBarHeight;
  const groupGap = 22;
  const margin = { top: 12, right: 112, bottom: 28, left: labelWidth };
  const W = 620;
  const chartHeight = margin.top + margin.bottom + data.length * groupHeight + (data.length - 1) * groupGap;
  const allValues = data.flatMap((d) => hasDiesel ? [d.electric, d.diesel] : [d.electric]);
  const maxVal = d3.max(allValues) * 1.15 || 1;

  const svg = svgBase(W, chartHeight, t("yearly_analysis.chart_aria_emissions_saved"));
  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxVal]).nice().range([0, iW]);

  const gridG = svg.append("g");
  x.ticks(4).forEach((tick) => {
    gridG.append("line")
      .attr("x1", margin.left + x(tick)).attr("x2", margin.left + x(tick))
      .attr("y1", margin.top).attr("y2", chartHeight - margin.bottom)
      .attr("stroke", "var(--color-border-light)").attr("stroke-dasharray", "3,3");
  });

  data.forEach((item, i) => {
    const yBase = margin.top + i * (groupHeight + groupGap);
    svg.append("text")
      .attr("x", margin.left - 10).attr("y", yBase + groupHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", "11px").attr("font-weight", "600").attr("fill", "var(--color-text-main)")
      .text(item.label);

    if (hasDiesel) {
      svg.append("rect")
        .attr("x", margin.left).attr("y", yBase)
        .attr("width", Math.max(0, x(item.diesel))).attr("height", subBarHeight)
        .attr("rx", 3).attr("fill", DIESEL_BAR_COLOR).attr("opacity", 0.78)
        .append("title").text(`${t("simulation.label_diesel")}: ${formatFixed(item.diesel, 1)} ${item.unitLabel}`);
      svg.append("text")
        .attr("x", margin.left + Math.max(0, x(item.diesel)) + 4).attr("y", yBase + subBarHeight / 2)
        .attr("dy", "0.35em").attr("font-size", "9px").attr("fill", "#888")
        .text(formatFixed(item.diesel, 1));
    }
    const electricY2 = hasDiesel ? yBase + subBarHeight + subBarGap : yBase;
    svg.append("rect")
      .attr("x", margin.left).attr("y", electricY2)
      .attr("width", Math.max(0, x(item.electric))).attr("height", subBarHeight)
      .attr("rx", 3).attr("fill", ELECTRIC_BAR_COLOR).attr("opacity", 0.9)
      .append("title").text(`${totalLabel}: ${formatFixed(item.electric, 1)} ${item.unitLabel}`);
    svg.append("text")
      .attr("x", margin.left + Math.max(0, x(item.electric)) + 4).attr("y", electricY2 + subBarHeight / 2)
      .attr("dy", "0.35em").attr("font-size", "9px").attr("fill", "var(--color-text-main)")
      .text(formatFixed(item.electric, 1));

    if (hasDiesel) {
      const savedPositive = item.saved > 0;
      const arrow = savedPositive ? "↓" : "↑";
      const tone = savedPositive ? "var(--color-success)" : "var(--color-danger)";
      svg.append("text")
        .attr("x", W - margin.right + 10).attr("y", yBase + groupHeight / 2 - 6)
        .attr("dy", "0.35em").attr("font-size", "11px").attr("font-weight", "700").attr("fill", tone)
        .text(`${arrow} ${formatFixed(Math.abs(item.pctReduction), 0)}%`);
      svg.append("text")
        .attr("x", W - margin.right + 10).attr("y", yBase + groupHeight / 2 + 8)
        .attr("dy", "0.35em").attr("font-size", "9px").attr("fill", "#888")
        .text(`${savedPositive ? "−" : "+"}${formatFixed(Math.abs(item.saved), 1)} ${item.unitLabel}`);
    }
  });

  svg.append("g")
    .attr("transform", `translate(${margin.left},${chartHeight - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((d) => formatFixed(d, 1)))
    .selectAll("text").attr("font-size", "9px");

  el.appendChild(svg.node());

  if (legendEl) {
    let html = "";
    if (hasDiesel) html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${DIESEL_BAR_COLOR};opacity:0.78"></span>${textContent(t("simulation.emissions_toggle_diesel"))}</div>`;
    html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${ELECTRIC_BAR_COLOR};opacity:0.9"></span>${textContent(totalLabel)}</div>`;
    legendEl.innerHTML = html;
  }
};

const adaptiveDecimals = (v) => {
  if (v === 0) return 1;
  const abs = Math.abs(v);
  if (abs >= 100) return 0;
  if (abs >= 1) return 1;
  if (abs >= 0.01) return 2;
  return 3;
};

const setYaCo2PhaseTitle = (chartEl, showLifecycleInfo = false) => {
  const titleEl = chartEl?.closest(".ya-env-chart-section")?.querySelector(".ya-res-section-title");
  if (!titleEl) return;
  const baseTitle = textContent(t("simulation.emissions_co2_phase_title"));
  if (!showLifecycleInfo) {
    titleEl.textContent = baseTitle;
    return;
  }
  const tooltipText = textContent(t("yearly_analysis.lifecycle_phases_exclude_dh"));
  titleEl.innerHTML = `${baseTitle}<span class="ya-info-icon" tabindex="0" aria-label="${tooltipText}">i<span class="ya-info-tooltip">${linkifyMobitoolHtml(tooltipText)}</span></span>`;
};

const getYaCo2BreakdownLabelFontSize = (labels = []) => {
  const longestLength = labels.reduce(
    (maxLength, label) => Math.max(maxLength, text(label).trim().length),
    0
  );
  const length = longestLength;
  if (length > 24) return 8.5;
  if (length > 18) return 9;
  if (length > 12) return 10;
  return 11;
};

const renderYaCo2PhaseBreakdown = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
  if (!emState || emState.status !== "done" || !emState.electricYearly) return;

  const lcb = emState.structured?.lifecycleBreakdown;
  const unitLabel = t("simulation.emissions_unit_ton_year");
  let hasDhSegment = false;

  let bars;
  if (lcb?.ebus?.phases) {
    const lcbUnit = lcb.unit || "g CO₂-eq/year";
    const phaseDivisor = displayDivisor(lcbUnit, "t/year") || CO2_PHASE_DIVISOR;
    const buildPhasesFromObj = (phasesObj) =>
      LCA_PHASES.map((p) => ({
        key: p.key, label: t(p.i18n), color: p.color,
        value: Math.max(0, (toFiniteNumber(phasesObj?.[p.key]) ?? 0) / phaseDivisor),
      }));
    const ebusPhases = buildPhasesFromObj(lcb.ebus.phases);
    const ebusPhaseSum = ebusPhases.reduce((s, p) => s + p.value, 0);
    const ebusLabel = getEmissionsTotalLabel(emState);
    const ebusDh = (toFiniteNumber(lcb.ebus.diesel_heating) ?? 0) / phaseDivisor;
    hasDhSegment = emState.isDieselHeating && ebusDh > EPS;

    const ebusBar = { label: ebusLabel, phases: ebusPhases, dhValue: hasDhSegment ? ebusDh : 0, total: ebusPhaseSum + (hasDhSegment ? ebusDh : 0) };
    bars = [ebusBar];

    if (lcb.diesel_comparator?.available !== false && lcb.diesel_comparator?.phases) {
      const dieselPhases = buildPhasesFromObj(lcb.diesel_comparator.phases);
      bars.push({ label: t("simulation.label_diesel"), phases: dieselPhases, dhValue: 0, total: dieselPhases.reduce((s, p) => s + p.value, 0) });
    } else if (emState.dieselYearly?.gwp100a && hasEmissionPhaseData(emState.dieselYearly.gwp100a)) {
      const fallbackGwp = emState.dieselYearly.gwp100a;
      const fallbackPhases = LCA_PHASES.map((p) => ({
        key: p.key, label: t(p.i18n), color: p.color,
        value: Math.max(0, (toFiniteNumber(fallbackGwp[p.key]) ?? 0) / phaseDivisor),
      }));
      bars.push({ label: t("simulation.label_diesel"), phases: fallbackPhases, dhValue: 0, total: fallbackPhases.reduce((s, p) => s + p.value, 0) });
    }
  } else {
    const electricGwp = emState.electricYearly.gwp100a;
    const dieselGwp = emState.dieselYearly?.gwp100a;
    if (!electricGwp) return;
    if (!hasEmissionPhaseData(electricGwp) && !hasEmissionPhaseData(dieselGwp)) {
      el.innerHTML = `<p class="ya-status-msg">${textContent(t("yearly_analysis.lifecycle_phase_breakdown_unavailable"))}</p>`;
      return;
    }
    const phaseDivisor = inferUnitDivisor(electricGwp, CO2_PHASE_DIVISOR);
    const buildPhases = (gwp) =>
      LCA_PHASES.map((p) => ({
        key: p.key, label: t(p.i18n), color: p.color,
        value: Math.max(0, (toFiniteNumber(gwp[p.key]) ?? 0) / phaseDivisor),
      }));
    const co2EbusLabel = getEmissionsTotalLabel(emState);
    const ebusPhases = buildPhases(electricGwp);
    bars = [{ label: co2EbusLabel, phases: ebusPhases, dhValue: 0, total: ebusPhases.reduce((s, p) => s + p.value, 0) }];
    if (dieselGwp && hasEmissionPhaseData(dieselGwp)) {
      const dp = buildPhases(dieselGwp);
      bars.push({ label: t("simulation.label_diesel"), phases: dp, dhValue: 0, total: dp.reduce((s, p) => s + p.value, 0) });
    }
  }

  if (!bars?.length) return;

  const maxTotal = Math.max(...bars.map((b) => b.total)) * 1.15 || 1;
  const totalDecimals = adaptiveDecimals(maxTotal);
  const barHeight = 42;
  const barGap = 14;
  const labelWidth = emState.isDieselHeating ? 124 : 108;
  const margin = { top: 12, right: 68, bottom: 28, left: labelWidth };
  const W = 600;
  const contentHeight = bars.length * barHeight + (bars.length - 1) * barGap;
  const minChartHeight = 188;
  const extraVerticalSpace = Math.max(0, minChartHeight - (margin.top + margin.bottom + contentHeight));
  const layoutMargin = {
    ...margin,
    top: margin.top + extraVerticalSpace / 2,
    bottom: margin.bottom + extraVerticalSpace / 2,
  };
  const chartHeight = layoutMargin.top + layoutMargin.bottom + contentHeight;

  const svg = svgBase(W, chartHeight, t("simulation.chart_aria_co2_phase"));
  const iW = W - layoutMargin.left - layoutMargin.right;
  const x = d3.scaleLinear().domain([0, maxTotal]).nice().range([0, iW]);
  const labelFontSize = `${getYaCo2BreakdownLabelFontSize(bars.map((bar) => bar.label))}px`;

  bars.forEach((bar, i) => {
    const y = layoutMargin.top + i * (barHeight + barGap);
    svg.append("text")
      .attr("x", layoutMargin.left - 8).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", labelFontSize)
      .attr("font-weight", "600").attr("fill", "var(--color-text-main)")
      .text(bar.label);
    let xOff = 0;
    const dec = adaptiveDecimals(bar.total);
    bar.phases.forEach((phase) => {
      const w = Math.max(0, x(phase.value));
      if (w > 0.5) {
        const pct = bar.total > 0 ? Math.round((phase.value / bar.total) * 100) : 0;
        svg.append("rect")
          .attr("x", layoutMargin.left + xOff).attr("y", y)
          .attr("width", w).attr("height", barHeight)
          .attr("fill", phase.color).attr("rx", xOff === 0 ? 3 : 0)
          .style("cursor", "pointer")
          .append("title")
          .text(`${bar.label} · ${phase.label}: ${formatFixed(phase.value, dec)} ${unitLabel} (${pct}%)`);
        xOff += w;
      }
    });
    if (bar.dhValue > EPS) {
      const w = Math.max(0, x(bar.dhValue));
      if (w > 0.5) {
        const pct = bar.total > 0 ? Math.round((bar.dhValue / bar.total) * 100) : 0;
        svg.append("rect")
          .attr("x", layoutMargin.left + xOff).attr("y", y)
          .attr("width", w).attr("height", barHeight)
          .attr("fill", DH_BAR_COLOR).attr("rx", 0)
          .attr("stroke", "var(--color-surface)").attr("stroke-width", 1)
          .style("cursor", "pointer")
          .append("title")
          .text(`${bar.label} · ${t("yearly_analysis.diesel_heating")}: ${formatFixed(bar.dhValue, dec)} ${unitLabel} (${pct}%)`);
        xOff += w;
      }
    }
    svg.append("text")
      .attr("x", layoutMargin.left + xOff + 6).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("font-size", "10px").attr("fill", "#666")
      .text(`${formatFixed(bar.total, dec)} ${unitLabel}`);
  });

  svg.append("g")
    .attr("transform", `translate(${layoutMargin.left},${chartHeight - layoutMargin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((d) => formatFixed(d, totalDecimals)))
    .selectAll("text").attr("font-size", "9px");

  el.appendChild(svg.node());

  if (legendEl) {
    let html = LCA_PHASES.map((p) => `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${p.color}"></span>${textContent(t(p.i18n))}</div>`).join("");
    if (hasDhSegment) {
      html += `<div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${DH_BAR_COLOR}"></span>${textContent(t("yearly_analysis.diesel_heating"))}</div>`;
    }
    legendEl.innerHTML = html;
  }
};

const renderYaPrimaryEnergy = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
  if (!emState || emState.status !== "done" || !emState.electricYearly) return;

  const peb = emState.structured?.primaryEnergyBreakdown;
  let eRen, eNR, eTotal, dRen, dNR, dTotal, unitLabel;

  if (peb?.ebus) {
    const pDiv = displayDivisor(peb.unit || "MJ/year", peb.display_unit || "GJ/year") || 1e3;
    unitLabel = peb.display_unit || "GJ/year";
    eRen = (toFiniteNumber(peb.ebus.renewable) ?? 0) / pDiv;
    eNR = (toFiniteNumber(peb.ebus.non_renewable) ?? 0) / pDiv;
    eTotal = (toFiniteNumber(peb.ebus.total) ?? 0) / pDiv;
    if (peb.diesel_comparator) {
      dRen = (toFiniteNumber(peb.diesel_comparator.renewable) ?? 0) / pDiv;
      dNR = (toFiniteNumber(peb.diesel_comparator.non_renewable) ?? 0) / pDiv;
      dTotal = (toFiniteNumber(peb.diesel_comparator.total) ?? 0) / pDiv;
    } else {
      dRen = dNR = dTotal = null;
    }
  } else {
    const ePE = emState.electricYearly.primaryEnergy;
    const ePENR = emState.electricYearly.primaryEnergyNonRenewable;
    const dPE = emState.dieselYearly?.primaryEnergy;
    const dPENR = emState.dieselYearly?.primaryEnergyNonRenewable;
    if (!ePE || !ePENR) return;

    const rawETotal = toFiniteNumber(ePE.total) ?? 0;
    const rawENR = toFiniteNumber(ePENR.total) ?? 0;
    const rawDTotal = dPE ? (toFiniteNumber(dPE.total) ?? 0) : null;
    const rawDNR = dPENR ? (toFiniteNumber(dPENR.total) ?? 0) : null;
    const peak = Math.max(rawETotal, rawDTotal ?? 0);
    const uDiv = peak > 1e6 ? 1e3 : 1;
    unitLabel = uDiv === 1e3 ? "GJ/year" : "MJ/year";
    eTotal = rawETotal / uDiv;
    eNR = rawENR / uDiv;
    eRen = Math.max(0, eTotal - eNR);
    dTotal = rawDTotal != null ? rawDTotal / uDiv : null;
    dNR = rawDNR != null ? rawDNR / uDiv : null;
    dRen = dTotal != null && dNR != null ? Math.max(0, dTotal - dNR) : null;
  }

  if (eTotal == null || eTotal === 0) return;

  const buildSegments = (ren, nr) => [
    { key: "renewable", label: t("yearly_analysis.renewable"), color: ENERGY_COLORS.renewable, value: ren },
    { key: "nonRenewable", label: t("yearly_analysis.non_renewable"), color: ENERGY_COLORS.nonRenewable, value: Math.max(0, nr) },
  ];

  const peEbusLabel = getEmissionsTotalLabel(emState);
  const bars = [{ label: peEbusLabel, segments: buildSegments(eRen, eNR) }];
  if (dTotal != null) bars.push({ label: t("simulation.label_diesel"), segments: buildSegments(dRen ?? 0, dNR ?? 0) });

  const maxBar = Math.max(...bars.map((b) => b.segments.reduce((s, seg) => s + seg.value, 0))) * 1.15 || 1;
  const barHeight = 36, barGap = 16, labelWidth = 140;
  const margin = { top: 12, right: 80, bottom: 28, left: labelWidth };
  const W = 560;
  const chartHeight = margin.top + margin.bottom + bars.length * barHeight + (bars.length - 1) * barGap;

  const svg = svgBase(W, chartHeight, t("simulation.chart_aria_primary_energy"));
  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxBar]).nice().range([0, iW]);

  bars.forEach((bar, i) => {
    const y = margin.top + i * (barHeight + barGap);
    svg.append("text")
      .attr("x", margin.left - 8).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", "11px").attr("font-weight", "600").attr("fill", "var(--color-text-main)")
      .text(bar.label);
    let xOff = 0;
    const total = bar.segments.reduce((s, seg) => s + seg.value, 0);
    bar.segments.forEach((segment) => {
      const w = Math.max(0, x(segment.value));
      if (w > 0.5) {
        const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
        svg.append("rect")
          .attr("x", margin.left + xOff).attr("y", y)
          .attr("width", w).attr("height", barHeight)
          .attr("fill", segment.color).attr("rx", xOff === 0 ? 3 : 0)
          .style("cursor", "pointer")
          .append("title")
          .text(`${bar.label} · ${segment.label}: ${formatFixed(segment.value, 1)} ${unitLabel} (${pct}%)`);
        if (w > 50) {
          svg.append("text")
            .attr("x", margin.left + xOff + w / 2).attr("y", y + barHeight / 2)
            .attr("dy", "0.35em").attr("text-anchor", "middle")
            .attr("font-size", "9px").attr("font-weight", "600").attr("fill", "var(--color-surface)")
            .attr("pointer-events", "none").text(`${pct}%`);
        }
        xOff += w;
      }
    });
    svg.append("text")
      .attr("x", margin.left + xOff + 6).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("font-size", "10px").attr("fill", "#666")
      .text(`${t("simulation.label_total")}: ${formatFixed(total, 0)} ${unitLabel}`);
  });

  svg.append("g")
    .attr("transform", `translate(${margin.left},${chartHeight - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((d) => formatFixed(d, 0)))
    .selectAll("text").attr("font-size", "9px");

  el.appendChild(svg.node());

  if (legendEl) {
    legendEl.innerHTML = `
      <div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${ENERGY_COLORS.renewable}"></span>${textContent(t("yearly_analysis.renewable"))}</div>
      <div class="ya-chart-legend-item"><span class="ya-chart-legend-swatch" style="background:${ENERGY_COLORS.nonRenewable}"></span>${textContent(t("yearly_analysis.non_renewable"))}</div>`;
  }
};

/* ── Emissions: main panel renderer ──────────────────────────── */

const renderEmissionsPanel = (sec, emState) => {
  const panel = sec.closest('[data-panel="emissions"]') ?? sec;

  const headerEl = panel.querySelector('[data-role="ya-env-header"]');
  const controlsEl = panel.querySelector('[data-role="ya-env-controls"]');
  const kpisEl = panel.querySelector('[data-role="ya-env-kpis"]');
  const tableEl = panel.querySelector('[data-role="ya-env-table"]');
  const histEl = panel.querySelector('[data-role="ya-env-histogram"]');
  const histLegEl = panel.querySelector('[data-role="ya-env-histogram-legend"]');
  const co2El = panel.querySelector('[data-role="ya-env-co2-phase"]');
  const co2LegEl = panel.querySelector('[data-role="ya-env-co2-phase-legend"]');
  const methEl = panel.querySelector('[data-role="ya-env-methodology"]');
  const chartsEl = panel.querySelector(".ya-env-chart-grid");
  const moreInformationEl = panel.querySelector(".ya-more-information");
  setYaCo2PhaseTitle(co2El, emState?.status === "done" && !!emState?.isDieselHeating);

  const clearAll = () => {
    [headerEl, kpisEl, tableEl, histEl, histLegEl, co2El, co2LegEl, methEl]
      .forEach((e) => { if (e) e.innerHTML = ""; });
    if (controlsEl) controlsEl.hidden = true;
    if (chartsEl) chartsEl.hidden = true;
    if (moreInformationEl) moreInformationEl.hidden = true;
  };

  if (emState.status === "loading") {
    clearAll();
    if (kpisEl) kpisEl.innerHTML = `<p class="ya-status-msg">${textContent(t("simulation.emissions_loading"))}</p>`;
    return;
  }
  if (emState.status === "error") {
    clearAll();
    if (kpisEl) kpisEl.innerHTML = `<p class="ya-status-msg ya-status-msg--error">${textContent(emState.error || t("simulation.emissions_error"))}</p>`;
    return;
  }
  if (emState.status !== "done" || !emState.electricYearly) {
    clearAll();
    if (kpisEl) kpisEl.innerHTML = `<p class="ya-status-msg">${textContent(t("simulation.emissions_no_data"))}</p>`;
    return;
  }

  if (chartsEl) chartsEl.hidden = false;
  if (moreInformationEl) moreInformationEl.hidden = false;

  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;
  const isDH = !!emState.isDieselHeating;
  const ebusLabel = getEmissionsTotalLabel(emState);
  const structured = emState.structured;
  const assumptions = structured?.assumptions ?? emState.emissionsMetadata ?? {};
  const yearlyDistKm = toFiniteNumber(
    assumptions.yearly_distance_km ?? assumptions.yearlyDistanceKm ??
    emState.yearlyDistanceKm ?? emState.yearlyImpact?.yearly_distance_km
  );

  /* Header + KPI cards */
  const headerSubject = textContent(
    isDH
      ? (t("yearly_analysis.ebus_with_diesel_heating_against_diesel") || "e-bus with diesel heating against diesel")
      : (t("yearly_analysis.ebus_against_diesel") || "e-bus against diesel")
  );
  const headerDistance = yearlyDistKm != null
    ? ` (${textContent(t("yearly_analysis.annual_distance_label_compact") || "annual distance:")} ${formatKmPerYear(yearlyDistKm)})`
    : "";
  const headerTitle = `${textContent(t("simulation.env_page_title"))}: ${headerSubject}${headerDistance}`;

  const KPI_KEYS = ["gwp100a", "nox", "pm10"];
  const ebusKpiLabel = t("yearly_analysis.ebus") || ebusLabel;
  const dieselKpiLabel = t("simulation.label_diesel");
  let kpiCards;
  if (structured?.indicators?.length) {
    kpiCards = KPI_KEYS
      .map((k) => indicatorByKey(structured.indicators, k))
      .filter(Boolean)
      .map((ind) => {
        const div = displayDivisor(ind.unit, ind.display_unit) || 1;
        const eVal = (toFiniteNumber(ind.ebus_total) ?? 0) / div;
        const dVal = ind.diesel_comparator != null ? (toFiniteNumber(ind.diesel_comparator) ?? 0) / div : null;
        const dir = getComparisonDirection(ind);
        const tone = dir?.kind === "reduction" ? "positive" : dir?.kind === "increase" ? "negative" : "neutral";
        const dispUnit = ind.display_unit || ind.unit || "";
        const dec = INDICATOR_DISPLAY_DECIMALS[ind.key] ?? 1;
        return `<div class="ya-env-kpi-card ya-env-kpi-card--${tone}">
          <div class="ya-env-kpi-card__line">
            <span class="ya-env-kpi-card__title">${textContent(resolveEnvIndicatorLabel(ind))} (${textContent(dispUnit)}):</span>
            <span class="ya-env-kpi-card__values">
              <span class="ya-env-kpi-card__metric"><span class="ya-env-kpi-card__val-label">${textContent(ebusKpiLabel)}</span><span class="ya-env-kpi-card__val-num">${formatFixed(eVal, dec)}</span></span>
              ${dVal != null ? `<span class="ya-env-kpi-card__metric"><span class="ya-env-kpi-card__val-label">${textContent(dieselKpiLabel)}</span><span class="ya-env-kpi-card__val-num">${formatFixed(dVal, dec)}</span></span>` : ""}
              ${dir ? `<span class="ya-env-kpi-card__delta ya-env-kpi-card__delta--${tone}">${dir.arrow} ${formatFixed(dir.percent, 0)}%</span>` : ""}
            </span>
          </div>
        </div>`;
      }).join("");
  } else {
    kpiCards = ENV_KPI_DEFS
      .filter((def) => electricY[def.key]?.total != null)
      .map((def) => {
        const eRaw = toFiniteNumber(electricY[def.key]?.total) ?? 0;
        const dRaw = hasDiesel ? (toFiniteNumber(dieselY[def.key]?.total) ?? 0) : null;
        const div = inferUnitDivisor(electricY[def.key], def.divisor);
        const eVal = eRaw / div;
        const dVal = dRaw != null ? dRaw / div : null;
        const pctChange = dRaw != null && dRaw !== 0 ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100 : null;
        const tone = pctChange != null && pctChange > 0 ? "positive" : pctChange != null && pctChange < 0 ? "negative" : "neutral";
        return `<div class="ya-env-kpi-card ya-env-kpi-card--${tone}">
          <div class="ya-env-kpi-card__line">
            <span class="ya-env-kpi-card__title">${textContent(t(def.i18n))} (${textContent(def.unit)}):</span>
            <span class="ya-env-kpi-card__values">
              <span class="ya-env-kpi-card__metric"><span class="ya-env-kpi-card__val-label">${textContent(ebusKpiLabel)}</span><span class="ya-env-kpi-card__val-num">${formatFixed(eVal, 1)}</span></span>
              ${dVal != null ? `<span class="ya-env-kpi-card__metric"><span class="ya-env-kpi-card__val-label">${textContent(dieselKpiLabel)}</span><span class="ya-env-kpi-card__val-num">${formatFixed(dVal, 1)}</span></span>` : ""}
              ${pctChange != null ? `<span class="ya-env-kpi-card__delta ya-env-kpi-card__delta--${tone}">${pctChange > 0 ? "↓" : "↑"} ${formatFixed(Math.abs(pctChange), 0)}%</span>` : ""}
            </span>
          </div>
        </div>`;
      }).join("");
  }

  if (headerEl) {
    headerEl.innerHTML = `
      <div class="ya-env-header">
        <h2>${headerTitle}</h2>
        <p>${linkifyMobitoolHtml(textContent(t("yearly_analysis.env_page_subtitle")))}</p>
      </div>`;
  }
  if (kpisEl) {
    kpisEl.innerHTML = `<div class="kpi-grid ya-env-kpi-row">${kpiCards}</div>`;
  }

  /* Comparison tables */
  const TABLE_KEYS = ["gwp100a", "nox", "pm10"];
  const yearlyTableTitle = textContent(t("yearly_analysis.yearly_indicator_comparison"));
  const perKmTableTitle = textContent(t("yearly_analysis.normalized_indicators_per_km"));
  let yearlyTableRows, yearlyTableHeaders, perKmTableRows, perKmTableHeaders;

  if (structured?.indicators?.length) {
    const tableInds = TABLE_KEYS.map((k) => indicatorByKey(structured.indicators, k)).filter(Boolean);
    yearlyTableHeaders = hasDiesel
      ? `<th class="ya-env-table__section-title">${yearlyTableTitle}</th><th>${textContent(ebusLabel)}</th><th>${textContent(t("simulation.label_diesel"))}</th><th>${textContent(t("yearly_analysis.delta_vs_diesel"))}</th><th>${textContent(t("yearly_analysis.change_vs_diesel"))}</th>`
      : `<th class="ya-env-table__section-title">${yearlyTableTitle}</th><th>${textContent(ebusLabel)}</th>`;
    yearlyTableRows = tableInds.map((ind) => {
      const div = displayDivisor(ind.unit, ind.display_unit) || 1;
      const dec = INDICATOR_DISPLAY_DECIMALS[ind.key] ?? 1;
      const dispUnit = ind.display_unit || ind.unit || "";
      const eVal = (toFiniteNumber(ind.ebus_total) ?? 0) / div;
      const dVal = ind.diesel_comparator != null ? (toFiniteNumber(ind.diesel_comparator) ?? 0) / div : null;
      const diff = ind.delta_vs_diesel != null ? (toFiniteNumber(ind.delta_vs_diesel) ?? 0) / div : (dVal != null ? dVal - eVal : null);
      const dir = getComparisonDirection(ind);
      const changeCls = dir?.kind === "reduction" ? "ya-env-reduction--positive" : dir?.kind === "increase" ? "ya-env-reduction--negative" : "";
      return `<tr>
        <td>${textContent(resolveEnvIndicatorLabel(ind))} (${dispUnit})</td>
        <td>${formatFixed(eVal, dec)}</td>
        ${hasDiesel ? `<td>${dVal != null ? formatFixed(dVal, dec) : "—"}</td>` : ""}
        ${hasDiesel ? `<td>${diff != null ? formatFixed(diff, dec) : "—"}</td>` : ""}
        ${hasDiesel ? `<td class="${changeCls}">${dir ? `${dir.arrow} ${formatFixed(dir.percent, 0)}%` : "—"}</td>` : ""}
      </tr>`;
    }).join("");

    perKmTableHeaders = hasDiesel
      ? `<th class="ya-env-table__section-title">${perKmTableTitle}</th><th>${textContent(ebusLabel)}</th><th>${textContent(t("simulation.label_diesel"))}</th>`
      : `<th class="ya-env-table__section-title">${perKmTableTitle}</th><th>${textContent(ebusLabel)}</th>`;
    perKmTableRows = tableInds
      .filter((ind) => ind.normalized_ebus_per_km != null)
      .map((ind) => {
        const normUnit = ind.normalized_unit || "";
        return `<tr>
          <td>${textContent(resolveEnvIndicatorLabel(ind))} (${normUnit})</td>
          <td>${formatFixed(ind.normalized_ebus_per_km, 1)}</td>
          ${hasDiesel ? `<td>${ind.normalized_diesel_per_km != null ? formatFixed(ind.normalized_diesel_per_km, 1) : "—"}</td>` : ""}
        </tr>`;
      }).join("");
  } else {
    const comparisonRows = ENV_TABLE_ROWS
      .filter((row) => electricY[row.key]?.total != null)
      .map((row) => {
        const eRaw = toFiniteNumber(electricY[row.key]?.total) ?? 0;
        const dRaw = hasDiesel ? toFiniteNumber(dieselY?.[row.key]?.total) : null;
        const div = inferUnitDivisor(electricY[row.key], row.divisor);
        const yearlyElectric = eRaw / div;
        const yearlyDiesel = dRaw != null ? dRaw / div : null;
        const perKmElectric = yearlyDistKm ? eRaw / yearlyDistKm : null;
        const perKmDiesel = yearlyDistKm && dRaw != null ? dRaw / yearlyDistKm : null;
        const diff = yearlyDiesel != null ? yearlyDiesel - yearlyElectric : null;
        const pct = dRaw != null && dRaw !== 0 ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100 : null;
        const changeCls = pct != null && pct > 0 ? "ya-env-reduction--positive" : pct != null && pct < 0 ? "ya-env-reduction--negative" : "";
        return { row, yearlyElectric, yearlyDiesel, perKmElectric, perKmDiesel, diff, pct, changeCls };
      });
    yearlyTableHeaders = hasDiesel
      ? `<th class="ya-env-table__section-title">${yearlyTableTitle}</th><th>${textContent(ebusLabel)}</th><th>${textContent(t("simulation.label_diesel"))}</th><th>${textContent(t("yearly_analysis.delta_vs_diesel"))}</th><th>${textContent(t("yearly_analysis.change_vs_diesel"))}</th>`
      : `<th class="ya-env-table__section-title">${yearlyTableTitle}</th><th>${textContent(ebusLabel)}</th>`;
    yearlyTableRows = comparisonRows.map(({ row, yearlyElectric, yearlyDiesel, diff, pct, changeCls }) => `
        <tr>
          <td>${textContent(t(row.i18n))} (${row.unit})</td>
          <td>${formatFixed(yearlyElectric, row.decimals)}</td>
          ${hasDiesel ? `<td>${formatFixed(yearlyDiesel, row.decimals)}</td>` : ""}
          ${hasDiesel ? `<td>${diff != null ? formatFixed(diff, row.decimals) : "—"}</td>` : ""}
          ${hasDiesel ? `<td class="${changeCls}">${pct != null ? `${pct > 0 ? "↓" : "↑"} ${formatFixed(Math.abs(pct), 0)}%` : "—"}</td>` : ""}
        </tr>`).join("");
    perKmTableHeaders = hasDiesel
      ? `<th class="ya-env-table__section-title">${perKmTableTitle}</th><th>${textContent(ebusLabel)}</th><th>${textContent(t("simulation.label_diesel"))}</th>`
      : `<th class="ya-env-table__section-title">${perKmTableTitle}</th><th>${textContent(ebusLabel)}</th>`;
    perKmTableRows = yearlyDistKm
      ? comparisonRows.map(({ row, perKmElectric, perKmDiesel }) => `
        <tr>
          <td>${textContent(t(row.i18n))} (${row.perKmUnit})</td>
          <td>${perKmElectric != null ? formatFixed(perKmElectric, 1) : "—"}</td>
          ${hasDiesel ? `<td>${perKmDiesel != null ? formatFixed(perKmDiesel, 1) : "—"}</td>` : ""}
        </tr>`).join("")
      : "";
  }

  /* Mixed-case decomposition table */
  let dhBreakdownHtml = "";
  const mcd = structured?.mixedCaseDecomposition;
  if (isDH && mcd?.available === true && hasPositiveMixedCaseDieselHeating(mcd)) {
    const mcdYearlyKwh = toFiniteNumber(mcd.yearly_electric_kwh);
    const mcdKwhPer100km = toFiniteNumber(mcd.electric_kwh_per_100km);
    const mcdDhLiters = toFiniteNumber(mcd.yearly_diesel_heating_liters);
    const mcdIndicators = mcd.indicators ?? {};
    const MCD_KEYS = ["gwp100a", "nox", "pm10"];
    const mcdTooltipText = `${textContent(t("yearly_analysis.mixed_case_description"))} ${textContent(t("yearly_analysis.electric_side"))}: ${mcdYearlyKwh ? `${formatInt(mcdYearlyKwh)} kWh/yr` : "—"} (${mcdKwhPer100km ? `${formatFixed(mcdKwhPer100km, 1)} kWh/100km` : "—"}) · ${textContent(t("yearly_analysis.diesel_heating_label"))} ${mcdDhLiters ? `${formatFixed(mcdDhLiters, 1)} l/yr` : "0 l/yr"}`;
    const mcdInfoTip = `<span class="ya-info-icon" tabindex="0" aria-label="${textContent(mcdTooltipText)}">i<span class="ya-info-tooltip">${textContent(mcdTooltipText)}</span></span>`;
    const mcdRows = MCD_KEYS.map((key) => {
      const mi = mcdIndicators[key];
      if (!mi) return "";
      const ind = indicatorByKey(structured.indicators, key);
      const div = ind ? displayDivisor(ind.unit, ind.display_unit) || 1 : 1;
      const dispUnit = ind?.display_unit || mi.unit || "";
      const dec = INDICATOR_DISPLAY_DECIMALS[key] ?? 1;
      const elVal = (toFiniteNumber(mi.electric_side) ?? 0) / div;
      const dhVal = (toFiniteNumber(mi.diesel_heating) ?? 0) / div;
      const totVal = (toFiniteNumber(mi.total) ?? 0) / div;
      return `<tr>
        <td>${textContent(resolveEnvIndicatorLabel(ind ?? { key }))} (${dispUnit})</td>
        <td>${formatFixed(elVal, dec)}</td>
        <td>${formatFixed(dhVal, dec)}</td>
        <td><strong>${formatFixed(totVal, dec)}</strong></td>
      </tr>`;
    }).filter(Boolean).join("");
    dhBreakdownHtml = `<div class="ya-res-section" style="margin-top:16px">
      <div class="ya-env-table-wrap"><table class="ya-env-table">
        <thead><tr><th class="ya-env-table__section-title">${textContent(t("yearly_analysis.mixed_case_decomposition"))}${mcdInfoTip}</th><th>${textContent(t("yearly_analysis.electric_side"))}</th><th>${textContent(t("yearly_analysis.diesel_heating"))}</th><th>${textContent(t("yearly_analysis.ebus_total_diesel_heating"))}</th></tr></thead>
        <tbody>${mcdRows}</tbody>
      </table></div>
    </div>`;
  }

  if (tableEl) {
    const hasPerKm = perKmTableRows && perKmTableRows.length > 0;
    const perKmTableHtml = hasPerKm
      ? `<div class="ya-res-section">
      <div class="ya-env-table-wrap"><table class="ya-env-table"><thead><tr>${perKmTableHeaders}</tr></thead><tbody>${perKmTableRows}</tbody></table></div>
    </div>`
      : "";
    tableEl.innerHTML = `<div class="ya-res-section">
      <div class="ya-env-table-wrap"><table class="ya-env-table"><thead><tr>${yearlyTableHeaders}</tr></thead><tbody>${yearlyTableRows}</tbody></table></div>
    </div>${dhBreakdownHtml}${perKmTableHtml}`;
  }

  /* Charts */
  try { renderYaEmissionsHistogram(histEl, histLegEl, emState); } catch (e) { console.error("[YA-Emissions] Histogram error:", e); }
  try { renderYaCo2PhaseBreakdown(co2El, co2LegEl, emState); } catch (e) { console.error("[YA-Emissions] CO₂ phase error:", e); }

  /* Methodology note */
  if (methEl) {
    const lcaMethod = assumptions.lca_phase_method || "";
    const baseNote = linkifyMobitoolHtml(textContent(t("yearly_analysis.env_methodology_base_note")));
    const dhNote = isDH ? ` ${textContent(t("yearly_analysis.env_methodology_diesel_heating_note"))}` : "";
    const caveatNote = isDH ? ` ${textContent(t("yearly_analysis.env_methodology_diesel_heating_caveat"))}` : "";
    const methodNote = lcaMethod ? ` ${textContent(t("yearly_analysis.env_methodology_lca_method", { method: lcaMethod }))}` : "";
    methEl.innerHTML = `<div class="ya-env-methodology-note">
      <p>${baseNote}${dhNote}${caveatNote}${methodNote}</p>
    </div>`;
  }
};

/* ── JSON export builder ───────────────────────────────────────── */

const round = (v, d = 4) => (v != null && Number.isFinite(v) ? +v.toFixed(d) : null);

const buildExportPayload = (features, effState, costState, emissionsState, busModelData, analysisId) => {
  const cfg = features.config ?? {};
  const meta = features.meta ?? {};
  const results = features.results ?? {};
  const yearlyTotals = results.yearlyTotals ?? {};

  const header = {
    analysisId,
    exportedAt: new Date().toISOString(),
    shift: (meta.shiftNames ?? []).join(", ") || null,
    busModel: meta.busModelName ?? null,
    mode: meta.modeLabel ?? cfg.mode ?? null,
    occupancyPercent: cfg.occupancy_percent ?? null,
    heating: cfg.auxiliary_heating_type ?? null,
    socRange: cfg.min_soc != null && cfg.max_soc != null
      ? { min: round(cfg.min_soc, 2), max: round(cfg.max_soc, 2) }
      : null,
  };

  /* ── Efficiency ─────────────────────────────────────────────── */
  const eff = {};
  if (effState.summary) {
    const s = effState.summary;
    eff.yearlySummary = {
      yearlyEnergy_kWh: round(s.energy, 1),
      yearlyDrivetrainEnergy_kWh: round(s.drv, 1),
      yearlyAuxiliaryEnergy_kWh: round(s.aux, 1),
      yearlySimulatedDistance_km: round(s.dist, 1),
      averageEfficiency_kWhPerKm: round(s.avgEfficiency, 4),
      bestCaseEfficiency_kWhPerKm: round(s.minEfficiency, 4),
      worstCaseEfficiency_kWhPerKm: round(s.maxEfficiency, 4),
      auxiliaryShare_pct: round(s.auxShare, 1),
      drivetrainShare_pct: round(s.drvShare, 1),
    };
  }
  eff.baseFeasibility = results.baseFeasible ?? null;
  eff.optimizedPacks = results.optimizedPacks ?? null;

  if (effState.enriched?.length) {
    eff.scenarios = effState.enriched.filter((s) => s.derived).map((s) => {
      const k = s.kpis ?? {};
      const d = s.derived;
      const row = {
        label: s.label,
        temperature_C: s.temperature,
        daysPerYear: s.occurrences,
        totalEnergy_kWh: round(k.totalEnergyKwh, 1),
        drivetrainEnergy_kWh: round(k.drivetrainEnergyKwh, 1),
        auxiliaryEnergy_kWh: round(k.auxiliaryEnergyKwh, 1),
        simulatedDistance_km: round(k.distanceKm, 1),
        efficiency_kWhPerKm: round(k.energyPerKm, 4),
      };
      if (hasQuantiles(k.consumptionPerKmQuantiles)) {
        row.efficiencyUncertainty = {
          q05: round(k.consumptionPerKmQuantiles.q05, 4),
          q50: round(k.consumptionPerKmQuantiles.q50, 4),
          q95: round(k.consumptionPerKmQuantiles.q95, 4),
        };
      }
      row.yearlyTotal_kWh = round(d.yearlyTotal, 1);
      row.yearlyDrivetrain_kWh = round(d.yearlyDrv, 1);
      row.yearlyAuxiliary_kWh = round(d.yearlyAux, 1);
      if (d.yearlyQ05 != null || d.yearlyQ50 != null || d.yearlyQ95 != null) {
        row.yearlyUncertainty = {
          q05: round(d.yearlyQ05, 1),
          q50: round(d.yearlyQ50, 1),
          q95: round(d.yearlyQ95, 1),
        };
      }
      return row;
    });

    const contribs = computeContributions(effState.enriched);
    if (contribs?.length) {
      eff.annualContributions = contribs.map((c) => ({
        label: c.label,
        temperature_C: c.temperature,
        daysPerYear: c.occurrences,
        yearlyDrivetrain_kWh: round(c.yearlyDrv, 1),
        yearlyAuxiliary_kWh: round(c.yearlyAux, 1),
        yearlyTotal_kWh: round(c.yearlyTotal, 1),
        shareOfYearlyEnergy_pct: round(c.share, 2),
      }));
    }
  }

  /* ── Costs ──────────────────────────────────────────────────── */
  let costs = null;
  if (costState.status === "done" && costState.costsData) {
    const cd = costState.costsData;
    const yearlyKm = toFiniteNumber(cd.yearlyDistanceKm);

    const hasDH = (cd.electric.dieselHeatingFuelOpex ?? 0) > 0
      || (cd.electric.dieselHeatingMaintOpex ?? 0) > 0;

    const assumptions = {
      energyPrice_CHFPerKwh: round(cd.assumptions.energyPricePerKwh, 3),
      fuelPrice_CHFPerL: round(cd.assumptions.fuelPricePerL, 3),
      electricMaintenanceCost_CHFPerKm: round(cd.assumptions.electricMaintPerKm, 4),
      dieselComparator_efficiency_LPerKm: round(cd.assumptions.dieselEfficiencyLPerKm, 4),
      dieselComparator_maintenanceCost_CHFPerKm: round(cd.assumptions.dieselMaintPerKm, 4),
    };
    if (hasDH) {
      assumptions.dieselHeatingMaintenanceFactor = round(cd.assumptions.dieselHeatingMaintenanceFactor, 4);
      assumptions.yearlyDieselHeating_liters = round(cd.assumptions.yearlyDieselHeatingLiters, 1);
      assumptions.yearlyDieselHeatingFuel_kWh = round(cd.assumptions.yearlyDieselHeatingFuelKwh, 1);
    }

    const electricBranch = {
      energyOPEX_CHF: round(cd.electric.energyOpex, 0),
      maintenanceOPEX_CHF: round(cd.electric.maintOpex, 0),
    };
    if (hasDH) {
      electricBranch.dieselHeatingFuelOPEX_CHF = round(cd.electric.dieselHeatingFuelOpex, 0);
      electricBranch.dieselHeatingMaintOPEX_CHF = round(cd.electric.dieselHeatingMaintOpex, 0);
    }
    Object.assign(electricBranch, {
      totalOPEX_CHF: round(cd.electric.totalOpex, 0),
      busCost_CHF: round(cd.electric.busCost, 0),
      batteryPacks: cd.electric.packs,
      batteryPackCost_CHF: round(cd.electric.packCost, 0),
      totalBatteryCost_CHF: round(cd.electric.totalBatteryCost, 0),
      CAPEX_CHF: round(cd.electric.capex, 0),
      CAPEXwithReplacements_CHF: round(cd.electric.capexPv, 0),
      annualizedCAPEX_CHF: round(cd.electric.capexAnnual, 0),
      totalAnnual_CHF: round(cd.electric.totalAnnual, 0),
      costPerKm_CHF: yearlyKm > 0 ? round(cd.electric.totalAnnual / yearlyKm, 4) : null,
      busLifetime_years: cd.electric.busLifetime,
      batteryLifetime_years: cd.electric.batteryLifetime,
      batteryReplacementYears: cd.electric.batteryReplacementYears ?? [],
    });

    costs = {
      assumptions,
      electric: electricBranch,
      diesel: {
        fuelOPEX_CHF: round(cd.diesel.fuelOpex, 0),
        maintenanceOPEX_CHF: round(cd.diesel.maintOpex, 0),
        totalOPEX_CHF: round(cd.diesel.totalOpex, 0),
        CAPEX_CHF: round(cd.diesel.capex, 0),
        annualizedCAPEX_CHF: round(cd.diesel.capexAnnual, 0),
        totalAnnual_CHF: round(cd.diesel.totalAnnual, 0),
        costPerKm_CHF: yearlyKm > 0 ? round(cd.diesel.totalAnnual / yearlyKm, 4) : null,
      },
      annualSaving_CHF: round(cd.annualSaving, 0),
      breakEvenYear: cd.breakEvenYear != null ? round(cd.breakEvenYear, 1) : null,
      yearlyEnergy_kWh: round(cd.yearlyEnergyKwh, 1),
      yearlyDistance_km: round(cd.yearlyDistanceKm, 1),
      scenarioCosts: cd.scenarioCosts?.map((sc) => {
        const row = {
          label: sc.label,
          temperature_C: sc.temperature,
          daysPerYear: sc.occurrences,
          dailyEnergy_kWh: round(sc.dailyEnergy, 1),
          dailyDistance_km: round(sc.dailyDistance, 1),
          energyPerKm_kWhPerKm: round(sc.energyPerKm, 4),
          annualEnergy_kWh: round(sc.annualEnergy, 1),
          annualDistance_km: round(sc.annualDistance, 1),
          annualEnergyCost_CHF: round(sc.annualEnergyCost, 0),
        };
        if (sc.annualElectricMaintCost != null) {
          row.annualElectricMaintCost_CHF = round(sc.annualElectricMaintCost, 0);
        }
        if (hasDH) {
          row.dailyDieselHeating_liters = round(sc.dailyDieselHeatingLiters, 2);
          row.annualDieselHeating_liters = round(sc.annualDieselHeatingLiters, 1);
          row.annualDieselHeatingFuelCost_CHF = round(sc.annualDieselHeatingFuelCost, 0);
          row.annualDieselHeatingMaintCost_CHF = round(sc.annualDieselHeatingMaintCost, 0);
        }
        return row;
      }) ?? [],
      projectedCostTrend: cd.yearly?.map((pt) => ({
        year: pt.year,
        electric_CHF: round(pt.electric, 0),
        diesel_CHF: round(pt.diesel, 0),
      })) ?? [],
    };
  }

  /* ── Emissions ──────────────────────────────────────────────── */
  let emissions = null;
  if (emissionsState.status === "done" && emissionsState.electricYearly) {
    const elY = emissionsState.electricYearly;
    const diY = emissionsState.dieselYearly;
    const elOnlyY = emissionsState.electricOnlyYearly;
    const dhOnlyY = emissionsState.dieselHeatingYearly;
    const emIsDH = !!emissionsState.isDieselHeating;
    const yearlyKm = toFiniteNumber(emissionsState.yearlyDistanceKm);

    const buildPhaseMap = (ind, divisor, decimals) => {
      if (!ind) return null;
      const phases = {};
      for (const phase of LCA_PHASES) {
        const val = toFiniteNumber(ind[phase.key]);
        if (val != null) phases[t(phase.i18n)] = round(val / divisor, decimals + 1);
      }
      return Object.keys(phases).length ? phases : null;
    };

    const indicators = {};
    for (const row of ENV_TABLE_ROWS) {
      const elInd = elY[row.key];
      const diInd = diY?.[row.key];
      if (!elInd?.total) continue;

      const div = inferUnitDivisor(elInd, row.divisor);
      const ebusTotal = round(toFiniteNumber(elInd.total) / div, row.decimals);
      const ebusPhases = buildPhaseMap(elInd, div, row.decimals);
      const entry = {
        unit: row.unit,
        ebus: { total: ebusTotal, phases: ebusPhases },
        electric: { total: ebusTotal, phases: ebusPhases },
        diesel: diInd?.total != null
          ? { total: round(toFiniteNumber(diInd.total) / div, row.decimals), phases: buildPhaseMap(diInd, div, row.decimals) }
          : null,
      };

      if (emIsDH && elOnlyY && dhOnlyY) {
        const elOnlyInd = elOnlyY[row.key];
        const dhOnlyInd = dhOnlyY[row.key];
        entry.ebus.electric = {
          total: round((toFiniteNumber(elOnlyInd?.total) ?? 0) / div, row.decimals),
          phases: buildPhaseMap(elOnlyInd, div, row.decimals),
        };
        entry.ebus.dieselHeating = {
          total: round((toFiniteNumber(dhOnlyInd?.total) ?? 0) / div, row.decimals),
          phases: buildPhaseMap(dhOnlyInd, div, row.decimals),
        };
      }

      if (entry.diesel?.total != null) {
        const diff = entry.diesel.total - ebusTotal;
        entry.reduction_pct = round((diff / Math.abs(entry.diesel.total)) * 100, 1);
      }
      indicators[row.label] = entry;
    }

    emissions = {
      yearlyDistance_km: round(yearlyKm, 1),
      auxiliaryHeatingType: emIsDH ? "diesel" : "default",
      indicators,
    };

    if (emIsDH && emissionsState.emissionsMetadata) {
      const m = emissionsState.emissionsMetadata;
      emissions.dieselHeatingMetadata = {
        yearlyDieselHeating_liters: round(m.yearlyDhLiters, 1),
        yearlyDieselHeatingFuel_kWh: round(m.yearlyDhFuelKwh, 1),
        yearlyElectric_kWh: round(m.yearlyElectricKwh, 1),
        electricConsumption_kWhPer100km: round(m.electricConsumptionKwhPer100km, 1),
        electricEnergyStored_kWh: round(m.electricEnergyStoredKwh, 0),
        batteryLifetimeReplacements: m.batteryLifetimeReplacements,
        optimizedPacks: m.optimizedPacks,
        busLength_m: round(m.busLengthM, 2),
        busModelName: m.busModelName ?? null,
        lcaSize: m.lcaSize,
        electricLcaVehicle: {
          id: m.electricLcaVehicleId ?? null,
          name: m.electricLcaVehicleName ?? null,
          powertrain: m.electricLcaVehiclePowertrain ?? null,
        },
        dieselHeatingLifecyclePhases: Array.isArray(m.dieselHeatingLifecyclePhases)
          ? [...m.dieselHeatingLifecyclePhases]
          : null,
        electricInputsApplied: {
          yearlyElectric_kWh: round(m.yearlyElectricKwh, 1),
          electricConsumption_kWhPer100km: round(m.electricConsumptionKwhPer100km, 1),
          optimizedPacks: m.optimizedPacks ?? null,
          electricEnergyStored_kWh: round(m.electricEnergyStoredKwh, 0),
          batteryLifetimeReplacements: m.batteryLifetimeReplacements ?? null,
          passengers: m.bevOverrides?.passengers ?? 1,
        },
        electricInputsAppliedNote: m.electricInputsAppliedNote,
        dieselHeatingContributionNote: m.dieselHeatingContributionNote,
        upstreamApiLimitationNote: m.upstreamApiLimitationNote,
        dhFuelFactorSource: m.dhFuelFactorSource,
      };
    }
  }

  return { header, efficiency: eff, costs, emissions };
};

const downloadJson = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ── Overview rendering ────────────────────────────────────────── */

const renderOverviewPanel = (el, features, effState, costState, emissionsState, busModelData = {}) => {
  if (!el) return;

  const cfg = features.config ?? {};
  const meta = features.meta ?? {};
  const results = features.results ?? {};
  const yearlyTotals = results.yearlyTotals ?? {};
  const scenarioResults = results.scenarioResults ?? [];
  const efficiencySummary = effState?.summary ?? null;
  const columns = [];

  /* ── Column 1: Inputs ──────────────────────────────────────── */
  {
    const shiftNames = meta.shiftNames ?? [];
    const sizingTemp = toFiniteNumber(meta.sizingTemp);
    const simulationLink = results.baseOptimizationRunId
      ? `<a class="ya-overview-link ya-mono" href="#simulation-results" data-action="open-simulation-results" data-run-id="${textContent(text(results.baseOptimizationRunId))}">${textContent(text(results.baseOptimizationRunId).slice(0, 8))}...</a>`
      : "—";
    const body = [
      overviewRowHtml(t("yearly_analysis.base_evaluation"), simulationLink, true),
      overviewRowHtml(t("yearly_analysis.col_shifts"), buildShiftLink(features), true),
      overviewRowHtml(t("yearly_analysis.col_mode"), modeLabel(cfg.mode, meta.modeLabel)),
      overviewRowHtml(t("yearly_analysis.occupancy"), cfg.occupancy_percent != null ? `${cfg.occupancy_percent}%` : "—"),
      overviewRowHtml(t("yearly_analysis.heating"), heatingLabel(cfg.auxiliary_heating_type)),
      overviewRowHtml(t("yearly_analysis.soc_range"), `${((cfg.min_soc ?? 0) * 100).toFixed(0)}–${((cfg.max_soc ?? 1) * 100).toFixed(0)}%`),
      overviewRowHtml(t("yearly_analysis.battery"), formatBatterySummary(busModelData, results.optimizedPacks)),
      overviewRowHtml(t("yearly_analysis.sizing_temperature"), sizingTemp != null ? `${formatFixed(sizingTemp, 1)} °C` : "—"),
    ].join("");

    columns.push(overviewColShell("🧩", t("yearly_analysis.inputs"), body));
  }

  /* ── Column 2: Efficiency ──────────────────────────────────── */
  {
    const feasible = results.baseFeasible;
    const feasBadge = feasible === true ? "ya-overview-badge--ok"
      : feasible === false ? "ya-overview-badge--err" : "ya-overview-badge--neutral";
    const feasLabel = feasible === true ? t("simulation.feasibility_feasible") : feasible === false ? t("simulation.feasibility_infeasible") : "—";

    const yearlyEnergy = toFiniteNumber(efficiencySummary?.energy ?? yearlyTotals.totalEnergyKwh);
    const yearlyDist = toFiniteNumber(efficiencySummary?.dist ?? yearlyTotals.distanceKm);
    const avgEpk = toFiniteNumber(efficiencySummary?.avgEfficiency)
      ?? (yearlyEnergy != null && yearlyDist > 0 ? yearlyEnergy / yearlyDist : null);

    const valid = scenarioResults.filter((sr) => !sr.error && sr.kpis?.energyPerKm != null);
    const epkValues = valid.map((sr) => sr.kpis.energyPerKm);
    const bestEpk = toFiniteNumber(efficiencySummary?.minEfficiency)
      ?? (epkValues.length ? Math.min(...epkValues) : null);
    const worstEpk = toFiniteNumber(efficiencySummary?.maxEfficiency)
      ?? (epkValues.length ? Math.max(...epkValues) : null);

    const body = [
      overviewRowHtml(t("yearly_analysis.base_feasibility"), `<span class="ya-overview-badge ${feasBadge}">${textContent(feasLabel)}</span>`, true),
      overviewRowHtml(t("yearly_analysis.yearly_energy"), yearlyEnergy != null ? `${formatInt(yearlyEnergy)} kWh` : "—"),
      overviewRowHtml(t("yearly_analysis.yearly_simulated_distance"), yearlyDist != null ? `${formatInt(yearlyDist)} km` : "—"),
      overviewRowHtml(t("yearly_analysis.avg_consumption_per_km"), avgEpk != null ? `${formatFixed(avgEpk, 3)} kWh/km` : "—"),
      overviewRowHtml(t("yearly_analysis.best_scenario_per_km"), bestEpk != null ? `${formatFixed(bestEpk, 3)} kWh/km` : "—"),
      overviewRowHtml(t("yearly_analysis.worst_scenario_per_km"), worstEpk != null ? `${formatFixed(worstEpk, 3)} kWh/km` : "—"),
    ].join("");

    columns.push(overviewColShell("⚡", t("simulation.tab_efficiency"), body));
  }

  /* ── Column 3: Costs ───────────────────────────────────────── */
  {
    if (costState.status === "error") {
      columns.push(overviewColShell("💰", t("simulation.tab_costs"), `<p class="ya-overview-col__msg">${textContent(costState.error || t("yearly_analysis.unable_compute_costs"))}</p>`));
    } else if (costState.costsData) {
      const cd = costState.costsData;
      const yearlyKm = toFiniteNumber(cd.yearlyDistanceKm);
      const electricPerKm = yearlyKm > 0 ? cd.electric.totalAnnual / yearlyKm : null;
      const dieselPerKm = yearlyKm > 0 ? cd.diesel.totalAnnual / yearlyKm : null;
      const toneCls = (val) => val > 0 ? "ya-overview-highlight--positive" : val < 0 ? "ya-overview-highlight--negative" : "ya-overview-highlight--neutral";

      const body = [
        overviewRowHtml(t("yearly_analysis.energy_opex_electric"), `CHF ${formatCHF(Math.round(cd.electric.energyOpex))}`),
        overviewRowHtml(t("yearly_analysis.maintenance_opex_electric"), `CHF ${formatCHF(Math.round(cd.electric.maintOpex))}`),
        overviewRowHtml(t("yearly_analysis.fuel_opex_diesel"), `CHF ${formatCHF(Math.round(cd.diesel.fuelOpex))}`),
        overviewRowHtml(t("yearly_analysis.maintenance_opex_diesel"), `CHF ${formatCHF(Math.round(cd.diesel.maintOpex))}`),
        overviewRowHtml(t("yearly_analysis.total_annual_electric"), `CHF ${formatCHF(Math.round(cd.electric.totalAnnual))}`),
        overviewRowHtml(t("yearly_analysis.total_annual_diesel"), `CHF ${formatCHF(Math.round(cd.diesel.totalAnnual))}`),
        overviewRowHtml(t("yearly_analysis.cost_per_km_electric"), electricPerKm != null ? `${formatFixed(electricPerKm, 3)} CHF` : "—"),
        overviewRowHtml(t("yearly_analysis.cost_per_km_diesel"), dieselPerKm != null ? `${formatFixed(dieselPerKm, 3)} CHF` : "—"),
        overviewRowHtml(t("simulation.costs_kpi_annual_saving"), `<span class="ya-overview-highlight ${toneCls(cd.annualSaving)}">CHF ${formatCHF(Math.round(cd.annualSaving))}</span>`, true),
      ].join("");

      columns.push(overviewColShell("💰", t("simulation.tab_costs"), body));
    } else {
      columns.push(overviewColShell("💰", t("simulation.tab_costs"), `<p class="ya-overview-col__msg">${textContent(t("simulation.costs_empty"))}</p>`));
    }
  }

  /* ── Column 4: Emissions ───────────────────────────────────── */
  {
    if (emissionsState.status === "loading" || emissionsState.status === "idle") {
      columns.push(overviewColShell("🌿", t("simulation.tab_emissions"), `<p class="ya-overview-col__msg">${textContent(t("common.loading"))}</p>`));
    } else if (emissionsState.status === "error") {
      columns.push(overviewColShell("🌿", t("simulation.tab_emissions"), `<p class="ya-overview-col__msg">${textContent(emissionsState.error || t("simulation.emissions_error"))}</p>`));
    } else if (emissionsState.status === "done" && emissionsState.electricYearly) {
      const electricY = emissionsState.electricYearly;
      const dieselY = emissionsState.dieselYearly;
      const hasDiesel = !!dieselY;

      const emissionDefs = [
        { key: "gwp100a", i18n: "simulation.env_kpi_co2", label: "CO₂", unit: "t/yr", divisor: 1e6 },
        { key: "nox", i18n: "simulation.env_kpi_nox", label: "NOx", unit: "kg/yr", divisor: 1e6 },
        { key: "pm10", i18n: "simulation.env_kpi_pm10", label: "PM₁₀", unit: "kg/yr", divisor: 1e6 },
      ];

      const body = emissionDefs
        .filter((def) => electricY[def.key]?.total != null)
        .map((def) => {
          const eRaw = toFiniteNumber(electricY[def.key]?.total) ?? 0;
          const dRaw = hasDiesel ? (toFiniteNumber(dieselY[def.key]?.total) ?? 0) : null;
          const eVal = eRaw / def.divisor;
          const pctChange = dRaw != null && dRaw !== 0 ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100 : null;
          const pctStr = pctChange != null ? `${pctChange > 0 ? "↓" : "↑"} ${formatFixed(Math.abs(pctChange), 0)}%` : "";
          const toneCls = pctChange != null && pctChange > 0 ? "ya-overview-highlight--positive"
            : pctChange != null && pctChange < 0 ? "ya-overview-highlight--negative"
              : "ya-overview-highlight--neutral";

          const valueStr = pctStr
            ? `${formatFixed(eVal, 1)} <span class="ya-overview-highlight ${toneCls}">${textContent(pctStr)}</span>`
            : `${formatFixed(eVal, 1)}`;

          return overviewRowHtml(`${t(def.i18n)} (${def.unit})`, valueStr, true);
        })
        .join("");

      columns.push(overviewColShell("🌿", t("simulation.tab_emissions"), body));
    } else {
      columns.push(overviewColShell("🌿", t("simulation.tab_emissions"), `<p class="ya-overview-col__msg">${textContent(t("simulation.emissions_no_data"))}</p>`));
    }
  }

  el.innerHTML = `<div class="ya-overview-grid">${columns.join("")}</div>`;

  el.querySelectorAll('[data-action="open-simulation-results"]').forEach((simLink) => {
    simLink.addEventListener("click", (event) => {
      event.preventDefault();
      const runId = text(simLink.dataset.runId).trim();
      if (!runId) return;
      openPartialInNewTab("simulation-results", { runId });
    });
  });

  el.querySelectorAll('[data-action="open-partial"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const partial = text(link.dataset.partial).trim();
      if (!partial) return;
      const payload = {};
      if (link.dataset.shiftId) payload.shiftId = text(link.dataset.shiftId).trim();
      openPartialInNewTab(partial, payload);
    });
  });
};

/* ── Bus model data helpers ────────────────────────────────────── */

export const parseBusModelSpecs = (busModel) => {
  if (!busModel) return {};
  let specs = busModel.specs;
  if (typeof specs === "string") {
    try { specs = JSON.parse(specs); } catch { specs = {}; }
  }
  if (!specs || typeof specs !== "object") specs = {};

  return {
    bus_length_m: toFiniteNumber(specs.bus_length_m ?? busModel.bus_length_m),
    battery_pack_size_kwh: toFiniteNumber(specs.battery_pack_size_kwh ?? busModel.battery_pack_size_kwh),
    battery_pack_cost: toFiniteNumber(specs.battery_pack_cost_chf ?? specs.battery_pack_cost ?? busModel.battery_pack_cost),
    cost: toFiniteNumber(specs.cost ?? busModel.cost),
    bus_lifetime: toFiniteNumber(specs.bus_lifetime ?? specs.bus_lifetime_years ?? busModel.bus_lifetime_years),
    battery_pack_lifetime: toFiniteNumber(specs.battery_pack_lifetime ?? specs.battery_pack_lifetime_years ?? busModel.battery_pack_lifetime_years),
    name: busModel.name ?? "",
    model: busModel.model ?? "",
  };
};

/* ── Main initializer ──────────────────────────────────────────── */

export const initializeYearlyAnalysisResults = async (root = document, options = {}) => {
  const section = root.querySelector("section.yearly-analysis-results");
  if (!section) return null;

  const cleanups = [];
  const pageTitleEl = section.querySelector('[data-role="page-title"]');
  const analysisNameEl = section.querySelector('[data-role="ya-analysis-name"]');
  const feedbackEl = section.querySelector('[data-role="feedback"]');
  const overviewPanel = section.querySelector('[data-role="overview-panel"]');
  const emissionsContent = section.querySelector('[data-role="emissions-content"]');
  const configOverlay = section.querySelector('[data-role="ya-config-overlay"]');
  const configContent = section.querySelector('[data-role="ya-configuration-content"]');

  const analysisId = options.analysisId ?? "";
  if (!analysisId) {
    if (feedbackEl) { feedbackEl.textContent = t("yearly_analysis.no_analysis_id"); feedbackEl.hidden = false; }
    return null;
  }

  let analysis;
  try {
    analysis = await fetchYearlyAnalysis(analysisId);
  } catch (err) {
    if (feedbackEl) { feedbackEl.textContent = err?.message ?? t("yearly_analysis.failed_load_analysis"); feedbackEl.hidden = false; }
    return null;
  }

  if (!analysis) {
    if (feedbackEl) { feedbackEl.textContent = t("yearly_analysis.analysis_not_found"); feedbackEl.hidden = false; }
    return null;
  }

  const analysisName = text(analysis.name).trim();
  if (pageTitleEl) pageTitleEl.textContent = t("yearly_analysis.results_title");
  if (analysisNameEl) analysisNameEl.textContent = analysisName || "—";

  const features = analysis.features ?? {};
  const scenarioResults = features.results?.scenarioResults ?? [];
  const yearlyTotals = features.results?.yearlyTotals ?? {};
  const config = features.config ?? {};

  /* ── State objects for async data ────────────────────────── */
  const costState = { costsData: null, error: null, status: "idle" };
  let backendCostsRaw = null;
  const costOverrides = {
    fuelCostPerL: null, energyPricePerKwh: null, interestRate: null,
    dieselEfficiency: null, dieselMaintCost: null, electricMaintCost: null,
    dieselCapex: null, yearlyDistanceKm: null,
  };
  const emissionsOverrides = { yearlyDistanceKm: null };
  const emissionsState = {
    status: "idle", electricYearly: null, electricOnlyYearly: null,
    dieselHeatingYearly: null, dieselYearly: null, yearlyImpact: null,
    yearlyDistanceKm: null, structured: null, isDieselHeating: false,
    emissionsMetadata: null, error: null,
  };
  const renderedTabs = new Set();

  /* ── Tab switching ───────────────────────────────────────── */
  const activateTab = (tabKey) => {
    section.querySelectorAll(".ya-tab").forEach((btn) => {
      const isActive = btn.dataset.tab === tabKey;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });
    section.querySelectorAll(".ya-tab-panel").forEach((panel) => {
      const isActive = panel.dataset.panel === tabKey;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });

    if (!renderedTabs.has(tabKey)) {
      renderedTabs.add(tabKey);
      TAB_RENDERERS[tabKey]?.();
    }
  };

  /* ── Download handler (captures live state) ──────────────── */
  const handleDownload = () => {
    const payload = buildExportPayload(
      features,
      effState,
      costState,
      getDisplayedEmissionsState(),
      busModelData,
      analysisId,
    );
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadJson(payload, `yearly-analysis-${timestamp}.json`);
  };
  if (configContent) configContent.innerHTML = renderConfig(features);

  const openConfiguration = () => {
    if (!configOverlay) return;
    configOverlay.hidden = false;
    configOverlay.querySelector('[data-action="close-configuration"]')?.focus();
  };
  const closeConfiguration = () => {
    if (configOverlay) configOverlay.hidden = true;
  };

  section.querySelectorAll('[data-action="view-configuration"]').forEach((btn) => {
    btn.addEventListener("click", openConfiguration);
    cleanups.push(() => btn.removeEventListener("click", openConfiguration));
  });
  section.querySelectorAll('[data-action="close-configuration"]').forEach((btn) => {
    btn.addEventListener("click", closeConfiguration);
    cleanups.push(() => btn.removeEventListener("click", closeConfiguration));
  });
  section.querySelectorAll('[data-action="download-json"]').forEach((btn) => {
    btn.addEventListener("click", handleDownload);
    cleanups.push(() => btn.removeEventListener("click", handleDownload));
  });

  const overlayClickHandler = (event) => {
    if (event.target === configOverlay) closeConfiguration();
  };
  configOverlay?.addEventListener("click", overlayClickHandler);
  if (configOverlay) cleanups.push(() => configOverlay.removeEventListener("click", overlayClickHandler));

  const overlayKeyHandler = (event) => {
    if (event.key === "Escape" && configOverlay && !configOverlay.hidden) closeConfiguration();
  };
  document.addEventListener("keydown", overlayKeyHandler);
  cleanups.push(() => document.removeEventListener("keydown", overlayKeyHandler));

  /* ── Efficiency state (mutable — recomputed after quantile backfill) */
  const effState = { enriched: null, summary: null, effByTemp: null, annualContrib: null, annualContributionMode: "yearly" };

  const recomputeEfficiency = (scenarios) => {
    effState.enriched = enrichAllScenarios(scenarios);
    effState.summary = computeYearlySummary(effState.enriched, yearlyTotals);
    effState.effByTemp = buildEfficiencyByTemp(effState.enriched);
    effState.annualContrib = buildAnnualContribution(effState.enriched);
  };
  recomputeEfficiency(scenarioResults);

  const detailContent = {
    critical: section.querySelector('[data-role="ya-detail-critical"]'),
    scenarios: section.querySelector('[data-role="ya-detail-scenarios"]'),
    battery: section.querySelector('[data-role="ya-detail-battery"]'),
    yearlySummary: section.querySelector('[data-role="ya-detail-yearly-summary"]'),
    yearlyUncertainty: section.querySelector('[data-role="ya-detail-yearly-uncertainty"]'),
  };

  const renderYearlyDetails = () => {
    if (detailContent.critical) {
      detailContent.critical.innerHTML = renderCriticalUncertaintyScenarios(effState.annualContrib);
    }
    if (detailContent.scenarios) {
      detailContent.scenarios.innerHTML = renderScenarioTable(effState.enriched);
    }
    if (detailContent.battery) {
      detailContent.battery.innerHTML = renderBatterySizing(features, analysis.optimization_run_id);
    }
    if (detailContent.yearlySummary) {
      detailContent.yearlySummary.innerHTML = renderYearlySummary(effState.summary);
    }
    if (detailContent.yearlyUncertainty) {
      detailContent.yearlyUncertainty.innerHTML = renderYearlyUncertaintySummary(effState.annualContrib);
    }
  };

  const effChart1El = section.querySelector('[data-role="ya-eff-chart-1"]');
  const effChart1Legend = section.querySelector('[data-role="ya-eff-chart-1-legend"]');
  const effChart2El = section.querySelector('[data-role="ya-eff-chart-2"]');
  const effChart2Legend = section.querySelector('[data-role="ya-eff-chart-2-legend"]');
  const effChart2UnitToggle = section.querySelector('[data-role="ya-eff-chart-2-unit-toggle"]');
  const effChart1NoteEl = section.querySelector('[data-role="ya-eff-chart-1-note"]');
  const effChart2NoteEl = section.querySelector('[data-role="ya-eff-chart-2-note"]');

  const updateAnnualContributionToggle = () => {
    if (!effChart2UnitToggle) return;
    effChart2UnitToggle.querySelectorAll("[data-unit-mode]").forEach((btn) => {
      const isActive = btn.dataset.unitMode === effState.annualContributionMode;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  };

  const renderAnnualContribution = () => {
    updateAnnualContributionToggle();
    try {
      renderAnnualContributionChart(effChart2El, effChart2Legend, effState.annualContrib, effState.annualContributionMode);
    } catch (e) {
      console.error("[YA-Eff] Chart 2 error:", e);
    }
  };

  const renderEfficiency = () => {
    renderYearlyDetails();
    if (effChart1NoteEl) effChart1NoteEl.textContent = quantileHelpText();
    if (effChart2NoteEl) effChart2NoteEl.textContent = annualContributionHelpText();

    try { renderEfficiencyByTempChart(effChart1El, effChart1Legend, effState.effByTemp); } catch (e) { console.error("[YA-Eff] Chart 1 error:", e); }
    renderAnnualContribution();
  };

  if (effChart2UnitToggle) {
    const unitToggleHandler = (event) => {
      const btn = event.target.closest("[data-unit-mode]");
      if (!btn || !effChart2UnitToggle.contains(btn)) return;
      const nextMode = normalizeAnnualContributionMode(btn.dataset.unitMode);
      if (nextMode === effState.annualContributionMode) return;
      effState.annualContributionMode = nextMode;
      renderAnnualContribution();
    };
    effChart2UnitToggle.addEventListener("click", unitToggleHandler);
    cleanups.push(() => effChart2UnitToggle.removeEventListener("click", unitToggleHandler));
  }

  /* ── Cost computation with slider overrides ────────────── */
  const computeCosts = () => {
    try {
      const result = computeYearlyCosts(features, busModelData, costOverrides);
      if (!result) {
        costState.status = "error";
        costState.error = t("yearly_analysis.insufficient_cost_data");
      } else {
        costState.costsData = result;
        costState.status = "done";
      }
    } catch (err) {
      costState.status = "error";
      costState.error = err?.message ?? t("yearly_analysis.cost_computation_failed");
    }
  };

  const refreshCosts = () => {
    if (backendCostsRaw) {
      try {
        const yearlyDistKm = toFiniteNumber(yearlyTotals.distanceKm);
        const yearlyEngKwh = toFiniteNumber(yearlyTotals.totalEnergyKwh);
        const mapped = mapBackendCostsToLocal(backendCostsRaw, yearlyDistKm, yearlyEngKwh, busModelData, {
          optimizedPacks: features.results?.optimizedPacks,
          overrides: costOverrides,
        });
        costState.costsData = mapped;
        costState.status = "done";
      } catch (err) {
        costState.status = "error";
        costState.error = err?.message ?? t("yearly_analysis.cost_recomputation_failed");
      }
    } else {
      computeCosts();
    }
    if (costState.costsData) {
      refreshCostsPanelElements(section, costState.costsData);
    }
    if (renderedTabs.has("overview")) {
      renderOverviewPanel(
        overviewPanel,
        features,
        effState,
        costState,
        getDisplayedEmissionsState(),
        busModelData,
      );
    }
  };

  let costRefreshTimer = null;
  const scheduleCostRefresh = () => {
    if (costRefreshTimer) clearTimeout(costRefreshTimer);
    costRefreshTimer = setTimeout(refreshCosts, COST_VARIABLE_DEBOUNCE_MS);
  };

  const getBaseEmissionsYearlyDistanceKm = () =>
    toFiniteNumber(yearlyTotals.distanceKm) ??
    toFiniteNumber(emissionsState.yearlyDistanceKm) ??
    toFiniteNumber(emissionsState.yearlyImpact?.yearly_distance_km);

  const getSelectedEmissionsYearlyDistanceKm = () =>
    toFiniteNumber(emissionsOverrides.yearlyDistanceKm) ??
    getBaseEmissionsYearlyDistanceKm();

  const getDisplayedEmissionsState = () =>
    deriveScaledEmissionsState(
      emissionsState,
      getBaseEmissionsYearlyDistanceKm(),
      getSelectedEmissionsYearlyDistanceKm(),
    );

  /* ── Tab renderers (lazy) ────────────────────────────────── */
  const TAB_RENDERERS = {
    overview: () => renderOverviewPanel(
      overviewPanel,
      features,
      effState,
      costState,
      getDisplayedEmissionsState(),
      busModelData,
    ),
    efficiency: () => renderEfficiency(),
    costs: () => {
      if (costState.status === "error") return;
      refreshCostsPanelElements(section, costState.costsData);
    },
    emissions: () => renderEmissionsPanel(emissionsContent, getDisplayedEmissionsState()),
  };

  const refreshDerivedEmissionsViews = () => {
    if (renderedTabs.has("emissions")) TAB_RENDERERS.emissions();
    if (renderedTabs.has("overview")) TAB_RENDERERS.overview();
  };

  /* ── Tab click handler ───────────────────────────────────── */
  const tabClickHandler = (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    activateTab(tab.dataset.tab);
  };
  const tabBar = section.querySelector(".ya-tabs");
  if (tabBar) {
    tabBar.addEventListener("click", tabClickHandler);
    cleanups.push(() => tabBar.removeEventListener("click", tabClickHandler));
  }

  /* ── Back/close handler ──────────────────────────────────── */
  const backHandler = () => triggerPartialLoad("yearly-analysis-runs");
  section.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener("click", backHandler);
    cleanups.push(() => btn.removeEventListener("click", backHandler));
  });

  /* ── Load bus model and optimization run ─────────────────── */
  let busModelData = {};
  let optimizationRun = null;

  const busModelId = text(config.bus_model_id ?? "");
  const optRunId = text(features.results?.baseOptimizationRunId ?? analysis.optimization_run_id ?? "");

  const loadDeps = async () => {
    const promises = [];
    if (busModelId) {
      promises.push(
        fetchBusModelById(busModelId)
          .then((bm) => { busModelData = parseBusModelSpecs(bm); })
          .catch((err) => console.warn("[ya-results] Bus model load failed:", err))
      );
    }
    if (optRunId) {
      promises.push(
        fetchOptimizationRun(optRunId)
          .then((run) => { optimizationRun = run; })
          .catch((err) => console.warn("[ya-results] Optimization run load failed:", err))
      );
    }
    await Promise.all(promises);
  };

  /* ── Wire cost variable sliders ─────────────────────────── */
  const wireSliders = () => {
    const busLengthM = toFiniteNumber(busModelData?.bus_length_m);
    const busLengthKey = busLengthM != null ? (busLengthM <= 10 ? 9 : busLengthM <= 15 ? 12 : 18) : 12;
    const busDefaults = getBusParameterDefaults(busLengthKey);

    const q = (role) => section.querySelector(`[data-role="${role}"]`);

    const fuelInput = q("ya-var-fuel-cost");
    const fuelValueEl = q("ya-var-fuel-cost-value");
    const fuelReset = q("ya-var-fuel-cost-reset");

    const dieselMaintInput = q("ya-var-diesel-maint");
    const dieselMaintValueEl = q("ya-var-diesel-maint-value");
    const dieselMaintReset = q("ya-var-diesel-maint-reset");

    const energyInput = q("ya-var-energy-price");
    const energyValueEl = q("ya-var-energy-price-value");
    const energyReset = q("ya-var-energy-price-reset");

    const elecMaintInput = q("ya-var-elec-maint");
    const elecMaintValueEl = q("ya-var-elec-maint-value");
    const elecMaintReset = q("ya-var-elec-maint-reset");

    const interestInput = q("ya-var-interest");
    const interestValueEl = q("ya-var-interest-value");
    const interestReset = q("ya-var-interest-reset");

    const dieselEffInput = q("ya-var-diesel-eff");
    const dieselEffValueEl = q("ya-var-diesel-eff-value");
    const dieselEffReset = q("ya-var-diesel-eff-reset");

    const dieselCapexInput = q("ya-var-diesel-capex");
    const dieselCapexValueEl = q("ya-var-diesel-capex-value");
    const dieselCapexReset = q("ya-var-diesel-capex-reset");

    const yearlyDistanceInput = q("ya-var-yearly-distance");
    const yearlyDistanceValueEl = q("ya-var-yearly-distance-value");
    const yearlyDistanceReset = q("ya-var-yearly-distance-reset");

    applyYaSliderRange(dieselEffInput, busDefaults.diesel_consumption_l_per_km);
    applyYaSliderRange(dieselMaintInput, busDefaults.diesel_maintenance_chf_per_km);
    applyYaSliderRange(elecMaintInput, busDefaults.electric_maintenance_chf_per_km);

    const defaultFuel = DEFAULT_FUEL_COST_PER_L;
    const defaultEnergy = DEFAULT_ENERGY_PRICE_PER_KWH;
    const defaultInterest = DEFAULT_OPEX_ANNUALIZATION_RATE;
    const defaultDieselEff = busLengthM != null ? getDieselEfficiencyForLength(busLengthM) : busDefaults.diesel_consumption_l_per_km.default;
    const defaultDieselMaint = busLengthM != null ? getDieselMaintenanceCostForLength(busLengthM) : busDefaults.diesel_maintenance_chf_per_km.default;
    const defaultElecMaint = busLengthM != null ? getElectricMaintenanceCostForLength(busLengthM) : busDefaults.electric_maintenance_chf_per_km.default;
    const defaultDieselCapex = getEquivalentDieselBusCapexForLength(busLengthM) ?? 350000;
    const defaultYearlyDistance =
      toFiniteNumber(yearlyTotals.distanceKm) ?? toFiniteNumber(costState.costsData?.yearlyDistanceKm);

    applyYaSliderRange(yearlyDistanceInput, buildYearlyDistanceSliderRange(defaultYearlyDistance));

    const syncAll = () => {
      syncYaRangeInput(fuelInput, fuelValueEl, costOverrides.fuelCostPerL ?? defaultFuel, (v) => formatFixed(v, 2));
      syncYaRangeInput(energyInput, energyValueEl, costOverrides.energyPricePerKwh ?? defaultEnergy, (v) => formatFixed(v, 2));
      syncYaRangeInput(interestInput, interestValueEl, costOverrides.interestRate ?? defaultInterest, (v) => `${(v * 100).toFixed(1)}%`);
      syncYaRangeInput(dieselEffInput, dieselEffValueEl, costOverrides.dieselEfficiency ?? defaultDieselEff, (v) => formatFixed(v, 3));
      syncYaRangeInput(dieselMaintInput, dieselMaintValueEl, costOverrides.dieselMaintCost ?? defaultDieselMaint, (v) => formatFixed(v, 3));
      syncYaRangeInput(elecMaintInput, elecMaintValueEl, costOverrides.electricMaintCost ?? defaultElecMaint, (v) => formatFixed(v, 3));
      syncYaRangeInput(dieselCapexInput, dieselCapexValueEl, costOverrides.dieselCapex ?? defaultDieselCapex, (v) => `${Math.round(v / 1000)}k`);
      syncYaRangeInput(yearlyDistanceInput, yearlyDistanceValueEl, costOverrides.yearlyDistanceKm ?? defaultYearlyDistance, (v) => formatInt(v));
    };

    syncAll();

    const onSlider = (input, valueEl, overrideKey, fmt) => {
      if (!input) return;
      const handler = () => {
        const v = toFiniteNumber(input.value);
        if (v == null) return;
        costOverrides[overrideKey] = v;
        setRangeProgress(input, v);
        if (valueEl) valueEl.textContent = fmt(v);
        scheduleCostRefresh();
      };
      input.addEventListener("input", handler);
      cleanups.push(() => input.removeEventListener("input", handler));
    };

    onSlider(fuelInput, fuelValueEl, "fuelCostPerL", (v) => formatFixed(v, 2));
    onSlider(energyInput, energyValueEl, "energyPricePerKwh", (v) => formatFixed(v, 2));
    onSlider(interestInput, interestValueEl, "interestRate", (v) => `${(v * 100).toFixed(1)}%`);
    onSlider(dieselEffInput, dieselEffValueEl, "dieselEfficiency", (v) => formatFixed(v, 3));
    onSlider(dieselMaintInput, dieselMaintValueEl, "dieselMaintCost", (v) => formatFixed(v, 3));
    onSlider(elecMaintInput, elecMaintValueEl, "electricMaintCost", (v) => formatFixed(v, 3));
    onSlider(dieselCapexInput, dieselCapexValueEl, "dieselCapex", (v) => `${Math.round(v / 1000)}k`);
    onSlider(yearlyDistanceInput, yearlyDistanceValueEl, "yearlyDistanceKm", (v) => formatInt(v));

    const onReset = (btn, overrideKey, defaultVal, syncFn) => {
      if (!btn) return;
      const handler = () => {
        costOverrides[overrideKey] = null;
        syncFn();
        scheduleCostRefresh();
      };
      btn.addEventListener("click", handler);
      cleanups.push(() => btn.removeEventListener("click", handler));
    };

    onReset(fuelReset, "fuelCostPerL", defaultFuel, syncAll);
    onReset(energyReset, "energyPricePerKwh", defaultEnergy, syncAll);
    onReset(interestReset, "interestRate", defaultInterest, syncAll);
    onReset(dieselEffReset, "dieselEfficiency", defaultDieselEff, syncAll);
    onReset(dieselMaintReset, "dieselMaintCost", defaultDieselMaint, syncAll);
    onReset(elecMaintReset, "electricMaintCost", defaultElecMaint, syncAll);
    onReset(dieselCapexReset, "dieselCapex", defaultDieselCapex, syncAll);
    onReset(yearlyDistanceReset, "yearlyDistanceKm", defaultYearlyDistance, syncAll);
  };

  const wireEmissionsDistanceSlider = () => {
    const q = (role) => section.querySelector(`[data-role="${role}"]`);
    const controlsEl = q("ya-env-controls");
    const yearlyDistanceInput = q("ya-env-yearly-distance");
    const yearlyDistanceReset = q("ya-env-yearly-distance-reset");

    const syncControl = () => {
      const baseYearlyDistanceKm = getBaseEmissionsYearlyDistanceKm();
      applyYaSliderRange(
        yearlyDistanceInput,
        buildYearlyDistanceSliderRange(baseYearlyDistanceKm),
      );
      syncYaRangeInput(
        yearlyDistanceInput,
        null,
        getSelectedEmissionsYearlyDistanceKm(),
        () => "",
      );
      if (yearlyDistanceInput) yearlyDistanceInput.disabled = emissionsState.status !== "done";
      if (yearlyDistanceReset) yearlyDistanceReset.disabled = emissionsState.status !== "done";
      if (controlsEl) {
        controlsEl.hidden = emissionsState.status !== "done" || baseYearlyDistanceKm == null;
      }
    };

    syncControl();

    if (yearlyDistanceInput) {
      const handler = () => {
        const value = toFiniteNumber(yearlyDistanceInput.value);
        if (value == null) return;
        emissionsOverrides.yearlyDistanceKm = value;
        setRangeProgress(yearlyDistanceInput, value);
        refreshDerivedEmissionsViews();
      };
      yearlyDistanceInput.addEventListener("input", handler);
      cleanups.push(() => yearlyDistanceInput.removeEventListener("input", handler));
    }

    if (yearlyDistanceReset) {
      const handler = () => {
        emissionsOverrides.yearlyDistanceKm = null;
        syncControl();
        refreshDerivedEmissionsViews();
      };
      yearlyDistanceReset.addEventListener("click", handler);
      cleanups.push(() => yearlyDistanceReset.removeEventListener("click", handler));
    }

    return syncControl;
  };

  const loadEmissions = async () => {
    emissionsState.status = "loading";
    emissionsState.error = null;
    syncEmissionsDistanceControl();
    refreshActiveTab();
    try {
      const busLengthForEmissions = toFiniteNumber(busModelData?.bus_length_m);
      if (busLengthForEmissions == null) {
        throw new Error(t("yearly_analysis.bus_length_missing_emissions"));
      }
      const backendEmissionsRaw = await fetchYearlyAnalysisEmissions(analysisId, {
        bus_length_m: busLengthForEmissions,
      });
      const structured = extractStructuredBlocks(backendEmissionsRaw);
      const mapped = mapBackendEmissionsToState(
        backendEmissionsRaw,
        features,
        busModelData,
      );
      emissionsState.electricYearly = mapped.electricYearly;
      emissionsState.electricOnlyYearly = mapped.electricOnlyYearly;
      emissionsState.dieselHeatingYearly = mapped.dieselHeatingYearly;
      emissionsState.dieselYearly = mapped.dieselYearly;
      emissionsState.yearlyImpact = mapped.yearlyImpact;
      emissionsState.yearlyDistanceKm = mapped.yearlyDistanceKm;
      emissionsState.isDieselHeating = mapped.isDieselHeating;
      emissionsState.emissionsMetadata = mapped.emissionsMetadata;
      emissionsState.structured = structured;
      emissionsState.status = "done";
    } catch (err) {
      emissionsState.status = "error";
      emissionsState.error = err?.message ?? t("yearly_analysis.environmental_load_failed");
      emissionsState.electricYearly = null;
      emissionsState.electricOnlyYearly = null;
      emissionsState.dieselHeatingYearly = null;
      emissionsState.dieselYearly = null;
      emissionsState.yearlyImpact = null;
      emissionsState.yearlyDistanceKm = null;
      emissionsState.isDieselHeating = false;
      emissionsState.emissionsMetadata = null;
      emissionsState.structured = null;
    }
    syncEmissionsDistanceControl();
    refreshDerivedEmissionsViews();
  };

  const refreshActiveTab = () => {
    const activePanel = section.querySelector(".ya-tab-panel.active");
    const activeKey = activePanel?.dataset?.panel;
    if (activeKey && renderedTabs.has(activeKey)) {
      TAB_RENDERERS[activeKey]?.();
    }
  };

  /* ── Initial render and data loading ─────────────────────── */
  activateTab("overview");

  await loadDeps();

  /* Try backend yearly-analysis costs first; fall back to client-side */
  const busLengthForCosts = toFiniteNumber(busModelData?.bus_length_m);
  if (busLengthForCosts != null) {
    try {
      backendCostsRaw = await fetchYearlyAnalysisCosts(analysisId, { bus_length_m: busLengthForCosts });
      const yearlyDistKm = toFiniteNumber(yearlyTotals.distanceKm);
      const yearlyEngKwh = toFiniteNumber(yearlyTotals.totalEnergyKwh);
      const mapped = mapBackendCostsToLocal(backendCostsRaw, yearlyDistKm, yearlyEngKwh, busModelData, { optimizedPacks: features.results?.optimizedPacks, overrides: {} });
      costState.costsData = mapped;
      costState.status = "done";
    } catch (err) {
      console.warn("[ya-results] Backend costs fetch failed, using client-side:", err);
      computeCosts();
    }
  } else {
    computeCosts();
  }

  wireSliders();
  const syncEmissionsDistanceControl = wireEmissionsDistanceSlider();
  refreshActiveTab();

  /* Backfill quantiles from prediction runs (best-effort, async) */
  try {
    const backfilled = await backfillQuantiles(scenarioResults, analysisId);
    const anyNew = backfilled.some((sr, i) =>
      sr.kpis?.quantiles && !scenarioResults[i]?.kpis?.quantiles,
    );
    if (anyNew) {
      recomputeEfficiency(backfilled);
      renderYearlyDetails();
      renderedTabs.delete("efficiency");
      refreshActiveTab();
    }
  } catch (e) {
    console.warn("[YA] Quantile backfill skipped:", e);
  }

  await loadEmissions();

  return () => {
    if (costRefreshTimer) clearTimeout(costRefreshTimer);
    cleanups.forEach((h) => h());
  };
};

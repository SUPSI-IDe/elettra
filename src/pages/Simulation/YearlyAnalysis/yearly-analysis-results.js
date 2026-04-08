import "./yearly-analysis-results.css";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import { loadAnalysis, ADDITIVE_KPIS, MODE_LABELS } from "./yearly-analysis-store";

const text = (v) => (v === null || v === undefined ? "" : String(v));

const toFiniteNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatFixed = (v, d = 2) => {
  const n = toFiniteNumber(v);
  return n != null ? n.toFixed(d) : "—";
};

const formatInt = (v) => {
  const n = toFiniteNumber(v);
  return n != null ? Math.round(n).toLocaleString() : "—";
};

const feasibilityBadge = (v) => {
  if (v === true) return `<span class="ya-badge ya-badge--ok">Feasible</span>`;
  if (v === false) return `<span class="ya-badge ya-badge--err">Infeasible</span>`;
  return `<span class="ya-badge ya-badge--neutral">—</span>`;
};

// ── Rendering ────────────────────────────────────────────────────────

const renderConfig = (analysis) => {
  const cfg = analysis.config ?? {};
  const meta = analysis.meta ?? {};
  const items = [
    { label: "Shift(s)", value: (meta.shiftNames ?? []).join(", ") || "—" },
    { label: "Bus model", value: meta.busModelName ?? "—" },
    { label: "Mode", value: meta.modeLabel ?? MODE_LABELS[cfg.mode] ?? "—" },
    { label: "Occupancy", value: cfg.occupancy_percent != null ? `${cfg.occupancy_percent}%` : "—" },
    { label: "Heating", value: cfg.auxiliary_heating_type ?? "—" },
    { label: "SoC range", value: `${((cfg.min_soc ?? 0) * 100).toFixed(0)}–${((cfg.max_soc ?? 1) * 100).toFixed(0)}%` },
  ];
  return `<div class="ya-res-config">
    <h3 class="ya-res-config-title">Configuration</h3>
    <div class="ya-res-params">${items.map(({ label, value }) =>
      `<div class="ya-res-param"><span class="ya-res-param-label">${textContent(label)}</span><span>${textContent(String(value))}</span></div>`
    ).join("")}</div>
  </div>`;
};

const renderBatterySizing = (analysis) => {
  const packs = analysis.results?.optimizedPacks;
  const baseFeasible = analysis.results?.baseFeasible;
  const baseRunId = analysis.results?.baseOptimizationRunId;
  const sizingTemp = analysis.meta?.sizingTemp;
  if (packs == null) return "";

  const items = [];
  if (sizingTemp != null) items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">Sizing temperature</span><span class="ya-highlight-value">${formatFixed(sizingTemp, 1)} °C</span></div>`);
  items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">Optimized battery packs</span><span class="ya-highlight-value">${packs}</span></div>`);
  if (baseFeasible != null) items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">Base simulation feasibility</span><span>${baseFeasible ? "Feasible" : "Infeasible"}</span></div>`);
  if (baseRunId) items.push(`<div class="ya-non-additive-item"><span class="ya-non-additive-label">Base simulation</span><span class="ya-mono">${textContent(baseRunId.slice(0, 8))}…</span></div>`);

  return `<div class="ya-res-section">
    <h3 class="ya-res-section-title">Battery sizing</h3>
    <div class="ya-non-additive">${items.join("")}</div>
    <p class="ya-sizing-note">Battery size determined by the base simulation. All scenarios run as prediction-only with this fixed pack count.</p>
  </div>`;
};

const renderScenarioTable = (scenarioResults = []) => {
  const headers = ["Scenario", "Temp. (°C)", "Days/year", "Total energy (kWh)", "Drivetrain (kWh)", "Auxiliary (kWh)", "Distance (km)", "kWh/km"];
  const headerHtml = headers.map((h) => `<th>${textContent(h)}</th>`).join("");

  const rows = scenarioResults.map((sr) => {
    if (sr.error) {
      return `<tr><td>${textContent(sr.label)}</td><td>${formatFixed(sr.temperature, 1)}</td><td>${sr.occurrences}</td><td colspan="5" class="ya-scenario-error">${textContent(sr.error)}</td></tr>`;
    }
    const k = sr.kpis ?? {};
    return `<tr>
      <td>${textContent(sr.label)}</td>
      <td>${formatFixed(sr.temperature, 1)}</td>
      <td>${sr.occurrences}</td>
      <td>${formatFixed(k.totalEnergyKwh, 1)}</td>
      <td>${formatFixed(k.drivetrainEnergyKwh, 1)}</td>
      <td>${formatFixed(k.auxiliaryEnergyKwh, 1)}</td>
      <td>${formatFixed(k.distanceKm, 1)}</td>
      <td>${formatFixed(k.energyPerKm, 3)}</td>
    </tr>`;
  }).join("");

  return `<div class="ya-res-section">
    <h3 class="ya-res-section-title">Scenario results</h3>
    <div class="ya-res-table-wrap"><table class="ya-res-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
};

const renderYearlySummary = (yearlyTotals = {}) => {
  const rows = ADDITIVE_KPIS.map((kpi) => {
    const val = yearlyTotals[kpi.key];
    return `<tr><td>${textContent(kpi.yearlyLabel)}</td><td>${val != null ? `${formatInt(val)} ${kpi.yearlyUnit}` : "—"}</td></tr>`;
  }).join("");
  return `<div class="ya-res-section">
    <h3 class="ya-res-section-title">Yearly aggregated summary</h3>
    <table class="ya-yearly-table"><thead><tr><th>KPI</th><th>Yearly total</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
};

const renderNonAdditive = (scenarioResults = [], baseFeasible = null) => {
  const valid = scenarioResults.filter((sr) => !sr.error && sr.kpis);
  const epkValues = valid.map((sr) => sr.kpis.energyPerKm).filter((v) => v != null);
  const best = epkValues.length ? Math.min(...epkValues).toFixed(3) : "—";
  const worst = epkValues.length ? Math.max(...epkValues).toFixed(3) : "—";

  return `<div class="ya-res-section">
    <h3 class="ya-res-section-title">Efficiency summary</h3>
    <div class="ya-non-additive">
      <div class="ya-non-additive-item"><span class="ya-non-additive-label">Best efficiency</span><span>${textContent(best)} kWh/km</span></div>
      <div class="ya-non-additive-item"><span class="ya-non-additive-label">Worst efficiency</span><span>${textContent(worst)} kWh/km</span></div>
    </div>
  </div>`;
};

// ── Main initializer ─────────────────────────────────────────────────

export const initializeYearlyAnalysisResults = (root = document, options = {}) => {
  const section = root.querySelector("section.yearly-analysis-results");
  if (!section) return null;

  const cleanups = [];
  const content = section.querySelector('[data-role="results-content"]');
  const feedbackEl = section.querySelector('[data-role="feedback"]');

  const analysisId = options.analysisId ?? "";
  if (!analysisId) {
    if (feedbackEl) { feedbackEl.textContent = "No analysis ID provided."; feedbackEl.hidden = false; }
    return null;
  }

  const analysis = loadAnalysis(analysisId);
  if (!analysis) {
    if (feedbackEl) { feedbackEl.textContent = "Analysis not found."; feedbackEl.hidden = false; }
    return null;
  }

  const scenarioResults = analysis.results?.scenarioResults ?? [];
  const yearlyTotals = analysis.results?.yearlyTotals ?? {};

  if (content) {
    content.innerHTML = [
      renderConfig(analysis),
      renderBatterySizing(analysis),
      renderScenarioTable(scenarioResults),
      renderYearlySummary(yearlyTotals),
      renderNonAdditive(scenarioResults, analysis.results?.baseFeasible),
    ].join("");
  }

  const backHandler = () => triggerPartialLoad("yearly-analysis-runs");
  section.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener("click", backHandler);
    cleanups.push(() => btn.removeEventListener("click", backHandler));
  });

  return () => cleanups.forEach((h) => h());
};

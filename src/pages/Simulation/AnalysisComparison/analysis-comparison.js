import "./analysis-comparison.css";
import { t } from "../../../i18n";
import { textContent } from "../../../ui-helpers";
import { isAuthenticated } from "../../../api/session";
import {
  fetchAllYearlyAnalyses,
  fetchYearlyAnalysis,
  fetchYearlyAnalysisCosts,
  fetchYearlyAnalysisEmissions,
} from "../../../api/simulation";
import { fetchBusModelById } from "../../../api/bus-models";
import { adaptYearlyAnalysisEmissions } from "../../../adapters/yearly-analysis";
import {
  computeYearlyCosts,
  mapBackendCostsToLocal,
  parseBusModelSpecs,
} from "../YearlyAnalysis/yearly-analysis-results";

/* ── Numeric helpers ───────────────────────────────────────────── */

const fin = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const firstFinite = (...values) => {
  for (const value of values) {
    const numeric = fin(value);
    if (numeric != null) return numeric;
  }
  return null;
};

const text = (value) => (value === null || value === undefined ? "" : String(value));

const naLabel = () => t("analysisComparison.notAvailable");

const formatNumber = (value, decimals = 0) => {
  const num = fin(value);
  if (num == null) return naLabel();
  return num.toLocaleString("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatWithUnit = (value, decimals, unit) => {
  const num = fin(value);
  if (num == null) return naLabel();
  return unit ? `${formatNumber(num, decimals)} ${unit}` : formatNumber(num, decimals);
};

const formatSigned = (value, decimals, unit) => {
  const num = fin(value);
  if (num == null) return "—";
  const sign = num > 0 ? "+" : "";
  const body = `${sign}${num.toLocaleString("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
  return unit ? `${body} ${unit}` : body;
};

// Difference = B - A
const absDiff = (a, b) => {
  const na = fin(a);
  const nb = fin(b);
  return na != null && nb != null ? nb - na : null;
};

// ((B - A) / A) * 100, guarded against zero / null
const relDiff = (a, b) => {
  const na = fin(a);
  const nb = fin(b);
  if (na == null || nb == null || na === 0) return null;
  return ((nb - na) / na) * 100;
};

const formatRel = (value) => {
  const num = fin(value);
  if (num == null) return "—";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

const toneClass = (value) => {
  const num = fin(value);
  if (num == null || num === 0) return "ac-diff--neutral";
  return num > 0 ? "ac-diff--up" : "ac-diff--down";
};

/* ── Model extraction ──────────────────────────────────────────── */

const CO2_KEY_RE = /co2|gwp|carbon|climate/i;

const findCo2Total = (emissions) => {
  if (!emissions) return null;
  const indicators = emissions.ebus?.indicators ?? {};
  for (const [key, value] of Object.entries(indicators)) {
    if (CO2_KEY_RE.test(key)) {
      const total = firstFinite(value?.total, value);
      if (total != null) return total;
    }
  }
  return null;
};

const collectEmissionIndicators = (emissions) => {
  if (!emissions) return [];
  const ebus = emissions.ebus?.indicators ?? {};
  const diesel = emissions.dieselComparator?.indicators ?? {};
  const keys = [...new Set([...Object.keys(ebus), ...Object.keys(diesel)])];
  return keys
    .map((key) => ({
      key,
      ebus: firstFinite(ebus[key]?.total, ebus[key]),
      diesel: firstFinite(diesel[key]?.total, diesel[key]),
    }))
    .filter((row) => row.ebus != null || row.diesel != null);
};

const buildModel = (input) => {
  const analysis = input.analysis ?? {};
  const features = input.features ?? {};
  const cfg = features.config ?? {};
  const fmeta = features.meta ?? {};
  const results = features.results ?? {};
  const shiftNames = Array.isArray(fmeta.shiftNames) ? fmeta.shiftNames.filter(Boolean) : [];

  const costs = input.costs ?? null;
  const emissions = input.emissions ?? null;

  // Yearly energy totals are stored directly on the analysis features.
  const yt = results.yearlyTotals ?? {};
  const esYt = features.energy_summary?.yearly_totals ?? {};
  const totalEnergyKwh = firstFinite(yt.totalEnergyKwh, esYt.total_energy_kwh);
  const drivetrainEnergyKwh = firstFinite(yt.drivetrainEnergyKwh, esYt.drivetrain_kwh);
  const auxiliaryEnergyKwh = firstFinite(yt.auxiliaryEnergyKwh, esYt.auxiliary_kwh);
  const distanceKm = firstFinite(yt.distanceKm, esYt.distance_km);
  const energyPerKm =
    totalEnergyKwh != null && distanceKm != null && distanceKm > 0
      ? totalEnergyKwh / distanceKm
      : null;

  // `costs` is the locally-computed annualized cost model (computeYearlyCosts).
  const electricCost = costs?.electric ?? null;
  const dieselCost = costs?.diesel ?? null;
  const costDistanceKm = firstFinite(costs?.yearlyDistanceKm, distanceKm);
  const totalAnnualCost = firstFinite(electricCost?.totalAnnual);
  const energyOpex = firstFinite(electricCost?.energyOpex);
  const maintenanceOpex = firstFinite(electricCost?.maintOpex);
  const vehicleCapexAnnual = firstFinite(electricCost?.capexAnnual);
  const dieselTotalAnnual = firstFinite(dieselCost?.totalAnnual);
  const annualSaving = firstFinite(costs?.annualSaving);
  const costPerKm =
    totalAnnualCost != null && costDistanceKm != null && costDistanceKm > 0
      ? totalAnnualCost / costDistanceKm
      : null;

  const co2Total = findCo2Total(emissions);
  const co2TotalTons = co2Total != null ? co2Total / 1000 : null;
  const co2PerKm =
    co2Total != null && distanceKm != null && distanceKm > 0
      ? co2Total / distanceKm
      : null;

  const scenarioResults = Array.isArray(results.scenarioResults)
    ? results.scenarioResults
    : [];
  const computedScenarios = scenarioResults.filter((sr) => sr && !sr.error).length;
  const erroredScenarios = scenarioResults.filter((sr) => sr && sr.error).length;

  return {
    id: text(analysis.id),
    name: text(analysis.name) || text(analysis.id).slice(0, 8),
    createdAt: analysis.created_at ?? analysis.createdAt ?? null,
    busModelName: text(input.busModelName ?? fmeta.busModelName) || null,
    mode: text(cfg.mode) || null,
    shiftNames,
    shiftCount: shiftNames.length,
    annualDistanceKm: distanceKm,
    scenarioCount: scenarioResults.length,
    computedScenarios,
    erroredScenarios,
    optimizedPacks: firstFinite(results.optimizedPacks),
    sectionStatus: {
      costs: input.costsStatus ?? "idle",
      emissions: input.emissionsStatus ?? "idle",
    },
    efficiency: {
      totalEnergyKwh,
      drivetrainEnergyKwh,
      auxiliaryEnergyKwh,
      energyPerKm,
    },
    cost: {
      totalAnnualCost,
      energyOpex,
      maintenanceOpex,
      vehicleCapexAnnual,
      dieselTotalAnnual,
      annualSaving,
      costPerKm,
    },
    emissions: {
      co2Total,
      co2TotalTons,
      co2PerKm,
      indicators: collectEmissionIndicators(emissions),
    },
  };
};

/* ── Compatibility logic ───────────────────────────────────────── */

const computeCompatibility = (a, b) => {
  const setA = new Set(a.shiftNames);
  const setB = new Set(b.shiftNames);
  const common = a.shiftNames.filter((name) => setB.has(name));
  const sameShiftSet =
    setA.size > 0 &&
    setA.size === setB.size &&
    [...setA].every((name) => setB.has(name));
  const sameCount = a.shiftCount === b.shiftCount;
  const sameMode = a.mode != null && a.mode === b.mode;

  const distA = a.annualDistanceKm;
  const distB = b.annualDistanceKm;
  const distanceComparable =
    distA != null && distB != null && Math.max(distA, distB) > 0;
  const distanceCloseRatio =
    distanceComparable ? Math.abs(distB - distA) / Math.max(distA, distB) : null;
  const sameDistanceBasis =
    distanceCloseRatio != null && distanceCloseRatio <= 0.05;

  let status;
  if (sameShiftSet && sameMode) {
    status = "compatible";
  } else if (common.length > 0 || sameCount || sameMode) {
    status = "partially";
  } else {
    status = "not";
  }

  return {
    status,
    common,
    sameShiftSet,
    sameCount,
    sameMode,
    distanceComparable,
    sameDistanceBasis,
  };
};

/* ── Rendering helpers ─────────────────────────────────────────── */

const sel = (root, role) => root.querySelector(`[data-role="${role}"]`);

const renderCompareTable = (rows) => {
  const body = rows
    .map((row) => {
      const aStr = formatWithUnit(row.a, row.decimals, row.unit);
      const bStr = formatWithUnit(row.b, row.decimals, row.unit);
      const diff = absDiff(row.a, row.b);
      const rel = relDiff(row.a, row.b);
      const diffStr = diff == null ? "—" : formatSigned(diff, row.decimals, row.unit);
      const relStr = formatRel(rel);
      const tone = toneClass(diff);
      return `<tr>
        <td>${textContent(row.label)}</td>
        <td>${textContent(aStr)}</td>
        <td>${textContent(bStr)}</td>
        <td class="${tone}">${textContent(diffStr)}</td>
        <td class="${tone}">${textContent(relStr)}</td>
      </tr>`;
    })
    .join("");

  return `<div class="ya-res-table-wrap">
    <table class="ya-res-table ac-table">
      <thead>
        <tr>
          <th>${textContent(t("analysisComparison.metric"))}</th>
          <th>${textContent(t("analysisComparison.analysisA"))}</th>
          <th>${textContent(t("analysisComparison.analysisB"))}</th>
          <th>${textContent(t("analysisComparison.difference"))}</th>
          <th>${textContent(t("analysisComparison.relativeDifference"))}</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

const renderMetaCard = (model) => {
  if (!model) return "";
  const rows = [
    [t("simulation.field_name"), model.name],
    [t("simulation.col_created"), formatDate(model.createdAt)],
    [t("simulation.field_bus_model"), model.busModelName ?? "—"],
    [t("yearly_analysis.col_mode"), model.mode ?? "—"],
    [t("yearly_analysis.col_shifts"), model.shiftNames.join(", ") || "—"],
    [
      t("analysisComparison.shiftCount"),
      model.shiftCount != null ? String(model.shiftCount) : "—",
    ],
    [
      t("analysisComparison.annualDistance"),
      model.annualDistanceKm != null
        ? `${formatNumber(model.annualDistanceKm, 0)} km`
        : naLabel(),
    ],
  ]
    .map(
      ([label, value]) =>
        `<div class="ac-meta-row"><span class="ac-meta-label">${textContent(
          label
        )}</span><span class="ac-meta-value">${textContent(value)}</span></div>`
    )
    .join("");
  return rows;
};

const renderCompatibility = (root, a, b, compat) => {
  const container = sel(root, "compatibility");
  if (!container) return;

  const statusMap = {
    compatible: { key: "analysisComparison.compatible", cls: "ya-badge--ok" },
    partially: { key: "analysisComparison.partiallyComparable", cls: "ya-badge--neutral" },
    not: { key: "analysisComparison.notComparable", cls: "ya-badge--err" },
  };
  const statusInfo = statusMap[compat.status];

  const distanceCell =
    a.annualDistanceKm != null || b.annualDistanceKm != null
      ? `${formatWithUnit(a.annualDistanceKm, 0, "km")} → ${formatWithUnit(
          b.annualDistanceKm,
          0,
          "km"
        )}`
      : naLabel();

  const rows = [
    [
      t("analysisComparison.commonShifts"),
      compat.common.length ? compat.common.join(", ") : "—",
    ],
    [t("analysisComparison.shiftsInA"), String(a.shiftCount)],
    [t("analysisComparison.shiftsInB"), String(b.shiftCount)],
    [t("analysisComparison.annualDistanceComparison"), distanceCell],
  ]
    .map(
      ([label, value]) =>
        `<div class="ac-meta-row"><span class="ac-meta-label">${textContent(
          label
        )}</span><span class="ac-meta-value">${textContent(value)}</span></div>`
    )
    .join("");

  const warning =
    compat.status !== "compatible"
      ? `<p class="ac-warning">${textContent(t("analysisComparison.warning"))}</p>`
      : "";

  container.innerHTML = `
    <div class="ya-res-section-header">
      <h2 class="ya-res-section-title">${textContent(t("analysisComparison.compatibility"))}</h2>
      <span class="ya-badge ${statusInfo.cls}">${textContent(t(statusInfo.key))}</span>
    </div>
    <div class="ac-meta-grid">${rows}</div>
    ${warning}`;
};

const renderExecutiveKpis = (root, a, b) => {
  const container = sel(root, "executive");
  if (!container) return;

  const numericCard = (titleKey, aVal, bVal, decimals, unit) => {
    const diff = absDiff(aVal, bVal);
    const rel = relDiff(aVal, bVal);
    const tone = toneClass(diff);
    return `<div class="ac-kpi-card">
      <span class="ac-kpi-title">${textContent(t(titleKey))}</span>
      <div class="ac-kpi-values">
        <span class="ac-kpi-ab"><em>${textContent(t("analysisComparison.analysisA"))}</em> ${textContent(
      formatWithUnit(aVal, decimals, unit)
    )}</span>
        <span class="ac-kpi-ab"><em>${textContent(t("analysisComparison.analysisB"))}</em> ${textContent(
      formatWithUnit(bVal, decimals, unit)
    )}</span>
      </div>
      <span class="ac-kpi-diff ${tone}">${textContent(
      diff == null ? "—" : formatSigned(diff, decimals, unit)
    )} <small>(${textContent(formatRel(rel))})</small></span>
    </div>`;
  };

  container.innerHTML = [
    numericCard(
      "analysisComparison.energyDifference",
      a.efficiency.totalEnergyKwh,
      b.efficiency.totalEnergyKwh,
      0,
      "kWh"
    ),
    numericCard(
      "analysisComparison.energyEfficiency",
      a.efficiency.energyPerKm,
      b.efficiency.energyPerKm,
      3,
      "kWh/km"
    ),
    numericCard(
      "analysisComparison.costDifference",
      a.cost.costPerKm,
      b.cost.costPerKm,
      3,
      "CHF/km"
    ),
    numericCard(
      "analysisComparison.co2Difference",
      a.emissions.co2TotalTons,
      b.emissions.co2TotalTons,
      1,
      "t"
    ),
  ].join("");
};

/* ── Panels ────────────────────────────────────────────────────── */

const buildEfficiencyRows = (a, b) => [
  {
    label: t("analysisComparison.totalAnnualEnergy"),
    a: a.efficiency.totalEnergyKwh,
    b: b.efficiency.totalEnergyKwh,
    decimals: 0,
    unit: "kWh",
  },
  {
    label: t("analysisComparison.drivetrainEnergy"),
    a: a.efficiency.drivetrainEnergyKwh,
    b: b.efficiency.drivetrainEnergyKwh,
    decimals: 0,
    unit: "kWh",
  },
  {
    label: t("analysisComparison.auxiliaryEnergy"),
    a: a.efficiency.auxiliaryEnergyKwh,
    b: b.efficiency.auxiliaryEnergyKwh,
    decimals: 0,
    unit: "kWh",
  },
  {
    label: t("analysisComparison.energyPerKm"),
    a: a.efficiency.energyPerKm,
    b: b.efficiency.energyPerKm,
    decimals: 3,
    unit: "kWh/km",
  },
  {
    label: t("analysisComparison.optimizedPacks"),
    a: a.optimizedPacks,
    b: b.optimizedPacks,
    decimals: 0,
    unit: "",
  },
];

const buildCostRows = (a, b) => [
  {
    label: t("analysisComparison.totalAnnualCost"),
    a: a.cost.totalAnnualCost,
    b: b.cost.totalAnnualCost,
    decimals: 0,
    unit: "CHF",
  },
  {
    label: t("analysisComparison.dieselTotalAnnualCost"),
    a: a.cost.dieselTotalAnnual,
    b: b.cost.dieselTotalAnnual,
    decimals: 0,
    unit: "CHF",
  },
  {
    label: t("analysisComparison.energyCost"),
    a: a.cost.energyOpex,
    b: b.cost.energyOpex,
    decimals: 0,
    unit: "CHF",
  },
  {
    label: t("analysisComparison.vehicleCost"),
    a: a.cost.vehicleCapexAnnual,
    b: b.cost.vehicleCapexAnnual,
    decimals: 0,
    unit: "CHF",
  },
  {
    label: t("analysisComparison.maintenanceCost"),
    a: a.cost.maintenanceOpex,
    b: b.cost.maintenanceOpex,
    decimals: 0,
    unit: "CHF",
  },
  {
    label: t("analysisComparison.costPerKm"),
    a: a.cost.costPerKm,
    b: b.cost.costPerKm,
    decimals: 3,
    unit: "CHF/km",
  },
  {
    label: t("analysisComparison.annualSaving"),
    a: a.cost.annualSaving,
    b: b.cost.annualSaving,
    decimals: 0,
    unit: "CHF",
  },
];

const buildEmissionsRows = (a, b) => {
  const rows = [
    {
      label: t("analysisComparison.totalAnnualCo2"),
      a: a.emissions.co2TotalTons,
      b: b.emissions.co2TotalTons,
      decimals: 1,
      unit: "t",
    },
    {
      label: t("analysisComparison.co2PerKm"),
      a: a.emissions.co2PerKm,
      b: b.emissions.co2PerKm,
      decimals: 3,
      unit: "kg/km",
    },
  ];

  const byKey = new Map();
  a.emissions.indicators.forEach((row) => {
    byKey.set(row.key, { label: row.key, a: row.ebus, b: null, decimals: 1, unit: "" });
  });
  b.emissions.indicators.forEach((row) => {
    const existing = byKey.get(row.key);
    if (existing) existing.b = row.ebus;
    else byKey.set(row.key, { label: row.key, a: null, b: row.ebus, decimals: 1, unit: "" });
  });
  return rows.concat([...byKey.values()]);
};

const renderPanels = (root, a, b) => {
  const overview = sel(root, "panel-overview");
  if (overview) {
    const feasRows = [
      [
        t("analysisComparison.shiftCount"),
        String(a.shiftCount),
        String(b.shiftCount),
      ],
      [
        t("analysisComparison.scenarioCount"),
        String(a.scenarioCount),
        String(b.scenarioCount),
      ],
    ]
      .map(
        ([label, av, bv]) =>
          `<tr><td>${textContent(label)}</td><td>${av}</td><td>${bv}</td></tr>`
      )
      .join("");

    overview.innerHTML = `
      <div class="ya-res-table-wrap">
        <table class="ya-res-table ac-table">
          <thead><tr>
            <th>${textContent(t("analysisComparison.metric"))}</th>
            <th>${textContent(t("analysisComparison.analysisA"))}</th>
            <th>${textContent(t("analysisComparison.analysisB"))}</th>
          </tr></thead>
          <tbody>${feasRows}</tbody>
        </table>
      </div>
      <h3 class="ya-res-section-title ac-subhead">${textContent(
        t("analysisComparison.keyMetrics")
      )}</h3>
      ${renderCompareTable([
        buildEfficiencyRows(a, b)[0],
        buildCostRows(a, b)[0],
        buildEmissionsRows(a, b)[0],
      ])}`;
  }

  const efficiency = sel(root, "panel-efficiency");
  if (efficiency) efficiency.innerHTML = renderCompareTable(buildEfficiencyRows(a, b));

  const cost = sel(root, "panel-cost");
  if (cost) {
    const costUnavailable =
      a.sectionStatus.costs !== "ready" && b.sectionStatus.costs !== "ready";
    cost.innerHTML = costUnavailable
      ? `<p class="ac-section-note">${textContent(t("analysisComparison.costUnavailable"))}</p>`
      : renderCompareTable(buildCostRows(a, b));
  }

  const emissions = sel(root, "panel-emissions");
  if (emissions) {
    const emissionsUnavailable =
      a.sectionStatus.emissions !== "ready" && b.sectionStatus.emissions !== "ready";
    emissions.innerHTML = emissionsUnavailable
      ? `<p class="ac-section-note">${textContent(t("analysisComparison.emissionsUnavailable"))}</p>`
      : renderCompareTable(buildEmissionsRows(a, b));
  }

  const details = sel(root, "panel-details");
  if (details) {
    const allRows = [
      ...buildEfficiencyRows(a, b),
      ...buildCostRows(a, b),
      ...buildEmissionsRows(a, b),
    ];
    details.innerHTML = renderCompareTable(allRows);
  }
};

/* ── Export ────────────────────────────────────────────────────── */

const buildComparisonRows = (a, b) => {
  const tag = (category, rows) =>
    rows.map((row) => ({
      category,
      metric: row.label,
      unit: row.unit || "",
      analysisA: fin(row.a),
      analysisB: fin(row.b),
      absoluteDifference: absDiff(row.a, row.b),
      relativeDifferencePct: relDiff(row.a, row.b),
    }));
  return [
    ...tag(t("analysisComparison.efficiency"), buildEfficiencyRows(a, b)),
    ...tag(t("analysisComparison.cost"), buildCostRows(a, b)),
    ...tag(t("analysisComparison.emissions"), buildEmissionsRows(a, b)),
  ];
};

const csvCell = (value) => {
  if (value == null) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const downloadBlob = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportCsv = (a, b) => {
  const header = [
    "category",
    "metric",
    "unit",
    "analysis_a",
    "analysis_b",
    "absolute_difference",
    "relative_difference_pct",
  ];
  const rows = buildComparisonRows(a, b).map((row) =>
    [
      row.category,
      row.metric,
      row.unit,
      row.analysisA,
      row.analysisB,
      row.absoluteDifference,
      row.relativeDifferencePct,
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  downloadBlob("analysis-comparison.csv", csv, "text/csv;charset=utf-8;");
};

const exportJson = (a, b, compat) => {
  const payload = {
    differenceDefinition: "Difference = Analysis B - Analysis A",
    analysisA: a,
    analysisB: b,
    compatibility: compat,
    metrics: buildComparisonRows(a, b),
  };
  downloadBlob(
    "analysis-comparison.json",
    JSON.stringify(payload, null, 2),
    "application/json"
  );
};

/* ── Data loading ──────────────────────────────────────────────── */

const loadAnalysisModel = async (id) => {
  const analysis = await fetchYearlyAnalysis(id);
  const features = analysis?.features ?? {};
  const config = features.config ?? {};
  const busModelId = text(config.bus_model_id ?? config.busModelId);

  let busModelData = {};
  let busLengthM = null;
  let busModelName = features.meta?.busModelName ?? null;
  if (busModelId) {
    try {
      const busModel = await fetchBusModelById(busModelId);
      busModelData = parseBusModelSpecs(busModel);
      busLengthM = firstFinite(busModelData.bus_length_m);
      busModelName = busModelName || busModelData.name || busModelData.model || null;
    } catch {
      // Bus model is optional for the metadata view; costs/emissions will be unavailable.
    }
  }

  // Costs: mirror the yearly-analysis results page exactly — prefer the backend
  // /costs payload (mapped to the local model) and fall back to the client-side
  // computation only if the backend call fails. This keeps the annualized
  // figures identical to what the results page displays.
  let costs = null;
  let costsStatus = "error";
  const yearlyTotals = features.results?.yearlyTotals ?? {};
  const yearlyDistKm = firstFinite(yearlyTotals.distanceKm);
  const yearlyEngKwh = firstFinite(yearlyTotals.totalEnergyKwh);
  if (busLengthM != null && busLengthM > 0) {
    try {
      const raw = await fetchYearlyAnalysisCosts(id, { bus_length_m: busLengthM });
      costs = mapBackendCostsToLocal(raw, yearlyDistKm, yearlyEngKwh, busModelData, {
        optimizedPacks: features.results?.optimizedPacks,
        overrides: {},
      });
      if (costs) costsStatus = "ready";
    } catch {
      costs = null;
    }
  }
  if (!costs) {
    try {
      costs = computeYearlyCosts(features, busModelData, {});
      if (costs) costsStatus = "ready";
    } catch {
      costs = null;
    }
  }

  // Emissions: reuse the backend emissions endpoint + adapter.
  let emissions = null;
  let emissionsStatus = "error";
  if (busLengthM != null && busLengthM > 0) {
    try {
      const raw = await fetchYearlyAnalysisEmissions(id, { bus_length_m: busLengthM });
      emissions = adaptYearlyAnalysisEmissions(raw);
      emissionsStatus = "ready";
    } catch {
      emissions = null;
    }
  }

  return buildModel({
    analysis,
    features,
    busModelName,
    costs,
    costsStatus,
    emissions,
    emissionsStatus,
  });
};

/* ── Init ──────────────────────────────────────────────────────── */

export const initializeAnalysisComparison = (root = document, options = {}) => {
  const section = root.querySelector("section.analysis-comparison");
  if (!section) return null;

  const cleanups = [];
  const selectA = sel(section, "select-a");
  const selectB = sel(section, "select-b");
  const metaA = sel(section, "meta-a");
  const metaB = sel(section, "meta-b");
  const loadingEl = sel(section, "loading");
  const emptyEl = sel(section, "empty");
  const comparisonEl = sel(section, "comparison");
  const feedbackEl = sel(section, "feedback");

  let analyses = [];
  const detailCache = new Map();
  let modelA = null;
  let modelB = null;
  let compat = null;

  const showFeedback = (message) => {
    if (!feedbackEl) return;
    if (!message) {
      feedbackEl.hidden = true;
      feedbackEl.textContent = "";
      return;
    }
    feedbackEl.hidden = false;
    feedbackEl.textContent = message;
  };

  const analysisDisplayName = (item) => {
    const name = text(item.name).trim();
    const created = item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : "";
    if (name) return created ? `${name} · ${created}` : name;
    return `${text(item.id).slice(0, 8)}${created ? ` · ${created}` : ""}`;
  };

  const populateSelectors = () => {
    const placeholder = `<option value="">${textContent(
      t("analysisComparison.selectPlaceholder")
    )}</option>`;
    const optionsHtml = analyses
      .map(
        (item) =>
          `<option value="${textContent(item.id)}">${textContent(
            analysisDisplayName(item)
          )}</option>`
      )
      .join("");
    if (selectA) selectA.innerHTML = placeholder + optionsHtml;
    if (selectB) selectB.innerHTML = placeholder + optionsHtml;
  };

  const loadDetail = async (id) => {
    if (!id) return null;
    if (detailCache.has(id)) return detailCache.get(id);
    const model = await loadAnalysisModel(id);
    detailCache.set(id, model);
    return model;
  };

  const renderComparison = () => {
    const idA = selectA?.value || "";
    const idB = selectB?.value || "";

    if (metaA) metaA.innerHTML = modelA ? renderMetaCard(modelA) : "";
    if (metaB) metaB.innerHTML = modelB ? renderMetaCard(modelB) : "";

    if (!idA || !idB || !modelA || !modelB) {
      if (comparisonEl) comparisonEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (comparisonEl) comparisonEl.hidden = false;

    compat = computeCompatibility(modelA, modelB);
    renderCompatibility(section, modelA, modelB, compat);
    renderExecutiveKpis(section, modelA, modelB);
    renderPanels(section, modelA, modelB);
  };

  const refreshModels = async () => {
    const idA = selectA?.value || "";
    const idB = selectB?.value || "";
    showFeedback("");

    if (!idA) modelA = null;
    if (!idB) modelB = null;

    const needsLoad = (idA && (!modelA || modelA.id !== idA)) || (idB && (!modelB || modelB.id !== idB));
    if (needsLoad && loadingEl) loadingEl.hidden = false;

    try {
      if (idA && (!modelA || modelA.id !== idA)) modelA = await loadDetail(idA);
      if (idB && (!modelB || modelB.id !== idB)) modelB = await loadDetail(idB);
    } catch (error) {
      showFeedback(error?.message || t("analysisComparison.loadError"));
    } finally {
      if (loadingEl) loadingEl.hidden = true;
    }

    renderComparison();
  };

  const handleSelectA = () => {
    modelA = null;
    void refreshModels();
  };
  const handleSelectB = () => {
    modelB = null;
    void refreshModels();
  };
  selectA?.addEventListener("change", handleSelectA);
  selectB?.addEventListener("change", handleSelectB);
  cleanups.push(() => selectA?.removeEventListener("change", handleSelectA));
  cleanups.push(() => selectB?.removeEventListener("change", handleSelectB));

  /* ── Tabs ────────────────────────────────────────────────────── */
  const activateTab = (tabName) => {
    section.querySelectorAll(".ya-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    section.querySelectorAll(".ya-tab-panel").forEach((panel) => {
      const active = panel.dataset.panel === tabName;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  };
  const handleTabClick = (event) => {
    const btn = event.target.closest(".ya-tab");
    if (!btn) return;
    activateTab(btn.dataset.tab);
  };
  const tabList = section.querySelector(".ya-tabs");
  if (tabList) {
    tabList.addEventListener("click", handleTabClick);
    cleanups.push(() => tabList.removeEventListener("click", handleTabClick));
  }

  /* ── Export actions ──────────────────────────────────────────── */
  const handleExport = (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn || !modelA || !modelB) return;
    if (btn.dataset.action === "export-csv") exportCsv(modelA, modelB);
    else if (btn.dataset.action === "export-json") exportJson(modelA, modelB, compat);
  };
  section.addEventListener("click", handleExport);
  cleanups.push(() => section.removeEventListener("click", handleExport));

  /* ── Initial load ────────────────────────────────────────────── */
  const loadAnalyses = async () => {
    if (loadingEl) loadingEl.hidden = false;
    try {
      analyses = await fetchAllYearlyAnalyses();
      analyses = Array.isArray(analyses) ? analyses : [];
    } catch (error) {
      analyses = [];
      showFeedback(error?.message || t("analysisComparison.loadError"));
    } finally {
      if (loadingEl) loadingEl.hidden = true;
    }
    populateSelectors();

    // Preselect from route options if provided.
    const preA = text(options.analysisA ?? options.analysisIdA);
    const preB = text(options.analysisB ?? options.analysisIdB);
    if (preA && selectA && analyses.some((a) => text(a.id) === preA)) {
      selectA.value = preA;
    }
    if (preB && selectB && analyses.some((a) => text(a.id) === preB)) {
      selectB.value = preB;
    }
    if (selectA?.value || selectB?.value) {
      void refreshModels();
    } else {
      renderComparison();
    }
  };

  if (isAuthenticated()) {
    void loadAnalyses();
  } else {
    renderComparison();
  }

  return () => cleanups.forEach((fn) => fn());
};

import { buildFeasibilityResultModel } from "./feasibility-result-model.js";
import { resolvePredictionRunShiftIds } from "./feasibility-shift-scope.js";

export const YEARLY_ANALYSIS_SCHEMA_VERSION = 2;

export const ADDITIVE_KPIS = [
  { key: "totalEnergyKwh", label: "Total energy", unit: "kWh", yearlyLabel: "Yearly energy", yearlyUnit: "kWh/year" },
  { key: "drivetrainEnergyKwh", label: "Drivetrain energy", unit: "kWh", yearlyLabel: "Yearly drivetrain energy", yearlyUnit: "kWh/year" },
  { key: "auxiliaryEnergyKwh", label: "Auxiliary energy", unit: "kWh", yearlyLabel: "Yearly auxiliary energy", yearlyUnit: "kWh/year" },
  { key: "distanceKm", label: "Simulated distance", unit: "km", yearlyLabel: "Yearly simulated distance", yearlyUnit: "km/year" },
];

const ADDITIVE_KPI_KEYS = ADDITIVE_KPIS.map(({ key }) => key);
const QUANTILE_KEYS = ["q05", "q50", "q95"];
const ENERGY_COMPONENT_KEYS = Object.freeze({
  mechanicalGreyboxKwh: "total_mechanical_greybox_kwh",
  qrfResidualKwh: "total_qrf_residual_kwh",
  fixedAuxiliaryKwh: "total_fixed_auxiliary_kwh",
  hvacElectricalKwh: "total_hvac_electrical_kwh",
  uncoveredThermalKwh: "total_uncovered_thermal_kwh",
});

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const toFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const uniqueTexts = (values = []) => {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = text(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};

const readName = (namesById, shiftId) => {
  if (namesById instanceof Map) return text(namesById.get(shiftId));
  return isRecord(namesById) ? text(namesById[shiftId]) : "";
};

const copyQuantiles = (value) => {
  if (!isRecord(value)) return null;
  const normalized = Object.fromEntries(
    QUANTILE_KEYS.map((key) => [key, toFiniteNumber(value[key])]),
  );
  return Object.values(normalized).some((entry) => entry !== null)
    ? normalized
    : null;
};

const readQuantiles = (summary, candidateKeys) => {
  for (const key of candidateKeys) {
    const quantiles = copyQuantiles(summary?.[key]);
    if (quantiles) return quantiles;
  }
  return null;
};

const statusForRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return "failed";
  const completed = rows.filter((row) => !row?.error && row?.kpis).length;
  if (completed === rows.length) return "completed";
  return completed === 0 ? "failed" : "partial";
};

const emptyYearlyTotals = () =>
  Object.fromEntries(ADDITIVE_KPI_KEYS.map((key) => [key, null]));

const sumCompleteValues = (records, reader) => {
  const values = records.map(reader);
  return values.every((value) => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
};

const aggregateQuantiles = (kpisList, key) => {
  const result = {};
  for (const quantile of QUANTILE_KEYS) {
    result[quantile] = sumCompleteValues(
      kpisList,
      (kpis) => toFiniteNumber(kpis?.[key]?.[quantile]),
    );
  }
  return Object.values(result).some((value) => value !== null) ? result : null;
};

const divideQuantiles = (quantiles, denominator) => {
  if (!quantiles || denominator === null || denominator <= 0) return null;
  return Object.fromEntries(
    QUANTILE_KEYS.map((key) => [
      key,
      quantiles[key] === null ? null : quantiles[key] / denominator,
    ]),
  );
};

const aggregatePerDistanceQuantiles = (kpisList, key, totalDistanceKm) => {
  if (totalDistanceKm === null || totalDistanceKm <= 0) return null;
  const result = {};
  for (const quantile of QUANTILE_KEYS) {
    const weighted = sumCompleteValues(kpisList, (kpis) => {
      const value = toFiniteNumber(kpis?.[key]?.[quantile]);
      const distance = toFiniteNumber(kpis?.distanceKm);
      return value !== null && distance !== null ? value * distance : null;
    });
    result[quantile] = weighted === null ? null : weighted / totalDistanceKm;
  }
  return Object.values(result).some((value) => value !== null) ? result : null;
};

const aggregateEnergyComponents = (kpisList) => {
  const keys = new Set(
    kpisList.flatMap((kpis) => Object.keys(kpis?.energyComponents ?? {})),
  );
  const result = {};
  for (const key of keys) {
    const sum = sumCompleteValues(
      kpisList,
      (kpis) => toFiniteNumber(kpis?.energyComponents?.[key]),
    );
    if (sum !== null) result[key] = sum;
  }
  return Object.keys(result).length ? result : null;
};

const commonValue = (records, key) => {
  const values = records.map((record) => record?.[key] ?? null);
  return values.length && values.every((value) => value === values[0])
    ? values[0]
    : null;
};

const makeScenarioError = (shiftResults) => {
  const errors = shiftResults
    .filter((row) => row.error)
    .map((row) => `${row.shiftId}: ${row.error}`);
  return errors.length ? errors.join("; ") : null;
};

const maxFinite = (values) => {
  const finite = values.map(toFiniteNumber).filter((value) => value !== null);
  return finite.length ? Math.max(...finite) : null;
};

const deriveSelectedPackSizeKwh = (shifts, fallback) => {
  const pairs = [
    ["optimizedKwh", "optimizedPacks"],
    ["baseKwh", "basePacks"],
    ["maxPhysicalKwh", "maxPhysicalPacks"],
  ];
  for (const shift of shifts) {
    for (const [energyKey, packKey] of pairs) {
      const energy = toFiniteNumber(shift?.battery?.[energyKey]);
      const packs = toFiniteNumber(shift?.battery?.[packKey]);
      if (energy !== null && packs !== null && packs > 0) return energy / packs;
    }
  }
  return toFiniteNumber(fallback);
};

/**
 * Snapshot the physical vehicles represented by the linked feasibility run.
 * `per_bus_summary` is the authoritative optimizer contract: every row is one
 * simulated vehicle and its `shift_id` identifies the annual-result scope that
 * owns that vehicle.  Missing or inconsistent rows remain explicit so the
 * economic model never silently falls back to one vehicle.
 */
export const buildYearlyFleetSnapshot = (
  optimizationRun = {},
  requestedShiftIds = [],
) => {
  const expectedShiftIds = uniqueTexts(requestedShiftIds);
  const expected = new Set(expectedShiftIds);
  const rows = optimizationRun?.results?.per_bus_summary;
  const unavailable = (issue) => ({
    dataAvailable: false,
    source: "optimization_per_bus_summary",
    vehicleCount: null,
    vehicleCountByShift: {},
    issue,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    return unavailable("missing_per_bus_summary");
  }

  const counts = Object.fromEntries(
    expectedShiftIds.map((shiftId) => [shiftId, 0]),
  );
  for (const row of rows) {
    if (!isRecord(row)) return unavailable("invalid_per_bus_summary_row");
    const shiftId = text(row.shift_id);
    if (!shiftId) return unavailable("missing_per_bus_shift_id");
    if (expected.size && !expected.has(shiftId)) {
      return unavailable("unexpected_per_bus_shift_id");
    }
    counts[shiftId] = (counts[shiftId] ?? 0) + 1;
  }

  if (expectedShiftIds.some((shiftId) => counts[shiftId] === 0)) {
    return unavailable("missing_per_bus_shift");
  }

  return {
    dataAvailable: true,
    source: "optimization_per_bus_summary",
    vehicleCount: rows.length,
    vehicleCountByShift: counts,
    issue: null,
  };
};

const asScenario = (scenario = {}, index = 0) => ({
  scenarioId: text(scenario.scenarioId) || `cluster-${index + 1}`,
  label: text(scenario.label),
  temperature: toFiniteNumber(scenario.temperature),
  occurrences: Math.max(0, toFiniteNumber(scenario.occurrences) ?? 0),
});

/**
 * Stores the physical configuration inherited from feasibility. It is a
 * snapshot: weather clusters can change energy results, but never sizing.
 */
export const buildFixedYearlyConfiguration = (
  optimizationRun = {},
  { shiftNamesById = {}, packSizeKwh: configuredPackSizeKwh = null } = {},
) => {
  const feasibility = buildFeasibilityResultModel(optimizationRun);
  const inputParams = isRecord(optimizationRun?.input_params)
    ? optimizationRun.input_params
    : {};
  const requestedShiftIds = uniqueTexts(inputParams.shift_ids);
  const shiftIds = requestedShiftIds.length
    ? requestedShiftIds
    : uniqueTexts(feasibility.shifts.map((shift) => shift.shiftId));
  const feasibilityByShift = new Map(
    feasibility.shifts.map((shift) => [text(shift.shiftId), shift]),
  );
  const selectedSources = shiftIds.map((shiftId) =>
    feasibilityByShift.get(shiftId),
  );
  const fixedPacks = toFiniteNumber(inputParams.fixed_battery_packs);
  const optimizedPacks = maxFinite(
    selectedSources.map((shift) => shift?.battery?.optimizedPacks),
  );
  const commonPacks = feasibility.fleet.battery.decision === "fixed" && fixedPacks !== null
    ? fixedPacks
    : optimizedPacks;
  const packSizeKwh = deriveSelectedPackSizeKwh(
    selectedSources,
    feasibility.fleet.battery.packSizeKwh ?? configuredPackSizeKwh,
  );
  const maximumRequiredPacks = maxFinite(
    selectedSources.map((shift) => shift?.battery?.requiredPacks),
  );

  const shifts = shiftIds.map((shiftId) => {
    const source = feasibilityByShift.get(shiftId);
    const resolvedName = readName(shiftNamesById, shiftId);
    const battery = source?.battery
      ? {
          ...source.battery,
          commonPacks,
          commonPackMargin:
            commonPacks !== null && source.battery.requiredPacks !== null
              ? commonPacks - source.battery.requiredPacks
              : null,
          isSizing:
            feasibility.fleet.battery.decision === "optimized" &&
            commonPacks !== null &&
            source.battery.optimizedPacks === commonPacks,
        }
      : null;
    return {
      shiftId,
      shiftName: resolvedName || text(source?.shiftName) || shiftId,
      battery,
      operation: source?.operation ?? null,
    };
  });
  const sizingShifts = shifts.filter((shift) => shift.battery?.isSizing);
  const mostDemandingShifts = maximumRequiredPacks === null
    ? []
    : shifts.filter(
        (shift) => shift.battery?.requiredPacks === maximumRequiredPacks,
      );
  const battery = {
    ...feasibility.fleet.battery,
    packs: commonPacks,
    packSizeKwh,
    nominalKwh:
      commonPacks !== null && packSizeKwh !== null
        ? commonPacks * packSizeKwh
        : null,
    sizingShiftIds: sizingShifts.map((shift) => shift.shiftId),
    sizingShiftNames: sizingShifts.map((shift) => shift.shiftName),
    mostDemandingShiftIds: mostDemandingShifts.map((shift) => shift.shiftId),
    mostDemandingShiftNames: mostDemandingShifts.map((shift) => shift.shiftName),
  };

  return {
    fixed: true,
    sourceOptimizationRunId: text(optimizationRun?.id) || null,
    mode: feasibility.mode,
    busModelId: feasibility.fleet.busModelId,
    shiftIds,
    fleet: buildYearlyFleetSnapshot(optimizationRun, shiftIds),
    soc: {
      minFraction: toFiniteNumber(inputParams.min_soc) ?? 0,
      maxFraction: toFiniteNumber(inputParams.max_soc) ?? 1,
    },
    battery,
    infrastructure: feasibility.infrastructure,
    shifts,
  };
};

/** Add stable, unique identities without relying on a cluster label. */
export const normalizeYearlyScenarios = (scenarios = []) => {
  const used = new Set();
  return (Array.isArray(scenarios) ? scenarios : []).map((scenario, index) => {
    const normalized = asScenario(scenario, index);
    const requestedId = normalized.scenarioId;
    let scenarioId = requestedId;
    let suffix = 2;
    while (used.has(scenarioId)) {
      scenarioId = `${requestedId}-${suffix}`;
      suffix += 1;
    }
    used.add(scenarioId);
    return { ...normalized, scenarioId };
  });
};

export const extractPredictionOnlyKpis = (predictionRun = {}) => {
  const summary = isRecord(predictionRun?.summary) ? predictionRun.summary : {};
  const energyComponents = Object.fromEntries(
    Object.entries(ENERGY_COMPONENT_KEYS)
      .map(([target, source]) => [target, toFiniteNumber(summary[source])])
      .filter(([, value]) => value !== null),
  );

  return {
    feasible: null,
    solverStatus: "prediction-only",
    totalEnergyKwh: toFiniteNumber(summary.total_consumption_kwh),
    drivetrainEnergyKwh: toFiniteNumber(summary.total_drivetrain_kwh),
    auxiliaryEnergyKwh: toFiniteNumber(summary.total_auxiliary_kwh),
    distanceKm: toFiniteNumber(summary.total_distance_km),
    energyPerKm: toFiniteNumber(summary.consumption_per_km_kwh),
    auxiliaryPerKmKwh: toFiniteNumber(summary.auxiliary_per_km_kwh),
    drivetrainPerKmKwh: toFiniteNumber(summary.drivetrain_per_km_kwh),
    quantiles: readQuantiles(summary, [
      "quantiles",
      "total_quantiles",
      "consumption_quantiles",
    ]),
    drivetrainQuantiles: readQuantiles(summary, ["drivetrain_quantiles"]),
    consumptionPerKmQuantiles: readQuantiles(summary, [
      "consumption_per_km_kwh_quantiles",
      "total_consumption_per_km_kwh_quantiles",
      "total_per_km_kwh_quantiles",
    ]),
    drivetrainPerKmQuantiles: readQuantiles(summary, [
      "drivetrain_per_km_kwh_quantiles",
    ]),
    predictionStack: text(predictionRun?.prediction_stack) || null,
    modelRelease: text(predictionRun?.model_name) || null,
    auxiliaryEstimatorRelease:
      text(predictionRun?.auxiliary_estimator_release) || null,
    ...(Object.keys(energyComponents).length ? { energyComponents } : {}),
  };
};

export const aggregatePredictionKpis = (kpisList = []) => {
  if (!Array.isArray(kpisList) || !kpisList.length || kpisList.some((kpis) => !kpis)) {
    return null;
  }

  const totals = Object.fromEntries(
    ADDITIVE_KPI_KEYS.map((key) => [
      key,
      sumCompleteValues(kpisList, (kpis) => toFiniteNumber(kpis?.[key])),
    ]),
  );
  const distanceKm = totals.distanceKm;
  const quantiles = aggregateQuantiles(kpisList, "quantiles");
  const drivetrainQuantiles = aggregateQuantiles(
    kpisList,
    "drivetrainQuantiles",
  );
  const energyComponents = aggregateEnergyComponents(kpisList);
  const feasibleValues = kpisList.map((kpis) => kpis.feasible);
  const feasible = feasibleValues.some((value) => value === false)
    ? false
    : feasibleValues.every((value) => value === true)
      ? true
      : null;

  return {
    feasible,
    solverStatus: commonValue(kpisList, "solverStatus") ?? "prediction-only",
    ...totals,
    energyPerKm:
      totals.totalEnergyKwh !== null && distanceKm !== null && distanceKm > 0
        ? totals.totalEnergyKwh / distanceKm
        : null,
    auxiliaryPerKmKwh:
      totals.auxiliaryEnergyKwh !== null && distanceKm !== null && distanceKm > 0
        ? totals.auxiliaryEnergyKwh / distanceKm
        : null,
    drivetrainPerKmKwh:
      totals.drivetrainEnergyKwh !== null && distanceKm !== null && distanceKm > 0
        ? totals.drivetrainEnergyKwh / distanceKm
        : null,
    quantiles,
    drivetrainQuantiles,
    consumptionPerKmQuantiles:
      divideQuantiles(quantiles, distanceKm) ??
      aggregatePerDistanceQuantiles(
        kpisList,
        "consumptionPerKmQuantiles",
        distanceKm,
      ),
    drivetrainPerKmQuantiles:
      divideQuantiles(drivetrainQuantiles, distanceKm) ??
      aggregatePerDistanceQuantiles(
        kpisList,
        "drivetrainPerKmQuantiles",
        distanceKm,
      ),
    predictionStack: commonValue(kpisList, "predictionStack"),
    modelRelease: commonValue(kpisList, "modelRelease"),
    auxiliaryEstimatorRelease: commonValue(
      kpisList,
      "auxiliaryEstimatorRelease",
    ),
    ...(energyComponents
      ? { energyComponents }
      : {}),
  };
};

/**
 * Associates one cluster's returned runs with physical shifts. Identifiers are
 * authoritative; array order and equal display names are never used.
 */
export const buildYearlyScenarioOutcome = ({
  scenario = {},
  shiftIds = [],
  predictionRuns = [],
  failure = null,
} = {}) => {
  const normalizedScenario = asScenario(scenario);
  const expectedShiftIds = uniqueTexts(shiftIds);
  const runs = Array.isArray(predictionRuns) ? predictionRuns.filter(Boolean) : [];
  const runsByShift = new Map();
  const unexpectedPredictionRunIds = [];
  const unattributedPredictionRunIds = [];

  for (const run of runs) {
    let runShiftIds = resolvePredictionRunShiftIds(run);
    if (runShiftIds.length === 0 && expectedShiftIds.length === 1 && runs.length === 1) {
      runShiftIds = [expectedShiftIds[0]];
    }

    if (runShiftIds.length !== 1) {
      unattributedPredictionRunIds.push(text(run?.id) || null);
      continue;
    }

    const shiftId = runShiftIds[0];
    if (!expectedShiftIds.includes(shiftId)) {
      unexpectedPredictionRunIds.push(text(run?.id) || null);
      continue;
    }
    const entries = runsByShift.get(shiftId) ?? [];
    entries.push(run);
    runsByShift.set(shiftId, entries);
  }

  const failureMessage = text(failure);
  const shiftResults = expectedShiftIds.map((shiftId) => {
    const matches = runsByShift.get(shiftId) ?? [];
    let error = failureMessage || null;
    if (!error && matches.length === 0) {
      error = `No prediction result returned for shift ${shiftId}.`;
    } else if (!error && matches.length > 1) {
      error = `Multiple prediction results returned for shift ${shiftId}.`;
    }
    const predictionRun = !error ? matches[0] : null;
    return {
      ...normalizedScenario,
      shiftId,
      kpis: predictionRun ? extractPredictionOnlyKpis(predictionRun) : null,
      predRunId: predictionRun ? text(predictionRun.id) || null : null,
      error,
    };
  });

  const aggregateError = makeScenarioError(shiftResults);
  const predRunIds = shiftResults
    .map((result) => result.predRunId)
    .filter(Boolean);
  const aggregateResult = {
    ...normalizedScenario,
    kpis: aggregateError
      ? null
      : aggregatePredictionKpis(shiftResults.map((result) => result.kpis)),
    predRunId: predRunIds.length === 1 ? predRunIds[0] : null,
    predRunIds,
    error: aggregateError,
  };

  return {
    scenarioId: normalizedScenario.scenarioId,
    shiftResults,
    aggregateResult,
    diagnostics: {
      unexpectedPredictionRunIds,
      unattributedPredictionRunIds,
    },
  };
};

export const computeYearlyTotals = (
  scenarioResults = [],
  { requireComplete = false } = {},
) => {
  const rows = Array.isArray(scenarioResults) ? scenarioResults : [];
  if (requireComplete && (rows.length === 0 || rows.some((row) => row?.error || !row?.kpis))) {
    return emptyYearlyTotals();
  }

  const totals = {};
  for (const key of ADDITIVE_KPI_KEYS) {
    let sum = 0;
    let valid = false;
    let complete = true;
    for (const row of rows) {
      if (row?.error) continue;
      const value = toFiniteNumber(row?.kpis?.[key]);
      const occurrences = toFiniteNumber(row?.occurrences);
      if (value !== null && occurrences !== null) {
        sum += value * occurrences;
        valid = true;
      } else {
        complete = false;
      }
    }
    totals[key] = valid && (!requireComplete || complete) ? sum : null;
  }
  const componentKeys = new Set(
    rows.flatMap((row) => Object.keys(row?.kpis?.energyComponents ?? {})),
  );
  const energyComponents = {};
  for (const key of componentKeys) {
    let sum = 0;
    let valid = false;
    let complete = true;
    for (const row of rows) {
      if (row?.error) continue;
      const value = toFiniteNumber(row?.kpis?.energyComponents?.[key]);
      const occurrences = toFiniteNumber(row?.occurrences);
      if (value === null || occurrences === null) {
        complete = false;
        continue;
      }
      sum += value * occurrences;
      valid = true;
    }
    if (valid && complete) energyComponents[key] = sum;
  }
  if (Object.keys(energyComponents).length) {
    totals.energyComponents = energyComponents;
  }
  return totals;
};

const readDistance = (distancesByShiftId, shiftId) => {
  if (distancesByShiftId instanceof Map) {
    return toFiniteNumber(distancesByShiftId.get(shiftId));
  }
  return isRecord(distancesByShiftId)
    ? toFiniteNumber(distancesByShiftId[shiftId])
    : null;
};

/** Builds both per-shift annual totals and the backward-compatible general total. */
export const buildYearlyAnalysisResults = ({
  scenarios = [],
  outcomes = [],
  fixedConfiguration = {},
  nominalDailyDistanceKmByShiftId = {},
} = {}) => {
  const normalizedScenarios = normalizeYearlyScenarios(scenarios);
  const outcomeByScenarioId = new Map(
    (Array.isArray(outcomes) ? outcomes : []).map((outcome) => [
      text(outcome?.scenarioId),
      outcome,
    ]),
  );
  const shiftIds = uniqueTexts(fixedConfiguration?.shiftIds);
  const fixedShiftsById = new Map(
    (Array.isArray(fixedConfiguration?.shifts) ? fixedConfiguration.shifts : [])
      .map((shift) => [text(shift?.shiftId), shift]),
  );

  const scenarioOutcomes = normalizedScenarios.map((scenario) =>
    outcomeByScenarioId.get(scenario.scenarioId) ??
    buildYearlyScenarioOutcome({
      scenario,
      shiftIds,
      failure: "Prediction result is unavailable for this scenario.",
    }),
  );
  const scenarioResults = scenarioOutcomes.map((outcome) => outcome.aggregateResult);
  const shiftResults = shiftIds.map((shiftId) => {
    const fixedShift = fixedShiftsById.get(shiftId) ?? {};
    const perScenario = scenarioOutcomes.map((outcome) =>
      outcome.shiftResults.find((row) => row.shiftId === shiftId) ?? {
        ...asScenario(outcome.aggregateResult),
        shiftId,
        kpis: null,
        predRunId: null,
        error: `Prediction result is unavailable for shift ${shiftId}.`,
      },
    );
    return {
      shiftId,
      shiftName: text(fixedShift.shiftName) || shiftId,
      scenarioResults: perScenario,
      yearlyTotals: computeYearlyTotals(perScenario, { requireComplete: true }),
      nominalDailyDistanceKm: readDistance(
        nominalDailyDistanceKmByShiftId,
        shiftId,
      ),
      status: statusForRows(perScenario),
    };
  });

  const nominalDistances = shiftIds.map((shiftId) =>
    readDistance(nominalDailyDistanceKmByShiftId, shiftId),
  );
  const nominalDailyDistanceKm = nominalDistances.length &&
    nominalDistances.every((distance) => distance !== null)
    ? nominalDistances.reduce((sum, distance) => sum + distance, 0)
    : null;
  const expectedPredictionCount = normalizedScenarios.length * shiftIds.length;
  const completedPredictionCount = shiftResults.reduce(
    (sum, shift) => sum + shift.scenarioResults.filter((row) => !row.error && row.kpis).length,
    0,
  );
  const status = expectedPredictionCount > 0 && completedPredictionCount === expectedPredictionCount
    ? "completed"
    : completedPredictionCount === 0
      ? "failed"
      : "partial";

  return {
    schemaVersion: YEARLY_ANALYSIS_SCHEMA_VERSION,
    scenarioResults,
    yearlyTotals: computeYearlyTotals(scenarioResults, { requireComplete: true }),
    shiftResults,
    nominalDailyDistanceKm,
    completion: {
      expectedPredictionCount,
      completedPredictionCount,
      failedPredictionCount: expectedPredictionCount - completedPredictionCount,
    },
    diagnostics: scenarioOutcomes.map((outcome) => ({
      scenarioId: outcome.scenarioId,
      ...outcome.diagnostics,
    })),
    status,
  };
};

const configuredYearlyShiftIds = (features = {}) =>
  uniqueTexts([
    ...(Array.isArray(features?.config?.shift_ids)
      ? features.config.shift_ids
      : []),
    ...(Array.isArray(features?.config?.fixedConfiguration?.shiftIds)
      ? features.config.fixedConfiguration.shiftIds
      : []),
    ...(Array.isArray(features?.config?.fixedConfiguration?.shifts)
      ? features.config.fixedConfiguration.shifts.map((shift) => shift?.shiftId)
      : []),
    ...(Array.isArray(features?.meta?.shifts)
      ? features.meta.shifts.map((shift) => shift?.shiftId)
      : []),
  ]);

const yearlyShiftNamesById = (features, shiftIds) => {
  const names = new Map();
  const add = (shiftId, shiftName) => {
    const id = text(shiftId);
    const name = text(shiftName);
    if (id && name && !names.has(id)) names.set(id, name);
  };

  for (const shift of Array.isArray(features?.config?.fixedConfiguration?.shifts)
    ? features.config.fixedConfiguration.shifts
    : []) {
    add(shift?.shiftId, shift?.shiftName);
  }
  for (const shift of Array.isArray(features?.meta?.shifts)
    ? features.meta.shifts
    : []) {
    add(shift?.shiftId, shift?.shiftName);
  }
  const legacyNames = Array.isArray(features?.meta?.shiftNames)
    ? features.meta.shiftNames
    : [];
  shiftIds.forEach((shiftId, index) => add(shiftId, legacyNames[index]));
  return names;
};

const predictionRunTemperature = (run = {}) =>
  toFiniteNumber(
    run.external_temp_celsius ??
    run.contextual_parameters?.external_temp_celsius ??
    run.input_params?.external_temp_celsius,
  );

const sameTemperature = (left, right) => {
  const a = toFiniteNumber(left);
  const b = toFiniteNumber(right);
  return a !== null && b !== null && Math.abs(a - b) <= 0.001;
};

const statusForLegacyRows = (rows = []) => {
  if (!rows.length) return "failed";
  const completed = rows.filter((row) => !row?.error && row?.kpis).length;
  if (completed === rows.length) return "completed";
  return completed === 0 ? "failed" : "partial";
};

/**
 * Reconstructs per-shift annual results for analyses saved before schema v2.
 * The result is an in-memory view only: callers never need to patch the saved
 * analysis or write compatibility data back to the database.
 */
export const backfillYearlyShiftResults = (
  features = {},
  predictionRuns = [],
) => {
  if (!isRecord(features)) return features;
  const existing = features?.results?.shiftResults;
  if (Array.isArray(existing) && existing.length > 0) return features;

  const shiftIds = configuredYearlyShiftIds(features);
  if (!shiftIds.length) return features;

  const namesById = yearlyShiftNamesById(features, shiftIds);
  const generalScenarioResults = Array.isArray(features?.results?.scenarioResults)
    ? features.results.scenarioResults
    : [];
  const generalYearlyTotals = isRecord(features?.results?.yearlyTotals)
    ? features.results.yearlyTotals
    : {};

  // With one physical shift, the historical aggregate is already the exact
  // shift result. Prefer it over a reconstruction so temporary API failures do
  // not hide otherwise valid saved data.
  if (shiftIds.length === 1 && generalScenarioResults.length) {
    const shiftId = shiftIds[0];
    const scenarioResults = generalScenarioResults.map((row) => ({
      ...row,
      shiftId,
    }));
    const storedStatus = text(features?.results?.status ?? features?.status);
    const shiftResults = [{
      shiftId,
      shiftName: namesById.get(shiftId) || shiftId,
      status: storedStatus || statusForLegacyRows(scenarioResults),
      nominalDailyDistanceKm:
        toFiniteNumber(features?.results?.nominalDailyDistanceKm) ??
        toFiniteNumber(scenarioResults[0]?.kpis?.distanceKm),
      yearlyTotals: { ...generalYearlyTotals },
      scenarioResults,
    }];
    return {
      ...features,
      results: { ...(features.results ?? {}), shiftResults },
    };
  }

  const scenariosSource = Array.isArray(features?.scenarios) && features.scenarios.length
    ? features.scenarios
    : generalScenarioResults;
  const scenarios = normalizeYearlyScenarios(scenariosSource);
  const runs = Array.isArray(predictionRuns)
    ? predictionRuns.filter((run) => run && typeof run === "object")
    : [];
  const outcomes = scenarios.map((scenario) => {
    const matchingRuns = runs.filter((run) =>
      sameTemperature(predictionRunTemperature(run), scenario.temperature),
    );
    const usableRuns = matchingRuns.filter((run) =>
      isRecord(run?.summary) &&
      !["failed", "cancelled", "canceled"].includes(text(run?.status).toLowerCase()),
    );
    return buildYearlyScenarioOutcome({
      scenario,
      shiftIds,
      predictionRuns: usableRuns,
      failure: usableRuns.length
        ? null
        : `Prediction results are unavailable for scenario ${scenario.scenarioId}.`,
    });
  });
  const nominalDailyDistanceKmByShiftId = Object.fromEntries(
    shiftIds.map((shiftId) => {
      const matchingRun = runs.find((run) =>
        resolvePredictionRunShiftIds(run).includes(shiftId) &&
        isRecord(run?.summary) &&
        toFiniteNumber(run?.summary?.total_distance_km) !== null,
      );
      return [shiftId, toFiniteNumber(matchingRun?.summary?.total_distance_km)];
    }),
  );
  const fixedConfiguration = {
    ...(isRecord(features?.config?.fixedConfiguration)
      ? features.config.fixedConfiguration
      : {}),
    shiftIds,
    shifts: shiftIds.map((shiftId) => ({
      shiftId,
      shiftName: namesById.get(shiftId) || shiftId,
    })),
  };
  const reconstructed = buildYearlyAnalysisResults({
    scenarios,
    outcomes,
    fixedConfiguration,
    nominalDailyDistanceKmByShiftId,
  });

  return {
    ...features,
    results: {
      ...(features.results ?? {}),
      shiftResults: reconstructed.shiftResults,
    },
  };
};

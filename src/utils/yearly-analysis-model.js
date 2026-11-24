import { batteryEnergy, resultBatteryPolicy } from "./battery-policy.js";
import { buildFeasibilityResultModel } from "./feasibility-result-model.js";
import { buildFleetInvestment } from "./fleet-investment.js";
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
export const YEARLY_ENERGY_UNCERTAINTY_METHOD = "independent-trip-q95-conditional-v1";
const ENERGY_COMPONENT_KEYS = Object.freeze({
  mechanicalGreyboxKwh: "total_mechanical_greybox_kwh",
  qrfResidualKwh: "total_qrf_residual_kwh",
  fixedAuxiliaryKwh: "total_fixed_auxiliary_kwh",
  hvacElectricalKwh: "total_hvac_electrical_kwh",
  hvacInTripElectricalKwh: "total_hvac_in_trip_electrical_kwh",
  hvacTerminalElectricalKwh: "total_hvac_terminal_electrical_kwh",
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

const readCompleteQuantiles = (value) => {
  if (!isRecord(value)) return null;
  const [q05, q50, q95] = QUANTILE_KEYS.map((key) => toFiniteNumber(value[key]));
  return q05 !== null && q50 !== null && q95 !== null
    && q05 <= q50 && q50 <= q95 ? { q05, q50, q95 } : null;
};

const normalizeUncertainty = (value) => {
  if (value?.method !== YEARLY_ENERGY_UNCERTAINTY_METHOD) return null;
  const daily = readCompleteQuantiles(value.daily_kwh);
  const scenario = readCompleteQuantiles(value.scenario_daily_kwh);
  const ids = uniqueTexts(value.scenario_prediction_run_ids);
  const validScenario = scenario && ids.length > 0 && ids.length === value.scenario_prediction_run_ids.length;
  const provenance = Object.fromEntries(["samples", "seed", "scenario_samples", "scenario_seed"]
    .filter((key) => Number.isSafeInteger(value[key]) && value[key] >= 0)
    .map((key) => [key, value[key]]));
  return {
    method: YEARLY_ENERGY_UNCERTAINTY_METHOD,
    daily_kwh: daily,
    scenario_daily_kwh: validScenario ? scenario : null,
    scenario_prediction_run_ids: validScenario ? ids : [],
    ...provenance,
  };
};

const sameIds = (left, right) => left.length === right.length && left.every((id) => right.includes(id));

const selectYearlyUncertainty = (value, runIds) => {
  const uncertainty = normalizeUncertainty(value);
  if (!uncertainty || !runIds.length) return null;
  const { daily_kwh: daily, scenario_daily_kwh: scenario, scenario_prediction_run_ids: ids } = uncertainty;
  if (runIds.length === 1) {
    return daily && (!ids.length || ids.includes(runIds[0])) ? uncertainty : null;
  }
  if (!scenario || !sameIds(runIds, ids)) return null;
  const { samples: _samples, seed: _seed, ...scenarioUncertainty } = uncertainty;
  return {
    ...scenarioUncertainty,
    daily_kwh: scenario,
    ...(uncertainty.scenario_samples != null ? { samples: uncertainty.scenario_samples } : {}),
    ...(uncertainty.scenario_seed != null ? { seed: uncertainty.scenario_seed } : {}),
  };
};

const selectSharedUncertainty = (sources, runIds) => {
  const matches = sources.map((source) => selectYearlyUncertainty(source, runIds)).filter(Boolean);
  const first = matches[0];
  return first && matches.every((match) => QUANTILE_KEYS.every(
    (key) => match.daily_kwh[key] === first.daily_kwh[key],
  )) ? first : null;
};

const transformQuantiles = (quantiles, transform) => quantiles
  ? Object.fromEntries(QUANTILE_KEYS.map((key) => [key, transform(quantiles[key])]))
  : null;

const applyYearlyUncertainty = (kpis, uncertainty) => {
  const { energyUncertainty: _storedUncertainty, ...clean } = kpis;
  const quantiles = uncertainty?.daily_kwh ?? null;
  const aux = toFiniteNumber(kpis.auxiliaryEnergyKwh);
  const distance = toFiniteNumber(kpis.distanceKm);
  const drivetrainQuantiles = aux === null ? null : transformQuantiles(quantiles, (value) => value - aux);
  return {
    ...clean,
    quantiles,
    drivetrainQuantiles,
    consumptionPerKmQuantiles: distance > 0 ? transformQuantiles(quantiles, (value) => value / distance) : null,
    drivetrainPerKmQuantiles: distance > 0 ? transformQuantiles(drivetrainQuantiles, (value) => value / distance) : null,
    ...(uncertainty ? { energyUncertainty: uncertainty } : {}),
  };
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
  const policy = resultBatteryPolicy(optimizationRun);
  const operatingAssumptions = Object.fromEntries([
    "version", "state_of_health", "battery_soc_policy", "reference_min_soc", "reference_max_soc",
    "allowed_min_soc", "allowed_max_soc", "min_soc", "max_soc", "usable_fraction_initial",
    "low_soc_warning", "preferred_max_soc_exceeded", "session_connection_minutes", "layover_reduction_minutes",
  ].filter(key => policy[key] !== undefined).map(key => [key, policy[key]]));
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
          selectedPacks: feasibility.fleet.battery.decision === 'fixed' ? fixedPacks ?? source.battery.optimizedPacks : source.battery.optimizedPacks,
          commonPacks: feasibility.fleet.battery.decision === 'fixed' ? fixedPacks ?? source.battery.optimizedPacks : source.battery.optimizedPacks,
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
    if (battery && Number.isFinite(battery.selectedPacks * packSizeKwh) && packSizeKwh > 0) {
      battery.energy = optimizationRun.results?.battery_results?.[shiftId]?.battery_energy
        ?? batteryEnergy(battery.selectedPacks * packSizeKwh, policy);
    }
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
    uniform: new Set(shifts.map(shift => shift.battery?.selectedPacks)).size === 1,
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
    investment: buildFleetInvestment(optimizationRun),
    operatingAssumptions,
    soc: {
      minFraction: policy.min_soc,
      maxFraction: policy.max_soc,
    },
    battery,
    infrastructure: feasibility.infrastructure,
    shifts,
  };
};

/** Batch predictions only for duties with the same selected physical battery. */
export const buildYearlyPredictionGroups = (fixedConfiguration = {}) => {
  const groups = new Map();
  for (const shift of fixedConfiguration.shifts ?? []) {
    const packs = shift.battery?.selectedPacks ?? shift.battery?.optimizedPacks;
    if (!Number.isInteger(packs) || packs <= 0) throw new Error("Missing selected battery size");
    if (!groups.has(packs)) groups.set(packs, { packs, shiftIds: [] });
    groups.get(packs).shiftIds.push(shift.shiftId);
  }
  return [...groups.values()];
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

  return applyYearlyUncertainty({
    feasible: null,
    solverStatus: "prediction-only",
    totalEnergyKwh: toFiniteNumber(summary.total_consumption_kwh),
    drivetrainEnergyKwh: toFiniteNumber(summary.total_drivetrain_kwh),
    auxiliaryEnergyKwh: toFiniteNumber(summary.total_auxiliary_kwh),
    distanceKm: toFiniteNumber(summary.total_distance_km),
    energyPerKm: toFiniteNumber(summary.consumption_per_km_kwh),
    auxiliaryPerKmKwh: toFiniteNumber(summary.auxiliary_per_km_kwh),
    drivetrainPerKmKwh: toFiniteNumber(summary.drivetrain_per_km_kwh),
    predictionStack: text(predictionRun?.prediction_stack) || null,
    modelRelease: text(predictionRun?.model_name) || null,
    auxiliaryEstimatorRelease:
      text(predictionRun?.auxiliary_estimator_release) || null,
    ...(Object.keys(energyComponents).length ? { energyComponents } : {}),
  }, selectYearlyUncertainty(summary.energy_uncertainty, uniqueTexts([predictionRun.id])));
};

export const aggregatePredictionKpis = (kpisList = [], predictionRunIds = []) => {
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
  const runIds = uniqueTexts(predictionRunIds);
  const uncertainty = runIds.length === kpisList.length
    ? selectSharedUncertainty(kpisList.map((kpis) => kpis.energyUncertainty), runIds)
    : null;
  const energyComponents = aggregateEnergyComponents(kpisList);
  const feasibleValues = kpisList.map((kpis) => kpis.feasible);
  const feasible = feasibleValues.some((value) => value === false)
    ? false
    : feasibleValues.every((value) => value === true)
      ? true
      : null;

  return applyYearlyUncertainty({
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
    predictionStack: commonValue(kpisList, "predictionStack"),
    modelRelease: commonValue(kpisList, "modelRelease"),
    auxiliaryEstimatorRelease: commonValue(
      kpisList,
      "auxiliaryEstimatorRelease",
    ),
    ...(energyComponents
      ? { energyComponents }
      : {}),
  }, uncertainty);
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
      error = `No prediction result returned for vehicle block ${shiftId}.`;
    } else if (!error && matches.length > 1) {
      error = `Multiple prediction results returned for vehicle block ${shiftId}.`;
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
      : aggregatePredictionKpis(shiftResults.map((result) => result.kpis), predRunIds),
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
        error: `Prediction result is unavailable for vehicle block ${shiftId}.`,
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

const scenarioRows = (value) => Array.isArray(value) ? value : [];

const rowPredictionIds = (row) => uniqueTexts([
  ...scenarioRows(row?.predRunIds), row?.predRunId,
]);

const usablePredictionRun = (run) => isRecord(run?.summary)
  && !["failed", "cancelled", "canceled"].includes(text(run?.status).toLowerCase());

const legacyScenarioRuns = (row, rows, descriptors, runs) => {
  const runIds = rowPredictionIds(row);
  if (runIds.length) return runs.filter((run) => runIds.includes(text(run.id)));
  const scenarioId = text(row.scenarioId);
  const exact = scenarioId ? runs.filter((run) =>
    text(run.contextual_parameters?.yearly_scenario_id) === scenarioId,
  ) : [];
  if (exact.length) return exact;
  if ([rows, descriptors].some((scenarios) =>
    scenarios.filter((scenario) => sameTemperature(scenario?.temperature, row.temperature)).length > 1,
  )) return [];
  return runs.filter((run) => sameTemperature(predictionRunTemperature(run), row.temperature));
};

const mapScenarioResults = (features, mapper) => {
  if (!isRecord(features?.results)) return features;
  const { results } = features;
  const mapRows = (rows, shiftId = null) => rows.map((row) => mapper(row, rows, shiftId));
  return {
    ...features,
    results: {
      ...results,
      ...(Array.isArray(results.scenarioResults)
        ? { scenarioResults: mapRows(results.scenarioResults) } : {}),
      ...(Array.isArray(results.shiftResults) ? {
        shiftResults: results.shiftResults.map((shift) => ({
          ...shift,
          ...(Array.isArray(shift.scenarioResults)
            ? { scenarioResults: mapRows(shift.scenarioResults, shift.shiftId) } : {}),
        })),
      } : {}),
    },
  };
};

const validRowIds = (row, shiftId, expectedShifts) => {
  const runIds = rowPredictionIds(row);
  const expectedCount = shiftId ? 1 : expectedShifts.length;
  return expectedCount && runIds.length !== expectedCount ? [] : runIds;
};

/** Remove legacy percentile sums from the view model and from technical exports. */
export const sanitizeYearlyEnergyUncertainty = (features) => {
  const expectedShifts = configuredYearlyShiftIds(features);
  return mapScenarioResults(features, (row, _rows, shiftId) => {
    if (!row?.kpis) return row;
    const runIds = validRowIds(row, shiftId, expectedShifts);
    return { ...row, kpis: applyYearlyUncertainty(row.kpis,
      row.error ? null : selectYearlyUncertainty(row.kpis.energyUncertainty, runIds),
    ) };
  });
};

/**
 * Resolve historical intervals for the actual prediction IDs behind each row.
 * Matching by temperature is limited to legacy rows without saved IDs and
 * requires a unique cluster and at most one usable prediction per block.
 */
export const hydrateYearlyEnergyUncertainty = async (
  features, predictionRuns = [], loadUncertainty = async () => null,
) => {
  const runs = scenarioRows(predictionRuns).filter(usablePredictionRun);
  const runsById = new Map(runs.map((run) => [text(run.id), run]));
  const shiftIds = configuredYearlyShiftIds(features);
  const general = scenarioRows(features?.results?.scenarioResults);
  const descriptors = scenarioRows(features?.scenarios);
  const withIds = mapScenarioResults(features, (row, rows, shiftId) => {
    if (!row?.kpis || row.error || rowPredictionIds(row).length) return row;
    let matches = legacyScenarioRuns(row, rows, descriptors, runs);
    if (shiftId) {
      const matchingGeneral = general.filter((scenario) =>
        text(row.scenarioId) && text(row.scenarioId) === text(scenario.scenarioId),
      );
      if (matchingGeneral.length === 1 && rowPredictionIds(matchingGeneral[0]).length) {
        matches = rowPredictionIds(matchingGeneral[0]).map((id) => runsById.get(id)).filter(Boolean);
      }
      matches = matches.filter((run) => {
        const ids = resolvePredictionRunShiftIds(run);
        return ids.length === 1 && ids[0] === shiftId
          || ids.length === 0 && shiftIds.length === 1;
      });
      const predictionRunId = matches.length === 1 && text(matches[0].id);
      return predictionRunId ? { ...row, predRunId: predictionRunId } : row;
    }

    // Require all configured blocks and exclude repeated runs for a block.
    if (!shiftIds.length) return row;
    const outcome = buildYearlyScenarioOutcome({ scenario: row, shiftIds, predictionRuns: matches });
    const ids = outcome.aggregateResult.predRunIds;
    if (outcome.aggregateResult.error || ids.length !== shiftIds.length) return row;
    return { ...row, predRunId: ids.length === 1 ? ids[0] : null, predRunIds: ids };
  });

  const applySources = (source, loaded = new Map()) => mapScenarioResults(source, (row, _rows, shiftId) => {
    if (!row?.kpis || row.error) return row;
    const ids = validRowIds(row, shiftId, shiftIds);
    const uncertainty = selectYearlyUncertainty(row.kpis.energyUncertainty, ids)
      ?? selectSharedUncertainty(ids.flatMap((id) => [
        runsById.get(id)?.summary?.energy_uncertainty, loaded.get(id),
      ]), ids);
    return { ...row, kpis: applyYearlyUncertainty(row.kpis, uncertainty) };
  });

  const withSavedUncertainty = applySources(withIds);
  const groupIdsByMember = new Map();
  const shiftRowsByScenario = new Map();
  for (const shift of scenarioRows(withSavedUncertainty?.results?.shiftResults)) {
    for (const row of scenarioRows(shift.scenarioResults)) {
      const id = text(row.scenarioId);
      if (!id) continue;
      const rows = shiftRowsByScenario.get(id) ?? [];
      rows.push(row);
      shiftRowsByScenario.set(id, rows);
    }
  }
  for (const rows of shiftRowsByScenario.values()) {
    const ids = uniqueTexts(rows.flatMap(rowPredictionIds));
    if (ids.length === rows.length) ids.forEach((id) => groupIdsByMember.set(id, ids));
  }
  for (const row of scenarioRows(withSavedUncertainty?.results?.scenarioResults)) {
    const ids = validRowIds(row, null, shiftIds);
    ids.forEach((id) => groupIdsByMember.set(id, ids));
  }

  const pending = new Map();
  mapScenarioResults(withSavedUncertainty, (row, _rows, shiftId) => {
    if (!row?.kpis || row.error || row.kpis.energyUncertainty) return row;
    const ids = validRowIds(row, shiftId, shiftIds);
    if (ids.length) {
      const group = groupIdsByMember.get(ids[0]) ?? ids;
      pending.set(JSON.stringify([...group].sort()), group);
    }
    return row;
  });
  const requests = [...pending.values()];
  if (!requests.length) return withSavedUncertainty;
  const loaded = new Map();
  const loadNext = async () => {
    while (requests.length) {
      const group = requests.shift();
      try {
        const response = await loadUncertainty(group[0]);
        const byRunId = response?.by_prediction_run;
        if (!isRecord(byRunId) || !Object.hasOwn(byRunId, group[0])) continue;
        for (const id of group) {
          if (Object.hasOwn(byRunId, id)) loaded.set(id, byRunId[id]);
        }
      } catch {
        // Historical records may lack enough inputs to replay the interval.
      }
    }
  };
  await Promise.all([loadNext(), loadNext()]);
  return applySources(withSavedUncertainty, loaded);
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
    const sameId = generalScenarioResults.filter((row) => text(row.scenarioId) === scenario.scenarioId);
    const sameTemp = generalScenarioResults.filter((row) => sameTemperature(row.temperature, scenario.temperature));
    const savedRows = sameId.length ? sameId : sameTemp;
    const row = savedRows.length === 1 ? savedRows[0] : scenario;
    const usableRuns = legacyScenarioRuns(row, scenarios, generalScenarioResults, runs)
      .filter(usablePredictionRun);
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

export const FEASIBILITY_FAILURE_GUIDANCE = Object.freeze({
  DEPOT_MISMATCH: "depot_mismatch",
  STOP_NOT_DEPOT: "stop_not_depot",
  DEPOT_NOT_SELECTED: "depot_not_selected",
  DEPOT_DWELL: "depot_dwell",
  PREDICTION_REFRESH: "prediction_refresh",
  PREDICTION_DISTRIBUTION: "prediction_distribution",
  PREDICTION_CONSISTENCY: "prediction_consistency",
  BUS_MODEL: "bus_model",
  BUS_COSTS: "bus_costs",
  OPERATIONAL_DATA: "operational_data",
  TIME_BUDGET: "time_budget",
  CONFIGURATION: "configuration",
  SYSTEM: "system",
  BLOCKED: "blocked",
  GENERIC: "generic",
});

const firstText = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
};

const extractLeadingShiftName = (message) => {
  const match = firstText(message)?.match(/^([^:]{1,120}):\s+/);
  return firstText(match?.[1]);
};

const shiftNameForId = (shiftNamesById, shiftId) => {
  const normalizedShiftId = firstText(shiftId);
  if (!normalizedShiftId || !shiftNamesById) return null;
  if (shiftNamesById instanceof Map) {
    return firstText(shiftNamesById.get(normalizedShiftId));
  }
  return firstText(shiftNamesById[normalizedShiftId]);
};

const classifyFailure = ({ code, message }) => {
  const normalizedCode = firstText(code)?.toLowerCase();
  if (normalizedCode === "daily_cycle_depot_mismatch") {
    return FEASIBILITY_FAILURE_GUIDANCE.DEPOT_MISMATCH;
  }
  if (normalizedCode === "daily_cycle_stop_not_depot") {
    return FEASIBILITY_FAILURE_GUIDANCE.STOP_NOT_DEPOT;
  }
  if (normalizedCode === "daily_cycle_depot_not_selected") {
    return FEASIBILITY_FAILURE_GUIDANCE.DEPOT_NOT_SELECTED;
  }

  const text = firstText(message)?.toLowerCase() ?? "";
  if (
    text.includes("start and end at the same depot") ||
    text.includes("requires matching depots")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.DEPOT_MISMATCH;
  }
  if (
    text.includes("common start/end stop to be a registered depot") ||
    text.includes("configure the actual start/end depot")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.STOP_NOT_DEPOT;
  }
  if (text.includes("select the start/end depot in charging infrastructure")) {
    return FEASIBILITY_FAILURE_GUIDANCE.DEPOT_NOT_SELECTED;
  }
  if (text.includes("leave time for a daily depot stay")) {
    return FEASIBILITY_FAILURE_GUIDANCE.DEPOT_DWELL;
  }
  if (
    text.includes("battery_pack_cost_chf") ||
    text.includes("battery pack cost in the bus model") ||
    text.includes("invalid bus cost in the bus model")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.BUS_COSTS;
  }
  if (
    text.includes("cannot determine bus_model_id") ||
    /bus model .* (?:not found|no longer exists)/.test(text) ||
    text.includes("bus model is no longer available") ||
    text.includes("bus_model_id does not match") ||
    text.includes("prediction capacity does not match the physical bus model") ||
    text.includes("reference battery is outside physical bus limits") ||
    text.includes("same battery pack size for every bus")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.BUS_MODEL;
  }
  if (
    text.includes("must share one model, stack and auxiliary estimator") ||
    text.includes("auxiliary estimator does not match") ||
    text.includes("battery variants must share bus model") ||
    text.includes("prediction catalogue must cover exactly") ||
    text.includes("reference_prediction_run_ids must cover exactly") ||
    (text.includes("reference for shift") && text.includes("prediction catalogue"))
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.PREDICTION_CONSISTENCY;
  }
  if (
    /prediction run .* not found/.test(text) ||
    text.includes("does not cover the current complete shift sequence") ||
    text.includes("no longer covers the complete ordered shift") ||
    text.includes("prediction mass/capacity is stale") ||
    text.includes("recalculate its forecast") ||
    text.includes("do not reproduce the reference forecast") ||
    text.includes("missing or non-finite energy/mass sensitivity") ||
    text.includes("trip energy and mass sensitivity must be finite") ||
    text.includes("has no explicit battery pack count") ||
    text.includes("has an invalid battery pack count") ||
    /prediction .* is not completed/.test(text) ||
    text.includes("prediction row has no") ||
    text.includes("aggregate profile does not cover every trip occurrence") ||
    text.includes("prediction component breakdown is only partially available") ||
    text.includes("invalid prediction component") ||
    text.includes("energy profile must cover every trip occurrence")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.PREDICTION_REFRESH;
  }
  if (
    text.includes("requires a supported complete predictive distribution") ||
    text.includes("qrf model has no fitted estimators") ||
    text.includes("predictive distribution contains non-finite energy") ||
    text.includes("recovered distribution does not reproduce") ||
    text.includes("complete finite predictive support is required")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.PREDICTION_DISTRIBUTION;
  }
  if (
    /trip .* has no stop times/.test(text) ||
    /trip .* has invalid stop times/.test(text) ||
    /shift .* has no trips/.test(text) ||
    text.includes("no trips found across all buses") ||
    text.includes("invalid profile or charging timeline")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.OPERATIONAL_DATA;
  }
  if (
    text.includes("time budget exhausted") ||
    text.includes("within the time budget") ||
    text.includes("budget exhausted during preparation")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.TIME_BUDGET;
  }
  if (
    text.includes("must appear exactly once in the optimizer") ||
    text.includes("charging station identifiers must be unique") ||
    text.includes("fixed infrastructure") ||
    text.includes("fixed batteries") ||
    text.includes("fixed battery exceeds") ||
    text.includes("battery packs and installed slots must be fixed") ||
    text.includes("daily cycles require entire-dwell occupancy") ||
    text.includes("finite non-empty occurrence-by-support matrix") ||
    text.includes("invalid aggregate sample count/limit") ||
    text.includes("aggregate precision must be positive") ||
    text.includes("charging_only requires an explicit battery configuration") ||
    text.includes("soc reserve optimization")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.CONFIGURATION;
  }
  if (
    /optimization run .* not found/.test(text) ||
    text.includes("worker requires a pending optimization") ||
    text.includes("worker finished without a terminal result") ||
    text.includes("unknown charging objective") ||
    text.includes("unsupported solver") ||
    text.includes("solver_threads must be positive") ||
    text.includes("no peak refinement solution")
  ) {
    return FEASIBILITY_FAILURE_GUIDANCE.SYSTEM;
  }
  return FEASIBILITY_FAILURE_GUIDANCE.GENERIC;
};

const uniqueGuidance = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const signature = JSON.stringify([item.kind, item.shiftName, item.blockingShiftNames]);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

export function buildFeasibilityFailureGuidance({
  failure = null,
  outcome = null,
  blockingShiftNames = [],
  selectedShiftName = null,
  shiftNamesById = null,
} = {}) {
  if (outcome?.status === "not_evaluated") {
    const normalizedBlockingShiftNames = blockingShiftNames
      .map(firstText)
      .filter(Boolean);
    if (!normalizedBlockingShiftNames.length) {
      return [{ kind: FEASIBILITY_FAILURE_GUIDANCE.GENERIC }];
    }
    return [{
      kind: FEASIBILITY_FAILURE_GUIDANCE.BLOCKED,
      blockingShiftNames: normalizedBlockingShiftNames,
    }];
  }

  const failureIssues = Array.isArray(failure?.issues) ? failure.issues : [];
  const outcomeIssues = Array.isArray(outcome?.issues) ? outcome.issues : [];
  const issues = outcomeIssues.length ? outcomeIssues : outcome ? [] : failureIssues;
  const issueGuidance = issues.map((issue) => ({
    kind: classifyFailure({ code: issue?.code, message: issue?.message }),
    shiftName: firstText(
      selectedShiftName,
      shiftNameForId(shiftNamesById, issue?.shiftId),
      issue?.shiftName,
      outcome?.shiftName,
      extractLeadingShiftName(issue?.message),
    ),
  }));
  if (issueGuidance.length) return uniqueGuidance(issueGuidance);

  const failureCodes = Array.isArray(outcome?.failureCodes)
    ? outcome.failureCodes
    : [];
  const codedGuidance = failureCodes.map((code) => ({
    kind: classifyFailure({ code, message: failure?.message }),
    shiftName: firstText(
      selectedShiftName,
      shiftNameForId(shiftNamesById, outcome?.shiftId),
      outcome?.shiftName,
      extractLeadingShiftName(failure?.message),
    ),
  }));
  if (codedGuidance.length) return uniqueGuidance(codedGuidance);

  const message = firstText(failure?.message);
  return [{
    kind: classifyFailure({ message }),
    shiftName: firstText(
      selectedShiftName,
      shiftNameForId(shiftNamesById, outcome?.shiftId),
      outcome?.shiftName,
      extractLeadingShiftName(message),
    ),
  }];
}

import { FEASIBILITY_ASSESSMENT_METHOD } from './feasibility-assessment.js';
import { resolveFeasibilityDemandBasis } from './feasibility-demand-basis.js';
import { scopePredictionRunsByShift } from './feasibility-shift-scope.js';

export const FEASIBILITY_EXPORT_SCHEMA_VERSION = 1;

const same = (a, b) => Object.is(a, b) || Boolean(a && b && typeof a === 'object' && typeof b === 'object' &&
  Array.isArray(a) === Array.isArray(b) &&
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const id = value => value == null ? null : String(value).trim() || null;
const ids = values => [...new Set((Array.isArray(values) ? values : []).map(id).filter(Boolean))];
const values = record => Object.values(record ?? {});
const quality = issues => ({ status: issues.length ? 'partial' : 'complete', issues });
const issue = (code, shiftId) => ({ code, ...(shiftId ? { shiftId } : {}) });
const basis = run => resolveFeasibilityDemandBasis(run.input_params ?? {});
const assertFiniteNumbers = value => {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite feasibility export quantity');
  if (value && typeof value === 'object') Object.values(value).forEach(assertFiniteNumbers);
};

const verdictFor = assessment => {
  const determined = assessment.designExecution.state === 'completed' && !assessment.model.failure;
  const feasible = determined ? assessment.model.electrificationFeasible : null;
  const verificationStatus = assessment.sourceRun.results?.forecast_verification?.status ?? null;
  return {
    status: feasible === true ? 'feasible' : feasible === false ? 'infeasible' : 'not_determined',
    electrificationFeasible: feasible,
    verificationStatus,
    evidence: verificationStatus ?? 'historical_unverified',
    solverStatus: assessment.sourceRun.results?.solver_status ?? null,
  };
};

function serializeDesign({ assessment, shiftAssessments = [] }) {
  if (assessment?.method !== FEASIBILITY_ASSESSMENT_METHOD || assessment.scope.kind !== 'general') {
    throw new Error('A feasibility export requires a shared General assessment for each design');
  }
  const run = assessment.sourceRun, results = run.results ?? {}, params = run.input_params ?? {};
  if (!id(run.id)) throw new Error('A feasibility design requires a saved run ID');
  const issues = [];
  const verdict = verdictFor(assessment);
  const current = assessment.designExecution.state === 'completed' && !assessment.model.failure;
  if (!current) issues.push(issue(assessment.model.failure ? 'evaluation_failure' : `execution_${assessment.designExecution.state}`));
  if (verdict.status === 'not_determined') issues.push(issue('technical_verdict_unavailable'));
  if (!verdict.verificationStatus) issues.push(issue('historical_verification_unavailable'));
  const requestedPredictions = ids([
    ...(run.prediction_run_ids ?? []), ...values(results.selected_prediction_run_ids),
    ...values(results.initial_reference_prediction_run_ids), ...values(params.reference_prediction_run_ids),
  ]);
  const predictionsById = new Map(assessment.predictionRuns.map(row => [id(row.id), row]));
  const missingPredictions = requestedPredictions.filter(key => !predictionsById.has(key));
  if (missingPredictions.length) issues.push(issue('prediction_runs_missing'));
  for (const prediction of assessment.predictionRuns) {
    if (prediction.status && !['completed', 'done'].includes(prediction.status)) {
      issues.push({ code: 'prediction_run_not_completed', predictionRunId: id(prediction.id) });
    }
  }
  const gtfs = params.gtfs_provenance ?? null;
  const savedOperating = results.operating_assumptions ?? params.operating_assumptions;
  if (savedOperating?.version && savedOperating.version !== 'battery-timing-v1') {
    issues.push(issue('operating_assumptions_version_unsupported'));
  }
  if (!gtfs) issues.push(issue('recorded_gtfs_unavailable'));
  if (!assessment.model.infrastructure.selectionComplete) issues.push(issue('infrastructure_selection_unavailable'));
  if (assessment.model.infrastructure.totalInstallationCostChf === null) issues.push(issue('infrastructure_investment_unavailable'));
  if (assessment.fleetInvestment.missingPrices) issues.push(issue('investment_prices_unavailable'));
  if (assessment.fleetInvestment.usesCurrentPrices) issues.push(issue('current_catalogue_prices'));

  const snapshots = new Map();
  for (const snapshot of shiftAssessments) {
    const shiftId = snapshot?.scope?.shiftId;
    if (snapshot?.method !== FEASIBILITY_ASSESSMENT_METHOD || snapshot.scope.kind !== 'shift' || !shiftId ||
        snapshot.viewState.selectedShiftId !== shiftId || snapshots.has(shiftId)) {
      throw new Error('Invalid or duplicate feasibility vehicle-block assessment');
    }
    if (!same(snapshot.sourceRun, run) || !same(snapshot.operatingAssumptions, assessment.operatingAssumptions) ||
        !same(snapshot.fleetInvestment, assessment.fleetInvestment) ||
        !same(snapshot.predictionRuns, scopePredictionRunsByShift(assessment.predictionRuns, { selectedShiftId: shiftId }))) {
      throw new Error(`Vehicle block ${shiftId} refers to different feasibility inputs`);
    }
    snapshots.set(shiftId, snapshot);
  }
  const shiftIds = ids([...assessment.model.shifts.map(row => row.shiftId),
    ...assessment.infeasibility.rows.map(row => row.shiftId)]);
  if (!shiftIds.length) issues.push(issue('vehicle_block_details_unavailable'));
  if (snapshots.size !== shiftIds.length || shiftIds.some(key => !snapshots.has(key))) {
    throw new Error('The feasibility export requires exactly one assessment for every saved vehicle block');
  }
  const shifts = shiftIds.map(shiftId => {
    const snapshot = snapshots.get(shiftId), summary = snapshot.viewState.selectedShiftSummary;
    const modelRow = snapshot.model.shifts.find(row => row.shiftId === shiftId);
    const rowIssues = [];
    const kind = snapshot.isDiagnostic ? 'diagnostic' : summary?.battery.physicalFeasible === true ? 'physical' : 'unverified';
    if (!summary) rowIssues.push(issue('vehicle_block_details_unavailable', shiftId));
    if (current && snapshot.decisionConsumption.totalKwh === null) rowIssues.push(issue('decision_consumption_unavailable', shiftId));
    if (current && !snapshot.predictions.length) rowIssues.push(issue('vehicle_block_forecasts_unavailable', shiftId));
    if (current && snapshot.batteryCoverage === null) rowIssues.push(issue('battery_capacity_unavailable', shiftId));
    if (current && kind === 'unverified') rowIssues.push(issue('physical_verification_unavailable', shiftId));
    const physical = current && kind === 'physical';
    const operation = current && !snapshot.isDiagnostic ? summary?.operation ?? null : null;
    if (operation && !['complete', 'empty'].includes(operation.chargingPlan.status)) {
      rowIssues.push(issue('charging_plan_incomplete', shiftId));
    }
    const recordedGtfs = gtfs?.version === 1 && Object.hasOwn(gtfs.shifts ?? {}, shiftId)
      ? gtfs.shifts[shiftId] : null;
    if (recordedGtfs === null) rowIssues.push(issue('vehicle_block_recorded_gtfs_unavailable', shiftId));
    issues.push(...rowIssues);
    return {
      shiftId, shiftName: modelRow?.shiftName ?? snapshot.diagnosticRow?.shiftName ?? shiftId,
      scope: { kind: 'vehicle_block', shiftId, assessmentKind: kind },
      outcome: modelRow?.outcome ?? null,
      battery: { configuration: modelRow?.battery ?? null, summary: summary?.battery ?? null,
        singlePackCapacityKwh: snapshot.singlePackCapacityKwh,
        nominalCapacityKwh: snapshot.batteryCoverage?.nominalKwh ?? null,
        usableCapacityKwh: snapshot.batteryCoverage?.usableKwh ?? null },
      consumption: current ? snapshot.decisionConsumption : null,
      energyBalance: current && !snapshot.isDiagnostic ? snapshot.energyBalance : null,
      energyComparison: current ? snapshot.energyComparison : null,
      sizingEffect: current ? snapshot.sizingEffect : null,
      operation: { status: operation ? physical ? 'available' : 'unverified' : kind === 'diagnostic' ? 'diagnostic_only' : 'unavailable',
        verificationStatus: verdict.verificationStatus, result: operation },
      forecasts: snapshot.predictions,
      diagnostic: snapshot.isDiagnostic ? {
        source: snapshot.diagnosticRow?.source ?? null,
        scope: snapshot.diagnosticRow?.source === 'diagnostic' ? 'relaxed_diagnostic' : 'saved_infeasible_result',
        result: snapshot.diagnosticRow,
        consumptionComparable: snapshot.diagnosticConsumptionComparable,
      } : null,
      provenance: { gtfs: recordedGtfs, predictionRunIds: snapshot.predictionRuns.map(row => id(row.id)) },
      dataQuality: quality(rowIssues),
    };
  });
  return {
    run: { id: id(run.id), name: run.name ?? null, status: run.status ?? null,
      createdAt: run.created_at ?? null, completedAt: run.completed_at ?? null },
    basis: { key: basis(run), configuredConsumptionBasis: params.consumption_basis ?? null,
      configuredQuantile: params.quantile_consumption ?? null,
      methodVersion: results.consumption_analysis?.version ?? params.basis_method_version ?? null },
    execution: assessment.designExecution, verdict,
    configuration: params,
    operatingAssumptions: { source: savedOperating?.version === 'battery-timing-v1'
      ? 'recorded' : 'inputs_and_historical_defaults', values: assessment.operatingAssumptions },
    provenance: { gtfs,
      predictions: { requestedRunIds: requestedPredictions, missingRunIds: missingPredictions,
        selectedRunIds: results.selected_prediction_run_ids ?? null,
        initialReferenceRunIds: results.initial_reference_prediction_run_ids ?? null },
      hvac: { fullReproductionInputsIncluded: false,
        resource: `/api/v1/simulation/optimization-runs/${encodeURIComponent(run.id)}/auxiliary-assumptions` },
    },
    general: { scope: { kind: 'fleet_design', shiftIds },
      fleet: assessment.model.fleet, infrastructure: assessment.model.infrastructure,
      infrastructureSummary: assessment.viewState.general.infrastructureSummary,
      investment: assessment.fleetInvestment,
      failure: assessment.model.failure, diagnostics: assessment.infeasibility,
    },
    shifts,
    // Audit data is preserved separately from the current, scoped physical assessment.
    sourceData: { results: run.results ?? null, predictionRuns: assessment.predictionRuns },
    dataQuality: quality(issues),
  };
}

/** Serialize shared snapshots only. Does not fetch data, optimize, or recalculate technical results. */
export function buildFeasibilityExportDocument({ designs = [], entryRunId = null, unavailableProfiles = [],
  sourceRun = null, collectionIssues = [],
  exportedAt = new Date().toISOString() } = {}) {
  if (!designs.length) throw new Error('At least one feasibility design is required');
  const serialized = designs.map(serializeDesign);
  const byId = new Map(serialized.map(design => [design.run.id, design]));
  if (byId.size !== serialized.length) throw new Error('Duplicate feasibility design ID');
  const entryId = id(entryRunId) ?? serialized[0].run.id;
  const entry = byId.get(entryId);
  if (!entry) throw new Error('The entry feasibility design is missing');
  const references = new Map();
  for (const design of serialized) for (const [key, value] of Object.entries(design.configuration.basis_run_ids ?? {})) {
    if (!['mean', 'aggregate_q95'].includes(key) || !id(value)) throw new Error('Invalid paired feasibility reference');
    if (references.has(key) && references.get(key) !== id(value)) throw new Error('Conflicting paired feasibility references');
    references.set(key, id(value));
  }
  if (new Set(references.values()).size !== references.size) throw new Error('A paired design ID cannot represent both bases');
  const rootId = id(entry.configuration.basis_source_run_id) ?? references.get('mean') ?? entryId;
  if (sourceRun && (id(sourceRun.id) !== rootId || (byId.has(rootId) &&
      !same(sourceRun, designs.find(design => id(design.assessment.sourceRun.id) === rootId).assessment.sourceRun)))) {
    throw new Error('The source feasibility record belongs to another snapshot');
  }
  if (references.has('mean') && references.get('mean') !== rootId) throw new Error('Conflicting feasibility family root');
  const profiles = new Map(['mean', 'aggregate_q95'].map(key => [key, {
    basis: key, runId: references.get(key) ?? null,
    status: references.has(key) ? 'unavailable' : 'not_recorded', error: null,
  }]));
  for (const design of serialized) {
    const parent = id(design.configuration.basis_source_run_id);
    if ((parent && parent !== rootId) ||
        (design.run.id !== rootId && parent !== rootId && ![...references.values()].includes(design.run.id)) ||
        (references.has(design.basis.key) && references.get(design.basis.key) !== design.run.id)) {
      throw new Error('A feasibility design belongs to another family or basis');
    }
    const key = design.basis.key;
    if (['available', 'pending', 'running', 'failed'].includes(profiles.get(key)?.status)) {
      throw new Error('Ambiguous feasibility design basis');
    }
    profiles.set(key, { basis: key, runId: design.run.id,
      status: design.execution.state === 'completed' ? 'available' : design.execution.state, error: null });
  }
  const missingBases = new Set();
  for (const missing of unavailableProfiles) {
    if (!['mean', 'aggregate_q95'].includes(missing.basis) ||
        !['unavailable', 'pending', 'running', 'failed', 'not_calculated'].includes(missing.status) ||
        missingBases.has(missing.basis) || (missing.status === 'not_calculated' && id(missing.runId) !== null) ||
        byId.has(id(missing.runId)) ||
        (references.has(missing.basis) && references.get(missing.basis) !== id(missing.runId)) ||
        (profiles.get(missing.basis)?.runId && !references.has(missing.basis))) {
      throw new Error('Invalid unavailable feasibility profile');
    }
    missingBases.add(missing.basis);
    profiles.set(missing.basis, { basis: missing.basis, runId: id(missing.runId), status: missing.status,
      error: missing.error == null ? null : String(missing.error) });
  }
  const profileList = [...profiles.values()];
  const assignedIds = profileList.map(profile => profile.runId).filter(Boolean);
  if (new Set(assignedIds).size !== assignedIds.length) throw new Error('A feasibility run ID cannot represent multiple profiles');
  const issues = [...collectionIssues,
    ...serialized.flatMap(design => design.dataQuality.issues.map(item => ({ ...item, runId: design.run.id })))];
  for (const profile of profileList) if (!['available', 'not_recorded', 'not_calculated'].includes(profile.status)) {
    issues.push({ code: `profile_${profile.status}`, basis: profile.basis, runId: profile.runId });
  }
  if (!byId.has(rootId) && !sourceRun) issues.push({ code: 'source_design_unavailable', runId: rootId });
  const document = { schemaVersion: FEASIBILITY_EXPORT_SCHEMA_VERSION, kind: 'feasibility_evaluation', exportedAt,
    evaluation: { id: rootId, entryRunId: entryId, name: byId.get(rootId)?.run.name ?? sourceRun?.name ?? null,
      sourceRecord: sourceRun && !byId.has(rootId) ? { id: rootId, name: sourceRun.name ?? null,
        status: sourceRun.status ?? null, inputParams: sourceRun.input_params ?? null,
        predictionRunIds: sourceRun.prediction_run_ids ?? [], results: sourceRun.results ?? null } : null,
      recordedExecution: designs.find(design => id(design.assessment.sourceRun.id) === entryId).assessment.execution,
      recordedPairedOutcome: designs.find(design => id(design.assessment.sourceRun.id) === entryId).assessment.pairedOutcome },
    units: { energy: 'kWh', batteryCapacity: 'kWh_nominal', power: 'kW_DC', distance: 'km', specificConsumption: 'kWh/km',
      currency: 'CHF', duration: 'min', clockTime: 'minutes_since_service_day_start', soc: 'fraction_of_residual_capacity' },
    methodology: { assessment: FEASIBILITY_ASSESSMENT_METHOD, coverage: 'recorded_designs',
      sharedInfrastructure: 'once_per_design', forecastQuantiles: 'not_aggregate_decision_profiles' },
    profiles: profileList,
    designs: serialized,
    dataQuality: quality(issues),
  };
  assertFiniteNumbers(document);
  return structuredClone(document);
}

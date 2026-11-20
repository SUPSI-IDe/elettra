import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFeasibilityExportReconciles } from '../test-support/feasibility-export-reconciliation.js';
import { buildFeasibilityExportDocument } from '../src/utils/feasibility-export.js';
import { feasibilityExportFixture as fixture, feasibilityExportSnapshots as snapshots } from '../test-support/feasibility-export-fixture.js';

const exportedAt = '2026-11-20T12:00:00.000Z';
const documentFor = (options, extra = {}) => buildFeasibilityExportDocument({ designs: [snapshots(options)], exportedAt, ...extra });
const paired = (settings = {}) => ['mean', 'aggregate_q95'].map(basis => snapshots(fixture({ ...settings, basis })));
const codes = document => document.dataQuality.issues.map(row => row.code);

for (const mode of ['battery_only', 'charging_only', 'joint']) for (const uniform of [false, true]) {
  test(`JSON reconciles both full designs: ${mode}, ${uniform ? 'uniform' : 'different'} batteries`, () => {
    const designs = paired({ mode, uniform });
    const document = buildFeasibilityExportDocument({ designs, entryRunId: 'q95-design', exportedAt });
    assert.equal(document.schemaVersion, 1);
    assert.equal(document.kind, 'feasibility_evaluation');
    assert.equal(document.evaluation.id, 'mean-design');
    assert.equal(document.evaluation.entryRunId, 'q95-design');
    assert.equal(document.exportedAt, exportedAt);
    assert.equal(document.dataQuality.status, 'complete');
    assert.deepEqual(document.profiles.map(row => row.status), ['available', 'available']);
    assert.deepEqual(JSON.parse(JSON.stringify(document)), document);
    assertFeasibilityExportReconciles(JSON.parse(JSON.stringify(document)));
    document.designs.forEach((design, index) => {
      const source = designs[index];
      assert.equal(design.verdict.status, 'feasible');
      assert.equal(design.verdict.verificationStatus, 'verified');
      assert.deepEqual(design.general.infrastructure, source.assessment.model.infrastructure);
      assert.deepEqual(design.general.investment, source.assessment.fleetInvestment);
      assert.equal(design.general.investment.totals.totalCost,
        design.general.investment.rows.reduce((sum, row) => sum + row.totalCost, 0));
      assert.equal(design.shifts.reduce((sum, row) => sum + row.battery.nominalCapacityKwh, 0),
        design.general.investment.totals.capacity);
      for (const block of design.shifts) {
        const snapshot = source.shiftAssessments.find(row => row.scope.shiftId === block.shiftId);
        assert.deepEqual(block.consumption, snapshot.decisionConsumption);
        assert.deepEqual(block.energyBalance, snapshot.energyBalance);
        assert.deepEqual(block.energyComparison, snapshot.energyComparison);
        assert.deepEqual(block.forecasts, snapshot.predictions);
        assert.deepEqual(block.operation.result, snapshot.viewState.selectedShiftSummary.operation);
      }
    });
    assert.equal(document.designs[0].shifts[0].consumption.totalKwh, 300);
    assert.equal(document.designs[1].shifts[0].consumption.totalKwh, 390.123456789);
    assert.equal(document.designs[1].shifts[0].forecasts.find(row => row.isOptimized).totalConsumptionQ95Kwh, 500);
    assert.equal(document.designs[0].shifts[0].operation.result.chargingPlan.sessions[0].endMinute, 1500);
    assert.equal(document.designs[0].shifts[1].operation.result.chargingPlan.status, 'empty');
    assert.equal(document.designs[0].general.infrastructure.totalInstallationCostChf, 100000);
    assert.equal(document.designs[1].general.infrastructure.totalInstallationCostChf, 150000);
  });
}

test('provenance and original audit results retain saved GTFS, forecast IDs, HVAC references and all trajectories', () => {
  const options = fixture();
  options.optimizationRun.results.per_bus_summary[0].energy_timeline = { soc_kwh: [450, 200], charge_kwh: [50, 50] };
  const design = documentFor(options).designs[0];
  assert.deepEqual(design.provenance.gtfs, options.optimizationRun.input_params.gtfs_provenance);
  assert.deepEqual(design.sourceData.results, options.optimizationRun.results);
  assert.deepEqual(design.sourceData.predictionRuns.map(row => row.id).sort(), options.predictionRuns.map(row => row.id).sort());
  assert.equal(design.configuration.bus_model_snapshot.name, 'Frozen bus');
  assert.equal(design.operatingAssumptions.source, 'recorded');
  assert.equal(design.provenance.hvac.fullReproductionInputsIncluded, false);
  assert.match(design.provenance.hvac.resource, /mean-design\/auxiliary-assumptions$/);
});

for (const status of ['pending', 'running', 'failed', 'unavailable']) {
  test(`a ${status} Q95 does not invalidate the verified Mean design`, () => {
    const options = fixture();
    options.optimizationRun.basis_summaries = {
      mean: { status: 'completed', verification_status: 'verified', electrification_feasible: true },
      aggregate_q95: { status },
    };
    const document = documentFor(options, { unavailableProfiles: [{ basis: 'aggregate_q95', runId: 'q95-design', status, error: 'Fixture unavailable' }] });
    assert.equal(document.designs[0].execution.state, 'completed');
    assert.equal(document.designs[0].verdict.status, 'feasible');
    assert.equal(document.designs[0].shifts[0].consumption.totalKwh, 300);
    assert.equal(document.profiles[1].status, status);
    assert.equal(document.profiles[1].error, 'Fixture unavailable');
    assert.equal(document.dataQuality.status, 'partial');
  });
}

test('the paired result stays orange in its recorded summary, with separate physical and diagnostic scopes', () => {
  const designs = paired();
  const q95 = fixture({ basis: 'aggregate_q95' });
  q95.optimizationRun.results.electrification_feasible = false;
  q95.optimizationRun.results.forecast_verification.status = 'physical_limits_exceeded';
  Object.assign(q95.optimizationRun.results.battery_results.a, { physical_feasible: false, required_total_packs: 20 });
  const mean = fixture();
  mean.optimizationRun.basis_summaries = {
    mean: { status: 'completed', verification_status: 'verified', electrification_feasible: true },
    aggregate_q95: { status: 'completed', verification_status: 'physical_limits_exceeded', electrification_feasible: false },
  };
  designs[0] = snapshots(mean);
  designs[1] = snapshots(q95);
  const document = buildFeasibilityExportDocument({ designs });
  assert.equal(document.evaluation.recordedPairedOutcome.key, 'mean_only');
  assert.equal(document.designs[0].verdict.status, 'feasible');
  assert.equal(document.designs[1].verdict.status, 'infeasible');
  assert.equal(document.profiles[1].status, 'available');
  const [critical, physical] = document.designs[1].shifts;
  assert.equal(critical.scope.assessmentKind, 'diagnostic');
  assert.equal(critical.diagnostic.scope, 'saved_infeasible_result');
  assert.equal(critical.operation.status, 'diagnostic_only');
  assert.equal(critical.operation.result, null);
  assert.equal(critical.energyBalance, null);
  assert.equal(physical.scope.assessmentKind, 'physical');
  assert.ok(physical.operation.result);
  assert.equal(document.designs[1].general.investment.rows[0].packs, 12);
});

test('a relaxed diagnostic is auditable without becoming the saved design or an overnight charging plan', () => {
  const options = fixture();
  const results = options.optimizationRun.results;
  results.electrification_feasible = false;
  results.forecast_verification.status = 'infeasible';
  const battery = results.battery_results.a;
  delete results.battery_results.a;
  results.infeasibility_diagnostics = { status: 'available', forecast_verification: { status: 'verified' },
    battery_results: { a: { ...battery, required_total_packs: 20, physical_feasible: false } },
    per_bus_summary: [results.per_bus_summary[0]] };
  const design = documentFor(options).designs[0], block = design.shifts[0];
  assert.equal(design.verdict.status, 'infeasible');
  assert.equal(block.diagnostic.scope, 'relaxed_diagnostic');
  assert.equal(block.operation.result, null);
  assert.equal(block.energyBalance, null);
  assert.equal(design.sourceData.results.battery_results.a, undefined);
  assert.equal(design.sourceData.results.infeasibility_diagnostics.battery_results.a.required_total_packs, 20);
});

for (const status of ['pending', 'running', 'failed']) {
  test(`${status} executions keep audit inputs but do not publish current technical results`, () => {
    const options = fixture();
    options.optimizationRun.status = status;
    if (status === 'failed') options.optimizationRun.results.error = 'Calculation failed';
    const design = documentFor(options).designs[0];
    assert.equal(design.execution.state, status);
    assert.equal(design.verdict.status, 'not_determined');
    assert.equal(design.verdict.electrificationFeasible, null);
    assert.equal(design.shifts[0].consumption, null);
    assert.equal(design.shifts[0].operation.result, null);
    assert.equal(design.shifts[0].energyComparison, null);
    assert.ok(design.sourceData.results);
  });
}

test('historical Mean is not relabelled verified or treated as proof that Q95 was never calculated', () => {
  const options = fixture({ paired: false });
  delete options.optimizationRun.results.forecast_verification;
  delete options.optimizationRun.results.operating_assumptions;
  delete options.optimizationRun.input_params.gtfs_provenance;
  const document = documentFor(options), design = document.designs[0];
  assert.equal(design.verdict.evidence, 'historical_unverified');
  assert.equal(design.operatingAssumptions.source, 'inputs_and_historical_defaults');
  assert.equal(document.profiles[1].status, 'not_recorded');
  assert.equal(design.provenance.gtfs, null);
  assert.ok(codes(document).includes('historical_verification_unavailable'));
  assert.equal(documentFor(options, { unavailableProfiles: [{ basis: 'aggregate_q95', status: 'not_calculated' }] }).profiles[1].status, 'not_calculated');
});

test('legacy median and configured quantiles retain their own basis keys', () => {
  for (const [quantile, key] of [['median', 'q50'], ['q95', 'configured']]) {
    const options = fixture({ paired: false });
    delete options.optimizationRun.input_params.consumption_basis;
    options.optimizationRun.input_params.quantile_consumption = quantile;
    const document = documentFor(options);
    assert.equal(document.designs[0].basis.key, key);
    assert.equal(document.profiles.find(row => row.basis === key).runId, 'mean-design');
    assert.equal(document.profiles.find(row => row.basis === 'aggregate_q95').status, 'not_recorded');
  }
});

test('missing aggregate Q95 and historical charging remain null and explicitly partial', () => {
  const options = fixture({ basis: 'aggregate_q95' });
  delete options.optimizationRun.results.consumption_analysis;
  delete options.optimizationRun.results.per_bus_summary[0].total_charged_kwh;
  delete options.optimizationRun.results.per_bus_summary[0].num_charging_sessions;
  delete options.optimizationRun.results.per_bus_summary[0].charging_sessions;
  const document = documentFor(options), block = document.designs[0].shifts[0];
  assert.equal(block.consumption.totalKwh, null);
  assert.equal(block.energyBalance.plannedChargingEnergyKwh, null);
  assert.equal(block.operation.result.chargingPlan.status, 'unavailable');
  assert.ok(codes(document).includes('decision_consumption_unavailable'));
  assert.ok(codes(document).includes('charging_plan_incomplete'));
});

test('missing referenced forecasts and current catalogue prices carry explicit reasons', () => {
  const options = fixture();
  options.predictionRuns = options.predictionRuns.filter(row => row.id !== 'initial-a');
  delete options.optimizationRun.results.battery_results.a.investment_cost_source;
  delete options.optimizationRun.results.battery_results.a.bus_cost_chf;
  const document = documentFor(options), design = document.designs[0];
  assert.deepEqual(design.provenance.predictions.missingRunIds, ['initial-a']);
  assert.equal(design.general.investment.rows[0].usesCurrentPrices, true);
  assert.ok(codes(document).includes('prediction_runs_missing'));
  assert.ok(codes(document).includes('current_catalogue_prices'));
});

test('an unsupported operating snapshot is retained but not claimed as the effective recorded policy', () => {
  const options = fixture();
  options.optimizationRun.results.operating_assumptions.version = 'future-policy';
  const document = documentFor(options);
  assert.equal(document.designs[0].operatingAssumptions.source, 'inputs_and_historical_defaults');
  assert.equal(document.designs[0].sourceData.results.operating_assumptions.version, 'future-policy');
  assert.ok(codes(document).includes('operating_assumptions_version_unsupported'));
});

test('missing forecasts, partial charging detail and unknown investment do not become zeroes', () => {
  const options = fixture();
  options.predictionRuns = options.predictionRuns.filter(row => row.shift_id !== 'a');
  const battery = options.optimizationRun.results.battery_results.a;
  delete battery.bus_cost_chf;
  delete battery.battery_pack_cost_chf;
  options.optimizationRun.results.per_bus_summary[0].charging_sessions = [];
  const document = documentFor(options), design = document.designs[0];
  assert.equal(design.shifts[0].consumption.totalKwh, 300); // Saved aggregate profile remains available.
  assert.equal(design.shifts[0].forecasts.length, 0);
  assert.equal(design.shifts[0].operation.result.chargingPlan.status, 'unavailable');
  assert.equal(design.general.investment.rows[0].busCost, null);
  assert.equal(design.general.investment.totals.totalCost, null);
  assert.ok(codes(document).includes('vehicle_block_forecasts_unavailable'));
  assert.ok(codes(document).includes('investment_prices_unavailable'));
  assert.equal(codes(document).filter(code => code === 'investment_prices_unavailable').length, 1);
});

test('non-finite source quantities are rejected instead of silently becoming null during JSON encoding', () => {
  const options = fixture();
  options.optimizationRun.results.invalid_quantity = Number.NaN;
  assert.throws(() => documentFor(options), /Non-finite/);
});

test('snapshots from different inputs, prediction data, scopes or duplicate blocks are rejected', () => {
  const options = fixture();
  options.optimizationRun.results.empty_metadata = [];
  const valid = snapshots(options);
  const variants = [
    value => { value.shiftAssessments.pop(); },
    value => { value.shiftAssessments.push(value.shiftAssessments[0]); },
    value => { value.assessment.scope.kind = 'shift'; },
    value => { value.shiftAssessments[0].scope.shiftId = 'unknown'; },
    value => { value.shiftAssessments[0].sourceRun.input_params.min_soc = .1; },
    value => { value.shiftAssessments[0].sourceRun.results.empty_metadata = {}; },
    value => { value.shiftAssessments[0].operatingAssumptions.min_soc = .1; },
    value => { value.shiftAssessments[0].predictionRuns[0].summary.total_consumption_kwh = 999; },
    value => { value.shiftAssessments[0].fleetInvestment.rows[0].busCost = 1; },
  ];
  for (const mutate of variants) {
    const bad = structuredClone(valid); mutate(bad);
    assert.throws(() => buildFeasibilityExportDocument({ designs: [bad] }));
  }
});

test('unrelated families, conflicting references, wrong bases and ambiguous profile declarations are rejected', () => {
  assert.throws(() => buildFeasibilityExportDocument());
  assert.throws(() => buildFeasibilityExportDocument({ designs: paired(), entryRunId: 'unknown' }));
  assert.throws(() => buildFeasibilityExportDocument({ designs: [snapshots(), snapshots()] }));
  const unrelated = fixture({ paired: false, basis: 'aggregate_q95' });
  unrelated.optimizationRun.input_params.basis_source_run_id = 'unrelated';
  assert.throws(() => buildFeasibilityExportDocument({ designs: [snapshots(), snapshots(unrelated)] }));
  const wrong = fixture({ basis: 'aggregate_q95' });
  wrong.optimizationRun.input_params.basis_run_ids.mean = 'other-root';
  assert.throws(() => buildFeasibilityExportDocument({ designs: [snapshots(), snapshots(wrong)] }));
  for (const unavailableProfiles of [
    [{ basis: 'aggregate_q95', runId: 'other-id', status: 'failed' }],
    [{ basis: 'mean', runId: 'mean-design', status: 'failed' }],
    [{ basis: 'aggregate_q95', runId: 'q95-design', status: 'not_calculated' }],
    [{ basis: 'aggregate_q95', runId: 'q95-design', status: 'unavailable' }, { basis: 'aggregate_q95', runId: 'q95-design', status: 'failed' }],
  ]) assert.throws(() => buildFeasibilityExportDocument({ designs: [snapshots()], unavailableProfiles }));
  const historical = fixture({ paired: false });
  delete historical.optimizationRun.input_params.consumption_basis;
  historical.optimizationRun.input_params.quantile_consumption = 'median';
  assert.throws(() => documentFor(historical, { unavailableProfiles: [
    { basis: 'mean', runId: 'same-id', status: 'unavailable' },
    { basis: 'aggregate_q95', runId: 'same-id', status: 'unavailable' },
  ] }));
});

test('a missing source design has no invented root name or configuration', () => {
  const document = documentFor(fixture({ basis: 'aggregate_q95' }));
  assert.equal(document.evaluation.id, 'mean-design');
  assert.equal(document.evaluation.name, null);
  assert.equal(document.designs.length, 1);
  assert.equal(document.designs[0].run.id, 'q95-design');
  assert.ok(codes(document).includes('source_design_unavailable'));
});

test('structured failure data is explicit even if the saved top-level status says completed', () => {
  const options = fixture();
  options.optimizationRun.results.failure = { phase: 'validation', issues: [{ code: 'invalid_shift', shift_id: 'a' }] };
  const document = documentFor(options);
  assert.equal(document.designs[0].verdict.status, 'not_determined');
  assert.equal(document.designs[0].shifts[0].consumption, null);
  assert.ok(codes(document).includes('evaluation_failure'));
});

test('exported objects, source snapshots and a second export never share mutable data', () => {
  const designs = paired(), before = structuredClone(designs);
  const first = buildFeasibilityExportDocument({ designs });
  first.designs[0].configuration.min_soc = 0;
  first.designs[0].shifts[0].forecasts[0].totalConsumptionKwh = 999;
  first.designs[0].sourceData.results.total_installation_cost_chf = 1;
  assert.deepEqual(designs, before);
  const next = buildFeasibilityExportDocument({ designs });
  assert.equal(next.designs[0].configuration.min_soc, .4);
  assert.equal(next.designs[0].shifts[0].consumption.totalKwh, 300);
  assert.equal(next.designs[0].general.infrastructure.totalInstallationCostChf, 100000);
});

test('the original source can be audited without occupying a duplicate current basis slot', () => {
  const source = fixture({ paired: false }).optimizationRun;
  const options = fixture({ paired: false });
  options.optimizationRun.id = 'compatible-mean';
  options.optimizationRun.input_params.basis_source_run_id = source.id;
  const document = documentFor(options, { sourceRun: source });
  assert.equal(document.designs.length, 1);
  assert.equal(document.profiles.find(row => row.basis === 'mean').runId, 'compatible-mean');
  assert.equal(document.evaluation.sourceRecord.id, source.id);
  assert.equal(document.evaluation.sourceRecord.results.battery_results.a.optimized_packs, 10);
  assert.equal(codes(document).includes('source_design_unavailable'), false);
  document.evaluation.sourceRecord.results.battery_results.a.optimized_packs = 999;
  assert.equal(source.results.battery_results.a.optimized_packs, 10);
  assert.throws(() => documentFor(options, { sourceRun: { ...source, id: 'other-source' } }), /source feasibility/);
});

test('loading issues remain explicit and detached from caller state', () => {
  const collectionIssues = [{ code: 'prediction_loading_failed', error: 'Timeout', predictionRunId: 'mean-a' }];
  const document = documentFor(fixture({ paired: false }), { collectionIssues });
  assert.equal(document.dataQuality.status, 'partial');
  assert.deepEqual(document.dataQuality.issues[0], collectionIssues[0]);
  document.dataQuality.issues[0].error = 'Changed';
  assert.equal(collectionIssues[0].error, 'Timeout');
});


test('independent reconciliation rejects drift in the serialized investment, energy and references', () => {
  const original = buildFeasibilityExportDocument({ designs: paired(), exportedAt });
  const corruptions = [
    document => { document.designs[0].general.investment.totals.totalCost += 1; },
    document => { document.designs[0].shifts[0].energyBalance.operationalEnergyKwh += 1; },
    document => { document.designs[0].shifts[0].operation.result.totalChargedKwh += 1; },
    document => { document.designs[0].shifts[0].consumption.totalKwh += 1; },
    document => { document.profiles[0].runId = 'unrelated-design'; },
  ];
  for (const corrupt of corruptions) {
    const document = JSON.parse(JSON.stringify(original));
    corrupt(document);
    assert.throws(() => assertFeasibilityExportReconciles(document));
  }
});

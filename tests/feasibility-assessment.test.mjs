import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeasibilityAssessment } from '../src/utils/feasibility-assessment.js';
import { buildPredictionComponentRows, readPredictionTotalQuantiles } from '../src/utils/feasibility-predictions.js';

import { feasibilityAssessmentFixture as fixture } from '../test-support/feasibility-assessment-fixture.js';

for (const mode of ['battery_only', 'charging_only', 'joint']) {
  test(`${mode} shares selected physical battery, energy and charging without repricing frozen investments`, () => {
    const assessment = buildFeasibilityAssessment(fixture(mode));
    assert.equal(assessment.model.mode, mode);
    assert.equal(assessment.scope.shiftId, 'a');
    assert.equal(assessment.singlePackCapacityKwh, 50);
    assert.equal(assessment.batteryCoverage.nominalKwh, 500);
    assert.equal(assessment.energyBalance.usableBatteryEnergyKwh, 250);
    assert.equal(assessment.energyBalance.operationalEnergyKwh, 350);
    assert.equal(assessment.energyBalance.minimumSocReserveKwh, 5);
    assert.equal(assessment.viewState.selectedShiftSummary.operation.chargingPlan.sessions[0].endMinute, 1500);
    assert.equal(assessment.decisionConsumption.totalKwh, 300);
    assert.equal(assessment.decisionConsumption.source, 'reference_forecast');
    assert.equal(assessment.energyComparison.isDeficit, false);
    assert.equal(assessment.sizingEffect.decisionDrivetrainKwh, 260);
    assert.equal(assessment.sizingEffect.decisionAuxiliaryKwh, 40);
    assert.deepEqual(assessment.predictions.map(row => row.runId), ['selected-a', 'initial-a']);
    assert.equal(assessment.predictions[0].isVerifiedSelection, true);
    assert.equal(assessment.predictions[1].predictionRole, 'initial_max_physical');
    assert.equal(assessment.fleetInvestment.totals.totalCost, 1020000);
    assert.equal(assessment.fleetInvestment.usesCurrentPrices, false);
    assert.equal(assessment.model.infrastructure.totalInstallationCostChf, mode === 'battery_only' ? null : 100000);
  });
}

test('identical shift names never mix forecasts or physical batteries', () => {
  const options = fixture();
  const a = buildFeasibilityAssessment(options);
  const b = buildFeasibilityAssessment({ ...options, scope: 'b' });
  assert.equal(a.decisionConsumption.perKmKwh, 3);
  assert.equal(b.decisionConsumption.perKmKwh, 3.5);
  assert.equal(b.batteryCoverage.nominalKwh, 600);
  assert.deepEqual(b.predictions.map(row => row.runId), ['selected-b']);
  assert.equal(b.viewState.selectedShiftSummary.operation.chargingPlan.status, 'empty');
  const unknown = buildFeasibilityAssessment({ ...options, scope: 'unknown' });
  assert.equal(unknown.viewState.selectedShiftSummary, null);
  assert.equal(unknown.decisionConsumption.totalKwh, null);
  assert.equal(unknown.energyBalance, null);
});

test('General exposes the whole design without attributing one block energy to the fleet', () => {
  const result = buildFeasibilityAssessment({ ...fixture(), scope: 'general' });
  assert.equal(result.model.shifts.length, 2);
  assert.equal(result.fleetInvestment.totals.totalCost, 1020000);
  assert.equal(result.model.infrastructure.totalInstallationCostChf, 100000);
  assert.equal(result.viewState.selectedShiftSummary, null);
  for (const field of ['decisionConsumption', 'batteryCoverage', 'energyComparison', 'energyBalance', 'sizingEffect']) {
    assert.equal(result[field], null, field);
  }
});

test('the saved prediction ID wins over a different forecast with the same pack count', () => {
  const options = fixture();
  const other = structuredClone(options.predictionRuns[1]);
  other.id = 'other-a';
  other.summary.total_consumption_kwh = 999;
  options.predictionRuns.unshift(other);
  const result = buildFeasibilityAssessment(options);
  assert.equal(result.batteryCoverage.matchedRun.id, 'selected-a');
  assert.equal(result.decisionConsumption.totalKwh, 300);
  assert.equal(result.energyBalance.meanDemandKwh, 300);
  assert.equal(result.energyBalance.marginKwh, 50);
});

test('empty historical selected IDs retain pack-based matching and missing battery rows stay unavailable', () => {
  const options = fixture();
  options.optimizationRun.results.selected_prediction_run_ids = { a: null, b: ' ' };
  assert.equal(buildFeasibilityAssessment(options).energyBalance.meanDemandKwh, 300);
  options.optimizationRun.results.battery_results = null;
  assert.equal(buildFeasibilityAssessment(options).batteryCoverage, null);
});

test('Q95 decision demand comes from the aggregate profile, independently from forecast trip quantiles', () => {
  const options = fixture();
  options.optimizationRun.input_params.consumption_basis = 'aggregate_q95';
  options.optimizationRun.results.consumption_analysis = { status: 'available', per_shift: {
    a: { status: 'available', statistics: { mean_total_kwh: 290, q95_total_kwh: 380.123456789 } },
  } };
  const q95 = buildFeasibilityAssessment(options);
  assert.equal(q95.predictions[0].totalConsumptionQ95Kwh, 500);
  assert.equal(q95.decisionConsumption.totalKwh, 380.123456789);
  assert.equal(q95.decisionConsumption.perKmKwh, 3.80123456789);
  assert.equal(q95.decisionConsumption.source, 'aggregate_profile');
  assert.equal(q95.sizingEffect.decisionDrivetrainKwh, 340.123456789);
  assert.equal(q95.energyComparison.isDeficit, true);
  options.optimizationRun.input_params.consumption_basis = 'mean';
  assert.equal(buildFeasibilityAssessment(options).decisionConsumption.totalKwh, 290);
});

test('missing aggregate Q95 stays unavailable unless a solver trajectory establishes its demand', () => {
  const options = fixture();
  options.optimizationRun.input_params.consumption_basis = 'aggregate_q95';
  const missing = buildFeasibilityAssessment(options);
  assert.equal(missing.decisionConsumption.totalKwh, null);
  assert.equal(missing.decisionConsumption.perKmKwh, null);
  assert.equal(missing.decisionConsumption.source, 'unavailable');
  options.optimizationRun.results.per_bus_summary[0].energy_timeline = { soc_kwh: [450, 200], charge_kwh: [50, 50] };
  const trajectory = buildFeasibilityAssessment(options);
  assert.equal(trajectory.decisionConsumption.totalKwh, 350);
  assert.equal(trajectory.decisionConsumption.source, 'solver_trajectory');
});

test('saved operating bounds control both forecast SOC and battery energy without expanding them again', () => {
  const options = fixture();
  options.optimizationRun.input_params = { ...options.optimizationRun.input_params,
    state_of_health: .7, battery_soc_policy: 'constant_initial_usable' };
  options.optimizationRun.results.operating_assumptions = { version: 'battery-timing-v1',
    state_of_health: .7, min_soc: .2, max_soc: .9, usable_fraction_initial: .49 };
  const result = buildFeasibilityAssessment(options);
  assert.equal(result.operatingAssumptions.min_soc, .2);
  assert.ok(Math.abs(result.predictions[0].minSocKwh - 70) < 1e-9);
  assert.equal(result.predictions[0].maxSocKwh, 315);
  assert.equal(result.energyBalance.usableBatteryEnergyKwh, 245);
  assert.ok(Math.abs(result.energyBalance.minimumAllowedSocKwh - 70) < 1e-9);
});

test('missing numeric forecasts remain missing; an explicit zero remains a measurement', () => {
  const summary = { total_consumption_kwh: null, total_drivetrain_kwh: false,
    total_auxiliary_kwh: ' ', quantiles: { q05: null, q50: 0, q95: false } };
  assert.deepEqual(readPredictionTotalQuantiles(summary), { q05: null, q50: 0, q95: null });
  const rows = buildPredictionComponentRows(summary);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 'total');
  assert.equal(rows[0].mean, null);
  const options = fixture();
  options.predictionRuns = [];
  delete options.optimizationRun.results.per_bus_summary[0].total_charged_kwh;
  const result = buildFeasibilityAssessment(options);
  assert.equal(result.decisionConsumption.totalKwh, null);
  assert.equal(result.energyBalance.plannedChargingEnergyKwh, null);
  assert.equal(result.energyBalance.operationalEnergyKwh, null);
});

test('a relaxed diagnostic never replaces the saved design, investment or global verdict', () => {
  const options = fixture();
  const results = options.optimizationRun.results;
  results.electrification_feasible = false;
  results.forecast_verification.status = 'infeasible';
  results.battery_results = { b: results.battery_results.b };
  results.infeasibility_diagnostics = { status: 'available', forecast_verification: { status: 'verified' },
    battery_results: { a: { optimized_packs: 10, required_total_packs: 20, max_physical_packs: 16,
      physical_feasible: false, pack_size_kwh: 50 } },
  };
  const result = buildFeasibilityAssessment(options);
  assert.equal(result.isDiagnostic, true);
  assert.equal(result.diagnosticRow.source, 'diagnostic');
  assert.equal(result.model.electrificationFeasible, false);
  assert.equal(result.execution.state, 'completed');
  assert.equal(result.predictions[0].isVerifiedSelection, false);
  assert.equal(result.energyComparison.availableKwh, null);
  assert.equal(result.sourceRun.results.battery_results.a, undefined);
  assert.equal(result.run.results.battery_results.a.required_total_packs, 20);
  assert.equal(result.fleetInvestment.rows.find(row => row.id === 'a').packs, 10);
  assert.equal(result.fleetInvestment.rows.find(row => row.id === 'a').usesCurrentPrices, true);
});

test('paired outcome and execution failure remain distinct from an established infeasible result', () => {
  const options = fixture();
  options.optimizationRun.basis_summaries = {
    mean: { status: 'completed', verification_status: 'verified', electrification_feasible: true },
    aggregate_q95: { status: 'completed', verification_status: 'infeasible', electrification_feasible: false },
  };
  assert.equal(buildFeasibilityAssessment(options).pairedOutcome.key, 'mean_only');
  delete options.optimizationRun.basis_summaries;
  options.optimizationRun.status = 'failed';
  options.optimizationRun.results = { error: 'Missing forecast', failure: { issues: [] } };
  const failed = buildFeasibilityAssessment(options);
  assert.equal(failed.execution.state, 'failed');
  assert.ok(failed.model.failure);
  assert.equal(failed.infeasibility.active, false);
  assert.equal(failed.decisionConsumption.totalKwh, 300);
  assert.equal(failed.predictions[0].isVerifiedSelection, false);
});

test('assessment snapshots isolate saved inputs, forecast rows, names and infrastructure', () => {
  const options = fixture();
  const before = structuredClone(options);
  const first = buildFeasibilityAssessment(options);
  first.sourceRun.results.total_installation_cost_chf = 0;
  first.predictions[0].totalConsumptionMeanKwh = 999;
  first.model.shifts[0].shiftName = 'Changed';
  first.viewState.selectedShiftSummary.operation.chargingPlan.sessions[0].endMinute = 0;
  assert.deepEqual(options, before);
  const next = buildFeasibilityAssessment(options);
  assert.equal(next.decisionConsumption.totalKwh, 300);
  assert.equal(next.model.infrastructure.totalInstallationCostChf, 100000);
  assert.equal(next.model.shifts[0].shiftName, 'Same name');
});

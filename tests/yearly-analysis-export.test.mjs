import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYearlyAssessment } from '../src/utils/yearly-analysis-assessment.js';
import { buildYearlyExportDocument } from '../src/utils/yearly-analysis-export.js';
import { yearlyFleetConfiguration as configuration } from '../test-support/yearly-fleet-fixture.js';

const model = { bus_length_m: 18 };
const exportedAt = '2026-11-20T12:00:00.000Z';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const makeDocument = (features = configuration(), emissionsState = { status: 'idle' }, assumptions) => {
  const assessment = buildYearlyAssessment({ features, model, emissionsState, ...(assumptions && { assumptions }) });
  const groupAssessments = assessment.fleet.groups.map(group => buildYearlyAssessment({
    features, baseline: assessment.baseline, assumptions: assessment.assumptions, emissionsState, scope: group.id,
  }));
  return { assessment, groupAssessments, document: buildYearlyExportDocument({
    features, assessment, groupAssessments, analysisId: 'annual-id', analysisName: 'Annual assessment', exportedAt,
  }) };
};
const groupedLca = () => {
  const phases = { direct: 0, energyChain: 60, vehicle: 40 };
  const indicator = { unit: 'g', electricity_operation: 60, diesel_heating: 0, other_lifecycle: 40,
    total: 100, diesel_comparator_total: 200, saving: 100,
    phases, diesel_comparator_phases: { direct: 150, energyChain: 20, vehicle: 30 },
    diesel_heating_phases: { direct: 0, energyChain: 0, vehicle: 0 } };
  return { status: 'complete', methodology_version: 'mobitool-parameterized-grid94-v1',
    annual_km: 100000, vehicle_count: 2,
    energy_boundary: { dc_kwh: 160000, grid_kwh: 160000 / .94 },
    indicators: { gwp100a: { ...indicator, total: 200, diesel_comparator_total: 400, saving: 200,
      electricity_operation: 120, other_lifecycle: 80, phases: { direct: 0, energyChain: 120, vehicle: 80 },
      diesel_comparator_phases: { direct: 300, energyChain: 40, vehicle: 60 } } },
    vehicles: [{ shift_id: 'group-a', shift_ids: ['a', 'b'], vehicle_count: 2,
      annual_km: 50000, dc_kwh: 80000, diesel_heating_liters: 0,
      lifetime_bus: 12, lifetime_battery: 8, lifetime_diesel_bus: 12, diesel_consumption_l_per_km: .5518,
      indicators: { gwp100a: indicator } }],
  };
};

test('schema 4 serializes effective saved assumptions and separates adjusted activity from technical results', () => {
  const features = configuration();
  features.assessment_assumptions = { tco: { energyPrice: .45, rate: .07, horizon: 20,
    annualKmByGroup: { a: 60000 }, infrastructureMaintenanceMode: 'fixed', infrastructureMaintenance: 14000 } };
  const { assessment, document } = makeDocument(features);
  assert.equal(document.schemaVersion, 4);
  assert.equal(document.exportedAt, exportedAt);
  assert.deepEqual(document.analysis, { id: 'annual-id', name: 'Annual assessment', status: null });
  assert.equal(document.assumptions.energyPrice, .45);
  assert.equal(document.assumptions.rate, .07);
  assert.equal(document.assumptions.horizon, 20);
  assert.deepEqual(document.assumptions.annualKmByShift, { a: 96000, b: 24000 });
  assert.equal(document.technicalBaseline.activity.distanceKm, 100000);
  assert.equal(document.general.activity.distanceKm, 120000);
  assert.equal(document.general.activity.busEnergyDcKwh, 192000);
  near(document.general.activity.purchasedGridEnergyKwh, 192000 / .94);
  assert.deepEqual(document.general.economics, assessment.economics);
  near(document.general.economics.electric.operating.find(row => row.key === 'electricity').annual, 192000 / .94 * .45);
  assert.equal(document.general.economics.electric.operating.find(row => row.key === 'infraMaintenance').annual, 14000);
  assert.equal(document.shifts[0].technicalResults.yearlyTotals.distanceKm, 80000);
  assert.equal(document.shifts[0].assessedActivity.distanceKm, 96000);
  assert.equal(document.shifts[0].assessmentGroupId, 'a');
  assert.equal(document.shifts[1].assessmentGroupId, 'a');
  assert.ok(!('costs' in document));
});

test('serialization uses the supplied live assessment even when the persisted tariff differs', () => {
  const features = configuration();
  features.assessment_assumptions = { tco: { energyPrice: .2 } };
  const initial = buildYearlyAssessment({ features, model });
  const { document } = makeDocument(features, { status: 'idle' }, { ...initial.assumptions, energyPrice: .45 });
  assert.equal(document.assumptions.energyPrice, .45);
  near(document.general.economics.electric.operating.find(row => row.key === 'electricity').annual, 160000 / .94 * .45);
  assert.equal(features.assessment_assumptions.tco.energyPrice, .2);
});

test('a group from a previous tariff or mileage cannot be mixed into the fleet document', () => {
  const features = configuration();
  const { assessment, groupAssessments } = makeDocument(features);
  const edited = buildYearlyAssessment({ features, assumptions: { ...assessment.assumptions, energyPrice: .45 } });
  assert.throws(() => buildYearlyExportDocument({ features, assessment: edited, groupAssessments }), /different annual inputs/);
});

test('group contributions conserve unequal frozen investments instead of repeating common maximum packs', () => {
  const features = configuration();
  Object.assign(features.config.fixedConfiguration.investment.rows[1], { packs: 10, capacity: 500, batteryCost: 60000 });
  features.results.optimizedPacks = 99;
  const { document } = makeDocument(features);
  assert.equal(document.general.economics.electric.initial, 2144000);
  assert.deepEqual(document.groups.map(group => group.batteryPacks), [14, 10]);
  assert.equal(document.groups.reduce((sum, group) => sum + group.fleetContribution.activity.distanceKm, 0), 100000);
  near(document.groups.reduce((sum, group) => sum + group.fleetContribution.economics.electric.initial, 0), 2144000);
  near(document.groups.reduce((sum, group) => sum + group.fleetContribution.economics.electric.annualOpex, 0), document.general.economics.electric.annualOpex);
});

test('representative values scale money and activity, retaining per-km TCO, years, discounting and LCA scope', () => {
  const { document } = makeDocument(configuration(), { status: 'done', rawLca: groupedLca() });
  const group = document.groups[0], representative = group.representativeBus;
  assert.equal(document.general.scope.kind, 'fleet');
  assert.equal(group.fleetContribution.scope.kind, 'vehicle_group');
  assert.equal(representative.scope.kind, 'representative_bus');
  assert.equal(group.physicalVehicleCount, 2);
  assert.equal(representative.allocation, .5);
  assert.equal(representative.activity.distanceKm, 50000);
  assert.equal(representative.economics.electric.initial, 1084000);
  assert.equal(representative.economics.electric.perKm, document.general.economics.electric.perKm);
  assert.equal(representative.economics.electric.annuityFactor, document.general.economics.electric.annuityFactor);
  const battery = representative.economics.electric.components.find(row => row.key === 'battery');
  assert.equal(battery.life, 8);
  assert.equal(battery.replacements[0].year, 8);
  assert.equal(battery.replacements[0].cost, 84000);
  assert.equal(representative.economics.comparison.points.at(-1).year, 12);
  near(representative.economics.comparison.points.at(-1).electric, representative.economics.electric.presentValue);
  assert.equal(document.general.environment.status, 'complete');
  assert.equal(document.general.environment.result.vehicle_count, 2);
  assert.equal(representative.environment.result.vehicle_count, 1);
  assert.equal(representative.environment.result.annual_km, 50000);
  assert.equal(representative.environment.result.indicators.gwp100a.total, 100);
  assert.equal(document.shifts[0].environmentScope, 'representative_group');
  assert.ok(!('emissions' in document.shifts[0]));
});

test('provenance, exact technical snapshots and scenario identifiers survive JSON serialization', () => {
  const features = configuration();
  features.gtfs_provenance = { shifts: { a: [{ id: 'gtfs-edition', year: 2026 }] } };
  features.config.weather_reference = { weather_temperature_series_id: 'weather-series', depot_name: 'Depot' };
  features.config.bus_model_snapshot = { name: 'Saved bus', bus_length_m: 18 };
  features.config.fixedConfiguration.sourceOptimizationRunId = 'feasibility-id';
  features.config.fixedConfiguration.operatingAssumptions = { auxiliary_policy_id: 'annual-pvgis-local-cap10-v1' };
  features.scenarios = [{ scenarioId: 'cold-cluster', label: 'Cold', temperature: -5, occurrences: 10 }];
  features.results.shiftResults[0].scenarioResults = [{ scenarioId: 'cold-cluster', predRunId: 'prediction-id', kpis: { totalEnergyKwh: 123.456789 } }];
  const original = structuredClone(features);
  const { document } = makeDocument(features);
  const decoded = JSON.parse(JSON.stringify(document));
  assert.equal(decoded.provenance.gtfs.shifts.a[0].id, 'gtfs-edition');
  assert.equal(decoded.provenance.weather.weather_temperature_series_id, 'weather-series');
  assert.equal(decoded.provenance.sourceOptimizationRunId, 'feasibility-id');
  assert.equal(decoded.methodology.chargingEnergy, 'grid-to-bus-dc-94-v1');
  assert.equal(decoded.methodology.economics, 'annual-fleet-tco-v1');
  assert.equal(decoded.technicalBaseline.scenarios[0].scenarioId, 'cold-cluster');
  assert.equal(decoded.shifts[0].technicalResults.scenarioResults[0].predRunId, 'prediction-id');
  assert.equal(decoded.shifts[0].technicalResults.scenarioResults[0].kpis.totalEnergyKwh, 123.456789);
  assert.deepEqual(decoded.configuration.fixedConfiguration.investment, original.config.fixedConfiguration.investment);
  document.configuration.fixedConfiguration.investment.rows[0].busCost = 0;
  assert.deepEqual(features, original);
});

test('complete fleet LCA does not hide a missing representative-group result', () => {
  const rawLca = groupedLca();
  rawLca.vehicles = ['a', 'b'].map((id, index) => ({ ...rawLca.vehicles[0],
    shift_id: id, shift_ids: [id], vehicle_count: 1, battery_chemistry: index ? 'LFP' : 'NMC' }));
  const { document } = makeDocument(configuration(), { status: 'done', rawLca });
  assert.equal(document.general.environment.status, 'complete');
  assert.equal(document.groups[0].representativeBus.environment.result, null);
  assert.equal(document.dataQuality.status, 'partial');
  assert.ok(document.dataQuality.issues.includes('group:a:lca_assumptions_or_scope_unavailable'));
});

test('configured shifts without original results remain present with explicit missing data', () => {
  const features = configuration();
  features.config.shift_ids = ['a', 'b', 'missing'];
  const { document } = makeDocument(features);
  const missing = document.shifts.find(shift => shift.shiftId === 'missing');
  assert.equal(missing.technicalResults, null);
  assert.equal(missing.assessedActivity, null);
  assert.equal(missing.environmentScope, 'unavailable');
  assert.ok(document.dataQuality.issues.includes('shift:missing:technical_results_unavailable'));
});

test('unknown measured activity cannot turn into an exported zero after mileage scaling', () => {
  const features = configuration();
  features.results.shiftResults[0].yearlyTotals = { distanceKm: null, totalEnergyKwh: null };
  const { document } = makeDocument(features);
  assert.equal(document.general.activity, null);
  assert.equal(document.groups[0].fleetContribution.activity, null);
  assert.equal(document.groups[0].representativeBus.activity, null);
  assert.equal(document.shifts[0].assessedActivity, null);
  assert.equal(document.shifts[1].assessedActivity.distanceKm, 20000);
  assert.equal(document.dataQuality.status, 'partial');
  assert.ok(document.dataQuality.issues.includes('shift:a:assessed_activity_unavailable'));
});

for (const status of ['loading', 'error', 'done']) {
  test(`a mismatching LCA during ${status} cannot masquerade as the current environmental result`, () => {
    const features = configuration();
    features.assessment_assumptions = { tco: { annualKmByGroup: { a: 60000 } } };
    const { document } = makeDocument(features, { status, error: 'Refresh failed', rawLca: groupedLca() });
    assert.equal(document.general.activity.distanceKm, 120000);
    assert.equal(document.general.environment.result, null);
    assert.equal(document.general.environment.matchesAssumptions, false);
    assert.equal(document.general.environment.error, 'Refresh failed');
    assert.equal(document.general.environment.previousResult?.annual_km ?? null, status === 'done' ? null : 100000);
    assert.equal(document.groups[0].representativeBus.environment.previousResult?.annual_km ?? null, status === 'done' ? null : 50000);
    assert.ok(document.shifts.every(shift => !('emissions' in shift)));
  });
}

test('partial data remains labelled and a configured shift without activity is not fabricated', () => {
  const features = configuration();
  features.config.shift_ids = ['a', 'b', 'missing'];
  features.config.fixedConfiguration.investment.rows[0].busCost = null;
  const { document } = makeDocument(features);
  assert.equal(document.general.economics.status, 'incomplete');
  assert.ok(document.general.economics.issues.includes('missing_prices'));
  assert.equal(document.general.economics.electric, null);
  const missing = document.shifts.find(shift => shift.shiftId === 'missing');
  assert.equal(missing.technicalResults, null);
  assert.equal(missing.assessedActivity, null);
  assert.equal(missing.environmentScope, 'unavailable');
});

test('missing group snapshots and representative-only exports fail explicitly', () => {
  const features = configuration();
  const { assessment, groupAssessments } = makeDocument(features);
  assert.throws(() => buildYearlyExportDocument({ features, assessment }), /Missing representative assessment/);
  assert.throws(() => buildYearlyExportDocument({ features, assessment: groupAssessments[0] }), /requires a fleet assessment/);
});

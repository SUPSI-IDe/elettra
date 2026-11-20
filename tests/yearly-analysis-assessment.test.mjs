import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYearlyAssessment } from '../src/utils/yearly-analysis-assessment.js';
import { yearlyFleetConfiguration as configuration } from '../test-support/yearly-fleet-fixture.js';

const model = { bus_length_m: 18 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

const savedConfiguration = () => {
  const features = configuration();
  features.config.bus_model_snapshot = { bus_length_m: 18, bus_lifetime: 12, battery_pack_lifetime: 8 };
  features.assessment_assumptions = { tco: {
    energyPrice: .45, horizon: 20, rate: .07,
    annualKmByGroup: { a: 60000 },
    infrastructureMaintenanceMode: 'fixed', infrastructureMaintenance: 14000,
  } };
  return features;
};

const lca = () => {
  const indicator = {
    unit: 'g', electricity_operation: 60, diesel_heating: 10, other_lifecycle: 30,
    total: 100, diesel_comparator_total: 200,
    phases: { direct: 10, energyChain: 60, vehicle: 30 },
    diesel_comparator_phases: { direct: 150, energyChain: 20, vehicle: 30 },
    diesel_heating_phases: { direct: 10, energyChain: 0, vehicle: 0 },
  };
  return {
    status: 'complete', vehicle_count: 2, annual_km: 100000,
    energy_boundary: { dc_kwh: 160000 },
    indicators: { gwp100a: { ...indicator, total: 200, diesel_comparator_total: 400 } },
    vehicles: [{
      shift_id: 'group-a', shift_ids: ['a', 'b'], vehicle_count: 2,
      annual_km: 50000, dc_kwh: 80000, diesel_heating_liters: 50,
      lifetime_bus: 12, lifetime_battery: 8, lifetime_diesel_bus: 12,
      diesel_consumption_l_per_km: .5518,
      indicators: { gwp100a: indicator },
    }],
  };
};

test('saved assumptions scale assigned activity while keeping simulated baseline and investment frozen', () => {
  const assessment = buildYearlyAssessment({ features: savedConfiguration(), model });
  assert.equal(assessment.assumptions.energyPrice, .45);
  assert.equal(assessment.assumptions.horizon, 20);
  assert.equal(assessment.assumptions.rate, .07);
  assert.deepEqual(assessment.assumptions.annualKmByShift, { a: 96000, b: 24000 });
  assert.equal(assessment.baseline.totals.km, 100000);
  assert.equal(assessment.baseline.totals.dc, 160000);
  assert.equal(assessment.fleet.totals.km, 120000);
  assert.equal(assessment.fleet.totals.dc, 192000);
  near(assessment.fleet.totals.grid, 192000 / .94);
  assert.equal(assessment.economics.electric.initial, 2168000);
  near(assessment.economics.electric.operating.find(row => row.key === 'electricity').annual, 192000 / .94 * .45);
  assert.equal(assessment.economics.electric.operating.find(row => row.key === 'infraMaintenance').annual, 14000);
  assert.equal(assessment.economics.status, 'complete');
  near(assessment.economics.comparison.points.at(-1).electric, assessment.economics.electric.presentValue);
  near(assessment.economics.comparison.points.at(-1).diesel, assessment.economics.diesel.presentValue);
});

test('current catalogue prices and maximum packs do not replace individual frozen investments', () => {
  const features = savedConfiguration();
  Object.assign(features.config.fixedConfiguration.investment.rows[1], { packs: 10, capacity: 500, batteryCost: 60000 });
  features.results.optimizedPacks = 99;
  const result = buildYearlyAssessment({ features, model: {
    cost: 999999, battery_pack_cost: 999999, bus_lifetime: 25, battery_pack_lifetime: 2,
  } });
  assert.equal(result.fleet.groups.length, 2);
  assert.deepEqual(result.fleet.rows.map(row => row.packs), [14, 10]);
  assert.equal(result.economics.electric.initial, 2144000);
  assert.equal(result.assumptions.bodyLife, 12);
  assert.equal(result.assumptions.batteryLife, 8);
});

for (const mode of ['fixed', 'rate']) {
  test(`group assessments reconcile to fleet investment and OPEX with ${mode} maintenance`, () => {
    const features = configuration();
    const fixed = features.config.fixedConfiguration;
    fixed.fleet.vehicleCount = 3;
    fixed.investment.rows.push({ id: 'c', packs: 10, capacity: 500, busCost: 800000, batteryCost: 60000 });
    features.results.shiftResults.push({ shiftId: 'c', status: 'completed', yearlyTotals: { distanceKm: 40000, totalEnergyKwh: 40000 } });
    features.results.yearlyTotals = { distanceKm: 140000, totalEnergyKwh: 200000 };
    features.assessment_assumptions = { tco: { infrastructureMaintenanceMode: mode, infrastructureMaintenance: 6000 } };
    const fleet = buildYearlyAssessment({ features, model });
    const small = buildYearlyAssessment({ features, model, scope: 'a' });
    const other = buildYearlyAssessment({ features, model, scope: 'c' });
    assert.deepEqual(small.scope, { kind: 'representative_bus', groupId: 'a', shiftIds: ['a', 'b'], physicalVehicleCount: 2 });
    assert.equal(small.divisor, 2);
    assert.equal(small.scopedFleet.totals.km / small.divisor, 50000);
    assert.equal(small.scopedFleet.totals.dc / small.divisor, 80000);
    assert.equal(other.divisor, 1);
    near(small.infrastructureShare + other.infrastructureShare, 1);
    near(small.scopedFleet.infrastructure.total + other.scopedFleet.infrastructure.total, 400000);
    for (const design of ['electric', 'diesel']) {
      for (const field of ['initial', 'annualOpex', 'presentValue', 'annualEquivalent']) {
        near(small.economics[design][field] + other.economics[design][field], fleet.economics[design][field]);
      }
    }
  });
}

test('explicit current assumptions override persisted values and regenerate the save mileage mapping', () => {
  const features = savedConfiguration();
  const baseline = buildYearlyAssessment({ features, model });
  const edited = buildYearlyAssessment({ features, baseline: baseline.baseline, assumptions: {
    ...baseline.assumptions, energyPrice: .30, annualKmByGroup: { a: 75000 },
  } });
  assert.equal(edited.assumptions.energyPrice, .30);
  assert.equal(edited.fleet.totals.km, 150000);
  assert.deepEqual(edited.assumptions.annualKmByShift, { a: 120000, b: 30000 });
  assert.equal(features.assessment_assumptions.tco.energyPrice, .45);
  assert.equal(baseline.assumptions.annualKmByShift.a, 96000);
});

test('fleet and representative environments retain the backend group scope and heater quantity', () => {
  const features = configuration();
  features.config.auxiliary_heating_type = 'diesel';
  const rawLca = lca();
  const fleet = buildYearlyAssessment({ features, model, emissionsState: { status: 'done', rawLca } });
  const representative = buildYearlyAssessment({ features, model, scope: 'a', emissionsState: { status: 'done', rawLca } });
  assert.equal(fleet.environment.matchesAssumptions, true);
  assert.equal(fleet.environment.isStale, false);
  assert.equal(fleet.environment.rawLca.vehicle_count, 2);
  assert.equal(representative.environment.rawLca.vehicle_count, 1);
  assert.deepEqual(representative.environment.rawLca.display_scope.shift_ids, ['a', 'b']);
  assert.equal(representative.environment.rawLca.annual_km, 50000);
  assert.equal(representative.environment.rawLca.indicators.gwp100a.total, 100);
  assert.equal(fleet.economics.dieselHeatingLiters, 100);
  near(fleet.economics.electric.operating.find(row => row.key === 'heater').annual, 100 * 1.85 * 1.1);
  assert.equal(rawLca.vehicle_count, 2);
});

test('financial edits update economics without invalidating matching physical LCA inputs', () => {
  const features = configuration();
  const rawLca = lca();
  const initial = buildYearlyAssessment({ features, model, emissionsState: { status: 'done', rawLca } });
  const changed = buildYearlyAssessment({ features, assumptions: {
    ...initial.assumptions, energyPrice: .45, horizon: 20, rate: .07,
  }, emissionsState: { status: 'done', rawLca } });
  assert.notEqual(changed.economics.electric.perKm, initial.economics.electric.perKm);
  assert.equal(changed.environment.matchesAssumptions, true);
  assert.equal(changed.environment.isStale, false);
  assert.deepEqual(changed.environment.rawLca, initial.environment.rawLca);
});

for (const status of ['loading', 'error', 'done']) {
  test(`mileage changes distinguish previous LCA from the current assessment during ${status}`, () => {
    const features = configuration();
    features.config.auxiliary_heating_type = 'diesel';
    features.assessment_assumptions = { tco: { annualKmByGroup: { a: 60000 } } };
    const result = buildYearlyAssessment({ features, model, emissionsState: { status, error: 'Refresh failed', rawLca: lca() } });
    assert.equal(result.environment.matchesAssumptions, false);
    assert.equal(result.environment.isStale, status !== 'done');
    assert.equal(result.environment.rawLca?.annual_km ?? null, status === 'done' ? null : 100000);
    assert.equal(result.environment.error, 'Refresh failed');
    assert.equal(result.fleet.totals.km, 120000);
    assert.equal(result.economics.dieselHeatingLiters, 120);
  });
}

test('missing diesel heater activity keeps electric economics unavailable, rather than assuming free fuel', () => {
  const features = configuration();
  features.config.auxiliary_heating_type = 'diesel';
  const result = buildYearlyAssessment({ features, model });
  assert.equal(result.economics.electric, null);
  assert.ok(result.economics.diesel);
  assert.equal(result.economics.comparison, null);
  assert.equal(result.economics.dieselHeatingLiters, null);
  assert.ok(result.economics.issues.includes('diesel_heating_activity_unavailable'));
});

test('historical missing fleet and incomplete frozen inputs remain explicit', () => {
  const historical = buildYearlyAssessment();
  assert.equal(historical.economics.status, 'incomplete');
  assert.ok(historical.economics.issues.includes('missing_fleet'));
  const missingPrice = configuration();
  missingPrice.config.fixedConfiguration.investment.rows[0].busCost = null;
  const invalid = buildYearlyAssessment({ features: missingPrice, model });
  assert.equal(invalid.economics.electric, null);
  assert.ok(invalid.economics.issues.includes('missing_prices'));
  const mismatch = buildYearlyAssessment({ features: configuration(), model, predictionRuns: [{ shift_id: 'b', contextual_parameters: { battery_capacity_kwh: 500 } }] });
  assert.ok(mismatch.economics.issues.includes('battery_mismatch'));
});

test('invalid current financial values do not silently fall back to saved assumptions', () => {
  const features = savedConfiguration();
  const initial = buildYearlyAssessment({ features, model });
  const invalid = buildYearlyAssessment({ features, model, assumptions: { ...initial.assumptions, horizon: 0 } });
  assert.equal(invalid.assumptions.horizon, 0);
  assert.equal(invalid.economics.status, 'incomplete');
  assert.equal(invalid.economics.electric, null);
  assert.equal(invalid.economics.diesel, null);
});

test('retained assessment snapshots cannot mutate saved inputs or later assessments', () => {
  const features = configuration(), rawLca = lca();
  const before = structuredClone({ features, rawLca });
  const result = buildYearlyAssessment({ features, model, emissionsState: { status: 'done', rawLca } });
  result.assumptions.annualKmByGroup.a = 1;
  result.fleet.rows[0].busCost = 1;
  result.baseline.infrastructure.total = 1;
  result.environment.rawLca.vehicles[0].shift_ids.push('injected');
  assert.deepEqual({ features, rawLca }, before);
  const next = buildYearlyAssessment({ features, model });
  assert.equal(next.economics.electric.initial, 2168000);
  assert.equal(next.assumptions.annualKmByGroup.a, 50000);
});

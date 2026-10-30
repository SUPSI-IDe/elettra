import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnnualFleet, capitalCashFlow, computeFleetTco, computeDieselTco, cumulativeCostComparison, yearlyTcoDefaults, scaleAnnualFleet, scopeFleetLca } from '../src/utils/yearly-fleet-tco.js';
import { buildYearlyPredictionGroups } from '../src/utils/yearly-analysis-model.js';

const configuration = () => ({
  config: { fixedConfiguration: {
    busModelId: 'bus', fleet: { vehicleCount: 2 },
    investment: { rows: [
      { id: 'a', packs: 14, capacity: 700, busCost: 800000, batteryCost: 84000 },
      { id: 'b', packs: 14, capacity: 700, busCost: 800000, batteryCost: 84000 },
    ] },
    infrastructure: { dataAvailable: true, stations: [{ selected: true, installationCostChf: 400000,
      costBreakdown: { chargers_cost_chf: 110000, site_fixed_cost_chf: 250000, site_power_cost_chf: 40000 } }] },
  } },
  results: { yearlyTotals: { distanceKm: 100000, totalEnergyKwh: 160000 }, shiftResults: [
    { shiftId: 'a', status: 'completed', yearlyTotals: { distanceKm: 80000, totalEnergyKwh: 144000 } },
    { shiftId: 'b', status: 'completed', yearlyTotals: { distanceKm: 20000, totalEnergyKwh: 16000 } },
  ] },
});
const assumptions = { horizon: 12, rate: 0, bodyLife: 12, batteryLife: 8, pointLife: 15, siteLife: 30,
  energyPrice: .20, maintenancePerKm: .40, infrastructureMaintenance: 5000, fuelPrice: 1.85, heaterMaintenanceFactor: .10 };

test('representative activity conserves total fleet energy and kilometres; never averages duty ratios', () => {
  const fleet = buildAnnualFleet(configuration());
  assert.deepEqual(fleet.issues, []);
  assert.equal(fleet.groups.length, 1);
  assert.equal(fleet.groups[0].km / fleet.count, 50000);
  assert.equal(fleet.groups[0].dc / fleet.count, 80000);
  assert.equal(fleet.totals.dc / fleet.totals.km, 1.6);
  assert.notEqual(fleet.totals.dc / fleet.totals.km, (1.8 + .8) / 2);
  assert.equal(fleet.infrastructure.total, 400000);
});

test('different batteries retain their actual mass and investment', () => {
  const features = configuration();
  Object.assign(features.config.fixedConfiguration.investment.rows[1], { packs: 10, capacity: 500, batteryCost: 60000 });
  const fleet = buildAnnualFleet(features);
  assert.equal(fleet.groups.length, 2);
  assert.equal(fleet.totals.batteryCost, 144000);
  assert.deepEqual(buildYearlyPredictionGroups({ shifts: [
    { shiftId: 'a', battery: { selectedPacks: 14 } }, { shiftId: 'b', battery: { selectedPacks: 10 } },
    { shiftId: 'c', battery: { selectedPacks: 14 } },
  ] }), [{ packs: 14, shiftIds: ['a', 'c'] }, { packs: 10, shiftIds: ['b'] }]);
  assert.ok(buildAnnualFleet(features, [{ shift_id: 'b', contextual_parameters: { battery_capacity_kwh: 700 } }]).issues.includes('battery_mismatch'));
});

test('finite-horizon cost includes one battery replacement, residual and shared infrastructure once', () => {
  const fleet = buildAnnualFleet(configuration());
  const tco = computeFleetTco(fleet, assumptions);
  assert.equal(tco.initial, 2168000);
  assert.equal(tco.components[1].replacements.length, 1);
  assert.equal(tco.components[1].replacements[0].year, 8);
  assert.equal(tco.components[1].residual, 84000);
  const capital = 1600000 + (168000 + 168000 - 84000) + (110000 - 22000) + (290000 - 174000);
  const annual = 160000 / .94 * .2 + 100000 * .4 + 5000;
  assert.ok(Math.abs(tco.presentValue - (capital + 12 * annual)) < 1e-6);
  assert.ok(Math.abs(tco.perKm - (capital + 12 * annual) / 1200000) < 1e-10);
  assert.equal(tco.perKm, (tco.annualEquivalent / 2) / (fleet.totals.km / 2));
  assert.equal(capitalCashFlow(100, 12, 12, 0).replacements.length, 0);
  assert.equal(capitalCashFlow(100, 12, 12, 0).residual, 0);
});

test('discounted cashflows and kilometres share the same time basis', () => {
  const tco = computeFleetTco(buildAnnualFleet(configuration()), { ...assumptions, rate: .03 });
  const factor = Array.from({ length: 12 }, (_, i) => 1 / 1.03 ** (i + 1)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(tco.annuityFactor - factor) < 1e-10);
  assert.equal(tco.components[1].discountedReplacements, 168000 / 1.03 ** 8);
  assert.equal(tco.components[1].discountedResidual, 84000 / 1.03 ** 12);
  assert.ok(Math.abs(tco.perKm - tco.presentValue / (100000 * factor)) < 1e-10);
});

test('missing prices, missing duty predictions and inconsistent site totals do not become free costs', () => {
  const features = configuration();
  features.config.fixedConfiguration.investment.rows[0].busCost = null;
  assert.equal(computeFleetTco(buildAnnualFleet(features), assumptions), null);
  const missing = configuration(); missing.results.shiftResults.pop();
  assert.equal(computeFleetTco(buildAnnualFleet(missing), assumptions), null);
  const inconsistent = configuration(); inconsistent.config.fixedConfiguration.infrastructure.stations[0].installationCostChf = 1;
  assert.equal(computeFleetTco(buildAnnualFleet(inconsistent), assumptions), null);
});

test('infrastructure maintenance defaults to 2% once per fleet, preserves explicit fixed estimates', () => {
  const features = configuration(), fleet = buildAnnualFleet(features);
  const defaults = yearlyTcoDefaults(features, { bus_length_m: 18 });
  assert.equal(defaults.infrastructureMaintenanceRate, .02);
  assert.equal(computeFleetTco(fleet, defaults).operating.find(c => c.key === 'infraMaintenance').annual, 8000);
  features.assessment_assumptions = { tco: { infrastructureMaintenance: 0 } };
  assert.equal(yearlyTcoDefaults(features).infrastructureMaintenanceMode, 'rate');
  features.assessment_assumptions.tco.infrastructureMaintenanceMode = 'fixed';
  assert.equal(yearlyTcoDefaults(features).infrastructureMaintenanceMode, 'fixed');
  features.assessment_assumptions.tco = { infrastructureMaintenance: 6000 };
  assert.equal(yearlyTcoDefaults(features).infrastructureMaintenanceMode, 'fixed');
});

test('12-year diesel default has no replacement or terminal residual on a 12-year horizon; saved lifetimes remain configurable', () => {
  const features = configuration(), fleet = buildAnnualFleet(features);
  const defaults = yearlyTcoDefaults(features, { bus_length_m: 18 });
  assert.equal(defaults.dieselLife, 12);
  const diesel = computeDieselTco(fleet, defaults);
  assert.deepEqual(diesel.components[0].replacements, []);
  assert.equal(diesel.discountedResidual, 0);
  const { points } = cumulativeCostComparison(computeFleetTco(fleet, defaults), diesel, defaults);
  const year9 = points.find(p => p.year === 9), year10 = points.find(p => p.year === 10);
  assert.ok(Math.abs(year10.diesel - year9.diesel - diesel.annualOpex / 1.03 ** 10) < 1e-6);
  assert.equal(points.at(-1).diesel, points.at(-2).diesel);
  features.assessment_assumptions = { tco: { dieselLife: 10 } };
  assert.equal(yearlyTcoDefaults(features).dieselLife, 10);
});

test('diesel TCO includes replacement and residual on the same horizon; cumulative endpoints reconcile for both designs', () => {
  const fleet = buildAnnualFleet(configuration());
  const a = { ...assumptions, rate: .03, dieselCapex: 500000, dieselLife: 10, dieselConsumption: .55, dieselMaintenance: .45 };
  const electric = computeFleetTco(fleet, a), diesel = computeDieselTco(fleet, a);
  assert.equal(diesel.initial, 1000000);
  assert.equal(diesel.discountedReplacements, 1000000 / 1.03 ** 10);
  assert.equal(diesel.discountedResidual, 800000 / 1.03 ** 12);
  assert.equal(diesel.annualOpex, 100000 * (.55 * 1.85 + .45));
  assert.ok(Math.abs(diesel.perKm - diesel.annualEquivalent / fleet.totals.km) < 1e-12);
  const { points } = cumulativeCostComparison(electric, diesel, a);
  assert.ok(Math.abs(points.at(-1).electric - electric.presentValue) < 1e-6);
  assert.ok(Math.abs(points.at(-1).diesel - diesel.presentValue) < 1e-6);
  assert.equal(computeDieselTco(fleet, { ...a, dieselCapex: null }), null);
});

test('a residual-only crossing is labelled separately from break-even during operation', () => {
  const design = (initial, residual) => ({ initial, annualOpex: 0, discountedResidual: residual, components: [{ replacements: [] }] });
  const comparison = cumulativeCostComparison(design(200, 150), design(100, 0), { horizon: 2, rate: 0 });
  assert.equal(comparison.breakEven, 2);
  assert.equal(comparison.residualOnly, true);
});

test('mileage per battery group scales only its duties, preserves weighted intensity and investment', () => {
  const features = configuration();
  const uniform = buildAnnualFleet(features);
  const scaled = scaleAnnualFleet(uniform, { a: 60000 });
  assert.equal(scaled.totals.km, 120000);
  assert.equal(scaled.totals.dc, 192000);
  assert.equal(scaled.rows[0].km, 96000);
  assert.equal(scaled.rows[1].km, 24000);
  assert.equal(scaled.infrastructure.total, uniform.infrastructure.total);
  Object.assign(features.config.fixedConfiguration.investment.rows[1], { packs: 10, capacity: 500 });
  const heterogeneous = buildAnnualFleet(features);
  const changed = scaleAnnualFleet(heterogeneous, { a: 100000, b: 20000 });
  assert.equal(changed.groups[0].dc, 180000);
  assert.equal(changed.groups[1].dc, 16000);
  assert.equal(changed.totals.km, 120000);
  assert.equal(changed.totals.busCost, heterogeneous.totals.busCost);
});

test('two assigned 10-pack duties pool their energy and km; the 16-pack bus serves only its assigned hard duty', () => {
  const features = configuration(), fixed = features.config.fixedConfiguration;
  fixed.fleet.vehicleCount = 3;
  fixed.investment.rows = [
    { id: 'easy-a', modelName: 'TPL_18m', packs: 10, capacity: 500, busCost: 800000, batteryCost: 60000 },
    { id: 'easy-b', modelName: 'TPL_18m', packs: 10, capacity: 500, busCost: 800000, batteryCost: 60000 },
    { id: 'hard', modelName: 'TPL_18m', packs: 16, capacity: 800, busCost: 800000, batteryCost: 96000 },
  ];
  features.results = { yearlyTotals: { distanceKm: 140000, totalEnergyKwh: 260000 }, shiftResults: [
    { shiftId: 'easy-a', yearlyTotals: { distanceKm: 20000, totalEnergyKwh: 20000 } },
    { shiftId: 'easy-b', yearlyTotals: { distanceKm: 40000, totalEnergyKwh: 60000 } },
    { shiftId: 'hard', yearlyTotals: { distanceKm: 80000, totalEnergyKwh: 180000 } },
  ] };
  const fleet = buildAnnualFleet(features);
  assert.deepEqual(fleet.issues, []);
  const [small, large] = fleet.groups;
  assert.deepEqual(small.members.map(r => r.id), ['easy-a', 'easy-b']);
  assert.equal(small.dc / small.km, 80000 / 60000);
  assert.notEqual(small.dc / small.km, (1 + 1.5) / 2);
  assert.equal(small.km / small.count, 30000);
  assert.deepEqual(large.members.map(r => r.id), ['hard']);
  assert.equal(large.dc / large.km, 2.25);
  const changed = scaleAnnualFleet(fleet, { 'easy-a': 45000, hard: 80000 });
  assert.equal(changed.groups[0].km, 90000);
  assert.equal(changed.groups[0].dc, 120000);
  assert.equal(changed.groups[1].km, 80000);
  assert.equal(changed.groups[1].dc, 180000);
  assert.deepEqual(changed.rows.map(r => r.packs), [10, 10, 16]);
});

test('representative LCA keeps the diesel comparison and all phases proportional to physical bus count', () => {
  const phases = { direct: 0, energyChain: 60, vehicle: 40 };
  const indicator = { unit: 'g', electricity_operation: 60, diesel_heating: 0, other_lifecycle: 40, total: 100, diesel_comparator_total: 200,
    phases, diesel_comparator_phases: { direct: 150, energyChain: 20, vehicle: 30 }, diesel_heating_phases: { direct: 0, energyChain: 0, vehicle: 0 } };
  const raw = { status: 'complete', vehicle_count: 2, annual_km: 100000,
    indicators: { gwp100a: indicator }, energy_boundary: {}, vehicles: [{ shift_ids: ['a', 'b'], vehicle_count: 2, annual_km: 50000, dc_kwh: 80000, indicators: { gwp100a: indicator } }] };
  const scoped = scopeFleetLca(raw, buildAnnualFleet(configuration()).groups[0]);
  assert.equal(scoped.vehicle_count, 1);
  assert.equal(scoped.vehicles[0].vehicle_count, 1);
  assert.equal(scoped.annual_km, 50000);
  assert.equal(scoped.indicators.gwp100a.diesel_comparator_total, 200);
  assert.equal(scoped.indicators.gwp100a.phases.vehicle, 40);
  assert.equal(scoped.energy_boundary.grid_kwh, 80000 / .94);
  assert.equal(raw.vehicle_count, 2);
});

import assert from 'node:assert/strict';

const sum = values => values.reduce((total, value) => total + value, 0);
const near = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Number.isFinite(expected) &&
  Math.abs(actual - expected) <= Math.max(1e-6, Math.abs(expected) * 1e-9), `${label}: ${actual} != ${expected}`);

const checkDesign = (design, km, label) => {
  near(sum(design.components.map(component => component.initial)), design.initial, `${label} initial components`);
  near(sum(design.operating.map(item => item.annual)), design.annualOpex, `${label} operating items`);
  near(sum(design.components.map(component => component.presentValue)) + design.annualOpex * design.annuityFactor,
    design.presentValue, `${label} lifetime cost`);
  near(design.annualEquivalent * design.annuityFactor, design.presentValue, `${label} annual equivalent`);
  near(design.perKm * km, design.annualEquivalent, `${label} per-km cost`);
  for (const component of design.components) {
    near(component.initial + component.discountedReplacements - component.discountedResidual,
      component.presentValue, `${label} ${component.key} capital`);
  }
};

/** Contract-level conservation checks on the serialized document, independent of the builder. */
export function assertYearlyExportReconciles(document) {
  assert.equal(document.schemaVersion, 4);
  assert.equal(document.dataQuality.status, 'complete');
  assert.equal(document.general.scope.kind, 'fleet');
  const { groups, general, shifts } = document;
  near(sum(groups.map(group => group.physicalVehicleCount)), general.scope.physicalVehicleCount, 'physical fleet count');
  for (const field of ['distanceKm', 'busEnergyDcKwh', 'purchasedGridEnergyKwh']) {
    near(sum(groups.map(group => group.fleetContribution.activity[field])), general.activity[field], `group ${field}`);
    near(sum(shifts.map(shift => shift.assessedActivity[field])), general.activity[field], `shift ${field}`);
  }
  near(general.activity.busEnergyDcKwh / .94, general.activity.purchasedGridEnergyKwh, 'DC/grid boundary');
  const frozen = document.configuration.fixedConfiguration.investment.rows;
  near(sum(frozen.map(row => row.busCost + row.batteryCost)) + document.technicalBaseline.infrastructure.total,
    general.economics.electric.initial, 'frozen investment');
  for (const design of ['electric', 'diesel']) {
    checkDesign(general.economics[design], general.activity.distanceKm, `fleet ${design}`);
    near(general.economics.comparison.points.at(-1)[design], general.economics[design].presentValue, `fleet ${design} endpoint`);
    for (const field of ['initial', 'annualOpex', 'presentValue', 'annualEquivalent']) {
      near(sum(groups.map(group => group.fleetContribution.economics[design][field])), general.economics[design][field], `group ${design} ${field}`);
    }
  }
  const baselineById = new Map(document.technicalBaseline.vehicles.map(row => [row.id, row]));
  for (const shift of shifts) {
    const baseline = baselineById.get(shift.shiftId);
    near(shift.assessedActivity.busEnergyDcKwh / shift.assessedActivity.distanceKm, baseline.dc / baseline.km, `block ${shift.shiftId} intensity`);
    near(shift.assessedActivity.distanceKm, document.assumptions.annualKmByShift[shift.shiftId], `block ${shift.shiftId} mileage input`);
  }
  assert.equal(general.environment.status, 'complete');
  const fleetLca = general.environment.result;
  near(fleetLca.annual_km, general.activity.distanceKm, 'fleet environmental mileage');
  near(fleetLca.energy_boundary.dc_kwh, general.activity.busEnergyDcKwh, 'fleet environmental DC');
  for (const group of groups) {
    const bus = group.representativeBus, contribution = group.fleetContribution, count = group.physicalVehicleCount;
    assert.equal(contribution.scope.kind, 'vehicle_group');
    assert.equal(bus.scope.kind, 'representative_bus');
    assert.equal(bus.environment.status, 'complete');
    for (const field of ['distanceKm', 'busEnergyDcKwh', 'purchasedGridEnergyKwh']) {
      near(bus.activity[field] * count, contribution.activity[field], `representative ${field}`);
    }
    for (const design of ['electric', 'diesel']) {
      checkDesign(bus.economics[design], bus.activity.distanceKm, `representative ${group.groupId} ${design}`);
      for (const field of ['initial', 'annualOpex', 'presentValue', 'annualEquivalent']) {
        near(bus.economics[design][field] * count, contribution.economics[design][field], `representative ${design} ${field}`);
      }
      near(bus.economics[design].perKm, contribution.economics[design].perKm, `representative ${design} intensity`);
      near(bus.economics.comparison.points.at(-1)[design], bus.economics[design].presentValue, `representative ${design} endpoint`);
    }
    near(bus.environment.result.annual_km, bus.activity.distanceKm, 'representative environmental mileage');
    near(bus.environment.result.energy_boundary.dc_kwh, bus.activity.busEnergyDcKwh, 'representative environmental DC');
  }
  for (const [key, indicator] of Object.entries(fleetLca.indicators)) {
    for (const field of ['electricity_operation', 'diesel_heating', 'other_lifecycle', 'total', 'diesel_comparator_total', 'saving']) {
      near(sum(groups.map(group => group.representativeBus.environment.result.indicators[key][field] * group.physicalVehicleCount)),
        indicator[field], `${key} ${field} group impacts`);
    }
    for (const field of ['phases', 'diesel_comparator_phases', 'diesel_heating_phases']) {
      for (const phase of Object.keys(indicator[field])) {
        near(sum(groups.map(group => group.representativeBus.environment.result.indicators[key][field][phase] * group.physicalVehicleCount)),
          indicator[field][phase], `${key} ${field}.${phase}`);
      }
    }
  }
}

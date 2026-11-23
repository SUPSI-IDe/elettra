import {
  buildAnnualFleet,
  dieselProjectInputs,
  electricProjectInputs,
  evaluateProjectDesign,
  cumulativeCostComparison,
  scaleAnnualFleet,
  scopeFleetLca,
  yearlyTcoDefaults,
} from './yearly-fleet-tco.js';

export const YEARLY_ASSESSMENT_METHOD = 'annual-fleet-tco-v1';

export const hasYearlyFleetInvestment = (features = {}) => {
  const rows = features.config?.fixedConfiguration?.investment?.rows;
  return Array.isArray(rows) && rows.length > 0 && rows.every(row => row?.busCost != null && row?.batteryCost != null);
};

// Only physical assessment inputs invalidate LCA; financial edits do not.
export const yearlyAssessmentLcaKey = assumptions => JSON.stringify([
  assumptions.bodyLife, assumptions.batteryLife, assumptions.dieselLife,
  assumptions.dieselConsumption, assumptions.annualKmByGroup,
]);

const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const belongsToGroup = (vehicle, group) => (vehicle.shift_ids ?? [vehicle.shift_id])
  .some(id => group.members.some(member => member.id === id));
const matchesLca = (raw, fleet, assumptions) => raw?.status === 'complete' &&
  Array.isArray(raw.vehicles) &&
  raw.vehicles.every(vehicle => close(vehicle.lifetime_bus, assumptions.bodyLife) &&
    close(vehicle.lifetime_battery, assumptions.batteryLife) &&
    close(vehicle.lifetime_diesel_bus, assumptions.dieselLife) &&
    close(vehicle.diesel_consumption_l_per_km, assumptions.dieselConsumption)) &&
  close(raw.annual_km, fleet.totals.km) && close(raw.energy_boundary?.dc_kwh, fleet.totals.dc) &&
  fleet.groups.every(group => {
    const members = raw.vehicles.filter(vehicle => belongsToGroup(vehicle, group));
    return close(members.reduce((total, vehicle) => total + vehicle.annual_km * (vehicle.vehicle_count ?? 1), 0), group.km) &&
      close(members.reduce((total, vehicle) => total + vehicle.dc_kwh * (vehicle.vehicle_count ?? 1), 0), group.dc);
  });

const scopedFleet = (fleet, group, share) => group ? {
  ...fleet,
  count: group.count,
  rows: group.members,
  totals: Object.fromEntries(['km', 'dc', 'grid', 'busCost', 'batteryCost'].map(key => [key,
    group.members.every(member => Number.isFinite(member[key]))
      ? group.members.reduce((total, member) => total + member[key], 0) : null,
  ])),
  infrastructure: Object.fromEntries(Object.entries(fleet.infrastructure)
    .map(([key, value]) => [key, value == null ? null : value * share])),
} : fleet;

function prepareScope(features, fleet, assumptions, raw, scope) {
  const group = fleet.groups.find(candidate => candidate.id === scope) ?? null;
  const divisor = group ? group.count : 1;
  const infrastructureShare = group ? group.count / fleet.count : 1;
  const local = scopedFleet(fleet, group, infrastructureShare);
  const vehicles = (raw?.vehicles ?? []).filter(vehicle => !group || belongsToGroup(vehicle, group));
  const lcaKm = vehicles.reduce((total, vehicle) => total + vehicle.annual_km * (vehicle.vehicle_count ?? 1), 0);
  const heater = features.config?.auxiliary_heating_type === 'diesel'
    ? lcaKm > 0 ? vehicles.reduce((total, vehicle) => total + vehicle.diesel_heating_liters * (vehicle.vehicle_count ?? 1), 0) * local.totals.km / lcaKm : null
    : 0;
  const dieselHeatingLiters = Number.isFinite(heater) ? heater : null;
  const inputs = {
    id: group?.id ?? 'fleet', km: local.totals.km ?? 0,
    electric: electricProjectInputs(local, {
      ...assumptions,
      infrastructureMaintenance: assumptions.infrastructureMaintenance * infrastructureShare,
    }, { dieselHeatingLiters }),
    diesel: dieselProjectInputs(local, assumptions),
  };
  return { group, divisor, infrastructureShare, local, dieselHeatingLiters, inputs };
}

export function yearlyProjectScopes({ features, baseline, assumptions, emissionsState }) {
  const fleet = scaleAnnualFleet(baseline, assumptions.annualKmByGroup);
  return ['fleet', ...fleet.groups.map(group => group.id)].map(scope =>
    prepareScope(features, fleet, assumptions, emissionsState.rawLca, scope).inputs);
}

/**
 * Evaluate the saved design and effective annual assumptions without a DOM or
 * network access. An optional baseline lets a page retain its frozen design
 * while evaluating successive edits. Explicit assumptions are the complete
 * current control values; when omitted, saved TCO assumptions are resolved.
 *
 * Fleet/group economics are additive group totals. A representative bus uses
 * `divisor` for absolute values; per-km TCO already has the correct scope.
 * The returned snapshot is detached from all inputs and safe for consumers to
 * retain. It does not fetch, save, round or serialize an export document.
 */
export function buildYearlyAssessment({
  features = {},
  model = {},
  predictionRuns = [],
  baseline = buildAnnualFleet(features, predictionRuns),
  assumptions = yearlyTcoDefaults(features, model),
  emissionsState = { status: 'idle' },
  scope = 'fleet',
  project,
} = {}) {
  const fleet = scaleAnnualFleet(baseline, assumptions.annualKmByGroup);
  const raw = emissionsState.rawLca;
  const { group, divisor, infrastructureShare, local, dieselHeatingLiters, inputs } =
    prepareScope(features, fleet, assumptions, raw, scope);
  const design = key => project === undefined
    ? evaluateProjectDesign(inputs[key], inputs.km, assumptions.horizon, assumptions.rate)
    : project?.[key] ?? null;
  const electric = design('electric'), diesel = design('diesel');
  const comparison = cumulativeCostComparison(electric, diesel, assumptions);
  const issues = [...local.issues];
  if (dieselHeatingLiters === null) issues.push('diesel_heating_activity_unavailable');
  if (project?.issue) issues.push(project.issue);
  if (!inputs.electric && !issues.length) issues.push('invalid_electric_assumptions');
  if (!inputs.diesel && !local.issues.length) issues.push('invalid_diesel_assumptions');

  const matchingLca = matchesLca(raw, fleet, assumptions) ? scopeFleetLca(raw, group) : null;
  const currentLca = emissionsState.status === 'done' ? matchingLca : null;
  const staleLca = !currentLca && raw?.status === 'complete' && ['loading', 'error'].includes(emissionsState.status)
    ? scopeFleetLca(raw, group) : null;

  return structuredClone({
    baseline,
    assumptions: {
      ...assumptions,
      annualKmByShift: Object.fromEntries(fleet.rows.map(member => [member.id, member.km])),
    },
    fleet,
    group,
    scopedFleet: local,
    scope: {
      kind: group ? 'representative_bus' : 'fleet',
      groupId: group?.id ?? null,
      shiftIds: local.rows.map(member => member.id),
      physicalVehicleCount: local.count,
    },
    divisor,
    infrastructureShare,
    economics: {
      status: electric && diesel ? 'complete' : 'incomplete',
      issues,
      electric,
      diesel,
      comparison,
      differencePerKm: electric && diesel ? diesel.perKm - electric.perKm : null,
      dieselHeatingLiters,
    },
    environment: {
      status: emissionsState.status,
      error: emissionsState.error ?? null,
      rawLca: currentLca ?? staleLca,
      matchesAssumptions: Boolean(matchingLca),
      isStale: !currentLca && Boolean(staleLca),
    },
  });
}

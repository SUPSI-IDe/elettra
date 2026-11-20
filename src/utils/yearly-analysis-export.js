import { CHARGING_ENERGY_POLICY, GRID_TO_BUS_EFFICIENCY } from './charging-energy.js';
import { buildYearlyResultScopes, getFixedYearlyShift } from './yearly-analysis-result-scope.js';
import { YEARLY_ASSESSMENT_METHOD } from './yearly-analysis-assessment.js';

export const YEARLY_EXPORT_SCHEMA_VERSION = 4;

const divided = (value, divisor) => Number.isFinite(value) ? value / divisor : null;
const sameData = (left, right) => Object.is(left, right) || Boolean(
  left && right && typeof left === 'object' && typeof right === 'object' &&
  Object.keys(left).length === Object.keys(right).length &&
  Object.keys(left).every(key => Object.hasOwn(right, key) && sameData(left[key], right[key])),
);
const activity = (totals, divisor = 1) => ({
  distanceKm: divided(totals.km, divisor),
  busEnergyDcKwh: divided(totals.dc, divisor),
  purchasedGridEnergyKwh: divided(totals.grid, divisor),
});
const hasMeasuredActivity = members => members.length > 0 && members.every(member =>
  Number.isFinite(member.km) && Number.isFinite(member.dc));

// These are changes of reporting scope, not a second financial calculation.
const designPerBus = (design, divisor) => design ? {
  ...design,
  ...Object.fromEntries(['initial', 'annualOpex', 'presentValue', 'annualEquivalent', 'residual',
    'discountedResidual', 'discountedReplacements'].filter(key => key in design)
    .map(key => [key, divided(design[key], divisor)])),
  components: design.components.map(component => ({
    ...component,
    ...Object.fromEntries(['initial', 'residual', 'discountedReplacements', 'discountedResidual', 'presentValue']
      .map(key => [key, divided(component[key], divisor)])),
    replacements: component.replacements.map(event => ({
      ...event, cost: divided(event.cost, divisor), discounted: divided(event.discounted, divisor),
    })),
  })),
  operating: design.operating.map(item => ({ ...item, annual: divided(item.annual, divisor) })),
} : null;

const economicsPerBus = (economics, divisor) => ({
  ...economics,
  electric: designPerBus(economics.electric, divisor),
  diesel: designPerBus(economics.diesel, divisor),
  dieselHeatingLiters: divided(economics.dieselHeatingLiters, divisor),
  comparison: economics.comparison ? {
    ...economics.comparison,
    points: economics.comparison.points.map(point => ({
      ...point, electric: divided(point.electric, divisor), diesel: divided(point.diesel, divisor),
    })),
  } : null,
});

const environmentResult = environment => {
  const complete = environment.status === 'done' && environment.matchesAssumptions && !environment.isStale;
  return {
    status: complete ? 'complete' : environment.status === 'done' ? 'unavailable' : environment.status,
    matchesAssumptions: environment.matchesAssumptions,
    isStale: environment.isStale,
    error: environment.error,
    reason: complete ? null : environment.status === 'done'
      ? 'lca_assumptions_or_scope_unavailable' : `lca_${environment.status}`,
    result: complete ? environment.rawLca : null,
    previousResult: !complete ? environment.rawLca : null,
  };
};

/**
 * Serialize the same completed/partial assessment used by the dashboard.
 * Inputs must be fleet and group snapshots from buildYearlyAssessment. This
 * module has no network/DOM dependency and never runs economic calculations.
 * Absolute group totals and representative-bus quantities have separate scopes.
 */
export function buildYearlyExportDocument({
  features = {},
  analysisId = '',
  analysisName = null,
  assessment,
  groupAssessments = [],
  persistence = { status: 'unknown', hasUnsavedChanges: null, error: null },
  exportedAt = new Date().toISOString(),
}) {
  if (assessment.scope.kind !== 'fleet') throw new Error('The complete annual export requires a fleet assessment');
  const snapshots = new Map(groupAssessments.map(snapshot => [snapshot.scope.groupId, snapshot]));
  const config = features.config ?? {};
  const fixed = config.fixedConfiguration ?? {};
  const environment = environmentResult(assessment.environment);
  const groups = assessment.fleet.groups.map(group => {
    const snapshot = snapshots.get(group.id);
    if (!snapshot || snapshot.scope.kind !== 'representative_bus' || snapshot.divisor !== group.count) {
      throw new Error(`Missing representative assessment for group ${group.id}`);
    }
    if (!sameData(snapshot.assumptions, assessment.assumptions) || !sameData(snapshot.scopedFleet.rows, group.members)) {
      throw new Error(`Group ${group.id} refers to different annual inputs`);
    }
    const measured = hasMeasuredActivity(assessment.baseline.groups.find(candidate => candidate.id === group.id)?.members ?? []);
    return {
      groupId: group.id,
      shiftIds: snapshot.scope.shiftIds,
      physicalVehicleCount: group.count,
      batteryPacks: group.packs,
      batteryCapacityKwh: group.capacity,
      fleetContribution: {
        scope: { ...snapshot.scope, kind: 'vehicle_group' },
        activity: measured ? activity(snapshot.scopedFleet.totals) : null,
        economics: snapshot.economics,
      },
      representativeBus: {
        scope: snapshot.scope,
        allocation: 1 / snapshot.divisor,
        activity: measured ? activity(snapshot.scopedFleet.totals, snapshot.divisor) : null,
        economics: economicsPerBus(snapshot.economics, snapshot.divisor),
        environment: environmentResult(snapshot.environment),
      },
    };
  });
  const technicalById = new Map((features.results?.shiftResults ?? []).map(result => [result.shiftId, result]));
  const assessedById = new Map(assessment.fleet.rows.map(member => [member.id, member]));
  const baselineById = new Map(assessment.baseline.rows.map(member => [member.id, member]));
  const shifts = buildYearlyResultScopes(features).filter(scope => scope.kind === 'shift').map(scope => {
    const member = assessedById.get(scope.shiftId);
    const original = baselineById.get(scope.shiftId);
    const group = groups.find(candidate => candidate.shiftIds.includes(scope.shiftId));
    return {
      shiftId: scope.shiftId,
      shiftName: scope.shiftName,
      status: scope.status,
      fixedConfiguration: getFixedYearlyShift(features, scope.shiftId),
      technicalResults: technicalById.get(scope.shiftId) ?? null,
      assessedActivity: member && original && hasMeasuredActivity([original]) ? activity(member) : null,
      assessmentGroupId: group?.groupId ?? null,
      environmentScope: group ? 'representative_group' : 'unavailable',
    };
  });
  const issues = [...assessment.economics.issues, ...(environment.reason ? [environment.reason] : [])];
  if (persistence.hasUnsavedChanges) issues.push(`assessment_assumptions_${persistence.status}`);
  for (const group of groups) {
    issues.push(...group.fleetContribution.economics.issues.map(issue => `group:${group.groupId}:${issue}`));
    if (group.representativeBus.environment.reason) issues.push(`group:${group.groupId}:${group.representativeBus.environment.reason}`);
  }
  for (const shift of shifts) {
    if (!shift.technicalResults) issues.push(`shift:${shift.shiftId}:technical_results_unavailable`);
    if (!shift.assessedActivity) issues.push(`shift:${shift.shiftId}:assessed_activity_unavailable`);
  }
  return structuredClone({
    schemaVersion: YEARLY_EXPORT_SCHEMA_VERSION,
    exportedAt,
    analysis: { id: analysisId, name: analysisName, status: features.results?.status ?? null },
    units: { distance: 'km', energy: 'kWh', currency: 'CHF', fuel: 'l', lifetime: 'years', costPerDistance: 'CHF/km' },
    methodology: {
      economics: YEARLY_ASSESSMENT_METHOD,
      chargingEnergy: CHARGING_ENERGY_POLICY,
      gridToBusEfficiency: GRID_TO_BUS_EFFICIENCY,
      environment: assessment.environment.rawLca?.methodology_version ?? null,
    },
    provenance: {
      sourceOptimizationRunId: fixed.sourceOptimizationRunId ?? features.results?.baseOptimizationRunId ?? null,
      gtfs: features.gtfs_provenance ?? null,
      weather: config.weather_reference ?? null,
      busModelSnapshot: config.bus_model_snapshot ?? null,
    },
    configuration: config,
    assumptions: assessment.assumptions,
    persistence,
    technicalBaseline: {
      activity: activity(assessment.baseline.totals),
      vehicles: assessment.baseline.rows,
      infrastructure: assessment.baseline.infrastructure,
      scenarios: features.scenarios ?? [],
      results: features.results ?? null,
    },
    general: {
      scope: assessment.scope,
      activity: hasMeasuredActivity(assessment.baseline.rows) ? activity(assessment.fleet.totals) : null,
      economics: assessment.economics,
      environment,
    },
    groups,
    shifts,
    dataQuality: {
      status: issues.length ? 'partial' : 'complete',
      issues,
    },
  });
}

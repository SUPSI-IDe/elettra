import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYearlyAssessment } from '../src/utils/yearly-analysis-assessment.js';
import { buildYearlyExportDocument } from '../src/utils/yearly-analysis-export.js';
import { validateParameterizedLca } from '../src/pages/Simulation/YearlyAnalysis/parameterized-lca.js';
import { annualExportFixture, annualExportLca } from '../test-support/yearly-export-acceptance-fixture.js';
import { assertYearlyExportReconciles } from '../test-support/yearly-export-reconciliation.js';

const documentFor = (analysis, model) => {
  const emissionsState = { status: 'done', rawLca: annualExportLca(analysis) };
  assert.deepEqual(validateParameterizedLca(emissionsState.rawLca), { valid: true, issues: [] });
  const features = analysis.features;
  const assessment = buildYearlyAssessment({ features, model, emissionsState });
  const groupAssessments = assessment.fleet.groups.map(group => buildYearlyAssessment({
    features, baseline: assessment.baseline, assumptions: assessment.assumptions, emissionsState, scope: group.id,
  }));
  return JSON.parse(JSON.stringify(buildYearlyExportDocument({ features, assessment, groupAssessments,
    persistence: { status: 'saved', hasUnsavedChanges: false, error: null } })));
};

for (const uniform of [true, false]) for (const heating of ['default', 'diesel']) for (const rate of [0, .04]) {
  test(`serialized reconciliation: ${uniform ? 'uniform' : 'mixed'} batteries, ${heating} heating, rate ${rate}`, () => {
    const { analysis, busModel } = annualExportFixture({ uniform, heating, rate });
    const baseline = documentFor(analysis, busModel.specs);
    assertYearlyExportReconciles(baseline);
    assert.equal(baseline.general.economics.electric.initial, uniform ? 1690000 : 1730000);
    assert.equal(baseline.general.economics.dieselHeatingLiters, heating === 'diesel' ? 730 : 0);
    const group = baseline.groups[0];
    const changed = { ...analysis.features.assessment_assumptions.tco,
      horizon: 17, bodyLife: 12, batteryLife: 5, pointLife: 10, siteLife: 30, dieselLife: 10,
      energyPrice: .37, fuelPrice: 2, infrastructureMaintenanceMode: 'fixed', infrastructureMaintenance: 3600,
      annualKmByGroup: { ...baseline.assumptions.annualKmByGroup, [group.groupId]: 30000 },
      annualKmByShift: Object.fromEntries(baseline.shifts.map(shift => [shift.shiftId,
        shift.assessedActivity.distanceKm * (group.shiftIds.includes(shift.shiftId)
          ? 30000 * group.physicalVehicleCount / group.fleetContribution.activity.distanceKm : 1)])),
    };
    analysis.features.assessment_assumptions.tco = changed;
    const edited = documentFor(analysis, busModel.specs);
    assertYearlyExportReconciles(edited);
    assert.equal(edited.technicalBaseline.activity.distanceKm, 73000);
    assert.equal(edited.general.economics.electric.initial, baseline.general.economics.electric.initial);
    const heater = edited.general.economics.electric.operating.find(item => item.key === 'heater');
    assert.ok(Math.abs(heater.annual - (heating === 'diesel' ? edited.general.activity.distanceKm * .01 * 2 * 1.1 : 0)) < 1e-6);
    assert.equal(edited.general.economics.electric.operating.find(item => item.key === 'infraMaintenance').annual, 3600);
  });
}

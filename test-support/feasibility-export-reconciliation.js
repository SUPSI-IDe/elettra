import assert from 'node:assert/strict';

const near = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Number.isFinite(expected) &&
  Math.abs(actual - expected) <= Math.max(1e-6, Math.abs(expected) * 1e-9), `${label}: ${actual} != ${expected}`);
const sum = rows => rows.reduce((total, value) => total + value, 0);

/** Conservation checks on serialized data, independent of the assessment and export builders. */
export function assertFeasibilityExportReconciles(document) {
  assert.equal(document.kind, 'feasibility_evaluation');
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.methodology.sharedInfrastructure, 'once_per_design');
  assert.equal(new Set(document.designs.map(row => row.run.id)).size, document.designs.length);
  for (const design of document.designs) {
    assert.equal(document.profiles.find(row => row.basis === design.basis.key).runId, design.run.id);
    const { rows, totals } = design.general.investment;
    for (const key of ['packs', 'capacity', 'busCost', 'batteryCost', 'totalCost']) {
      if (rows.length && rows.every(row => Number.isFinite(row[key]))) near(totals[key], sum(rows.map(row => row[key])), `${key} fleet sum`);
      else assert.equal(totals[key], null, `${key} incomplete fleet sum`);
    }
    for (const row of rows) {
      if (row.busCost !== null && row.batteryCost !== null) near(row.totalCost, row.busCost + row.batteryCost, 'vehicle investment');
      if (row.packs !== null && row.packCost !== null) near(row.batteryCost, row.packs * row.packCost, 'selected battery investment');
      const saved = design.sourceData.results?.battery_results?.[row.id];
      if (saved?.investment_cost_source === 'bus_model_snapshot' && saved.bus_cost_chf != null) {
        near(row.busCost, Number(saved.bus_cost_chf), 'frozen bus price');
      }
    }
    const infrastructureCost = design.sourceData.results?.total_installation_cost_chf;
    if (Number.isFinite(infrastructureCost)) {
      near(design.general.infrastructure.totalInstallationCostChf, infrastructureCost, 'shared infrastructure cost');
    }
    const availableIds = new Set(design.sourceData.predictionRuns.map(row => String(row.id)));
    assert.deepEqual(design.provenance.predictions.missingRunIds,
      design.provenance.predictions.requestedRunIds.filter(key => !availableIds.has(key)));
    assert.equal(new Set(design.shifts.map(row => row.shiftId)).size, design.shifts.length);
    assert.deepEqual(design.shifts.map(row => row.shiftId), design.general.scope.shiftIds);
    const current = design.execution.state === 'completed' && !design.general.failure;
    for (const block of design.shifts) {
      assert.equal(Object.hasOwn(block, 'infrastructure'), false, 'shared infrastructure must not be charged to every block');
      assert.equal(block.scope.shiftId, block.shiftId);
      if (!current) {
        assert.equal(block.consumption, null);
        assert.equal(block.operation.result, null);
      }
      if (block.diagnostic) {
        assert.equal(block.operation.result, null);
        assert.equal(block.energyBalance, null);
      }
      const results = block.diagnostic?.source === 'diagnostic'
        ? design.sourceData.results.infeasibility_diagnostics : design.sourceData.results;
      const analysis = results?.consumption_analysis;
      const detail = analysis?.per_shift?.[block.shiftId];
      if (block.consumption?.source === 'aggregate_profile') {
        const field = design.basis.key === 'aggregate_q95' ? 'q95_total_kwh' : 'mean_total_kwh';
        const key = design.basis.key === 'aggregate_q95' ? 'aggregate_q95' : 'mean';
        near(block.consumption.totalKwh, detail.statistics?.[field] ?? detail.cases?.[key]?.total_consumption_kwh, 'decision profile consumption');
      }
      const balance = block.energyBalance;
      if (balance) {
        if (balance.plannedChargingEnergyKwh !== null) {
          near(balance.operationalEnergyKwh, balance.usableBatteryEnergyKwh + balance.plannedChargingEnergyKwh, 'operational energy');
        } else assert.equal(balance.operationalEnergyKwh, null);
        const policy = design.operatingAssumptions.values;
        if (block.battery.nominalCapacityKwh !== null) {
          near(balance.minimumAllowedSocKwh, block.battery.nominalCapacityKwh * policy.state_of_health * policy.min_soc, 'minimum SOC energy');
          near(balance.maximumAllowedSocKwh, block.battery.nominalCapacityKwh * policy.state_of_health * policy.max_soc, 'maximum SOC energy');
        }
      }
      if (block.operation.result) {
        const plan = block.operation.result.chargingPlan;
        if (plan.status === 'complete') {
          near(plan.sessions.length, plan.reportedSessionCount ?? plan.sessions.length, 'charging session count');
          if (plan.sessions.every(row => row.energyKwh !== null) && block.operation.result.totalChargedKwh !== null) {
            near(sum(plan.sessions.map(row => row.energyKwh)), block.operation.result.totalChargedKwh, 'total charged energy');
          }
        }
        if (plan.status === 'empty') assert.equal(plan.sessions.length, 0);
        for (const session of plan.sessions) if (session.detailsComplete) {
          near(session.endMinute - session.startMinute, session.durationMinutes, 'session day offset');
          near(session.averagePowerKw * session.durationMinutes / 60, session.energyKwh, 'session energy');
        }
      }
      const selected = block.forecasts.find(row => row.isOptimized);
      if (selected && block.consumption?.perKmKwh != null && selected.totalDistanceKm > 0) {
        near(block.consumption.perKmKwh * selected.totalDistanceKm, block.consumption.totalKwh, 'decision energy intensity');
      }
    }
  }
}

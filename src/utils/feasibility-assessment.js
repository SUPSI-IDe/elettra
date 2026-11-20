import { resultBatteryPolicy } from './battery-policy.js';
import { evaluationStatus, pairedFeasibility } from './paired-feasibility.js';
import { buildFeasibilityResultModel } from './feasibility-result-model.js';
import { buildFeasibilityViewState } from './feasibility-view-state.js';
import { buildInfeasibilityPresentation, infeasibilityDetailRun } from './infeasibility-presentation.js';
import { scopePredictionRunsByShift } from './feasibility-shift-scope.js';
import { buildFleetInvestment } from './fleet-investment.js';
import { buildShiftEnergyBalance, ENERGY_BALANCE_TOLERANCE_KWH } from './feasibility-energy-balance.js';
import {
  buildFeasibilityPredictionRows, buildFeasibilityBatteryCoverage, buildFeasibilitySizingEffect,
  resolveSinglePackCapacityKwh, resolveShiftDecisionConsumption,
} from './feasibility-predictions.js';

export const FEASIBILITY_ASSESSMENT_METHOD = 'feasibility-technical-v1';

const number = value => value == null || typeof value === 'boolean' ||
  (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) ? null : Number(value);

/** Detached technical snapshot for one saved design and scope. No I/O or presentation formatting. */
export function buildFeasibilityAssessment({
  optimizationRun = {}, predictionRuns = [], currentBusModel = {}, shiftNamesById = {}, scope = 'general',
} = {}) {
  const source = structuredClone({ optimizationRun, predictionRuns, currentBusModel, shiftNamesById });
  const savedRun = source.optimizationRun;
  const isShift = scope !== 'general';
  const options = { shiftNamesById: source.shiftNamesById, ...(isShift ? { selectedShiftId: scope } : {}) };
  const infeasibility = buildInfeasibilityPresentation(savedRun, options);
  const diagnosticRow = infeasibility.rows.find(row => row.shiftId === scope) ?? null;
  const isDiagnostic = Boolean(infeasibility.active && isShift &&
    (diagnosticRow?.source !== 'result' || diagnosticRow.critical));
  const run = isDiagnostic ? infeasibilityDetailRun(savedRun, diagnosticRow) : savedRun;
  const model = buildFeasibilityResultModel(run, options);
  const viewState = buildFeasibilityViewState(model, isShift ? scope : null);
  if (isShift && viewState.selectedShiftId !== scope) {
    // Historical navigation can name a block whose saved technical details are absent.
    // Leave that selection unavailable rather than borrowing the first block's values.
    Object.assign(viewState, { selectedShift: null, selectedShiftSummary: null,
      selectedShiftId: scope, selectedShiftName: String(scope) });
  }
  const inputParams = run.input_params ?? {};
  const results = run.results ?? {};
  const operatingAssumptions = resultBatteryPolicy(run);
  const scopedPredictionRuns = scopePredictionRunsByShift(source.predictionRuns, options);
  const common = {
    method: FEASIBILITY_ASSESSMENT_METHOD,
    scope: { kind: isShift ? 'shift' : 'general', shiftId: isShift ? scope : null },
    sourceRun: savedRun, run, predictionRuns: scopedPredictionRuns,
    execution: evaluationStatus(savedRun), pairedOutcome: pairedFeasibility(savedRun),
    designExecution: evaluationStatus({ ...savedRun, basis_summaries: null }),
    model, viewState, infeasibility, diagnosticRow, isDiagnostic, operatingAssumptions,
    fleetInvestment: buildFleetInvestment(savedRun, source.currentBusModel, options),
  };
  // General describes the fleet design. A single block's energy must never look like a fleet total.
  if (!isShift) {
    Object.assign(viewState, { selectedShift: null, selectedShiftSummary: null, selectedShiftId: null, selectedShiftName: null });
    return { ...common, predictions: [], batteryCoverage: null, energyBalance: null,
      decisionConsumption: null, sizingEffect: null, energyComparison: null,
      singlePackCapacityKwh: null, diagnosticConsumptionComparable: false };
  }
  const predictionOptions = { ...options, inputParams, batteryPolicy: operatingAssumptions,
    initialReferencePredictionRunIds: results.initial_reference_prediction_run_ids,
    selectedPredictionRunIds: results.selected_prediction_run_ids,
    forecastVerificationStatus: results.forecast_verification?.status,
  };
  const predictions = buildFeasibilityPredictionRows(scopedPredictionRuns, results.per_bus_summary,
    results.battery_results, predictionOptions);
  const batteryCoverage = buildFeasibilityBatteryCoverage(scopedPredictionRuns, results.battery_results,
    inputParams, predictionOptions);
  const adequacy = batteryCoverage?.matchedRun
    ? predictions.find(row => row.runId === String(batteryCoverage.matchedRun.id)) : null;
  const summary = viewState.selectedShiftSummary;
  const nominal = batteryCoverage?.nominalKwh;
  const energyBalance = batteryCoverage ? buildShiftEnergyBalance({
    usableBatteryEnergyKwh: batteryCoverage.usableKwh,
    plannedChargingEnergyKwh: summary?.operation.totalChargedKwh,
    q05DemandKwh: adequacy?.totalConsumptionQ05Kwh,
    meanDemandKwh: adequacy?.totalConsumptionMeanKwh,
    q50DemandKwh: adequacy?.totalConsumptionMedianKwh,
    q95DemandKwh: adequacy?.totalConsumptionQ95Kwh,
    meanScheduleFeasible: summary?.battery.physicalFeasible,
    minimumSocKwh: summary?.operation.minSocKwh,
    maximumSocKwh: summary?.operation.maxSocKwh,
    minimumAllowedSocKwh: nominal == null ? null : nominal * operatingAssumptions.state_of_health * operatingAssumptions.min_soc,
    maximumAllowedSocKwh: nominal == null ? null : nominal * operatingAssumptions.state_of_health * operatingAssumptions.max_soc,
    minimumSocFraction: operatingAssumptions.min_soc, maximumSocFraction: operatingAssumptions.max_soc,
  }) : null;
  const decisionConsumption = resolveShiftDecisionConsumption(predictions, results, inputParams, isShift ? scope : null);
  const diagnosticChargingKwh = number(summary?.operation.totalChargedKwh);
  const diagnosticConsumptionComparable = diagnosticChargingKwh !== null &&
    (decisionConsumption.source !== 'reference_forecast' || decisionConsumption.referencePacks === diagnosticRow?.selected);
  const savedUsableEnergyKwh = number(diagnosticRow?.battery.battery_energy?.usable_capacity_kwh);
  const availableKwh = isDiagnostic && !diagnosticConsumptionComparable ? null
    : isDiagnostic && savedUsableEnergyKwh !== null ? savedUsableEnergyKwh + diagnosticChargingKwh
      : number(energyBalance?.comparisonEnergyKwh);
  const savedPackCapacity = isDiagnostic ? number(diagnosticRow?.battery.pack_size_kwh) : null;
  return {
    ...common,
    singlePackCapacityKwh: savedPackCapacity > 0 ? savedPackCapacity
      : resolveSinglePackCapacityKwh(scopedPredictionRuns[0], results.battery_results, options),
    predictions, batteryCoverage, energyBalance, decisionConsumption, diagnosticConsumptionComparable,
    sizingEffect: buildFeasibilitySizingEffect(predictions, decisionConsumption),
    energyComparison: { demandKwh: decisionConsumption.totalKwh, availableKwh,
      isDeficit: decisionConsumption.totalKwh !== null && availableKwh !== null &&
        availableKwh + ENERGY_BALANCE_TOLERANCE_KWH < decisionConsumption.totalKwh },
  };
}

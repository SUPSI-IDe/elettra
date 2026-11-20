import { resultBatteryPolicy } from './battery-policy.js';
import { FEASIBILITY_DEMAND_BASIS, resolveFeasibilityDemandBasis } from './feasibility-demand-basis.js';
import { hasShiftSelection, matchesShiftRecord, scopePredictionRunsByShift } from './feasibility-shift-scope.js';

// Missing quantities must remain missing, including explicit nulls in old records.
const toFiniteNumber = value => {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const toOptionalFiniteNumber = toFiniteNumber;
const matchesSelectedShift = matchesShiftRecord;
const PREDICTION_QUANTILE_KEYS = ['q05', 'q50', 'q95'];

export const resolveUsableSocFraction = (inputParams = {}) => {
  try { return resultBatteryPolicy({ input_params: inputParams }).usable_fraction_initial; }
  catch { return null; }
};

export const applyUsableSocWindow = (nominalKwh, usableSocFraction) => {
  const nominal = toOptionalFiniteNumber(nominalKwh);
  if (nominal == null) return null;
  if (usableSocFraction === null || usableSocFraction === undefined) return nominal;
  const usable = toFiniteNumber(usableSocFraction);
  return usable == null ? nominal : nominal * usable;
};

const deriveSocKwh = (batteryCapacityKwh, socFraction) => {
  const capacity = toFiniteNumber(batteryCapacityKwh);
  const soc = toFiniteNumber(socFraction);

  if (capacity == null || soc == null) return null;
  return capacity * soc;
};

const readPredictionQuantiles = (summary = {}, candidateKeys = []) => {
  const sourceKey = candidateKeys.find((key) => {
    const value = summary?.[key];
    return value && typeof value === "object" && !Array.isArray(value);
  });
  const source = sourceKey ? summary[sourceKey] : {};

  return Object.fromEntries(
    PREDICTION_QUANTILE_KEYS.map((key) => [key, toFiniteNumber(source?.[key])])
  );
};

const hasPredictionQuantiles = (quantiles = {}) =>
  PREDICTION_QUANTILE_KEYS.some((key) => quantiles?.[key] != null);

export const readPredictionTotalQuantiles = (
  summary = {},
  { kind = "absolute" } = {}
) =>
  readPredictionQuantiles(
    summary,
    kind === "per_km"
      ? [
          "consumption_per_km_kwh_quantiles",
          "total_consumption_per_km_kwh_quantiles",
          "total_per_km_kwh_quantiles",
        ]
      : ["quantiles", "total_quantiles", "consumption_quantiles"]
  );

const subtractPredictionQuantiles = (total = {}, drivetrain = {}) =>
  Object.fromEntries(
    PREDICTION_QUANTILE_KEYS.map((key) => {
      const totalValue = toFiniteNumber(total?.[key]);
      const drivetrainValue = toFiniteNumber(drivetrain?.[key]);
      return [
        key,
        totalValue != null && drivetrainValue != null
          ? totalValue - drivetrainValue
          : null,
      ];
    })
  );

export const buildPredictionComponentRows = (summary = {}, kind = "absolute") => {
  const isPerKm = kind === "per_km";
  const totalQuantiles = readPredictionTotalQuantiles(summary, {
    kind: isPerKm ? "per_km" : "absolute",
  });
  const drivetrainQuantiles = readPredictionQuantiles(
    summary,
    isPerKm ? ["drivetrain_per_km_kwh_quantiles"] : ["drivetrain_quantiles"]
  );
  const auxiliaryQuantilesDirect = readPredictionQuantiles(
    summary,
    isPerKm ? ["auxiliary_per_km_kwh_quantiles"] : ["auxiliary_quantiles"]
  );
  const auxiliaryQuantiles = hasPredictionQuantiles(auxiliaryQuantilesDirect)
    ? auxiliaryQuantilesDirect
    : subtractPredictionQuantiles(totalQuantiles, drivetrainQuantiles);

  return [
    {
      key: "drivetrain",
      mean: toFiniteNumber(
        isPerKm ? summary?.drivetrain_per_km_kwh : summary?.total_drivetrain_kwh
      ),
      quantiles: drivetrainQuantiles,
      derived: false,
    },
    {
      key: "auxiliary",
      mean: toFiniteNumber(
        isPerKm ? summary?.auxiliary_per_km_kwh : summary?.total_auxiliary_kwh
      ),
      quantiles: auxiliaryQuantiles,
      derived: !hasPredictionQuantiles(auxiliaryQuantilesDirect),
    },
    {
      key: "total",
      mean: toFiniteNumber(
        isPerKm ? summary?.consumption_per_km_kwh : summary?.total_consumption_kwh
      ),
      quantiles: totalQuantiles,
      derived: false,
    },
  ].filter((row) => row.mean != null || hasPredictionQuantiles(row.quantiles));
};

export const buildFeasibilityPredictionRows = (predictionRuns, perBusSummary, batteryResults = {}, viewOptions = {}) => {
  const allRuns = [...(predictionRuns ?? [])];
  const policy = viewOptions.batteryPolicy ?? resultBatteryPolicy({ input_params: viewOptions?.inputParams });
  const minSocFraction = policy.min_soc * policy.state_of_health;
  const maxSocFraction = policy.max_soc * policy.state_of_health;
  const selectedPredictionIds = new Set(
    Object.values(viewOptions?.selectedPredictionRunIds ?? {})
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
  );
  const initialReferencePredictionIds = new Set(
    Object.values(viewOptions?.initialReferencePredictionRunIds ?? {})
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
  );

  const sorted = scopePredictionRunsByShift(allRuns, viewOptions);

  const perBusArr = Array.isArray(perBusSummary) ? perBusSummary : [];
  const filteredPerBus = hasShiftSelection(viewOptions)
    ? perBusArr.filter((entry) =>
        matchesSelectedShift(entry, "", viewOptions)
      )
    : perBusArr;

  const optimizedPackSet = new Set(
    Object.entries(batteryResults ?? {})
      .filter(([shiftKey, result]) =>
        matchesSelectedShift(result, shiftKey, viewOptions)
      )
      .map(([, result]) => toFiniteNumber(result?.optimized_packs))
      .filter((value) => value != null)
  );
  const referencePackSet = new Set(
    Object.entries(batteryResults ?? {})
      .filter(([shiftKey, result]) =>
        matchesSelectedShift(result, shiftKey, viewOptions)
      )
      .map(([, result]) => toFiniteNumber(result?.reference_packs))
      .filter((value) => value != null)
  );
  const maxPhysicalPackSet = new Set(
    Object.entries(batteryResults ?? {})
      .filter(([shiftKey, result]) =>
        matchesSelectedShift(result, shiftKey, viewOptions)
      )
      .map(([, result]) => toFiniteNumber(result?.max_physical_packs))
      .filter((value) => value != null)
  );

  const rows = sorted.map((run) => {
    const cp = run?.contextual_parameters ?? {};
    const s = run?.summary ?? {};
    const packs = toFiniteNumber(cp.num_battery_packs);
    const batteryCapacityKwh = toFiniteNumber(cp.battery_capacity_kwh);
    const totalQuantiles = readPredictionTotalQuantiles(s, { kind: "absolute" });
    const perKmQuantiles = readPredictionTotalQuantiles(s, { kind: "per_km" });
    const componentRows = buildPredictionComponentRows(s, "absolute");
    const meanDrivetrainKwh = toOptionalFiniteNumber(
      componentRows.find((row) => row.key === "drivetrain")?.mean
    );
    const meanAuxiliaryKwh = toOptionalFiniteNumber(
      componentRows.find((row) => row.key === "auxiliary")?.mean
    );
    const totalConsumptionMeanKwh = toOptionalFiniteNumber(s.total_consumption_kwh);
    const totalConsumptionQ05Kwh = toOptionalFiniteNumber(totalQuantiles?.q05);
    const totalConsumptionQ50Kwh = toOptionalFiniteNumber(totalQuantiles?.q50);
    const totalConsumptionQ95Kwh = toOptionalFiniteNumber(totalQuantiles?.q95);
    const consumptionPerKmMeanKwh = toOptionalFiniteNumber(s.consumption_per_km_kwh);
    const consumptionPerKmQ05Kwh = toOptionalFiniteNumber(perKmQuantiles?.q05);
    const consumptionPerKmQ50Kwh = toOptionalFiniteNumber(perKmQuantiles?.q50);
    const consumptionPerKmQ95Kwh = toOptionalFiniteNumber(perKmQuantiles?.q95);
    const matchedBus = filteredPerBus.find((entry) => {
      const entryPacks = toFiniteNumber(entry?.optimized_packs ?? entry?.num_battery_packs);
      return entryPacks != null && entryPacks === packs;
    }) ?? {};

    const runId = String(run?.id ?? "").trim();
    const selectedById = Boolean(runId) && selectedPredictionIds.has(runId);
    const initialReferenceById =
      Boolean(runId) && initialReferencePredictionIds.has(runId);
    const isOptimized = selectedById || (
      selectedPredictionIds.size === 0 &&
      packs != null &&
      optimizedPackSet.has(packs)
    );
    const isInitialReference = initialReferenceById || (
      initialReferencePredictionIds.size === 0 &&
      packs != null &&
      referencePackSet.has(packs)
    );
    const isMaximumPhysical =
      packs != null && maxPhysicalPackSet.has(packs);
    const predictionRole = isOptimized
      ? isInitialReference
        ? "selected_reference"
        : "selected"
      : isInitialReference
        ? isMaximumPhysical
          ? "initial_max_physical"
          : "initial_reference"
        : "verification";

    return {
      runId,
      numBatteryPacks: packs,
      batteryCapacityKwh,
      totalWeightKg: toFiniteNumber(cp.total_weight_kg),
      totalDistanceKm: toFiniteNumber(s.total_distance_km),
      totalConsumptionKwh: totalConsumptionMeanKwh,
      totalConsumptionQ05Kwh,
      totalConsumptionMeanKwh,
      totalConsumptionMedianKwh: totalConsumptionQ50Kwh,
      totalConsumptionQ95Kwh,
      consumptionPerKmKwh: consumptionPerKmMeanKwh,
      consumptionPerKmQ05Kwh,
      consumptionPerKmMeanKwh,
      consumptionPerKmMedianKwh: consumptionPerKmQ50Kwh,
      consumptionPerKmQ95Kwh,
      totalDrivetrainKwh: meanDrivetrainKwh,
      totalAuxiliaryKwh: meanAuxiliaryKwh,
      minSocKwh:
        deriveSocKwh(batteryCapacityKwh, minSocFraction) ??
        toFiniteNumber(matchedBus.min_soc_kwh),
      maxSocKwh:
        deriveSocKwh(batteryCapacityKwh, maxSocFraction) ??
        toFiniteNumber(matchedBus.max_soc_kwh),
      isOptimized,
      isVerifiedSelection:
        isOptimized && viewOptions?.forecastVerificationStatus === "verified",
      predictionRole,
    };
  });

  if (!optimizedPackSet.size) {
    const bestRow = rows.reduce((best, row) => {
      if (row.consumptionPerKmMeanKwh == null) return best;
      if (!best || row.consumptionPerKmMeanKwh < best.consumptionPerKmMeanKwh) {
        return row;
      }
      return best;
    }, null);
    if (bestRow?.numBatteryPacks != null) {
      optimizedPackSet.add(bestRow.numBatteryPacks);
    }
  }

  return rows.map((row) => {
    if (row.isOptimized || optimizedPackSet.size === 0) return row;
    if (selectedPredictionIds.size > 0) return row;
    if (row.numBatteryPacks == null || !optimizedPackSet.has(row.numBatteryPacks)) {
      return row;
    }
    return {
      ...row,
      isOptimized: true,
      isVerifiedSelection:
        viewOptions?.forecastVerificationStatus === "verified",
      predictionRole:
        row.predictionRole === "initial_max_physical" ||
        row.predictionRole === "initial_reference"
          ? "selected_reference"
          : "selected",
    };
  });
};

export const resolveSinglePackCapacityKwh = (predictionRun = {}, batteryResults = {}, viewOptions = {}) => {
  const cp = predictionRun?.contextual_parameters ?? {};
  const predictionCapacity = toOptionalFiniteNumber(cp.battery_capacity_kwh);
  const predictionPacks = toOptionalFiniteNumber(cp.num_battery_packs);
  if (predictionCapacity != null && predictionPacks > 0) {
    return predictionCapacity / predictionPacks;
  }

  const batteryEntry = Object.entries(batteryResults ?? {})
    .find(([shiftKey, result]) => matchesSelectedShift(result, shiftKey, viewOptions))?.[1];
  const maxPhysicalKwh = toOptionalFiniteNumber(batteryEntry?.max_physical_kwh);
  const maxPhysicalPacks = toOptionalFiniteNumber(batteryEntry?.max_physical_packs);
  if (maxPhysicalKwh != null && maxPhysicalPacks > 0) {
    return maxPhysicalKwh / maxPhysicalPacks;
  }

  return null;
};

export const resolveOptimizedInstalledNominalKwh = ({
  batteryEntry = {},
  matchedRun = null,
  scopedRuns = [],
  batteryResults = {},
  viewOptions = {},
} = {}) => {
  const optimizedPacks = toOptionalFiniteNumber(batteryEntry?.optimized_packs);
  const matchedRunCapacity = toOptionalFiniteNumber(
    matchedRun?.contextual_parameters?.battery_capacity_kwh
  );
  const matchedRunPacks = toOptionalFiniteNumber(
    matchedRun?.contextual_parameters?.num_battery_packs
  );
  if (
    optimizedPacks != null &&
    matchedRunCapacity != null &&
    matchedRunPacks === optimizedPacks
  ) {
    return matchedRunCapacity;
  }

  const maxPhysicalKwh = toOptionalFiniteNumber(batteryEntry?.max_physical_kwh);
  const maxPhysicalPacks = toOptionalFiniteNumber(batteryEntry?.max_physical_packs);
  if (
    optimizedPacks != null &&
    maxPhysicalKwh != null &&
    maxPhysicalPacks === optimizedPacks
  ) {
    return maxPhysicalKwh;
  }

  if (optimizedPacks != null) {
    const singlePackCapacityKwh = resolveSinglePackCapacityKwh(
      matchedRun ?? scopedRuns[0] ?? {},
      batteryResults,
      viewOptions
    );
    if (singlePackCapacityKwh != null) {
      return singlePackCapacityKwh * optimizedPacks;
    }
  }

  return toOptionalFiniteNumber(batteryEntry?.optimized_kwh);
};

export function buildFeasibilityBatteryCoverage(predictionRuns = [], batteryResults = {}, inputParams = {}, options = {}) {
  const scopedRuns = scopePredictionRunsByShift(predictionRuns, options);
  const entries = Object.entries(batteryResults ?? {})
    .filter(([key, row]) => matchesSelectedShift(row, key, options)).map(([, row]) => row);
  const packs = entries.map(row => toFiniteNumber(row?.optimized_packs)).filter(value => value !== null);
  const optimizedPacks = packs.length ? Math.max(...packs) : null;
  const batteryEntry = entries.find(row => toFiniteNumber(row?.optimized_packs) === optimizedPacks) ?? entries[0] ?? {};
  const selectedIds = new Set(Object.values(options.selectedPredictionRunIds ?? {})
    .map(value => String(value ?? '').trim()).filter(Boolean));
  const matchedRun = optimizedPacks === null ? null : scopedRuns.find(run =>
    toFiniteNumber(run?.contextual_parameters?.num_battery_packs) === optimizedPacks &&
    (!selectedIds.size || selectedIds.has(String(run.id)))) ?? null;
  const nominalKwh = resolveOptimizedInstalledNominalKwh({ batteryEntry, matchedRun, scopedRuns, batteryResults, viewOptions: options });
  const usableKwh = applyUsableSocWindow(nominalKwh,
    options.batteryPolicy?.usable_fraction_initial ?? resolveUsableSocFraction(inputParams));
  return usableKwh === null ? null : {
    optimizedPacks, nominalKwh, usableKwh, matchedRun,
    matchedRunIndex: matchedRun ? scopedRuns.indexOf(matchedRun) : -1,
  };
}

export function buildFeasibilitySizingEffect(predictions = [], decisionConsumption = {}) {
  const selected = predictions.find(row => row.isOptimized) ?? predictions[0] ?? null;
  const initial = predictions.find(row => ['initial_reference', 'initial_max_physical'].includes(row.predictionRole)) ??
    (selected?.predictionRole === 'selected_reference' ? selected : null);
  const mean = selected?.totalConsumptionMeanKwh;
  const drivetrain = selected?.totalDrivetrainKwh;
  const auxiliary = selected?.totalAuxiliaryKwh;
  const coherent = drivetrain != null && auxiliary != null && mean != null &&
    Math.abs(drivetrain + auxiliary - mean) <= Math.max(.1, Math.abs(mean) * .001);
  const total = toFiniteNumber(decisionConsumption.totalKwh);
  const decisionAuxiliaryKwh = coherent ? auxiliary : null;
  return {
    selectedRunId: selected?.runId ?? null,
    initialRunId: initial?.runId ?? null,
    decisionTotalKwh: total,
    decisionPerKmKwh: toFiniteNumber(decisionConsumption.perKmKwh),
    decisionAuxiliaryKwh,
    decisionDrivetrainKwh: total !== null && decisionAuxiliaryKwh !== null && total >= decisionAuxiliaryKwh
      ? total - decisionAuxiliaryKwh : null,
  };
}

export const resolveShiftDecisionConsumption = (
  predictionData,
  results,
  inputParams,
  selectedShiftId,
) => {
  const basis = resolveFeasibilityDemandBasis(inputParams);
  const selectedPrediction = predictionData.find((row) => row.isOptimized) ??
    predictionData[0] ?? null;
  const perShiftAnalysis = results?.consumption_analysis?.per_shift ?? {};
  const normalizedShiftId = String(selectedShiftId ?? "").trim();
  const shiftAnalysis = perShiftAnalysis?.[normalizedShiftId] ??
    Object.entries(perShiftAnalysis).find(([shiftKey, detail]) =>
      [shiftKey, detail?.shift_id, detail?.id]
        .map((value) => String(value ?? "").trim())
        .includes(normalizedShiftId)
    )?.[1] ?? null;
  const analysisStatistics = shiftAnalysis?.statistics ?? {};
  const analysisCases = shiftAnalysis?.cases ?? {};
  const aggregateAnalysisAvailable =
    results?.consumption_analysis?.status === "available" &&
    shiftAnalysis?.status === "available";
  const finite = (...values) =>
    values
      .map((value) => toOptionalFiniteNumber(value))
      .find((value) => value !== null) ?? null;
  const shiftSummary = (Array.isArray(results?.per_bus_summary)
    ? results.per_bus_summary
    : []
  ).find((summary) =>
    [summary?.shift_id, summary?.id]
      .map((value) => String(value ?? "").trim())
      .includes(normalizedShiftId)
  );
  const timelineSoc = Array.isArray(shiftSummary?.energy_timeline?.soc_kwh)
    ? shiftSummary.energy_timeline.soc_kwh.map((value) =>
        toOptionalFiniteNumber(value)
      )
    : [];
  const timelineCharge = Array.isArray(shiftSummary?.energy_timeline?.charge_kwh)
    ? shiftSummary.energy_timeline.charge_kwh.map((value) =>
        toOptionalFiniteNumber(value)
      )
    : [];
  const timelineChargeTotal =
    timelineCharge.length && timelineCharge.every((value) => value !== null)
      ? timelineCharge.reduce((sum, value) => sum + value, 0)
      : null;
  const chargedEnergyKwh = finite(
    timelineChargeTotal,
    shiftSummary?.total_charged_kwh,
  );
  const timelineNetDemandKwh =
    timelineSoc.length >= 2 &&
    timelineSoc[0] !== null &&
    timelineSoc[timelineSoc.length - 1] !== null &&
    chargedEnergyKwh !== null
      ? Math.max(
          0,
          timelineSoc[0] +
            chargedEnergyKwh -
            timelineSoc[timelineSoc.length - 1],
        )
      : null;

  let analysisTotalKwh = null;
  let predictionTotalKwh = null;
  let predictionPerKmKwh = null;
  if (basis === FEASIBILITY_DEMAND_BASIS.AGGREGATE_Q95) {
    // The prediction summary Q95 is the sum of the per-trip Q95 values. It is
    // not the aggregate Q95 profile used by the optimizer and therefore must
    // never be presented as the decision-basis shift demand. The aggregate
    // value is published only after the fixed design has been verified.
    analysisTotalKwh = aggregateAnalysisAvailable
      ? finite(
          analysisStatistics.q95_total_kwh,
          analysisCases.aggregate_q95?.total_consumption_kwh,
        )
      : timelineNetDemandKwh;
  } else if (basis === FEASIBILITY_DEMAND_BASIS.Q50) {
    predictionTotalKwh = selectedPrediction?.totalConsumptionMedianKwh ?? null;
    predictionPerKmKwh = selectedPrediction?.consumptionPerKmMedianKwh ?? null;
  } else {
    analysisTotalKwh = aggregateAnalysisAvailable
      ? finite(
          analysisStatistics.mean_total_kwh,
          analysisCases.mean?.total_consumption_kwh,
        )
      : timelineNetDemandKwh;
    predictionTotalKwh = selectedPrediction?.totalConsumptionMeanKwh ?? null;
    predictionPerKmKwh = selectedPrediction?.consumptionPerKmMeanKwh ?? null;
  }

  const totalKwh = finite(analysisTotalKwh, predictionTotalKwh);
  const distanceKm = toOptionalFiniteNumber(selectedPrediction?.totalDistanceKm);
  const perKmKwh = analysisTotalKwh !== null && distanceKm !== null && distanceKm > 0
    ? analysisTotalKwh / distanceKm
    : finite(
        predictionPerKmKwh,
        totalKwh !== null && distanceKm !== null && distanceKm > 0
          ? totalKwh / distanceKm
          : null,
      );

  return { totalKwh, perKmKwh, basis,
    source: totalKwh === null ? "unavailable" : analysisTotalKwh !== null
      ? aggregateAnalysisAvailable ? "aggregate_profile" : "solver_trajectory" : "reference_forecast",
    referencePacks: selectedPrediction?.numBatteryPacks ?? null,
  };
};

import {
  parseYearlyDistanceKm,
  resolveYearlyDistanceKm,
} from "./yearly-analysis-distance.js";

export const buildLifecyclePhaseBar = (label, phases, backendResult = null, divisor = 1) => {
  const phaseTotal = phases.reduce((sum, phase) => sum + phase.value, 0);
  const backendTotal = backendResult?.total == null ? null : Number(backendResult.total);
  return {
    label,
    phases,
    total:
      Number.isFinite(backendTotal) && Number.isFinite(divisor) && divisor > 0
        ? backendTotal / divisor
        : phaseTotal,
  };
};

export const LIFECYCLE_PHASE_KEYS = [
  "direct",
  "directNonExhaust",
  "energyChain",
  "maintenance",
  "vehicle",
  "endOfLife",
  "infrastructure",
];

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const scaleNumericFields = (source, keys, scale) => {
  if (!source || typeof source !== "object") return source;
  const scaled = { ...source };
  for (const key of keys) {
    const value = toFiniteNumber(source[key]);
    if (value != null) scaled[key] = value * scale;
  }
  return scaled;
};

const scaleEmissionIndicatorYearly = (indicator, scale) =>
  scaleNumericFields(indicator, [...LIFECYCLE_PHASE_KEYS, "total"], scale);

const scaleEmissionIndicatorMap = (indicators, scale) => {
  if (!indicators || typeof indicators !== "object") return indicators;
  return Object.entries(indicators).reduce((acc, [key, indicator]) => {
    acc[key] = scaleEmissionIndicatorYearly(indicator, scale);
    return acc;
  }, {});
};

const scaleStructuredIndicatorEntry = (indicator, scale) =>
  scaleNumericFields(
    indicator,
    [
      "ebus_total",
      "diesel_comparator",
      "delta_vs_diesel",
      "ebus_display",
      "diesel_display",
      "saved_display",
      "saved",
      "electric_side",
      "diesel_heating",
      "total",
    ],
    scale,
  );

const scaleLifecyclePhases = (phases, scale) =>
  scaleNumericFields(phases, LIFECYCLE_PHASE_KEYS, scale);

const scaleLifecycleActor = (actor, scale) => {
  if (!actor || typeof actor !== "object") return actor;
  const scaled = scaleNumericFields(
    actor,
    [
      "electric_side",
      "electricSide",
      "diesel_heating",
      "dieselHeating",
      "phase_sum",
      "phaseSum",
      "total",
    ],
    scale,
  );
  if (actor.phases) scaled.phases = scaleLifecyclePhases(actor.phases, scale);
  return scaled;
};

const scaleStructuredLifecycleBreakdown = (breakdown, scale) => {
  if (!breakdown || typeof breakdown !== "object") return breakdown;
  return {
    ...breakdown,
    ebus: scaleLifecycleActor(breakdown.ebus, scale),
    diesel_comparator: scaleLifecycleActor(breakdown.diesel_comparator, scale),
  };
};

const scalePrimaryEnergyBucket = (bucket, scale) =>
  scaleNumericFields(bucket, ["renewable", "non_renewable", "total"], scale);

const scaleStructuredPrimaryEnergyBreakdown = (breakdown, scale) => {
  if (!breakdown || typeof breakdown !== "object") return breakdown;
  return {
    ...breakdown,
    ebus: scalePrimaryEnergyBucket(breakdown.ebus, scale),
    diesel_comparator: scalePrimaryEnergyBucket(
      breakdown.diesel_comparator,
      scale,
    ),
  };
};

const scaleStructuredMixedCaseDecomposition = (mixedCase, scale) => {
  if (!mixedCase || typeof mixedCase !== "object") return mixedCase;
  const scaled = scaleNumericFields(
    mixedCase,
    [
      "yearly_electric_kwh",
      "yearly_diesel_heating_liters",
      "yearly_diesel_heating_fuel_kwh",
    ],
    scale,
  );
  if (mixedCase.indicators && typeof mixedCase.indicators === "object") {
    scaled.indicators = Object.entries(mixedCase.indicators).reduce(
      (acc, [key, indicator]) => {
        acc[key] = scaleStructuredIndicatorEntry(indicator, scale);
        return acc;
      },
      {},
    );
  }
  return scaled;
};

const scaleEmissionsAssumptions = (assumptions, scale, selectedDistanceKm) => {
  if (!assumptions || typeof assumptions !== "object") return assumptions;
  const scaled = scaleNumericFields(
    assumptions,
    [
      "yearlyElectricKwh",
      "yearly_electric_kwh",
      "yearlyDieselHeatingLiters",
      "yearly_diesel_heating_liters",
      "yearlyDieselHeatingFuelKwh",
      "yearly_diesel_heating_fuel_kwh",
    ],
    scale,
  );
  if (selectedDistanceKm != null) {
    scaled.yearlyDistanceKm = selectedDistanceKm;
    scaled.yearly_distance_km = selectedDistanceKm;
  }
  return scaled;
};

const scaleEmissionsMetadata = (metadata, scale, selectedDistanceKm) => {
  if (!metadata || typeof metadata !== "object") return metadata;
  const scaled = scaleNumericFields(
    metadata,
    ["yearlyDhLiters", "yearlyDhFuelKwh", "yearlyElectricKwh"],
    scale,
  );
  if (selectedDistanceKm != null) scaled.yearlyDistanceKm = selectedDistanceKm;
  return scaled;
};

const scaleStructuredEmissions = (structured, scale, selectedDistanceKm) => {
  if (!structured || typeof structured !== "object") return structured;
  const scaled = { ...structured };
  if (Array.isArray(structured.indicators)) {
    scaled.indicators = structured.indicators.map((indicator) =>
      scaleStructuredIndicatorEntry(indicator, scale)
    );
  }
  if (structured.savings?.items) {
    scaled.savings = {
      ...structured.savings,
      items: structured.savings.items.map((item) =>
        scaleStructuredIndicatorEntry(item, scale)
      ),
    };
  }
  if (structured.lifecycleBreakdown) {
    scaled.lifecycleBreakdown = scaleStructuredLifecycleBreakdown(
      structured.lifecycleBreakdown,
      scale,
    );
  }
  if (structured.primaryEnergyBreakdown) {
    scaled.primaryEnergyBreakdown = scaleStructuredPrimaryEnergyBreakdown(
      structured.primaryEnergyBreakdown,
      scale,
    );
  }
  if (structured.mixedCaseDecomposition) {
    scaled.mixedCaseDecomposition = scaleStructuredMixedCaseDecomposition(
      structured.mixedCaseDecomposition,
      scale,
    );
  }
  if (structured.assumptions) {
    scaled.assumptions = scaleEmissionsAssumptions(
      structured.assumptions,
      scale,
      selectedDistanceKm,
    );
  }
  return scaled;
};

export const deriveScaledEmissionsState = (
  emissionsState,
  baseDistanceKm,
  selectedDistanceKm,
) => {
  if (
    !emissionsState ||
    emissionsState.status !== "done" ||
    !emissionsState.electricYearly
  ) {
    return emissionsState;
  }

  const baseKm = resolveYearlyDistanceKm(
    null,
    baseDistanceKm,
    emissionsState.baseYearlyDistanceKm,
    emissionsState.yearlyDistanceKm,
    emissionsState.yearlyImpact?.yearly_distance_km,
  );
  const selectedKm = resolveYearlyDistanceKm(selectedDistanceKm, baseKm);
  if (baseKm == null || selectedKm == null) return emissionsState;

  const scale = selectedKm / baseKm;
  return {
    ...emissionsState,
    baseYearlyDistanceKm: baseKm,
    distanceScaleFactor: scale,
    distanceOverrideApplied: Math.abs(scale - 1) > Number.EPSILON,
    electricYearly: scaleEmissionIndicatorMap(
      emissionsState.electricYearly,
      scale,
    ),
    electricOnlyYearly: scaleEmissionIndicatorMap(
      emissionsState.electricOnlyYearly,
      scale,
    ),
    dieselHeatingYearly: scaleEmissionIndicatorMap(
      emissionsState.dieselHeatingYearly,
      scale,
    ),
    dieselYearly: scaleEmissionIndicatorMap(
      emissionsState.dieselYearly,
      scale,
    ),
    yearlyImpact: emissionsState.yearlyImpact
      ? { ...emissionsState.yearlyImpact, yearly_distance_km: selectedKm }
      : { yearly_distance_km: selectedKm },
    yearlyDistanceKm: selectedKm,
    emissionsMetadata: scaleEmissionsMetadata(
      emissionsState.emissionsMetadata,
      scale,
      selectedKm,
    ),
    structured: scaleStructuredEmissions(
      emissionsState.structured,
      scale,
      selectedKm,
    ),
  };
};

const EXPORT_INDICATORS = [
  { key: "gwp100a", unit: "t/year", divisor: 1_000_000, decimals: 3 },
  { key: "nox", unit: "kg/year", divisor: 1_000_000, decimals: 3 },
  { key: "pm10", unit: "kg/year", divisor: 1_000_000, decimals: 4 },
  { key: "primaryEnergy", unit: "GJ/year", divisor: 1_000, decimals: 3 },
  {
    key: "primaryEnergyNonRenewable",
    unit: "GJ/year",
    divisor: 1_000,
    decimals: 3,
  },
];

const round = (value, decimals = 4) => {
  const numericValue = toFiniteNumber(value);
  return numericValue == null ? null : Number(numericValue.toFixed(decimals));
};

const buildExportPhases = (indicator, divisor, decimals) => {
  if (!indicator || typeof indicator !== "object") return null;
  const phases = {};
  for (const phaseKey of LIFECYCLE_PHASE_KEYS) {
    const value = toFiniteNumber(indicator[phaseKey]);
    if (value != null) phases[phaseKey] = round(value / divisor, decimals);
  }
  return Object.keys(phases).length ? phases : null;
};

const buildExportActor = (indicator, divisor, decimals) => {
  const total = toFiniteNumber(indicator?.total);
  if (total == null) return null;
  return {
    total: round(total / divisor, decimals),
    phases: buildExportPhases(indicator, divisor, decimals),
  };
};

const buildPrimaryEnergyExport = (breakdown) => {
  if (!breakdown?.ebus) return null;
  const rawUnit = String(breakdown.unit ?? "MJ/year").toLowerCase();
  const divisor = rawUnit.startsWith("mj") ? 1_000 : 1;
  const convert = (value) => {
    const numericValue = toFiniteNumber(value);
    return numericValue == null ? null : round(numericValue / divisor, 3);
  };
  const buildBucket = (bucket) => {
    if (!bucket) return null;
    return {
      renewable: convert(bucket.renewable),
      nonRenewable: convert(bucket.non_renewable),
      total: convert(bucket.total),
    };
  };
  return {
    unit: "GJ/year",
    ebus: buildBucket(breakdown.ebus),
    dieselComparator: buildBucket(breakdown.diesel_comparator),
  };
};

export const buildYearlyEmissionsExport = (
  emissionsState,
  { auxiliaryHeatingType = null } = {},
) => {
  if (emissionsState?.status !== "done" || !emissionsState.electricYearly) {
    return null;
  }

  const selectedDistanceKm = parseYearlyDistanceKm(
    emissionsState.yearlyDistanceKm,
  );
  const baseDistanceKm = resolveYearlyDistanceKm(
    null,
    emissionsState.baseYearlyDistanceKm,
    selectedDistanceKm,
  );
  const distanceScaleFactor =
    baseDistanceKm != null && selectedDistanceKm != null
      ? selectedDistanceKm / baseDistanceKm
      : null;

  const indicators = {};
  for (const definition of EXPORT_INDICATORS) {
    const ebusIndicator = emissionsState.electricYearly[definition.key];
    if (toFiniteNumber(ebusIndicator?.total) == null) continue;

    const entry = {
      unit: definition.unit,
      ebus: buildExportActor(
        ebusIndicator,
        definition.divisor,
        definition.decimals,
      ),
      dieselComparator: buildExportActor(
        emissionsState.dieselYearly?.[definition.key],
        definition.divisor,
        definition.decimals,
      ),
    };

    if (emissionsState.isDieselHeating) {
      entry.ebus.components = {
        electricSide: buildExportActor(
          emissionsState.electricOnlyYearly?.[definition.key],
          definition.divisor,
          definition.decimals,
        ),
        dieselHeating: buildExportActor(
          emissionsState.dieselHeatingYearly?.[definition.key],
          definition.divisor,
          definition.decimals,
        ),
      };
    }

    const ebusTotal = toFiniteNumber(ebusIndicator.total);
    const dieselTotal = toFiniteNumber(
      emissionsState.dieselYearly?.[definition.key]?.total,
    );
    entry.reductionPct =
      dieselTotal != null && dieselTotal !== 0
        ? round(((dieselTotal - ebusTotal) / Math.abs(dieselTotal)) * 100, 2)
        : null;
    indicators[definition.key] = entry;
  }

  return {
    schemaVersion: 2,
    yearlyDistance_km: round(selectedDistanceKm, 3),
    distance: {
      sourceYearlyDistance_km: round(baseDistanceKm, 3),
      selectedYearlyDistance_km: round(selectedDistanceKm, 3),
      scaleFactor: round(distanceScaleFactor, 6),
      overrideApplied:
        distanceScaleFactor != null &&
        Math.abs(distanceScaleFactor - 1) > Number.EPSILON,
    },
    auxiliaryHeatingType,
    indicators,
    primaryEnergyBreakdown: buildPrimaryEnergyExport(
      emissionsState.structured?.primaryEnergyBreakdown,
    ),
    dataCompleteness:
      emissionsState.structured?.dataCompleteness ??
      emissionsState.emissionsMetadata?.dataCompleteness ??
      null,
    scopeCompleteness:
      emissionsState.structured?.scopeCompleteness ??
      emissionsState.emissionsMetadata?.scopeCompleteness ??
      null,
    dieselHeatingMethodology:
      emissionsState.structured?.dieselHeatingMethodology ??
      emissionsState.emissionsMetadata?.dieselHeatingMethodology ??
      null,
  };
};

const OBJECT_TAG = "[object Object]";

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === OBJECT_TAG;

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

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

const camelKey = (key) =>
  text(key).replace(/[_-]+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());

const camelize = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => camelize(entry));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, entry]) => {
    acc[camelKey(key)] = camelize(entry);
    return acc;
  }, {});
};

const readPath = (value, path) => {
  const keys = Array.isArray(path) ? path : text(path).split(".");
  return keys.reduce(
    (acc, key) => (acc === null || acc === undefined ? undefined : acc[key]),
    value
  );
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined);

const firstFinite = (...values) => {
  for (const value of values) {
    const numeric = toFiniteNumber(value);
    if (numeric != null) return numeric;
  }
  return null;
};

const sumFinite = (...values) => {
  let hasValue = false;
  let total = 0;

  values.forEach((value) => {
    const numeric = toFiniteNumber(value);
    if (numeric == null) return;
    hasValue = true;
    total += numeric;
  });

  return hasValue ? total : null;
};

const hasAnyFiniteValue = (value) => {
  if (toFiniteNumber(value) != null) return true;
  if (Array.isArray(value)) return value.some((entry) => hasAnyFiniteValue(entry));
  if (!isPlainObject(value)) return false;
  return Object.values(value).some((entry) => hasAnyFiniteValue(entry));
};

const toScenarioArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isPlainObject(value)) {
    return [];
  }

  return Object.entries(value).map(([key, entry]) =>
    isPlainObject(entry)
      ? { scenarioKey: key, ...entry }
      : { scenarioKey: key, value: entry }
  );
};

const adaptScenarioDescriptor = (rawScenario = {}, index = 0) => {
  const scenario = camelize(rawScenario);
  const id = firstDefined(
    scenario.id,
    scenario.scenarioId,
    scenario.scenarioKey,
    scenario.label,
    scenario.name,
    String(index + 1)
  );
  const label = firstDefined(
    scenario.label,
    scenario.name,
    scenario.scenarioName,
    scenario.scenarioKey,
    `Scenario ${index + 1}`
  );

  return {
    id: id == null ? null : String(id),
    label: text(label).trim() || `Scenario ${index + 1}`,
    temperature: firstFinite(
      scenario.temperature,
      scenario.temperatureCelsius,
      scenario.externalTempCelsius,
      scenario.centroidTemperature
    ),
    occurrences: firstFinite(
      scenario.occurrences,
      scenario.days,
      scenario.count,
      scenario.nDays
    ),
  };
};

const withRaw = (viewModel, rawValue) => ({
  ...viewModel,
  raw: rawValue ?? null,
});

const adaptCostBreakdown = (rawBreakdown = {}, { mode = "generic" } = {}) => {
  const breakdown = camelize(rawBreakdown);
  const total = firstFinite(
    breakdown.total,
    breakdown.totalOpex,
    breakdown.totalAnnual,
    breakdown.annualTotal,
    breakdown.value,
    mode === "ebusElectric"
      ? sumFinite(breakdown.energyOpex, breakdown.maintOpex)
      : undefined,
    mode === "ebusDieselHeating"
      ? sumFinite(breakdown.fuelOpex, breakdown.maintOpex)
      : undefined,
    mode === "dieselComparator"
      ? sumFinite(breakdown.fuelOpex, breakdown.maintOpex)
      : undefined
  );

  return {
    ...breakdown,
    energy: firstFinite(
      breakdown.energy,
      breakdown.energyOpex,
      breakdown.energyCost,
      breakdown.electricityCost,
      breakdown.gridEnergyCost
    ),
    fuel: firstFinite(
      breakdown.fuel,
      breakdown.fuelOpex,
      breakdown.fuelCost,
      breakdown.dieselFuelCost
    ),
    maintenance: firstFinite(
      breakdown.maintenance,
      breakdown.maintOpex,
      breakdown.maintenanceOpex,
      breakdown.maintenanceCost
    ),
    total,
  };
};

const adaptEbusCostActor = (rawActor = {}) => {
  const actor = camelize(rawActor);
  const electric = adaptCostBreakdown(
    firstDefined(
      actor.opex?.electric,
      actor.electric,
      {
        energyOpex: actor.energyOpex,
        maintOpex: actor.maintOpex,
        totalOpex: actor.totalOpex,
      }
    ) ?? {},
    { mode: "ebusElectric" }
  );
  const dieselHeating = adaptCostBreakdown(
    firstDefined(
      actor.opex?.dieselHeating,
      actor.dieselHeating,
      actor.heating,
      {
        fuelOpex: actor.dieselHeatingFuelOpex,
        maintOpex: actor.dieselHeatingMaintOpex,
      }
    ) ?? {},
    { mode: "ebusDieselHeating" }
  );
  const opex = camelize(firstDefined(actor.opex, actor.annualOpex, {}) ?? {});

  return {
    ...actor,
    opex: {
      ...opex,
      electric,
      dieselHeating,
      total: firstFinite(
        opex.total,
        actor.totalOpex,
        sumFinite(electric.total, dieselHeating.total)
      ),
    },
    capex: firstFinite(actor.capex, actor.capexChf),
    capexAnnual: firstFinite(
      actor.capexAnnual,
      actor.annualizedCapex,
      actor.capexAnnualized
    ),
    totalAnnual: firstFinite(
      actor.totalAnnual,
      actor.annualTotal,
      actor.totalAnnualCost,
      actor.total
    ),
  };
};

const adaptDieselComparatorCostActor = (rawActor = {}) => {
  const actor = camelize(rawActor);
  const opex = adaptCostBreakdown(
    firstDefined(actor.opex, actor.annualOpex, actor) ?? {},
    { mode: "dieselComparator" }
  );

  return {
    ...actor,
    opex,
    capex: firstFinite(actor.capex, actor.capexChf),
    capexAnnual: firstFinite(
      actor.capexAnnual,
      actor.annualizedCapex,
      actor.capexAnnualized
    ),
    totalAnnual: firstFinite(
      actor.totalAnnual,
      actor.annualTotal,
      actor.totalAnnualCost,
      actor.total
    ),
  };
};

const EMISSION_VALUE_KEYS = [
  "total",
  "electric",
  "dieselHeating",
  "production",
  "maintenance",
  "use",
  "operation",
  "endOfLife",
  "infrastructure",
];

const RESERVED_EMISSION_KEYS = new Set([
  "id",
  "name",
  "label",
  "scenarioId",
  "scenarioKey",
  "scenarioName",
  "temperature",
  "temperatureCelsius",
  "externalTempCelsius",
  "centroidTemperature",
  "occurrences",
  "days",
  "count",
  "nDays",
  "distanceKm",
  "yearlyDistanceKm",
  "annualDistanceKm",
  "assumptions",
  "scenarios",
  "ebus",
  "ebusEmissions",
  "dieselComparator",
  "diesel",
  "comparator",
  "annualSaving",
  "annualReduction",
  "reduction",
]);

const looksLikeIndicator = (value) => {
  if (toFiniteNumber(value) != null) return true;
  if (!isPlainObject(value)) return false;

  return EMISSION_VALUE_KEYS.some((key) => key in value) || hasAnyFiniteValue(value);
};

const adaptEmissionChannel = (rawChannel = {}) => {
  const channel = camelize(rawChannel);

  return {
    ...channel,
    total: firstFinite(channel.total, channel.value),
  };
};

const adaptEmissionIndicator = (rawIndicator = {}, { includeHeatingSplit = false } = {}) => {
  if (toFiniteNumber(rawIndicator) != null) {
    return { total: toFiniteNumber(rawIndicator) };
  }

  const indicator = camelize(rawIndicator);
  const electric = adaptEmissionChannel(
    firstDefined(indicator.electric, indicator.ebusElectric, {}) ?? {}
  );
  const dieselHeating = adaptEmissionChannel(
    firstDefined(indicator.dieselHeating, indicator.heating, {}) ?? {}
  );

  if (includeHeatingSplit || "electric" in indicator || "dieselHeating" in indicator) {
    return {
      ...indicator,
      electric,
      dieselHeating,
      total: firstFinite(
        indicator.total,
        indicator.value,
        sumFinite(electric.total, dieselHeating.total)
      ),
    };
  }

  return {
    ...indicator,
    total: firstFinite(indicator.total, indicator.value),
  };
};

const extractIndicatorContainer = (actor = {}) =>
  firstDefined(
    actor.indicators,
    actor.metrics,
    actor.impacts,
    actor.emissions,
    actor.yearlyImpact
  );

const adaptEmissionIndicators = (rawIndicators = {}, options = {}) => {
  const indicators = camelize(rawIndicators);

  return Object.entries(indicators).reduce((acc, [key, value]) => {
    if (RESERVED_EMISSION_KEYS.has(key)) return acc;
    if (!looksLikeIndicator(value)) return acc;
    acc[key] = adaptEmissionIndicator(value, options);
    return acc;
  }, {});
};

const adaptEmissionActor = (rawActor = {}, { includeHeatingSplit = false } = {}) => {
  const actor = camelize(rawActor);
  const container = extractIndicatorContainer(actor) ?? actor;

  return {
    ...actor,
    indicators: adaptEmissionIndicators(container, { includeHeatingSplit }),
  };
};

export const adaptYearlyAnalysisMeta = (rawYearlyAnalysis = {}) => {
  const analysis = camelize(rawYearlyAnalysis);
  const features = isPlainObject(analysis.features) ? analysis.features : {};
  const featureScenarios = firstDefined(
    features.scenarios,
    readPath(features, "config.scenarios"),
    readPath(features, "results.scenarioResults")
  );

  return withRaw(
    {
      id: firstDefined(analysis.id, null),
      name: text(firstDefined(analysis.name, analysis.title, "")).trim(),
      optimizationRunId: firstDefined(
        analysis.optimizationRunId,
        analysis.optimizationRun?.id,
        readPath(features, "results.baseOptimizationRunId"),
        null
      ),
      createdAt: firstDefined(analysis.createdAt, analysis.updatedAt, null),
      features,
      scenarioDefinitions: toScenarioArray(featureScenarios).map((scenario, index) =>
        adaptScenarioDescriptor(scenario, index)
      ),
    },
    rawYearlyAnalysis
  );
};

export const adaptYearlyAnalysisEnergySummary = (rawEnergySummary = {}) => {
  const summary = camelize(rawEnergySummary);
  const yearlyTotalsSource =
    firstDefined(summary.yearlyTotals, summary.totals, summary.summary) ?? {};
  const scenariosSource = firstDefined(
    summary.scenarios,
    summary.scenarioResults,
    summary.scenarioSummaries
  );

  const yearlyTotals = {
    totalEnergyKwh: firstFinite(
      yearlyTotalsSource.totalEnergyKwh,
      summary.totalEnergyKwh
    ),
    electricEnergyKwh: firstFinite(
      yearlyTotalsSource.electricEnergyKwh,
      yearlyTotalsSource.batteryElectricEnergyKwh,
      yearlyTotalsSource.totalElectricConsumptionKwh,
      summary.electricEnergyKwh,
      summary.batteryElectricEnergyKwh
    ),
    drivetrainEnergyKwh: firstFinite(
      yearlyTotalsSource.drivetrainEnergyKwh,
      summary.drivetrainEnergyKwh
    ),
    auxiliaryEnergyKwh: firstFinite(
      yearlyTotalsSource.auxiliaryEnergyKwh,
      summary.auxiliaryEnergyKwh
    ),
    dieselHeatingLiters: firstFinite(
      yearlyTotalsSource.dieselHeatingLiters,
      yearlyTotalsSource.totalDieselHeatingLiters,
      summary.dieselHeatingLiters
    ),
    distanceKm: firstFinite(
      yearlyTotalsSource.distanceKm,
      summary.distanceKm,
      summary.yearlyDistanceKm
    ),
  };

  const dieselHeatingTotals =
    yearlyTotals.dieselHeatingLiters != null
      ? {
          liters: yearlyTotals.dieselHeatingLiters,
        }
      : null;

  const scenarios = toScenarioArray(scenariosSource).map((rawScenario, index) => {
    const scenario = camelize(rawScenario);
    const base = adaptScenarioDescriptor(rawScenario, index);

    return withRaw(
      {
        ...base,
        electric: {
          energyKwh: firstFinite(
            scenario.electric?.energyKwh,
            scenario.electricEnergyKwh,
            scenario.batteryElectricEnergyKwh,
            scenario.totalElectricConsumptionKwh,
            scenario.annualEnergy,
            scenario.dailyEnergy
          ),
          drivetrainEnergyKwh: firstFinite(
            scenario.electric?.drivetrainEnergyKwh,
            scenario.drivetrainEnergyKwh,
            scenario.dailyDrivetrain
          ),
          auxiliaryEnergyKwh: firstFinite(
            scenario.electric?.auxiliaryEnergyKwh,
            scenario.auxiliaryEnergyKwh,
            scenario.dailyAuxiliary
          ),
        },
        dieselHeating: {
          liters: firstFinite(
            scenario.dieselHeating?.liters,
            scenario.dieselHeatingLiters,
            scenario.annualDieselHeatingLiters,
            scenario.dailyDieselHeatingLiters
          ),
        },
        totalEnergyKwh: firstFinite(
          scenario.totalEnergyKwh,
          scenario.annualEnergy,
          scenario.dailyEnergy
        ),
        distanceKm: firstFinite(
          scenario.distanceKm,
          scenario.annualDistance,
          scenario.dailyDistance
        ),
      },
      rawScenario
    );
  });

  return withRaw(
    {
      yearlyTotals,
      dieselHeatingTotals,
      auxiliaryHeatingType: firstDefined(
        summary.auxiliaryHeatingType,
        readPath(summary, "assumptions.auxiliaryHeatingType"),
        readPath(summary, "config.auxiliaryHeatingType"),
        null
      ),
      scenarios,
    },
    rawEnergySummary
  );
};

export const adaptYearlyAnalysisCosts = (rawCosts = {}) => {
  const costs = camelize(rawCosts);
  const scenariosSource = firstDefined(
    costs.scenarios,
    costs.scenarioCosts,
    costs.scenarioBreakdown
  );

  const scenarios = toScenarioArray(scenariosSource).map((rawScenario, index) => {
    const scenario = camelize(rawScenario);
    const base = adaptScenarioDescriptor(rawScenario, index);
    const ebusSource =
      firstDefined(scenario.ebus, scenario.electric) ??
      {
        energyOpex: scenario.annualEnergyCost,
        dieselHeatingFuelOpex: scenario.annualDieselHeatingFuelCost,
        totalOpex: sumFinite(
          scenario.annualEnergyCost,
          scenario.annualDieselHeatingFuelCost
        ),
      };

    return withRaw(
      {
        ...base,
        annualDistanceKm: firstFinite(
          scenario.annualDistanceKm,
          scenario.annualDistance,
          scenario.distanceKm
        ),
        ebus: adaptEbusCostActor(ebusSource),
        dieselComparator: scenario.dieselComparator
          ? adaptDieselComparatorCostActor(scenario.dieselComparator)
          : null,
      },
      rawScenario
    );
  });

  return withRaw(
    {
      ebus: adaptEbusCostActor(
        firstDefined(costs.ebus, costs.electric, costs.ebusCost) ?? {}
      ),
      dieselComparator: adaptDieselComparatorCostActor(
        firstDefined(costs.dieselComparator, costs.diesel, costs.comparator) ?? {}
      ),
      annualSaving:
        firstFinite(costs.annualSaving, costs.annualSavingChf) ??
        (costs.annualSaving ?? null),
      assumptions: camelize(firstDefined(costs.assumptions, {}) ?? {}),
      scenarios,
    },
    rawCosts
  );
};

export const adaptYearlyAnalysisEmissions = (rawEmissions = {}) => {
  const emissions = camelize(rawEmissions);
  const scenariosSource = firstDefined(
    emissions.scenarios,
    emissions.scenarioEmissions,
    emissions.scenarioBreakdown
  );

  const scenarios = toScenarioArray(scenariosSource).map((rawScenario, index) => {
    const scenario = camelize(rawScenario);
    const base = adaptScenarioDescriptor(rawScenario, index);

    return withRaw(
      {
        ...base,
        annualDistanceKm: firstFinite(
          scenario.annualDistanceKm,
          scenario.yearlyDistanceKm,
          scenario.distanceKm
        ),
        ebus: adaptEmissionActor(
          firstDefined(scenario.ebus, scenario.electric, scenario) ?? {},
          { includeHeatingSplit: true }
        ),
        dieselComparator: scenario.dieselComparator
          ? adaptEmissionActor(scenario.dieselComparator)
          : null,
      },
      rawScenario
    );
  });

  const annualSavingSource = firstDefined(
    emissions.annualSaving,
    emissions.reduction,
    emissions.annualReduction
  );

  return withRaw(
    {
      ebus: adaptEmissionActor(
        firstDefined(emissions.ebus, emissions.electric, emissions.ebusEmissions) ?? {},
        { includeHeatingSplit: true }
      ),
      dieselComparator: adaptEmissionActor(
        firstDefined(
          emissions.dieselComparator,
          emissions.diesel,
          emissions.comparator
        ) ?? {}
      ),
      annualSaving: isPlainObject(annualSavingSource)
        ? adaptEmissionIndicators(annualSavingSource, { includeHeatingSplit: true })
        : firstFinite(annualSavingSource) ?? (annualSavingSource ?? null),
      assumptions: camelize(firstDefined(emissions.assumptions, {}) ?? {}),
      scenarios,
    },
    rawEmissions
  );
};

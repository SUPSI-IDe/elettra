import assert from "node:assert/strict";
import test from "node:test";

import {
  YEARLY_ANALYSIS_SCHEMA_VERSION,
  aggregatePredictionKpis,
  backfillYearlyShiftResults,
  buildFixedYearlyConfiguration,
  buildYearlyAnalysisResults,
  buildYearlyScenarioOutcome,
  computeYearlyTotals,
  extractPredictionOnlyKpis,
  normalizeYearlyScenarios,
} from "../src/utils/yearly-analysis-model.js";

const battery = (shiftName, optimizedPacks, requiredPacks = optimizedPacks) => ({
  shift_name: shiftName,
  base_packs: 6,
  base_kwh: 300,
  optimized_packs: optimizedPacks,
  optimized_kwh: optimizedPacks * 50,
  required_total_packs: requiredPacks,
  max_physical_packs: 16,
  max_physical_kwh: 800,
  physical_feasible: true,
});

const feasibilityRun = (mode = "battery_only") => ({
  id: `run-${mode}`,
  input_params: {
    mode,
    bus_model_id: "bus-1",
    shift_ids: ["morning", "evening"],
    min_soc: 0.2,
    max_soc: 0.9,
    ...(mode === "charging_only" ? { fixed_battery_packs: 13 } : {}),
    charging_stations: [{
      stop_id: "depot",
      stop_name: "Depot",
      num_slots: 3,
      max_power_per_slot_kw: 150,
    }],
  },
  results: {
    electrification_feasible: true,
    battery_results: {
      morning: battery("Stored morning", mode === "charging_only" ? 8 : 8, 8),
      evening: battery("Stored evening", mode === "charging_only" ? 10 : 12, 10),
    },
    ...(mode === "battery_only" ? {} : {
      installed_chargers: {
        depot: { stop_name: "Depot", num_slots: 2, max_power_per_slot_kw: 150 },
      },
    }),
    per_bus_summary: [
      {
        shift_id: "morning",
        min_soc_kwh: 100,
        max_soc_kwh: 450,
        charging_sessions: [{
          start_minute: 60,
          end_minute: 90,
          duration_minutes: 30,
          station_stop_id: "depot",
          station_name: "Depot",
          energy_kwh: 75,
        }],
      },
      { shift_id: "evening", charging_sessions: [] },
    ],
  },
});

const prediction = ({
  id,
  shiftId,
  energy,
  distance,
  drivetrain = energy * 0.75,
  auxiliary = energy * 0.25,
  quantiles = null,
  perKmQuantiles = null,
  components = {},
} = {}) => ({
  id,
  ...(shiftId === undefined ? {} : { shift_id: shiftId }),
  prediction_stack: "vecto-g2",
  model_name: "vecto-release-1",
  auxiliary_estimator_release: "aux-release-1",
  summary: {
    total_consumption_kwh: energy,
    total_drivetrain_kwh: drivetrain,
    total_auxiliary_kwh: auxiliary,
    total_distance_km: distance,
    consumption_per_km_kwh: energy / distance,
    drivetrain_per_km_kwh: drivetrain / distance,
    auxiliary_per_km_kwh: auxiliary / distance,
    ...(quantiles ? { quantiles } : {}),
    ...(perKmQuantiles
      ? { consumption_per_km_kwh_quantiles: perKmQuantiles }
      : {}),
    ...components,
  },
});

test("freezes the common worst-case battery, SOC window, infrastructure and shift plans", () => {
  const run = feasibilityRun("battery_only");
  const before = structuredClone(run);
  const fixed = buildFixedYearlyConfiguration(run, {
    shiftNamesById: new Map([
      ["morning", "40501"],
      ["evening", "40502"],
    ]),
  });

  assert.equal(fixed.fixed, true);
  assert.equal(fixed.sourceOptimizationRunId, "run-battery_only");
  assert.equal(fixed.busModelId, "bus-1");
  assert.deepEqual(fixed.shiftIds, ["morning", "evening"]);
  assert.deepEqual(fixed.soc, { minFraction: 0.2, maxFraction: 0.9 });
  assert.equal(fixed.battery.decision, "optimized");
  assert.equal(fixed.battery.packs, 12);
  assert.equal(fixed.battery.nominalKwh, 600);
  assert.deepEqual(fixed.battery.sizingShiftIds, ["evening"]);
  assert.equal(fixed.infrastructure.scope, "shared");
  assert.equal(fixed.infrastructure.decision, "fixed");
  assert.equal(fixed.infrastructure.stations[0].slots, 3);
  assert.deepEqual(
    fixed.shifts.map(({ shiftId, shiftName }) => ({ shiftId, shiftName })),
    [
      { shiftId: "morning", shiftName: "40501" },
      { shiftId: "evening", shiftName: "40502" },
    ],
  );
  assert.equal(fixed.shifts[0].operation.chargingSessions[0].energyKwh, 75);
  assert.deepEqual(run, before);
});

test("keeps mode decisions frozen for battery-only, charging-only and joint feasibility", () => {
  const expected = {
    battery_only: { battery: "optimized", infrastructure: "fixed", packs: 12 },
    charging_only: { battery: "fixed", infrastructure: "optimized", packs: 13 },
    joint: { battery: "optimized", infrastructure: "optimized", packs: 12 },
  };

  for (const [mode, decision] of Object.entries(expected)) {
    const fixed = buildFixedYearlyConfiguration(feasibilityRun(mode));
    assert.equal(fixed.mode, mode);
    assert.equal(fixed.battery.decision, decision.battery);
    assert.equal(fixed.infrastructure.decision, decision.infrastructure);
    assert.equal(fixed.battery.packs, decision.packs);
  }
});

test("uses the selected bus model pack size when legacy feasibility results omit capacity", () => {
  const run = feasibilityRun("battery_only");
  for (const result of Object.values(run.results.battery_results)) {
    delete result.base_kwh;
    delete result.optimized_kwh;
    delete result.max_physical_kwh;
  }

  const fixed = buildFixedYearlyConfiguration(run, { packSizeKwh: 48 });

  assert.equal(fixed.battery.packs, 12);
  assert.equal(fixed.battery.packSizeKwh, 48);
  assert.equal(fixed.battery.nominalKwh, 576);
});

test("uses only requested physical shifts and preserves missing feasibility details explicitly", () => {
  const run = feasibilityRun();
  run.input_params.shift_ids = ["morning", "missing", "morning", " "];
  run.results.battery_results.extra = battery("Unexpected", 15);

  const fixed = buildFixedYearlyConfiguration(run);

  assert.deepEqual(fixed.shiftIds, ["morning", "missing"]);
  assert.equal(fixed.battery.packs, 8);
  assert.equal(fixed.shifts[1].shiftName, "missing");
  assert.equal(fixed.shifts[1].battery.optimizedPacks, null);
  assert.equal(fixed.shifts[1].battery.commonPacks, 8);
  assert.deepEqual(fixed.shifts[1].operation, {
    minSocKwh: null,
    maxSocKwh: null,
    totalChargedKwh: null,
    numChargingSessions: null,
    chargingSessions: [],
  });
});

test("gives duplicate cluster labels and identifiers independent stable identities", () => {
  const normalized = normalizeYearlyScenarios([
    { scenarioId: "cold", label: "Cold", temperature: -5, occurrences: 10 },
    { scenarioId: "cold", label: "Cold", temperature: 0, occurrences: 20 },
    { label: "Cold", temperature: 5, occurrences: 30 },
    { label: "Cold", temperature: 10, occurrences: 40 },
  ]);

  assert.deepEqual(
    normalized.map(({ scenarioId }) => scenarioId),
    ["cold", "cold-2", "cluster-3", "cluster-4"],
  );
  assert.deepEqual(normalized.map(({ label }) => label), ["Cold", "Cold", "Cold", "Cold"]);
});

test("extracts nullable prediction KPIs, provenance, quantiles and energy components", () => {
  const kpis = extractPredictionOnlyKpis(prediction({
    id: "p1",
    shiftId: "morning",
    energy: 120,
    distance: 60,
    quantiles: { q05: 100, q50: 120, q95: 140 },
    perKmQuantiles: { q05: 1.7, q50: 2, q95: 2.3 },
    components: {
      total_mechanical_greybox_kwh: 70,
      total_hvac_electrical_kwh: 20,
    },
  }));

  assert.equal(kpis.totalEnergyKwh, 120);
  assert.equal(kpis.energyPerKm, 2);
  assert.deepEqual(kpis.quantiles, { q05: 100, q50: 120, q95: 140 });
  assert.equal(kpis.predictionStack, "vecto-g2");
  assert.equal(kpis.modelRelease, "vecto-release-1");
  assert.deepEqual(kpis.energyComponents, {
    mechanicalGreyboxKwh: 70,
    hvacElectricalKwh: 20,
  });

  const malformed = extractPredictionOnlyKpis({ summary: {
    total_consumption_kwh: "",
    total_distance_km: true,
    quantiles: { q05: "bad", q50: 10 },
  } });
  assert.equal(malformed.totalEnergyKwh, null);
  assert.equal(malformed.distanceKm, null);
  assert.deepEqual(malformed.quantiles, { q05: null, q50: 10, q95: null });
});

test("maps out-of-order predictions by shift ID and never by array order", () => {
  const scenario = { scenarioId: "cold", label: "Cold", temperature: -5, occurrences: 10 };
  const outcome = buildYearlyScenarioOutcome({
    scenario,
    shiftIds: ["morning", "evening"],
    predictionRuns: [
      prediction({ id: "evening-run", shiftId: "evening", energy: 80, distance: 40 }),
      prediction({ id: "morning-run", shiftId: "morning", energy: 120, distance: 60 }),
    ],
  });

  assert.deepEqual(
    outcome.shiftResults.map(({ shiftId, predRunId }) => ({ shiftId, predRunId })),
    [
      { shiftId: "morning", predRunId: "morning-run" },
      { shiftId: "evening", predRunId: "evening-run" },
    ],
  );
  assert.equal(outcome.aggregateResult.kpis.totalEnergyKwh, 200);
  assert.equal(outcome.aggregateResult.kpis.distanceKm, 100);
  assert.equal(outcome.aggregateResult.kpis.energyPerKm, 2);
  assert.deepEqual(outcome.aggregateResult.predRunIds, ["morning-run", "evening-run"]);
  assert.equal(outcome.aggregateResult.predRunId, null);
  assert.equal(outcome.aggregateResult.error, null);
});

test("allows an identifier-less legacy run only for one unambiguous shift", () => {
  const scenario = { scenarioId: "normal", label: "Normal", temperature: 15, occurrences: 365 };
  const run = prediction({ id: "legacy", shiftId: undefined, energy: 100, distance: 50 });
  const single = buildYearlyScenarioOutcome({
    scenario,
    shiftIds: ["only"],
    predictionRuns: [run],
  });
  const multiple = buildYearlyScenarioOutcome({
    scenario,
    shiftIds: ["one", "two"],
    predictionRuns: [run],
  });

  assert.equal(single.shiftResults[0].predRunId, "legacy");
  assert.equal(single.aggregateResult.predRunId, "legacy");
  assert.equal(single.aggregateResult.error, null);
  assert.match(multiple.shiftResults[0].error, /No prediction result/);
  assert.match(multiple.shiftResults[1].error, /No prediction result/);
  assert.deepEqual(multiple.diagnostics.unattributedPredictionRunIds, ["legacy"]);
});

test("reports missing and duplicate expected runs while ignoring unexpected shifts", () => {
  const outcome = buildYearlyScenarioOutcome({
    scenario: { scenarioId: "hot", label: "Hot", temperature: 30, occurrences: 20 },
    shiftIds: ["morning", "evening", "night"],
    predictionRuns: [
      prediction({ id: "m1", shiftId: "morning", energy: 100, distance: 50 }),
      prediction({ id: "m2", shiftId: "morning", energy: 101, distance: 50 }),
      prediction({ id: "e1", shiftId: "evening", energy: 80, distance: 40 }),
      prediction({ id: "x1", shiftId: "other", energy: 60, distance: 30 }),
    ],
  });

  assert.match(outcome.shiftResults[0].error, /Multiple prediction results/);
  assert.equal(outcome.shiftResults[1].error, null);
  assert.match(outcome.shiftResults[2].error, /No prediction result/);
  assert.equal(outcome.aggregateResult.kpis, null);
  assert.match(outcome.aggregateResult.error, /morning/);
  assert.match(outcome.aggregateResult.error, /night/);
  assert.deepEqual(outcome.diagnostics.unexpectedPredictionRunIds, ["x1"]);
});

test("expands a cluster API failure to every expected shift", () => {
  const outcome = buildYearlyScenarioOutcome({
    scenario: { scenarioId: "cold", label: "Cold", temperature: -10, occurrences: 10 },
    shiftIds: ["morning", "evening"],
    failure: "Prediction service unavailable",
  });

  assert.deepEqual(
    outcome.shiftResults.map(({ error }) => error),
    ["Prediction service unavailable", "Prediction service unavailable"],
  );
  assert.equal(outcome.aggregateResult.kpis, null);
});

test("sums complete shift KPIs and derives general per-kilometre quantiles", () => {
  const first = extractPredictionOnlyKpis(prediction({
    id: "a",
    shiftId: "a",
    energy: 120,
    distance: 100,
    drivetrain: 90,
    auxiliary: 30,
    quantiles: { q05: 90, q50: 110, q95: 130 },
    components: { total_hvac_electrical_kwh: 20 },
  }));
  const second = extractPredictionOnlyKpis(prediction({
    id: "b",
    shiftId: "b",
    energy: 80,
    distance: 50,
    drivetrain: 60,
    auxiliary: 20,
    quantiles: { q05: 45, q50: 55, q95: 65 },
    components: { total_hvac_electrical_kwh: 10 },
  }));

  const aggregate = aggregatePredictionKpis([first, second]);

  assert.equal(aggregate.totalEnergyKwh, 200);
  assert.equal(aggregate.drivetrainEnergyKwh, 150);
  assert.equal(aggregate.auxiliaryEnergyKwh, 50);
  assert.equal(aggregate.distanceKm, 150);
  assert.equal(aggregate.energyPerKm, 200 / 150);
  assert.deepEqual(aggregate.quantiles, { q05: 135, q50: 165, q95: 195 });
  assert.deepEqual(aggregate.consumptionPerKmQuantiles, {
    q05: 0.9,
    q50: 1.1,
    q95: 1.3,
  });
  assert.deepEqual(aggregate.energyComponents, { hvacElectricalKwh: 30 });
  assert.equal(aggregate.predictionStack, "vecto-g2");
});

test("does not create partial aggregate values when a shift omits a KPI", () => {
  const complete = extractPredictionOnlyKpis(prediction({
    id: "a",
    shiftId: "a",
    energy: 100,
    distance: 50,
  }));
  const incomplete = extractPredictionOnlyKpis({
    id: "b",
    shift_id: "b",
    summary: { total_distance_km: 25 },
  });

  const aggregate = aggregatePredictionKpis([complete, incomplete]);

  assert.equal(aggregate.totalEnergyKwh, null);
  assert.equal(aggregate.distanceKm, 75);
  assert.equal(aggregate.energyPerKm, null);
});

test("weights per-kilometre quantiles by distance when absolute quantiles are absent", () => {
  const first = extractPredictionOnlyKpis(prediction({
    id: "a",
    shiftId: "a",
    energy: 100,
    distance: 100,
    perKmQuantiles: { q05: 0.8, q50: 1, q95: 1.2 },
  }));
  const second = extractPredictionOnlyKpis(prediction({
    id: "b",
    shiftId: "b",
    energy: 100,
    distance: 50,
    perKmQuantiles: { q05: 1.6, q50: 2, q95: 2.4 },
  }));

  assert.deepEqual(
    aggregatePredictionKpis([first, second]).consumptionPerKmQuantiles,
    { q05: 1.0666666666666667, q50: 4 / 3, q95: 1.6 },
  );
});

test("builds complete general and per-shift annual totals across every cluster", () => {
  const fixedConfiguration = buildFixedYearlyConfiguration(feasibilityRun());
  const scenarios = normalizeYearlyScenarios([
    { label: "Cold", temperature: -5, occurrences: 100 },
    { label: "Warm", temperature: 20, occurrences: 265 },
  ]);
  const outcomes = [
    buildYearlyScenarioOutcome({
      scenario: scenarios[0],
      shiftIds: fixedConfiguration.shiftIds,
      predictionRuns: [
        prediction({ id: "c-e", shiftId: "evening", energy: 80, distance: 40 }),
        prediction({ id: "c-m", shiftId: "morning", energy: 120, distance: 60 }),
      ],
    }),
    buildYearlyScenarioOutcome({
      scenario: scenarios[1],
      shiftIds: fixedConfiguration.shiftIds,
      predictionRuns: [
        prediction({ id: "w-m", shiftId: "morning", energy: 90, distance: 60 }),
        prediction({ id: "w-e", shiftId: "evening", energy: 60, distance: 40 }),
      ],
    }),
  ];

  const results = buildYearlyAnalysisResults({
    scenarios,
    outcomes,
    fixedConfiguration,
    nominalDailyDistanceKmByShiftId: { morning: 60, evening: 40 },
  });

  assert.equal(results.schemaVersion, YEARLY_ANALYSIS_SCHEMA_VERSION);
  assert.equal(results.status, "completed");
  assert.deepEqual(results.completion, {
    expectedPredictionCount: 4,
    completedPredictionCount: 4,
    failedPredictionCount: 0,
  });
  assert.equal(results.scenarioResults[0].kpis.totalEnergyKwh, 200);
  assert.equal(results.scenarioResults[1].kpis.totalEnergyKwh, 150);
  assert.equal(results.yearlyTotals.totalEnergyKwh, 200 * 100 + 150 * 265);
  assert.equal(results.yearlyTotals.distanceKm, 100 * 365);
  assert.equal(results.nominalDailyDistanceKm, 100);
  assert.equal(results.shiftResults[0].yearlyTotals.totalEnergyKwh, 120 * 100 + 90 * 265);
  assert.equal(results.shiftResults[1].yearlyTotals.totalEnergyKwh, 80 * 100 + 60 * 265);
  assert.equal(results.shiftResults[0].nominalDailyDistanceKm, 60);
  assert.equal(results.shiftResults[1].nominalDailyDistanceKm, 40);
});

test("keeps a complete shift usable but suppresses incomplete general and shift totals", () => {
  const fixedConfiguration = buildFixedYearlyConfiguration(feasibilityRun());
  const scenarios = normalizeYearlyScenarios([
    { label: "Cold", temperature: -5, occurrences: 100 },
    { label: "Warm", temperature: 20, occurrences: 265 },
  ]);
  const outcomes = [
    buildYearlyScenarioOutcome({
      scenario: scenarios[0],
      shiftIds: fixedConfiguration.shiftIds,
      predictionRuns: [
        prediction({ id: "c-m", shiftId: "morning", energy: 120, distance: 60 }),
        prediction({ id: "c-e", shiftId: "evening", energy: 80, distance: 40 }),
      ],
    }),
    buildYearlyScenarioOutcome({
      scenario: scenarios[1],
      shiftIds: fixedConfiguration.shiftIds,
      predictionRuns: [
        prediction({ id: "w-m", shiftId: "morning", energy: 90, distance: 60 }),
      ],
    }),
  ];

  const results = buildYearlyAnalysisResults({
    scenarios,
    outcomes,
    fixedConfiguration,
    nominalDailyDistanceKmByShiftId: { morning: 60 },
  });

  assert.equal(results.status, "partial");
  assert.deepEqual(results.completion, {
    expectedPredictionCount: 4,
    completedPredictionCount: 3,
    failedPredictionCount: 1,
  });
  assert.deepEqual(results.yearlyTotals, {
    totalEnergyKwh: null,
    drivetrainEnergyKwh: null,
    auxiliaryEnergyKwh: null,
    distanceKm: null,
  });
  assert.equal(results.shiftResults[0].status, "completed");
  assert.equal(results.shiftResults[0].yearlyTotals.totalEnergyKwh, 120 * 100 + 90 * 265);
  assert.equal(results.shiftResults[1].status, "partial");
  assert.equal(results.shiftResults[1].yearlyTotals.totalEnergyKwh, null);
  assert.equal(results.nominalDailyDistanceKm, null);
});

test("marks absent outcomes as failed instead of silently dropping scenarios", () => {
  const fixedConfiguration = buildFixedYearlyConfiguration(feasibilityRun());
  const scenarios = normalizeYearlyScenarios([
    { label: "Cold", temperature: -5, occurrences: 365 },
  ]);

  const results = buildYearlyAnalysisResults({ scenarios, fixedConfiguration });

  assert.equal(results.status, "failed");
  assert.deepEqual(results.completion, {
    expectedPredictionCount: 2,
    completedPredictionCount: 0,
    failedPredictionCount: 2,
  });
  assert.match(results.scenarioResults[0].error, /unavailable/);
  assert.equal(results.shiftResults[0].yearlyTotals.totalEnergyKwh, null);
});

test("retains legacy partial-total behavior only when strict completeness is not requested", () => {
  const rows = [
    {
      occurrences: 100,
      kpis: {
        totalEnergyKwh: 10,
        drivetrainEnergyKwh: 8,
        auxiliaryEnergyKwh: 2,
        distanceKm: 5,
      },
      error: null,
    },
    { occurrences: 265, kpis: null, error: "failed" },
  ];

  assert.equal(computeYearlyTotals(rows).totalEnergyKwh, 1000);
  assert.equal(
    computeYearlyTotals(rows, { requireComplete: true }).totalEnergyKwh,
    null,
  );
});

test("keeps stored schema-v2 shift results unchanged", () => {
  const stored = {
    config: { shift_ids: ["morning"] },
    results: { shiftResults: [{ shiftId: "morning" }] },
  };
  assert.equal(backfillYearlyShiftResults(stored, []), stored);
});

test("uses the exact saved aggregate for a historical single-shift analysis", () => {
  const historical = {
    status: "completed",
    config: { shift_ids: ["single"] },
    meta: { shiftNames: ["Single service"] },
    results: {
      yearlyTotals: { totalEnergyKwh: 36500, distanceKm: 18250 },
      scenarioResults: [{
        scenarioId: "cold",
        label: "Cold",
        temperature: -5,
        occurrences: 365,
        kpis: { totalEnergyKwh: 100, distanceKm: 50, energyPerKm: 2 },
      }],
    },
  };
  const before = structuredClone(historical);
  const hydrated = backfillYearlyShiftResults(historical, []);

  assert.deepEqual(historical, before);
  assert.equal(hydrated.results.shiftResults.length, 1);
  assert.equal(hydrated.results.shiftResults[0].shiftId, "single");
  assert.equal(hydrated.results.shiftResults[0].shiftName, "Single service");
  assert.equal(hydrated.results.shiftResults[0].status, "completed");
  assert.deepEqual(
    hydrated.results.shiftResults[0].yearlyTotals,
    historical.results.yearlyTotals,
  );
});

test("reconstructs historical multi-shift results by shift ID despite reversed run order", () => {
  const historical = {
    status: "completed",
    config: { shift_ids: ["morning", "evening"] },
    meta: { shiftNames: ["Morning", "Evening"] },
    scenarios: [
      { scenarioId: "cold", label: "Cold", temperature: -5, occurrences: 100 },
      { scenarioId: "warm", label: "Warm", temperature: 20, occurrences: 265 },
    ],
    results: {
      scenarioResults: [],
      yearlyTotals: { totalEnergyKwh: 59750, distanceKm: 36500 },
    },
  };
  const runs = [
    { ...prediction({ id: "cold-evening", shiftId: "evening", energy: 80, distance: 40 }), external_temp_celsius: -5, status: "completed" },
    { ...prediction({ id: "cold-morning", shiftId: "morning", energy: 120, distance: 60 }), external_temp_celsius: -5, status: "completed" },
    { ...prediction({ id: "warm-evening", shiftId: "evening", energy: 60, distance: 40 }), external_temp_celsius: 20.0004, status: "completed" },
    { ...prediction({ id: "warm-morning", shiftId: "morning", energy: 90, distance: 60 }), external_temp_celsius: 20, status: "completed" },
  ];

  const hydrated = backfillYearlyShiftResults(historical, runs);
  const [morning, evening] = hydrated.results.shiftResults;

  assert.deepEqual(historical.results.shiftResults, undefined);
  assert.equal(morning.shiftId, "morning");
  assert.equal(morning.status, "completed");
  assert.equal(morning.scenarioResults[0].predRunId, "cold-morning");
  assert.equal(morning.yearlyTotals.totalEnergyKwh, 120 * 100 + 90 * 265);
  assert.equal(evening.shiftId, "evening");
  assert.equal(evening.scenarioResults[0].predRunId, "cold-evening");
  assert.equal(evening.yearlyTotals.totalEnergyKwh, 80 * 100 + 60 * 265);
});

test("marks only the affected historical shift partial when one prediction is missing", () => {
  const historical = {
    config: { shift_ids: ["morning", "evening"] },
    meta: { shiftNames: ["Morning", "Evening"] },
    scenarios: [
      { scenarioId: "cold", temperature: -5, occurrences: 100 },
      { scenarioId: "warm", temperature: 20, occurrences: 265 },
    ],
    results: {},
  };
  const runs = [
    { ...prediction({ id: "cold-morning", shiftId: "morning", energy: 120, distance: 60 }), external_temp_celsius: -5 },
    { ...prediction({ id: "cold-evening", shiftId: "evening", energy: 80, distance: 40 }), external_temp_celsius: -5 },
    { ...prediction({ id: "warm-morning", shiftId: "morning", energy: 90, distance: 60 }), external_temp_celsius: 20 },
  ];

  const hydrated = backfillYearlyShiftResults(historical, runs);
  assert.equal(hydrated.results.shiftResults[0].status, "completed");
  assert.equal(hydrated.results.shiftResults[1].status, "partial");
  assert.equal(hydrated.results.shiftResults[1].yearlyTotals.totalEnergyKwh, null);
  assert.match(hydrated.results.shiftResults[1].scenarioResults[1].error, /No prediction result/);
});

test("treats failed historical prediction rows as unavailable data", () => {
  const historical = {
    config: { shift_ids: ["morning", "evening"] },
    scenarios: [{ scenarioId: "cold", temperature: -5, occurrences: 365 }],
    results: {},
  };
  const failed = {
    ...prediction({ id: "failed", shiftId: "morning", energy: 100, distance: 50 }),
    external_temp_celsius: -5,
    status: "failed",
  };
  const hydrated = backfillYearlyShiftResults(historical, [failed]);

  assert.equal(hydrated.results.shiftResults[0].status, "failed");
  assert.equal(hydrated.results.shiftResults[1].status, "failed");
  assert.match(hydrated.results.shiftResults[0].scenarioResults[0].error, /unavailable/);
});

test("strict yearly totals reject a missing KPI without discarding complete metrics", () => {
  const rows = [
    {
      occurrences: 100,
      kpis: {
        totalEnergyKwh: 10,
        drivetrainEnergyKwh: 8,
        auxiliaryEnergyKwh: 2,
        distanceKm: 5,
      },
      error: null,
    },
    {
      occurrences: 265,
      kpis: {
        totalEnergyKwh: null,
        drivetrainEnergyKwh: 6,
        auxiliaryEnergyKwh: 2,
        distanceKm: 5,
      },
      error: null,
    },
  ];

  const totals = computeYearlyTotals(rows, { requireComplete: true });
  assert.equal(totals.totalEnergyKwh, null);
  assert.equal(totals.drivetrainEnergyKwh, 8 * 100 + 6 * 265);
  assert.equal(totals.distanceKm, 5 * 365);
});

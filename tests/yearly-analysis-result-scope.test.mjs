import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { translations } from "../src/i18n/translations.js";
import { mapParameterizedLca } from "../src/pages/Simulation/YearlyAnalysis/parameterized-lca.js";
import {
  YEARLY_GENERAL_SCOPE_KEY,
  buildScopedYearlyFeatures,
  buildShiftParameterizedLca,
  buildYearlyResultScopes,
  getFixedYearlyShift,
  getYearlyScopeSectionVisibility,
  resolveYearlyResultScope,
  resolveYearlyScopeKeyboardTarget,
} from "../src/utils/yearly-analysis-result-scope.js";

const lcaFixture = JSON.parse(
  readFileSync(new URL("./fixtures/grid94-lca.json", import.meta.url), "utf8"),
).base;

const features = {
  config: {
    mode: "joint",
    shift_ids: ["morning", "evening"],
    fixedConfiguration: {
      battery: { packs: 12 },
      shifts: [
        { shiftId: "morning", shiftName: "Morning service" },
        { shiftId: "evening", shiftName: "Evening service" },
      ],
    },
  },
  meta: {
    shiftNames: ["Legacy morning", "Legacy evening"],
    shifts: [
      { shiftId: "morning", shiftName: "Metadata morning" },
      { shiftId: "evening", shiftName: "Metadata evening" },
    ],
  },
  results: {
    status: "partial",
    optimizedPacks: 99,
    yearlyTotals: { totalEnergyKwh: 3000, distanceKm: 1500 },
    scenarioResults: [{ scenarioId: "general-cold" }],
    shiftResults: [
      {
        shiftId: "morning",
        shiftName: "Morning result",
        status: "completed",
        nominalDailyDistanceKm: 50,
        yearlyTotals: { totalEnergyKwh: 2000, distanceKm: 1000 },
        scenarioResults: [{ scenarioId: "morning-cold" }],
      },
      {
        shiftId: "evening",
        status: "failed",
        nominalDailyDistanceKm: 25,
        yearlyTotals: { totalEnergyKwh: 1000, distanceKm: 500 },
        scenarioResults: [{ scenarioId: "evening-cold" }],
      },
    ],
  },
};

const sumObjects = (left, right) => Object.fromEntries(
  Object.keys(left).map((key) => [key, left[key] + right[key]]),
);

const scaledVehicle = (vehicle, shiftId, factor) => {
  const copy = structuredClone(vehicle);
  copy.shift_id = shiftId;
  copy.annual_km *= factor;
  copy.dc_kwh *= factor;
  copy.diesel_heating_liters *= factor;
  for (const indicator of Object.values(copy.indicators)) {
    for (const field of [
      "electricity_operation",
      "diesel_heating",
      "other_lifecycle",
      "total",
      "diesel_comparator_total",
    ]) indicator[field] *= factor;
    indicator.phases = Object.fromEntries(
      Object.entries(indicator.phases).map(([key, value]) => [key, value * factor]),
    );
    indicator.diesel_comparator_phases = Object.fromEntries(
      Object.entries(indicator.diesel_comparator_phases).map(([key, value]) => [key, value * factor]),
    );
    indicator.diesel_heating_phases = Object.fromEntries(
      Object.entries(indicator.diesel_heating_phases).map(([key, value]) => [key, value * factor]),
    );
  }
  return copy;
};

const multiShiftLca = () => {
  const morning = scaledVehicle(lcaFixture.vehicles[0], "morning", 1);
  const evening = scaledVehicle(lcaFixture.vehicles[0], "evening", 0.5);
  const indicators = {};
  for (const key of Object.keys(lcaFixture.indicators)) {
    const first = morning.indicators[key];
    const second = evening.indicators[key];
    indicators[key] = {
      ...first,
      electricity_operation: first.electricity_operation + second.electricity_operation,
      diesel_heating: first.diesel_heating + second.diesel_heating,
      other_lifecycle: first.other_lifecycle + second.other_lifecycle,
      total: first.total + second.total,
      diesel_comparator_total: first.diesel_comparator_total + second.diesel_comparator_total,
      phases: sumObjects(first.phases, second.phases),
      diesel_comparator_phases: sumObjects(first.diesel_comparator_phases, second.diesel_comparator_phases),
      diesel_heating_phases: sumObjects(first.diesel_heating_phases, second.diesel_heating_phases),
    };
  }
  return {
    ...structuredClone(lcaFixture),
    annual_km: morning.annual_km + evening.annual_km,
    vehicle_count: 2,
    vehicles: [morning, evening],
    energy_boundary: {
      ...lcaFixture.energy_boundary,
      dc_kwh: morning.dc_kwh + evening.dc_kwh,
      grid_kwh: (morning.dc_kwh + evening.dc_kwh) / 0.94,
      charging_losses_kwh: (morning.dc_kwh + evening.dc_kwh) / 0.94 - (morning.dc_kwh + evening.dc_kwh),
    },
    indicators,
  };
};

test("buildYearlyResultScopes exposes General followed by stable per-shift tabs", () => {
  const scopes = buildYearlyResultScopes(features, {
    generalLabel: "Generale",
    shiftFallback: "Turno",
  });
  assert.deepEqual(scopes.map(({ key, kind, label, status }) => ({ key, kind, label, status })), [
    { key: "general", kind: "general", label: "Generale", status: "partial" },
    { key: "shift:morning", kind: "shift", label: "Morning result", status: "completed" },
    { key: "shift:evening", kind: "shift", label: "Evening service", status: "failed" },
  ]);
});

test("buildYearlyResultScopes keeps historical analyses on General only", () => {
  const scopes = buildYearlyResultScopes({ results: { yearlyTotals: {} } });
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].key, YEARLY_GENERAL_SCOPE_KEY);
});

test("buildYearlyResultScopes discovers legacy shifts from configuration and metadata", () => {
  const legacy = {
    status: "completed",
    config: { shift_ids: ["morning", "evening", "morning", " "] },
    meta: { shiftNames: ["Morning service", "Evening service"] },
    results: { yearlyTotals: {} },
  };
  assert.deepEqual(
    buildYearlyResultScopes(legacy).map(({ key, label, status }) => ({ key, label, status })),
    [
      { key: "general", label: "General", status: "completed" },
      { key: "shift:morning", label: "Morning service", status: null },
      { key: "shift:evening", label: "Evening service", status: null },
    ],
  );
});

test("buildYearlyResultScopes rejects blank and duplicate shift identifiers", () => {
  const copy = structuredClone(features);
  copy.results.shiftResults.push(
    { shiftId: "morning", shiftName: "Duplicate" },
    { shiftId: "  " },
    null,
  );
  assert.deepEqual(
    buildYearlyResultScopes(copy).map((scope) => scope.key),
    ["general", "shift:morning", "shift:evening"],
  );
});

test("duplicate shift names remain distinguishable by their identifiers", () => {
  const copy = structuredClone(features);
  copy.results.shiftResults[0].shiftName = "Same service";
  copy.results.shiftResults[1].shiftName = "Same service";
  assert.deepEqual(
    buildYearlyResultScopes(copy).slice(1).map((scope) => scope.label),
    ["Same service (morning)", "Same service (evening)"],
  );
});

test("duplicate legacy shift names remain distinguishable by their identifiers", () => {
  const legacy = {
    config: { shift_ids: ["first", "second"] },
    meta: { shiftNames: ["Same service", "Same service"] },
  };
  assert.deepEqual(
    buildYearlyResultScopes(legacy).slice(1).map((scope) => scope.label),
    ["Same service (first)", "Same service (second)"],
  );
});

test("scope resolution falls back safely to General", () => {
  const scopes = buildYearlyResultScopes(features);
  assert.equal(resolveYearlyResultScope(scopes, "shift:evening").shiftId, "evening");
  assert.equal(resolveYearlyResultScope(scopes, "missing").key, "general");
  assert.equal(resolveYearlyResultScope([], "missing"), null);
});

test("General exposes only the common configuration section", () => {
  assert.deepEqual(getYearlyScopeSectionVisibility({ kind: "general" }), {
    overview: true,
    efficiency: false,
    costs: false,
    emissions: false,
  });
  assert.deepEqual(getYearlyScopeSectionVisibility(), {
    overview: true,
    efficiency: false,
    costs: false,
    emissions: false,
  });
});

test("a shift exposes its overview, efficiency, costs, and emissions", () => {
  assert.deepEqual(getYearlyScopeSectionVisibility({ kind: "shift" }), {
    overview: true,
    efficiency: true,
    costs: true,
    emissions: true,
  });
});

test("keyboard navigation wraps and supports Home and End", () => {
  const scopes = buildYearlyResultScopes(features);
  assert.equal(resolveYearlyScopeKeyboardTarget(scopes, "general", "ArrowLeft").key, "shift:evening");
  assert.equal(resolveYearlyScopeKeyboardTarget(scopes, "shift:evening", "ArrowRight").key, "general");
  assert.equal(resolveYearlyScopeKeyboardTarget(scopes, "shift:morning", "Home").key, "general");
  assert.equal(resolveYearlyScopeKeyboardTarget(scopes, "general", "End").key, "shift:evening");
  assert.equal(resolveYearlyScopeKeyboardTarget(scopes, "general", "Enter"), null);
  assert.equal(resolveYearlyScopeKeyboardTarget([], "general", "Home"), null);
});

test("General returns the original feature object without cloning it", () => {
  assert.equal(buildScopedYearlyFeatures(features, { kind: "general" }), features);
});

test("a shift scope narrows annual outcomes but preserves the common physical configuration", () => {
  const scoped = buildScopedYearlyFeatures(features, {
    kind: "shift",
    shiftId: "evening",
    shiftName: "Evening service",
  });
  assert.notEqual(scoped, features);
  assert.equal(scoped.config.fixedConfiguration, features.config.fixedConfiguration);
  assert.deepEqual(scoped.config.shift_ids, ["evening"]);
  assert.deepEqual(scoped.meta.shiftNames, ["Evening service"]);
  assert.deepEqual(scoped.results.scenarioResults, [{ scenarioId: "evening-cold" }]);
  assert.deepEqual(scoped.results.yearlyTotals, { totalEnergyKwh: 1000, distanceKm: 500 });
  assert.equal(scoped.results.optimizedPacks, 12);
  assert.equal(scoped.results.status, "failed");
  assert.equal(features.results.optimizedPacks, 99);
});

test("an unavailable shift scope leaves historical data intact", () => {
  assert.equal(
    buildScopedYearlyFeatures(features, { kind: "shift", shiftId: "missing" }),
    features,
  );
});

test("a legacy single-shift scope safely reuses its exact aggregate", () => {
  const legacy = {
    status: "completed",
    config: { shift_ids: ["only"] },
    meta: { shiftNames: ["Only shift"] },
    results: {
      scenarioResults: [{ scenarioId: "cold", kpis: { totalEnergyKwh: 100 } }],
      yearlyTotals: { totalEnergyKwh: 36500 },
    },
  };
  const scoped = buildScopedYearlyFeatures(legacy, {
    kind: "shift",
    shiftId: "only",
    shiftName: "Only shift",
  });
  assert.deepEqual(scoped.results.yearlyTotals, { totalEnergyKwh: 36500 });
  assert.equal(scoped.results.scenarioResults[0].shiftId, "only");
  assert.equal(scoped.results.status, "completed");
});

test("a legacy multi-shift scope never presents the aggregate as one shift", () => {
  const legacy = {
    config: { shift_ids: ["morning", "evening"] },
    results: {
      scenarioResults: [{ scenarioId: "aggregate" }],
      yearlyTotals: { totalEnergyKwh: 99999 },
    },
  };
  const scoped = buildScopedYearlyFeatures(legacy, {
    kind: "shift",
    shiftId: "morning",
    shiftName: "Morning",
  });
  assert.deepEqual(scoped.results.scenarioResults, []);
  assert.deepEqual(scoped.results.yearlyTotals, {});
  assert.equal(scoped.results.status, "unavailable");
});

test("getFixedYearlyShift resolves normalized identifiers", () => {
  assert.equal(getFixedYearlyShift(features, " morning ").shiftName, "Morning service");
  assert.equal(getFixedYearlyShift(features, "missing"), null);
});

test("shift LCA uses exact per-vehicle records and remains valid", () => {
  const raw = multiShiftLca();
  const scoped = buildShiftParameterizedLca(raw, "evening");
  const sourceVehicle = raw.vehicles[1];
  assert.equal(scoped.vehicle_count, 1);
  assert.equal(scoped.annual_km, sourceVehicle.annual_km);
  assert.equal(scoped.energy_boundary.dc_kwh, sourceVehicle.dc_kwh);
  assert.ok(
    Math.abs(scoped.indicators.gwp100a.total - sourceVehicle.indicators.gwp100a.total) < 1e-6,
  );
  assert.deepEqual(scoped.indicators.gwp100a.phases, sourceVehicle.indicators.gwp100a.phases);
  assert.equal(scoped.scope.attribution.annual_distance_share, 1 / 3);
  assert.doesNotThrow(() => mapParameterizedLca(scoped));
});

test("shift LCA falls back to transparent proportional attribution for legacy vehicle rows", () => {
  const raw = multiShiftLca();
  raw.vehicles.forEach((vehicle) => { delete vehicle.indicators; });
  const scoped = buildShiftParameterizedLca(raw, "morning");
  assert.equal(scoped.indicators.gwp100a.total, raw.indicators.gwp100a.total * 2 / 3);
  assert.match(scoped.limitations.at(-1), /attribute electricity by DC energy/i);
  assert.doesNotThrow(() => mapParameterizedLca(scoped));
});

test("shift LCA rejects absent, malformed, and unknown shift scopes", () => {
  assert.equal(buildShiftParameterizedLca(null, "morning"), null);
  assert.equal(buildShiftParameterizedLca({}, "morning"), null);
  assert.equal(buildShiftParameterizedLca({ vehicles: [] }, "morning"), null);
  assert.equal(buildShiftParameterizedLca(multiShiftLca(), "missing"), null);
  assert.equal(buildShiftParameterizedLca(multiShiftLca(), ""), null);
});

test("general and per-shift annual result labels exist in every supported locale", () => {
  const keys = [
    "yearly_analysis.scope_general",
    "yearly_analysis.scope_shift",
    "yearly_analysis.result_scope_selector",
    "yearly_analysis.annual_overview",
    "yearly_analysis.annual_efficiency",
    "yearly_analysis.annual_costs",
    "yearly_analysis.annual_emissions",
    "yearly_analysis.annual_assumption_title",
    "yearly_analysis.annual_assumption_note",
    "yearly_analysis.deployed_configuration",
    "yearly_analysis.common_bus_configuration",
    "yearly_analysis.battery_configuration",
    "yearly_analysis.shared_charging_infrastructure",
    "yearly_analysis.shared_charging_infrastructure_unavailable",
    "yearly_analysis.reference_charging_plan",
    "yearly_analysis.reference_charging_plan_note",
    "yearly_analysis.reference_charging_plan_unavailable",
    "yearly_analysis.scope_status_unknown",
    "yearly_analysis.shift_cost_scope_note",
    "yearly_analysis.shift_emissions_scope_note",
    "yearly_analysis.shift_emissions_unavailable",
  ];
  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const key of keys) {
      assert.equal(typeof dictionary[key], "string", `${locale}: missing ${key}`);
      assert.notEqual(dictionary[key].trim(), "", `${locale}: empty ${key}`);
    }
    assert.match(dictionary["yearly_analysis.charging_session_label"], /\{index\}/);
    assert.match(dictionary["yearly_analysis.shift_annual_detail"], /\{shift\}/);
  }
});

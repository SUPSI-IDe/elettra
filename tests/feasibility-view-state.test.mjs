import assert from "node:assert/strict";
import test from "node:test";

import { translations } from "../src/i18n/translations.js";
import { buildFeasibilityViewState } from "../src/utils/feasibility-view-state.js";

const model = () => ({
  fleet: {
    scope: "common",
    battery: {
      packs: 12,
      sizingShiftNames: ["Evening"],
      mostDemandingShiftNames: ["Evening"],
    },
  },
  infrastructure: { scope: "shared", stations: [] },
  shifts: [
    { shiftId: "morning", shiftName: "Morning" },
    { shiftId: "evening", shiftName: "Evening" },
  ],
});

test("a multi-shift view exposes only physical shifts and selects the requested one", () => {
  const view = buildFeasibilityViewState(model(), "evening");

  assert.equal(view.showShiftSelector, true);
  assert.deepEqual(
    view.shiftOptions.map(({ shiftId, shiftName }) => ({ shiftId, shiftName })),
    [
      { shiftId: "morning", shiftName: "Morning" },
      { shiftId: "evening", shiftName: "Evening" },
    ],
  );
  assert.equal(view.shiftOptions.some(({ shiftId }) => shiftId === "all"), false);
  assert.equal(view.selectedShiftId, "evening");
  assert.equal(view.selectedShiftName, "Evening");
});

test("a missing or stale selection falls back deterministically to the first shift", () => {
  for (const requested of [undefined, null, "", "deleted-shift"]) {
    const view = buildFeasibilityViewState(model(), requested);
    assert.equal(view.selectedShiftId, "morning");
    assert.equal(view.selectedShiftName, "Morning");
  }
});

test("a single shift remains selected without displaying a redundant selector", () => {
  const source = model();
  source.shifts = [{ shiftId: "only", shiftName: "Only shift" }];
  const view = buildFeasibilityViewState(source, "only");

  assert.equal(view.showShiftSelector, false);
  assert.equal(view.selectedShiftId, "only");
  assert.equal(view.general.shiftCount, 1);
});

test("an empty or malformed model yields both levels without a selected shift", () => {
  for (const source of [undefined, null, [], "invalid", { shifts: "invalid" }]) {
    const view = buildFeasibilityViewState(source, "missing");
    assert.deepEqual(view.shiftOptions, []);
    assert.equal(view.showShiftSelector, false);
    assert.equal(view.selectedShift, null);
    assert.equal(view.selectedShiftId, null);
    assert.equal(view.selectedShiftName, null);
    assert.equal(view.general.shiftCount, 0);
  }
});

test("invalid and duplicate shift identifiers cannot create ambiguous selector entries", () => {
  const source = model();
  source.shifts = [
    { shiftId: "", shiftName: "Missing" },
    { shiftId: null, shiftName: "Missing" },
    { shiftId: "same", shiftName: "First" },
    { shiftId: "same", shiftName: "Second" },
    { shiftId: 42, shiftName: "Numeric id" },
  ];
  const view = buildFeasibilityViewState(source, 42);

  assert.deepEqual(
    view.shiftOptions.map(({ shiftId, shiftName }) => ({ shiftId, shiftName })),
    [
      { shiftId: "same", shiftName: "First" },
      { shiftId: "42", shiftName: "Numeric id" },
    ],
  );
  assert.equal(view.selectedShiftId, "42");
});

test("changing the selected shift never changes the common general configuration", () => {
  const source = model();
  const snapshot = structuredClone(source);
  const morning = buildFeasibilityViewState(source, "morning");
  const evening = buildFeasibilityViewState(source, "evening");

  assert.equal(morning.general.fleet, source.fleet);
  assert.equal(evening.general.fleet, source.fleet);
  assert.equal(morning.general.infrastructure, source.infrastructure);
  assert.equal(evening.general.infrastructure, source.infrastructure);
  assert.equal(morning.general.battery.packs, 12);
  assert.equal(evening.general.battery.packs, 12);
  assert.deepEqual(source, snapshot);
});

test("missing optional general fields remain empty instead of being inferred", () => {
  const view = buildFeasibilityViewState({ shifts: [{ shiftId: "s" }] }, "s");

  assert.deepEqual(view.general.fleet, {});
  assert.deepEqual(view.general.battery, {});
  assert.deepEqual(view.general.infrastructure, {});
  assert.deepEqual(view.general.sizingShiftNames, []);
  assert.deepEqual(view.general.mostDemandingShiftNames, []);
});

test("both feasibility levels are translated in every supported locale", () => {
  const keys = [
    "simulation.feasibility_general_level",
    "simulation.feasibility_general_title",
    "simulation.feasibility_general_subtitle",
    "simulation.feasibility_fleet_battery",
    "simulation.feasibility_shared_infrastructure",
    "simulation.feasibility_shared_value",
    "simulation.feasibility_shared_infrastructure_note",
    "simulation.feasibility_shifts_covered",
    "simulation.feasibility_one_configuration_note",
    "simulation.feasibility_sizing_shifts",
    "simulation.feasibility_most_demanding_shifts",
    "simulation.feasibility_limiting_shift_note",
    "simulation.feasibility_nominal_capacity",
    "simulation.feasibility_capacity_unavailable",
    "simulation.feasibility_decision_fixed",
    "simulation.feasibility_decision_optimized",
    "simulation.feasibility_decision_unknown",
    "simulation.feasibility_shift_level",
    "simulation.feasibility_shift_subtitle",
    "simulation.feasibility_shift_selector",
  ];

  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const key of keys) {
      assert.equal(typeof dictionary[key], "string", `${locale}: missing ${key}`);
      assert.notEqual(dictionary[key].trim(), "", `${locale}: empty ${key}`);
    }
    assert.ok(
      dictionary["simulation.feasibility_nominal_capacity"].includes("{capacity}"),
      `${locale}: missing capacity placeholder`,
    );
  }
});

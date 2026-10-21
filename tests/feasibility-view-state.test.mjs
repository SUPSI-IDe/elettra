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

test("the general result preserves the run mode and explicit overall feasibility", () => {
  const feasibleSource = model();
  feasibleSource.mode = "joint";
  feasibleSource.electrificationFeasible = true;
  const infeasibleSource = model();
  infeasibleSource.mode = "charging_only";
  infeasibleSource.electrificationFeasible = false;

  const feasible = buildFeasibilityViewState(feasibleSource).general;
  const infeasible = buildFeasibilityViewState(infeasibleSource).general;

  assert.equal(feasible.mode, "joint");
  assert.equal(feasible.electrificationFeasible, true);
  assert.equal(infeasible.mode, "charging_only");
  assert.equal(infeasible.electrificationFeasible, false);
});

test("missing or malformed overall feasibility remains unknown", () => {
  for (const value of [undefined, null, "true", 1, 0, {}, []]) {
    const source = model();
    source.electrificationFeasible = value;
    assert.equal(
      buildFeasibilityViewState(source).general.electrificationFeasible,
      null,
    );
  }
});

test("missing optional general fields remain empty instead of being inferred", () => {
  const view = buildFeasibilityViewState({ shifts: [{ shiftId: "s" }] }, "s");

  assert.deepEqual(view.general.fleet, {});
  assert.deepEqual(view.general.battery, {});
  assert.deepEqual(view.general.infrastructure, {});
  assert.deepEqual(view.general.sizingShiftNames, []);
  assert.deepEqual(view.general.mostDemandingShiftNames, []);
});

test("a complete shared infrastructure is summarized from active stations only", () => {
  const source = model();
  source.infrastructure = {
    scope: "shared",
    dataAvailable: true,
    selectionComplete: true,
    totalInstallationCostChf: "45000",
    stations: [
      { status: "installed", selected: true, slots: 2, totalPowerKw: 300 },
      { status: "fixed", selected: true, slots: 1, totalPowerKw: 100 },
      { status: "rejected", selected: false, slots: 0, totalPowerKw: 0 },
    ],
  };

  const summary = buildFeasibilityViewState(source).general.infrastructureSummary;
  assert.deepEqual(summary, {
    dataAvailable: true,
    selectionComplete: true,
    stations: source.infrastructure.stations,
    activeStationCount: 2,
    totalSlots: 3,
    totalPowerKw: 400,
    totalInstallationCostChf: 45000,
    statusCounts: { installed: 1, fixed: 1, rejected: 1 },
  });
});

test("candidate or incomplete infrastructure never reports final zero totals", () => {
  const source = model();
  source.infrastructure = {
    dataAvailable: true,
    selectionComplete: false,
    stations: [
      { status: "installed", selected: true, slots: 1, totalPowerKw: 150 },
      { status: "candidate", selected: null, slots: 2, totalPowerKw: 300 },
    ],
  };

  const summary = buildFeasibilityViewState(source).general.infrastructureSummary;
  assert.equal(summary.dataAvailable, true);
  assert.equal(summary.selectionComplete, false);
  assert.equal(summary.activeStationCount, null);
  assert.equal(summary.totalSlots, null);
  assert.equal(summary.totalPowerKw, null);
  assert.deepEqual(summary.statusCounts, { installed: 1, candidate: 1 });
});

test("a resolved empty infrastructure reports real zero totals", () => {
  const source = model();
  source.infrastructure = {
    dataAvailable: true,
    selectionComplete: true,
    totalInstallationCostChf: 0,
    stations: [],
  };

  const summary = buildFeasibilityViewState(source).general.infrastructureSummary;
  assert.equal(summary.activeStationCount, 0);
  assert.equal(summary.totalSlots, 0);
  assert.equal(summary.totalPowerKw, 0);
  assert.equal(summary.totalInstallationCostChf, 0);
});

test("missing active-station power remains unavailable instead of becoming a partial total", () => {
  const source = model();
  source.infrastructure = {
    dataAvailable: true,
    selectionComplete: true,
    stations: [
      { status: "installed", selected: true, slots: 1, totalPowerKw: 150 },
      { status: "installed", selected: true, slots: 1, totalPowerKw: null },
    ],
  };

  const summary = buildFeasibilityViewState(source).general.infrastructureSummary;
  assert.equal(summary.activeStationCount, 2);
  assert.equal(summary.totalSlots, 2);
  assert.equal(summary.totalPowerKw, null);
});

test("the selected shift summary compares its requirement with the common fleet battery", () => {
  const source = model();
  source.shifts = [
    {
      shiftId: "morning",
      shiftName: "Morning",
      battery: {
        requiredPacks: 8,
        commonPacks: 12,
        commonPackMargin: 4,
        maxPhysicalPacks: 16,
        excessPacks: 0,
        physicalFeasible: true,
        feasibilityStatus: "feasible",
        isSizing: false,
      },
      operation: {
        minSocKwh: 120,
        maxSocKwh: 500,
        totalChargedKwh: 80,
        numChargingSessions: 2,
      },
    },
    {
      shiftId: "evening",
      shiftName: "Evening",
      battery: {
        requiredPacks: 12,
        commonPacks: 12,
        commonPackMargin: 0,
        maxPhysicalPacks: 16,
        physicalFeasible: true,
        isSizing: true,
      },
      operation: {
        minSocKwh: 50,
        maxSocKwh: 520,
        totalChargedKwh: 140,
        numChargingSessions: 3,
      },
    },
  ];

  const morning = buildFeasibilityViewState(source, "morning").selectedShiftSummary;
  const evening = buildFeasibilityViewState(source, "evening").selectedShiftSummary;

  assert.deepEqual(morning, {
    shiftId: "morning",
    shiftName: "Morning",
    battery: {
      requiredPacks: 8,
      commonPacks: 12,
      commonPackMargin: 4,
      maxPhysicalPacks: 16,
      excessPacks: 0,
      physicalFeasible: true,
      feasibilityStatus: "feasible",
      feasible: true,
      isSizing: false,
    },
    operation: {
      minSocKwh: 120,
      maxSocKwh: 500,
      totalChargedKwh: 80,
      numChargingSessions: 2,
      chargingPlan: {
        status: "unavailable",
        reportedSessionCount: 2,
        detailedSessionCount: 0,
        expectedSessionCount: 2,
        sessions: [],
      },
    },
  });
  assert.equal(evening.battery.requiredPacks, 12);
  assert.equal(evening.battery.commonPackMargin, 0);
  assert.equal(evening.battery.isSizing, true);
  assert.equal(evening.operation.numChargingSessions, 3);
});

test("an infeasible shift preserves a negative common-battery margin", () => {
  const source = model();
  source.shifts = [{
    shiftId: "hard",
    shiftName: "Hard shift",
    battery: {
      requiredPacks: 18,
      commonPacks: 16,
      commonPackMargin: -2,
      maxPhysicalPacks: 16,
      excessPacks: 2,
      physicalFeasible: false,
      feasibilityStatus: "infeasible",
    },
  }];

  const detail = buildFeasibilityViewState(source, "hard").selectedShiftSummary;
  assert.equal(detail.battery.requiredPacks, 18);
  assert.equal(detail.battery.commonPacks, 16);
  assert.equal(detail.battery.commonPackMargin, -2);
  assert.equal(detail.battery.physicalFeasible, false);
  assert.equal(detail.battery.feasible, false);
  assert.equal(detail.operation.totalChargedKwh, null);
});

test("historical shift results fall back to optimized packs and derive the margin", () => {
  const source = model();
  source.fleet.battery.packs = 10;
  source.shifts = [{
    shiftId: "legacy",
    battery: {
      optimizedPacks: "7",
      commonPackMargin: "",
      physicalFeasible: "true",
    },
    operation: {
      minSocKwh: -1,
      maxSocKwh: "invalid",
      totalChargedKwh: "0",
      numChargingSessions: "0",
    },
  }];

  const detail = buildFeasibilityViewState(source, "legacy").selectedShiftSummary;
  assert.equal(detail.battery.requiredPacks, 7);
  assert.equal(detail.battery.commonPacks, 10);
  assert.equal(detail.battery.commonPackMargin, 3);
  assert.equal(detail.battery.physicalFeasible, null);
  assert.equal(detail.battery.feasible, true);
  assert.equal(detail.operation.minSocKwh, null);
  assert.equal(detail.operation.maxSocKwh, null);
  assert.equal(detail.operation.totalChargedKwh, 0);
  assert.equal(detail.operation.numChargingSessions, 0);
  assert.equal(detail.operation.chargingPlan.status, "empty");
});

test("selected-shift feasibility is independent from the overall run status", () => {
  const source = model();
  source.electrificationFeasible = false;
  source.shifts = [
    {
      shiftId: "covered",
      battery: {
        requiredPacks: 8,
        commonPacks: 12,
        commonPackMargin: 4,
        physicalFeasible: true,
        feasibilityStatus: "feasible",
      },
    },
    {
      shiftId: "shortfall",
      battery: {
        requiredPacks: 14,
        commonPacks: 12,
        commonPackMargin: -2,
        physicalFeasible: false,
        feasibilityStatus: "infeasible",
      },
    },
  ];

  assert.equal(
    buildFeasibilityViewState(source, "covered").selectedShiftSummary.battery.feasible,
    true,
  );
  assert.equal(
    buildFeasibilityViewState(source, "shortfall").selectedShiftSummary.battery.feasible,
    false,
  );
});

test("selected-shift feasibility handles explicit status, margin, and unknown data", () => {
  const cases = [
    [{ feasibilityStatus: "feasible" }, true],
    [{ feasibilityStatus: "INFEASIBLE" }, false],
    [{ commonPackMargin: 0 }, true],
    [{ commonPackMargin: -1 }, false],
    [{ physicalFeasible: true, commonPackMargin: -1 }, false],
    [{ physicalFeasible: false, commonPackMargin: 2 }, false],
    [{ feasibilityStatus: "unverified" }, null],
    [{ physicalFeasible: "true", commonPackMargin: "" }, null],
  ];

  for (const [battery, expected] of cases) {
    const source = model();
    source.fleet.battery.packs = null;
    source.shifts = [{ shiftId: "case", battery }];
    assert.equal(
      buildFeasibilityViewState(source, "case").selectedShiftSummary.battery.feasible,
      expected,
    );
  }
});

test("no selected shift produces no operational summary", () => {
  const view = buildFeasibilityViewState({
    fleet: { battery: { packs: 12 } },
    shifts: [],
  });

  assert.equal(view.selectedShiftSummary, null);
});

test("both feasibility levels are translated in every supported locale", () => {
  const keys = [
    "simulation.feasibility_scope_selector",
    "simulation.feasibility_scope_general",
    "simulation.feasibility_general_level",
    "simulation.feasibility_general_title",
    "simulation.feasibility_general_subtitle",
    "simulation.feasibility_optimization_mode",
    "simulation.feasibility_all_shifts_feasible",
    "simulation.feasibility_not_all_shifts_feasible",
    "simulation.feasibility_status_unavailable",
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
    "simulation.feasibility_infrastructure_title",
    "simulation.feasibility_infrastructure_subtitle",
    "simulation.feasibility_infrastructure_complete",
    "simulation.feasibility_infrastructure_incomplete",
    "simulation.feasibility_infrastructure_unavailable",
    "simulation.feasibility_infrastructure_empty",
    "simulation.feasibility_infrastructure_incomplete_note",
    "simulation.feasibility_active_locations",
    "simulation.feasibility_station_status",
    "simulation.feasibility_station_fixed",
    "simulation.feasibility_station_candidate",
    "simulation.feasibility_station_installed",
    "simulation.feasibility_station_rejected",
    "simulation.feasibility_station_configured",
    "simulation.feasibility_total_charging_power",
    "simulation.feasibility_peak_buses",
    "simulation.feasibility_delivered_energy",
    "simulation.feasibility_installation_cost",
    "simulation.feasibility_shift_summary_title",
    "simulation.feasibility_shift_summary_subtitle",
    "simulation.feasibility_shift_data_unavailable",
    "simulation.feasibility_shift_status_unknown",
    "simulation.feasibility_shift_shortfall",
    "simulation.feasibility_shift_is_sizing",
    "simulation.feasibility_shift_covered",
    "simulation.feasibility_shift_covered_with_charging",
    "simulation.feasibility_shift_required_battery",
    "simulation.feasibility_shift_common_battery",
    "simulation.feasibility_shift_battery_margin",
    "simulation.feasibility_shift_physical_limit",
    "simulation.feasibility_shift_charged_energy",
    "simulation.feasibility_shift_charging_sessions",
    "simulation.feasibility_charging_plan_title",
    "simulation.feasibility_charging_plan_subtitle",
    "simulation.feasibility_charging_plan_empty",
    "simulation.feasibility_charging_plan_unavailable",
    "simulation.feasibility_charging_plan_unavailable_count",
    "simulation.feasibility_charging_plan_partial_count",
    "simulation.feasibility_charging_plan_incomplete",
    "simulation.feasibility_charging_session_label",
    "simulation.feasibility_charging_location_unknown",
    "simulation.feasibility_charging_time",
    "simulation.feasibility_charging_duration",
    "simulation.feasibility_charging_energy",
    "simulation.feasibility_charging_average_power",
    "simulation.feasibility_minutes_short",
    "simulation.feasibility_charging_next_day",
    "simulation.feasibility_charging_day_offset",
  ];

  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const key of keys) {
      assert.equal(typeof dictionary[key], "string", `${locale}: missing ${key}`);
      assert.notEqual(dictionary[key].trim(), "", `${locale}: empty ${key}`);
    }
    assert.ok(
      dictionary["simulation.feasibility_optimization_mode"].includes("{mode}"),
      `${locale}: missing optimization mode placeholder`,
    );
    assert.ok(
      dictionary["simulation.feasibility_nominal_capacity"].includes("{capacity}"),
      `${locale}: missing capacity placeholder`,
    );
    assert.ok(
      dictionary["simulation.feasibility_charging_plan_unavailable_count"].includes("{count}"),
      `${locale}: missing charging count placeholder`,
    );
    assert.ok(
      dictionary["simulation.feasibility_charging_plan_partial_count"].includes("{available}") &&
        dictionary["simulation.feasibility_charging_plan_partial_count"].includes("{total}"),
      `${locale}: missing partial-plan placeholders`,
    );
    assert.ok(
      dictionary["simulation.feasibility_charging_session_label"].includes("{number}"),
      `${locale}: missing session number placeholder`,
    );
    assert.ok(
      dictionary["simulation.feasibility_charging_day_offset"].includes("{days}"),
      `${locale}: missing day offset placeholder`,
    );
  }
});

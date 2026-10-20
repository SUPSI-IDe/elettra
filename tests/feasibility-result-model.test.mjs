import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFeasibilityResultModel,
  FEASIBILITY_DECISION,
  FEASIBILITY_STATION_STATUS,
} from "../src/utils/feasibility-result-model.js";

const battery = (shiftName, optimizedPacks, overrides = {}) => ({
  shift_name: shiftName,
  reference_packs: 6,
  base_packs: 6,
  optimized_packs: optimizedPacks,
  required_total_packs: optimizedPacks,
  max_physical_packs: 16,
  base_kwh: 300,
  optimized_kwh: optimizedPacks * 50,
  max_physical_kwh: 800,
  physical_feasible: true,
  feasibility_status: "feasible",
  ...overrides,
});

test("a multi-shift battery-only run produces one common worst-case battery", () => {
  const model = buildFeasibilityResultModel({
    input_params: {
      mode: "battery_only",
      bus_model_id: "bus-1",
      shift_ids: ["s1", "s2", "s3"],
      charging_stations: [{
        stop_id: "depot",
        stop_name: "Depot",
        num_slots: 2,
        max_power_per_slot_kw: 150,
      }],
    },
    results: {
      electrification_feasible: true,
      battery_results: {
        s1: battery("Shift 1", 8),
        s2: battery("Shift 2", 12),
        s3: battery("Shift 3", 10),
      },
    },
  });

  assert.equal(model.mode, "battery_only");
  assert.equal(model.electrificationFeasible, true);
  assert.equal(model.fleet.scope, "common");
  assert.equal(model.fleet.busModelId, "bus-1");
  assert.deepEqual(model.fleet.battery, {
    decision: FEASIBILITY_DECISION.OPTIMIZED,
    packs: 12,
    packSizeKwh: 50,
    nominalKwh: 600,
    sizingShiftIds: ["s2"],
    sizingShiftNames: ["Shift 2"],
    mostDemandingShiftIds: ["s2"],
    mostDemandingShiftNames: ["Shift 2"],
  });
  assert.deepEqual(
    model.shifts.map((shift) => ({
      id: shift.shiftId,
      commonPacks: shift.battery.commonPacks,
      margin: shift.battery.commonPackMargin,
      isSizing: shift.battery.isSizing,
    })),
    [
      { id: "s1", commonPacks: 12, margin: 4, isSizing: false },
      { id: "s2", commonPacks: 12, margin: 0, isSizing: true },
      { id: "s3", commonPacks: 12, margin: 2, isSizing: false },
    ],
  );
  assert.equal(model.infrastructure.scope, "shared");
  assert.equal(model.infrastructure.decision, FEASIBILITY_DECISION.FIXED);
  assert.equal(model.infrastructure.dataAvailable, true);
  assert.equal(model.infrastructure.resultAvailable, false);
  assert.equal(model.infrastructure.selectionComplete, true);
  assert.deepEqual(model.infrastructure.stations[0], {
    stopId: "depot",
    stopName: "Depot",
    status: FEASIBILITY_STATION_STATUS.FIXED,
    selected: true,
    configuredSlots: 2,
    installedSlots: null,
    slots: 2,
    powerPerSlotKw: 150,
    totalPowerKw: 300,
    slotCostsChf: [],
    installationCostChf: null,
    peakConcurrentBuses: null,
    totalEnergyKwh: null,
  });
});

test("all shifts tied at the maximum are identified as sizing shifts", () => {
  const model = buildFeasibilityResultModel({
    input_params: { mode: "joint", shift_ids: ["a", "b", "c"] },
    results: {
      battery_results: {
        a: battery("A", 11),
        b: battery("B", 9),
        c: battery("C", 11),
      },
    },
  });

  assert.equal(model.fleet.battery.packs, 11);
  assert.deepEqual(model.fleet.battery.sizingShiftIds, ["a", "c"]);
  assert.deepEqual(model.fleet.battery.mostDemandingShiftIds, ["a", "c"]);
});

test("a charging-only run keeps the requested battery fixed and optimizes shared infrastructure", () => {
  const model = buildFeasibilityResultModel({
    input_params: {
      mode: "charging_only",
      fixed_battery_packs: 12,
      shift_ids: ["day", "night"],
      charging_stations: [
        { stop_id: "a", stop_name: "A", num_slots: 4, slot_costs_chf: [4, 3, 2, 1] },
        { stop_id: "b", stop_name: "B", num_slots: 2 },
        { stop_id: "c", stop_name: "C", num_slots: 1 },
      ],
    },
    results: {
      total_installation_cost_chf: 25,
      battery_results: {
        day: battery("Day", 12, { required_total_packs: 7 }),
        night: battery("Night", 12, { required_total_packs: 10 }),
      },
      installed_chargers: {
        a: { stop_name: "A", num_slots: 2, cost_chf: 20 },
        b: { stop_name: "B", num_slots: 0, cost_chf: 0 },
      },
      station_utilization: {
        a: { peak_concurrent_buses: 2, total_energy_kwh: 420 },
      },
    },
  });

  assert.equal(model.fleet.battery.decision, FEASIBILITY_DECISION.FIXED);
  assert.equal(model.fleet.battery.packs, 12);
  assert.deepEqual(model.fleet.battery.sizingShiftIds, []);
  assert.deepEqual(model.fleet.battery.mostDemandingShiftIds, ["night"]);
  assert.equal(model.infrastructure.decision, FEASIBILITY_DECISION.OPTIMIZED);
  assert.equal(model.infrastructure.dataAvailable, true);
  assert.equal(model.infrastructure.resultAvailable, true);
  assert.equal(model.infrastructure.selectionComplete, false);
  assert.equal(model.infrastructure.totalInstallationCostChf, 25);
  assert.deepEqual(
    model.infrastructure.stations.map((station) => ({
      id: station.stopId,
      status: station.status,
      selected: station.selected,
      configured: station.configuredSlots,
      installed: station.installedSlots,
      slots: station.slots,
    })),
    [
      { id: "a", status: "installed", selected: true, configured: 4, installed: 2, slots: 2 },
      { id: "b", status: "rejected", selected: false, configured: 2, installed: 0, slots: 0 },
      { id: "c", status: "candidate", selected: null, configured: 1, installed: null, slots: 1 },
    ],
  );
  assert.equal(model.infrastructure.stations[0].installationCostChf, 20);
  assert.equal(model.infrastructure.stations[0].peakConcurrentBuses, 2);
  assert.equal(model.infrastructure.stations[0].totalEnergyKwh, 420);
  assert.equal(model.infrastructure.stations[1].totalPowerKw, 0);
});

test("joint mode marks both fleet battery and shared infrastructure as optimized", () => {
  const model = buildFeasibilityResultModel({
    input_params: { mode: "joint", shift_ids: ["s"] },
    results: {
      battery_results: { s: battery("Shift", 9) },
      installed_chargers: { depot: { num_slots: 1 } },
    },
  });

  assert.equal(model.fleet.battery.decision, FEASIBILITY_DECISION.OPTIMIZED);
  assert.equal(model.infrastructure.decision, FEASIBILITY_DECISION.OPTIMIZED);
  assert.equal(model.infrastructure.stations[0].status, FEASIBILITY_STATION_STATUS.INSTALLED);
});

test("a single shift is both the sizing and most demanding shift", () => {
  const model = buildFeasibilityResultModel({
    input_params: { mode: "battery_only", shift_ids: ["only"] },
    results: { battery_results: { only: battery("Only shift", 8) } },
  });

  assert.deepEqual(model.fleet.battery.sizingShiftIds, ["only"]);
  assert.deepEqual(model.fleet.battery.mostDemandingShiftIds, ["only"]);
  assert.equal(model.shifts[0].battery.commonPackMargin, 0);
});

test("per-shift charging sessions keep their shift association and chronological order", () => {
  const model = buildFeasibilityResultModel({
    input_params: { mode: "battery_only", shift_ids: ["s1", "s2"] },
    results: {
      battery_results: {
        s1: battery("Battery name 1", 8),
        s2: battery("Battery name 2", 9),
      },
      per_bus_summary: [
        {
          shift_id: "s1",
          shift_name: "Summary name 1",
          min_soc_kwh: 100,
          max_soc_kwh: 380,
          total_charged_kwh: 120,
          num_charging_sessions: 2,
          charging_sessions: [
            {
              start_minute: 720,
              end_minute: 730,
              duration_minutes: 10,
              station_stop_id: "stop",
              station_name: "Central stop",
              energy_kwh: 25,
            },
            {
              start_minute: 60,
              end_minute: 90,
              duration_minutes: 30,
              station_stop_id: "depot",
              station_name: "Depot",
              energy_kwh: 60,
            },
          ],
        },
        { shift_id: "s2", charging_sessions: [] },
      ],
    },
  });

  assert.equal(model.shifts[0].shiftName, "Summary name 1");
  assert.equal(model.shifts[0].operation.numChargingSessions, 2);
  assert.deepEqual(
    model.shifts[0].operation.chargingSessions.map((session) => session.startMinute),
    [60, 720],
  );
  assert.equal(model.shifts[0].operation.chargingSessions[1].stationStopId, "stop");
  assert.deepEqual(model.shifts[1].operation.chargingSessions, []);
  assert.equal(model.shifts[1].operation.numChargingSessions, 0);
});

test("legacy aliases and object-shaped summaries are normalized without inventing missing values", () => {
  const model = buildFeasibilityResultModel({
    optimization_mode: "battery_only",
    bus_model_id: "legacy-bus",
    results: {
      battery_results: [{ shift_id: "legacy", optimized_packs: "10", max_physical_packs: "14" }],
      per_bus_summary: {
        legacy: { shift_name: "Legacy shift", total_charged_kwh: "123.5" },
      },
    },
  });

  assert.equal(model.mode, "battery_only");
  assert.equal(model.fleet.busModelId, "legacy-bus");
  assert.equal(model.fleet.battery.packs, 10);
  assert.equal(model.fleet.battery.packSizeKwh, null);
  assert.equal(model.fleet.battery.nominalKwh, null);
  assert.equal(model.electrificationFeasible, null);
  assert.equal(model.shifts[0].shiftName, "Legacy shift");
  assert.equal(model.shifts[0].operation.totalChargedKwh, 123.5);
});

test("unknown modes and malformed numeric fields remain explicit nulls", () => {
  const model = buildFeasibilityResultModel({
    input_params: {
      mode: "future_mode",
      shift_ids: ["s"],
      fixed_battery_packs: true,
      charging_stations: [{
        stop_id: "zero",
        num_slots: "0",
        max_power_per_slot_kw: "invalid",
        slot_costs_chf: [10, -1, "bad", "5"],
      }],
    },
    results: {
      electrification_feasible: "true",
      total_installation_cost_chf: Infinity,
      battery_results: {
        s: {
          optimized_packs: "",
          required_total_packs: -3,
          physical_feasible: 1,
        },
      },
    },
  });

  assert.equal(model.fleet.battery.decision, FEASIBILITY_DECISION.UNKNOWN);
  assert.equal(model.infrastructure.decision, FEASIBILITY_DECISION.UNKNOWN);
  assert.equal(model.fleet.battery.packs, null);
  assert.equal(model.electrificationFeasible, null);
  assert.equal(model.infrastructure.totalInstallationCostChf, null);
  assert.equal(model.shifts[0].battery.requiredPacks, null);
  assert.equal(model.shifts[0].battery.physicalFeasible, null);
  assert.equal(model.infrastructure.stations[0].slots, 0);
  assert.equal(model.infrastructure.stations[0].selected, null);
  assert.deepEqual(model.infrastructure.stations[0].slotCostsChf, [10, 5]);
});

test("zero-slot optimized results are rejected while zero-slot fixed stations stay fixed and inactive", () => {
  const optimized = buildFeasibilityResultModel({
    input_params: {
      mode: "joint",
      charging_stations: [{ stop_id: "candidate", num_slots: 3 }],
    },
    results: {
      installed_chargers: { candidate: { num_slots: 0 } },
    },
  });
  const fixed = buildFeasibilityResultModel({
    input_params: {
      mode: "battery_only",
      charging_stations: [{ stop_id: "fixed", num_slots: 0 }],
    },
  });

  assert.equal(optimized.infrastructure.stations[0].status, "rejected");
  assert.equal(optimized.infrastructure.stations[0].selected, false);
  assert.equal(fixed.infrastructure.stations[0].status, "fixed");
  assert.equal(fixed.infrastructure.stations[0].selected, false);
});

test("an optimized infrastructure is complete only when every candidate has a result", () => {
  const complete = buildFeasibilityResultModel({
    input_params: {
      mode: "joint",
      charging_stations: [
        { stop_id: "installed", num_slots: 4, max_power_per_slot_kw: 100, max_total_power_kw: 300 },
        { stop_id: "rejected", num_slots: 3, max_power_per_slot_kw: 150, max_total_power_kw: 400 },
      ],
    },
    results: {
      installed_chargers: {
        installed: { num_slots: 2, slot_costs_chf: [20_000, 10_000] },
        rejected: { num_slots: 0 },
      },
    },
  });
  const incomplete = buildFeasibilityResultModel({
    input_params: {
      mode: "joint",
      charging_stations: [
        { stop_id: "installed", num_slots: 2 },
        { stop_id: "unresolved", num_slots: 1 },
      ],
    },
    results: {
      installed_chargers: { installed: { num_slots: 1 } },
    },
  });

  assert.equal(complete.infrastructure.selectionComplete, true);
  assert.equal(complete.infrastructure.stations[0].totalPowerKw, 200);
  assert.deepEqual(complete.infrastructure.stations[0].slotCostsChf, [20_000, 10_000]);
  assert.equal(complete.infrastructure.stations[1].totalPowerKw, 0);
  assert.equal(incomplete.infrastructure.selectionComplete, false);
  assert.equal(incomplete.infrastructure.stations[1].status, "candidate");
  assert.equal(incomplete.infrastructure.stations[1].selected, null);
});

test("empty infrastructure data is distinct from unavailable infrastructure data", () => {
  const fixedEmpty = buildFeasibilityResultModel({
    input_params: { mode: "battery_only", charging_stations: [] },
    results: {},
  });
  const optimizedEmpty = buildFeasibilityResultModel({
    input_params: { mode: "joint", charging_stations: [] },
    results: { installed_chargers: {} },
  });
  const unavailable = buildFeasibilityResultModel({
    input_params: { mode: "joint" },
    results: {},
  });

  assert.equal(fixedEmpty.infrastructure.dataAvailable, true);
  assert.equal(fixedEmpty.infrastructure.selectionComplete, true);
  assert.equal(optimizedEmpty.infrastructure.dataAvailable, true);
  assert.equal(optimizedEmpty.infrastructure.selectionComplete, true);
  assert.equal(unavailable.infrastructure.dataAvailable, false);
  assert.equal(unavailable.infrastructure.selectionComplete, false);
});

test("a fixed result-only station keeps fixed provenance and an unknown slot count", () => {
  const model = buildFeasibilityResultModel({
    input_params: { mode: "battery_only" },
    results: {
      installed_chargers: {
        legacy: { stop_name: "Legacy depot" },
      },
    },
  });

  assert.equal(model.infrastructure.stations[0].status, "fixed");
  assert.equal(model.infrastructure.stations[0].selected, null);
  assert.equal(model.infrastructure.selectionComplete, false);
});

test("result-only stations and shifts are retained after requested items, and input is never mutated", () => {
  const run = {
    input_params: {
      mode: "joint",
      shift_ids: ["requested"],
      charging_stations: [{ stop_id: "input", stop_name: "Input" }],
    },
    results: {
      battery_results: {
        requested: battery("Requested", 8),
        extra: battery("Extra", 9),
      },
      installed_chargers: {
        output: { stop_name: "Output", num_slots: 2 },
      },
      station_utilization: {
        utilization: { stop_name: "Utilization only", total_energy_kwh: 10 },
      },
    },
  };
  const snapshot = structuredClone(run);
  const model = buildFeasibilityResultModel(run);

  assert.deepEqual(model.shifts.map((shift) => shift.shiftId), ["requested", "extra"]);
  assert.deepEqual(
    model.infrastructure.stations.map((station) => station.stopId),
    ["input", "output", "utilization"],
  );
  assert.equal(model.infrastructure.stations[1].status, "installed");
  assert.equal(model.infrastructure.stations[2].status, "configured");
  assert.deepEqual(run, snapshot);
});

test("empty, null and non-object payloads produce a stable empty model", () => {
  for (const payload of [undefined, null, [], "invalid"]) {
    const model = buildFeasibilityResultModel(payload);
    assert.equal(model.mode, null);
    assert.equal(model.fleet.busModelId, null);
    assert.equal(model.fleet.battery.packs, null);
    assert.deepEqual(model.fleet.battery.sizingShiftIds, []);
    assert.equal(model.infrastructure.scope, "shared");
    assert.deepEqual(model.infrastructure.stations, []);
    assert.deepEqual(model.shifts, []);
  }
});

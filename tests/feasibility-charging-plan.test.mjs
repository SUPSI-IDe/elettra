import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFeasibilityChargingPlan,
  formatFeasibilityClockMinute,
} from "../src/utils/feasibility-charging-plan.js";

const session = (overrides = {}) => ({
  startMinute: 60,
  endMinute: 90,
  durationMinutes: 30,
  stationStopId: "depot",
  stationName: "Depot",
  energyKwh: 60,
  ...overrides,
});

test("a complete charging plan is ordered chronologically and derives average power", () => {
  const plan = buildFeasibilityChargingPlan({
    numChargingSessions: 2,
    chargingSessions: [
      session({ startMinute: 720, endMinute: 730, durationMinutes: 10, energyKwh: 25 }),
      session(),
    ],
  });

  assert.equal(plan.status, "complete");
  assert.equal(plan.reportedSessionCount, 2);
  assert.equal(plan.detailedSessionCount, 2);
  assert.deepEqual(plan.sessions.map((item) => item.startMinute), [60, 720]);
  assert.deepEqual(plan.sessions.map((item) => item.sequence), [1, 2]);
  assert.equal(plan.sessions[0].averagePowerKw, 120);
  assert.equal(plan.sessions[1].averagePowerKw, 150);
});

test("clock-only ranges that cross midnight become chronological next-day ranges", () => {
  const plan = buildFeasibilityChargingPlan({
    numChargingSessions: 1,
    chargingSessions: [session({
      startMinute: 1430,
      endMinute: 10,
      durationMinutes: 20,
      energyKwh: 50,
    })],
  });

  assert.equal(plan.status, "complete");
  assert.equal(plan.sessions[0].startMinute, 1430);
  assert.equal(plan.sessions[0].endMinute, 1450);
  assert.equal(plan.sessions[0].durationMinutes, 20);
  assert.equal(plan.sessions[0].averagePowerKw, 150);
});

test("an absolute backend range remains authoritative when a legacy duration disagrees", () => {
  const plan = buildFeasibilityChargingPlan({
    chargingSessions: [session({
      startMinute: 1500,
      endMinute: 1530,
      durationMinutes: 5,
      energyKwh: 30,
    })],
  });

  assert.equal(plan.status, "complete");
  assert.equal(plan.sessions[0].durationMinutes, 30);
  assert.equal(plan.sessions[0].averagePowerKw, 60);
});

test("a missing end time is recovered from start and duration", () => {
  const plan = buildFeasibilityChargingPlan({
    numChargingSessions: 1,
    chargingSessions: [session({ endMinute: null, durationMinutes: 15 })],
  });

  assert.equal(plan.status, "complete");
  assert.equal(plan.sessions[0].endMinute, 75);
  assert.equal(plan.sessions[0].durationMinutes, 15);
  assert.equal(plan.sessions[0].averagePowerKw, 240);
});

test("equal clock values use a positive explicit duration for a full-day session", () => {
  const plan = buildFeasibilityChargingPlan({
    numChargingSessions: 1,
    chargingSessions: [session({
      startMinute: 60,
      endMinute: 60,
      durationMinutes: 1440,
      energyKwh: 144,
    })],
  });

  assert.equal(plan.status, "complete");
  assert.equal(plan.sessions[0].endMinute, 1500);
  assert.equal(plan.sessions[0].durationMinutes, 1440);
  assert.equal(plan.sessions[0].averagePowerKw, 6);
});

test("zero energy remains valid while a zero-duration session is incomplete", () => {
  const zeroEnergy = buildFeasibilityChargingPlan({
    numChargingSessions: 1,
    chargingSessions: [session({ energyKwh: 0 })],
  });
  const zeroDuration = buildFeasibilityChargingPlan({
    numChargingSessions: 1,
    chargingSessions: [session({ endMinute: 60, durationMinutes: 0 })],
  });

  assert.equal(zeroEnergy.status, "complete");
  assert.equal(zeroEnergy.sessions[0].averagePowerKw, 0);
  assert.equal(zeroDuration.status, "partial");
  assert.equal(zeroDuration.sessions[0].averagePowerKw, null);
  assert.equal(zeroDuration.sessions[0].detailsComplete, false);
});

test("a reported count larger than the available rows is partial", () => {
  const plan = buildFeasibilityChargingPlan({
    numChargingSessions: 3,
    chargingSessions: [session(), session({ startMinute: 120, endMinute: 135 })],
  });

  assert.equal(plan.status, "partial");
  assert.equal(plan.reportedSessionCount, 3);
  assert.equal(plan.detailedSessionCount, 2);
  assert.equal(plan.expectedSessionCount, 3);
});

test("a row with missing time, location, or energy remains visible and marks the plan partial", () => {
  const plan = buildFeasibilityChargingPlan({
    numChargingSessions: 1,
    chargingSessions: [{
      startMinute: "",
      endMinute: false,
      durationMinutes: "invalid",
      stationStopId: " ",
      stationName: null,
      energyKwh: -1,
    }],
  });

  assert.equal(plan.status, "partial");
  assert.equal(plan.sessions.length, 1);
  assert.deepEqual(plan.sessions[0], {
    sequence: 1,
    startMinute: null,
    endMinute: null,
    durationMinutes: null,
    stationStopId: null,
    stationName: null,
    energyKwh: null,
    averagePowerKw: null,
    detailsComplete: false,
  });
});

test("a station identifier is a usable location when its display name is absent", () => {
  const plan = buildFeasibilityChargingPlan({
    numChargingSessions: 1,
    chargingSessions: [session({ stationName: null })],
  });

  assert.equal(plan.status, "complete");
  assert.equal(plan.sessions[0].stationStopId, "depot");
});

test("zero reported sessions is distinct from unavailable schedule details", () => {
  assert.deepEqual(
    buildFeasibilityChargingPlan({ numChargingSessions: 0, chargingSessions: [] }),
    {
      status: "empty",
      reportedSessionCount: 0,
      detailedSessionCount: 0,
      expectedSessionCount: 0,
      sessions: [],
    },
  );

  const reportedWithoutRows = buildFeasibilityChargingPlan({
    numChargingSessions: 2,
    chargingSessions: [],
  });
  assert.equal(reportedWithoutRows.status, "unavailable");
  assert.equal(reportedWithoutRows.expectedSessionCount, 2);

  const historical = buildFeasibilityChargingPlan({});
  assert.equal(historical.status, "unavailable");
  assert.equal(historical.reportedSessionCount, null);
});

test("contradictory rows are retained and invalid collection members are ignored", () => {
  const source = {
    numChargingSessions: 0,
    chargingSessions: [null, "invalid", session()],
  };
  const snapshot = structuredClone(source);
  const plan = buildFeasibilityChargingPlan(source);

  assert.equal(plan.status, "partial");
  assert.equal(plan.detailedSessionCount, 1);
  assert.deepEqual(source, snapshot);
});

test("clock formatting preserves day offsets and rejects invalid minute values", () => {
  assert.deepEqual(formatFeasibilityClockMinute(0), { clock: "00:00", dayOffset: 0 });
  assert.deepEqual(formatFeasibilityClockMinute(1439), { clock: "23:59", dayOffset: 0 });
  assert.deepEqual(formatFeasibilityClockMinute(1440), { clock: "00:00", dayOffset: 1 });
  assert.deepEqual(formatFeasibilityClockMinute(2945), { clock: "01:05", dayOffset: 2 });
  assert.deepEqual(formatFeasibilityClockMinute("90"), { clock: "01:30", dayOffset: 0 });
  assert.equal(formatFeasibilityClockMinute(-1), null);
  assert.equal(formatFeasibilityClockMinute(1.5), null);
  assert.equal(formatFeasibilityClockMinute(true), null);
  assert.equal(formatFeasibilityClockMinute(""), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETION_BLOCKER_TYPES,
  formatBlockedDeletionMessage,
  formatDeletionBlockerLabel,
  guardProtectedDeletion,
  normalizeDeletionBlockers,
} from "../src/utils/protected-delete.js";

const EN = {
  "protected_delete.blocked_intro":
    "This item cannot be deleted because it is still used by:",
  "protected_delete.blocked_item_named": '{typeLabel} "{name}"',
  "protected_delete.blocked_item_id": "{typeLabel} (ID: {id})",
  "protected_delete.blocked_item_type_only": "{typeLabel}",
  "protected_delete.blocked_footer":
    "Delete the related items first and then try again.",
  "protected_delete.blocker_type.yearly_analysis": "Yearly analysis",
  "protected_delete.blocker_type.optimization_run": "Feasibility evaluation",
  "protected_delete.blocker_type.shift": "Shift",
  "protected_delete.blocker_type.custom_stop": "Custom stop",
  "protected_delete.blocker_type.bus_model": "Bus model",
  "protected_delete.blocker_type.unknown": "Related item",
};

const translate = (key, params = {}) => {
  let text = EN[key] ?? key;
  Object.entries(params).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, String(value));
  });
  return text;
};

test("guardProtectedDeletion allows deletion when there are zero blockers", () => {
  let flashed = null;
  const result = guardProtectedDeletion({
    blockers: [],
    showFlash: (message) => {
      flashed = message;
    },
  });

  assert.equal(result.blocked, false);
  assert.deepEqual(result.blockers, []);
  assert.equal(flashed, null);
});

test("formatBlockedDeletionMessage handles one blocker with name", () => {
  const message = formatBlockedDeletionMessage(
    [
      {
        type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
        id: "ya-1",
        name: "Scenario 2026",
      },
    ],
    translate
  );

  assert.match(message, /still used by:/);
  assert.match(message, /Yearly analysis "Scenario 2026"/);
  assert.match(message, /Delete the related items first/);
});

test("formatBlockedDeletionMessage handles multiple blockers", () => {
  const message = formatBlockedDeletionMessage(
    [
      {
        type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
        name: "Winter case",
      },
      {
        type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
        name: "Morning route",
      },
    ],
    translate
  );

  assert.match(message, /Yearly analysis "Winter case"/);
  assert.match(message, /Feasibility evaluation "Morning route"/);
});

test("formatDeletionBlockerLabel falls back when name is unavailable", () => {
  const label = formatDeletionBlockerLabel(
    { type: DELETION_BLOCKER_TYPES.SHIFT },
    translate
  );

  assert.equal(label, "Shift");
});

test("formatDeletionBlockerLabel uses id when name is unavailable", () => {
  const label = formatDeletionBlockerLabel(
    { type: DELETION_BLOCKER_TYPES.CUSTOM_STOP, id: "depot-42" },
    translate
  );

  assert.equal(label, "Custom stop (ID: depot-42)");
});

test("guardProtectedDeletion blocks deletion and flashes message", () => {
  const messages = [];
  const result = guardProtectedDeletion({
    blockers: [
      {
        type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
        name: "Scenario 2026",
      },
    ],
    showFlash: (message) => messages.push(message),
  });

  assert.equal(result.blocked, true);
  assert.equal(result.blockers.length, 1);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Scenario 2026/);
});

test("normalizeDeletionBlockers ignores invalid entries", () => {
  assert.deepEqual(
    normalizeDeletionBlockers([
      { type: DELETION_BLOCKER_TYPES.BUS_MODEL, id: "bm-1" },
      null,
      { id: "missing-type" },
      "invalid",
    ]),
    [{ type: DELETION_BLOCKER_TYPES.BUS_MODEL, id: "bm-1" }]
  );
});

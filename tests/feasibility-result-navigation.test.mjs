import assert from "node:assert/strict";
import test from "node:test";

import {
  FEASIBILITY_GENERAL_SCOPE_KEY,
  buildFeasibilityResultScopes,
  feasibilityShiftScopeKey,
  resolveFeasibilityResultScope,
  resolveFeasibilityScopeKeyboardTarget,
} from "../src/utils/feasibility-result-navigation.js";

const shifts = [
  { id: "morning", shiftName: "Morning" },
  { id: "evening", shiftName: "Evening" },
];

test("builds one general scope followed by every unique physical shift", () => {
  assert.deepEqual(buildFeasibilityResultScopes(shifts), [
    {
      key: "general",
      kind: "general",
      label: "General",
      shiftId: null,
      shiftName: null,
    },
    {
      key: "shift:morning",
      kind: "shift",
      label: "Morning",
      shiftId: "morning",
      shiftName: "Morning",
    },
    {
      key: "shift:evening",
      kind: "shift",
      label: "Evening",
      shiftId: "evening",
      shiftName: "Evening",
    },
  ]);
});

test("keeps general and the physical shift visible for a single-shift result", () => {
  const scopes = buildFeasibilityResultScopes([shifts[0]]);
  assert.deepEqual(scopes.map(({ key }) => key), ["general", "shift:morning"]);
});

test("an empty or malformed shift collection still exposes general", () => {
  for (const source of [undefined, null, {}, "invalid", []]) {
    const scopes = buildFeasibilityResultScopes(source, { generalLabel: "Generale" });
    assert.deepEqual(scopes.map(({ key, label }) => ({ key, label })), [
      { key: "general", label: "Generale" },
    ]);
  }
});

test("invalid and duplicate shift identifiers cannot create duplicate tabs", () => {
  const scopes = buildFeasibilityResultScopes([
    { id: "", shiftName: "Missing" },
    { id: null, shiftName: "Missing" },
    { id: "same", shiftName: "First" },
    { id: "same", shiftName: "Second" },
    { shift_id: 42, shift_name: "Numeric" },
  ]);

  assert.deepEqual(scopes.map(({ key, label }) => ({ key, label })), [
    { key: "general", label: "General" },
    { key: "shift:same", label: "First" },
    { key: "shift:42", label: "Numeric" },
  ]);
});

test("duplicate display names receive deterministic visible ordinals", () => {
  const source = structuredClone(shifts);
  source[0].shiftName = "Shared service";
  source[1].shiftName = "Shared service";

  assert.deepEqual(
    buildFeasibilityResultScopes(source).map(({ label }) => label),
    ["General", "Shared service (1)", "Shared service (2)"],
  );
});

test("scope construction does not mutate its shift input", () => {
  const source = structuredClone(shifts);
  const snapshot = structuredClone(source);
  buildFeasibilityResultScopes(source);
  assert.deepEqual(source, snapshot);
});

test("general is the deterministic fallback for absent and stale scope keys", () => {
  const scopes = buildFeasibilityResultScopes(shifts);
  for (const key of [undefined, null, "", "shift:deleted", "all"]) {
    assert.equal(resolveFeasibilityResultScope(scopes, key)?.key, "general");
  }
  assert.equal(
    resolveFeasibilityResultScope(scopes, "shift:evening")?.shiftId,
    "evening",
  );
});

test("scope resolution fails safely when no scope exists", () => {
  for (const source of [undefined, null, {}, []]) {
    assert.equal(resolveFeasibilityResultScope(source, "general"), null);
  }
});

test("keyboard navigation moves, wraps, and supports Home and End", () => {
  const scopes = buildFeasibilityResultScopes(shifts);
  assert.equal(
    resolveFeasibilityScopeKeyboardTarget(scopes, "general", "ArrowRight")?.key,
    "shift:morning",
  );
  assert.equal(
    resolveFeasibilityScopeKeyboardTarget(scopes, "general", "ArrowLeft")?.key,
    "shift:evening",
  );
  assert.equal(
    resolveFeasibilityScopeKeyboardTarget(scopes, "shift:evening", "ArrowRight")?.key,
    "general",
  );
  assert.equal(
    resolveFeasibilityScopeKeyboardTarget(scopes, "shift:morning", "Home")?.key,
    "general",
  );
  assert.equal(
    resolveFeasibilityScopeKeyboardTarget(scopes, "general", "End")?.key,
    "shift:evening",
  );
});

test("unrelated keyboard input and empty scopes do not select anything", () => {
  const scopes = buildFeasibilityResultScopes(shifts);
  assert.equal(
    resolveFeasibilityScopeKeyboardTarget(scopes, "general", "Enter"),
    null,
  );
  assert.equal(
    resolveFeasibilityScopeKeyboardTarget([], "general", "ArrowRight"),
    null,
  );
});

test("shift scope keys normalize identifiers without creating an all scope", () => {
  assert.equal(feasibilityShiftScopeKey(" morning "), "shift:morning");
  assert.equal(feasibilityShiftScopeKey(42), "shift:42");
  assert.equal(feasibilityShiftScopeKey(" "), "");
  assert.equal(FEASIBILITY_GENERAL_SCOPE_KEY, "general");
});

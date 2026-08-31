import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBusModelApiError,
  buildBusModelEditRequestBody,
  buildBusModelUpdateBody,
  extractBusModelValidationFields,
} from "../src/api/bus-model-request.js";

test("metadata-only update bodies omit specs and unrelated model fields", () => {
  assert.deepEqual(
    buildBusModelUpdateBody({
      name: "Legacy model renamed",
      description: "Still intentionally legacy",
    }),
    {
      name: "Legacy model renamed",
      description: "Still intentionally legacy",
    }
  );
});

test("a deliberate edit preserves specs without overwriting ownership fields", () => {
  const specs = {
    bus_length_m: 13,
    empty_weight_kg: 12750,
    custom_lca_field: { source: "existing" },
  };
  const body = buildBusModelEditRequestBody({
    name: "Complete model",
    manufacturer: "Generic",
    specs,
    userId: "user-1",
    model: "Derived category label",
  });

  assert.equal(body.specs, specs);
  assert.deepEqual(body.specs.custom_lca_field, { source: "existing" });
  assert.equal(Object.hasOwn(body, "manufacturer"), false);
  assert.equal(Object.hasOwn(body, "user_id"), false);
  assert.equal(Object.hasOwn(body, "model"), false);
});

test("422 locations become unique, user-displayable field names", () => {
  const payload = {
    detail: [
      { loc: ["body", "specs", "empty_weight_kg"], msg: "greater than 0" },
      { loc: ["body", "specs", "max_battery_packs"], msg: "integer" },
      { loc: ["body", "specs", "empty_weight_kg"], msg: "duplicate" },
    ],
  };

  assert.deepEqual(extractBusModelValidationFields(payload), [
    "empty_weight_kg",
    "max_battery_packs",
  ]);

  const error = buildBusModelApiError(
    { status: 422 },
    payload,
    "fallback"
  );
  assert.equal(error.status, 422);
  assert.deepEqual(error.validationFields, [
    "empty_weight_kg",
    "max_battery_packs",
  ]);
  assert.match(error.message, /greater than 0; integer; duplicate/);
});

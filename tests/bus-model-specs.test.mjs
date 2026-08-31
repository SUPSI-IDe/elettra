import assert from "node:assert/strict";
import test from "node:test";

import {
  BUS_MODEL_LENGTH_OPTIONS,
  getBusModelDefaultsForLength,
} from "../src/config/bus-model-defaults.js";
import {
  buildVehicleCategorySpecsForSubmission,
  getVehicleCategoryByKey,
  inferVehicleCategoryFromSpecs,
} from "../src/config/vehicle-categories.js";
import { translations } from "../src/i18n/translations.js";
import {
  BUS_MODEL_SPEC_FIELDS,
  captureBusModelSpecFormState,
  haveBusModelSpecsChanged,
  mergeBusModelSpecs,
  normalizeBusModelSpecValues,
  resolveExpectedBusLengthM,
  shouldSubmitBusModelSpecs,
  validateBusModelSpecs,
} from "../src/utils/bus-model-specs.js";

const validSpecs = {
  cost: 600000,
  bus_length_m: 13,
  max_passengers: 64,
  empty_weight_kg: 12750,
  max_battery_packs: 11,
  min_battery_packs: 7,
  battery_pack_size_kwh: 40,
  battery_pack_cost_chf: 6000,
  max_charging_power_kw: 450,
  battery_pack_weight_kg: 274,
  battery_pack_lifetime: 8,
  bus_lifetime: 12,
};

test("training-aligned weight defaults use the canonical 9, 13 and 18 m lengths", () => {
  assert.deepEqual(BUS_MODEL_LENGTH_OPTIONS, ["9", "13", "18"]);
  assert.equal(getBusModelDefaultsForLength(9).empty_weight_kg, 9875);
  assert.equal(getBusModelDefaultsForLength(13).empty_weight_kg, 12750);
  assert.equal(getBusModelDefaultsForLength(18).empty_weight_kg, 16325);

  for (const length of BUS_MODEL_LENGTH_OPTIONS) {
    const defaults = getBusModelDefaultsForLength(length);
    assert.equal(defaults.battery_pack_size_kwh, 40);
    assert.equal(defaults.battery_pack_weight_kg, 274);
  }

  assert.equal(getBusModelDefaultsForLength(12), null);
});

test("category passenger defaults remain unchanged while standard defaults use 13 m", () => {
  const midi = getVehicleCategoryByKey("midi_electric_bus_9m");
  const standard = getVehicleCategoryByKey("standard_electric_bus_12_13m");
  const articulated = getVehicleCategoryByKey("articulated_electric_bus_18m");

  assert.equal(midi.defaultPassengerCapacity, 34);
  assert.equal(standard.defaultPassengerCapacity, 64);
  assert.equal(articulated.defaultPassengerCapacity, 150);
  assert.equal(standard.lengthM, 13);
  assert.equal(standard.defaultSpecLength, "13");
});

test("legacy 12 m values are inferred as standard without becoming new defaults", () => {
  for (const specs of [
    { size: "12m" },
    { length_m: 12 },
    { bus_length_m: 12 },
  ]) {
    assert.equal(
      inferVehicleCategoryFromSpecs(specs)?.key,
      "standard_electric_bus_12_13m"
    );
  }
});

test("normalization accepts numeric form strings and exposes invalid values", () => {
  const normalized = normalizeBusModelSpecValues({
    ...Object.fromEntries(
      Object.entries(validSpecs).map(([field, value]) => [field, String(value)])
    ),
    empty_weight_kg: "Infinity",
    max_passengers: true,
  });

  assert.equal(normalized.bus_length_m, 13);
  assert.equal(normalized.empty_weight_kg, Infinity);
  assert.ok(Number.isNaN(normalized.max_passengers));
});

test("complete, finite and coherent specifications pass validation", () => {
  assert.deepEqual(validateBusModelSpecs(validSpecs, { expectedLengthM: 13 }), {
    ok: true,
    issue: null,
  });
});

test("every form specification remains required", () => {
  for (const field of BUS_MODEL_SPEC_FIELDS) {
    const incomplete = { ...validSpecs };
    delete incomplete[field];
    const result = validateBusModelSpecs(incomplete, { expectedLengthM: 13 });
    assert.equal(result.ok, false, field);
    assert.deepEqual(result.issue, { code: "required", field }, field);
  }
});

test("validation rejects non-finite, non-positive and fractional integer values", () => {
  const cases = [
    ["empty_weight_kg", Infinity, "finite"],
    ["battery_pack_weight_kg", Number.NaN, "finite"],
    ["bus_length_m", 0, "positive"],
    ["max_passengers", -1, "positive"],
    ["cost", -0.01, "non_negative"],
    ["battery_pack_cost_chf", -1, "non_negative"],
    ["max_battery_packs", 8.5, "integer"],
    ["bus_lifetime", 12.5, "integer"],
  ];

  for (const [field, value, code] of cases) {
    const result = validateBusModelSpecs(
      { ...validSpecs, [field]: value },
      { expectedLengthM: 13 }
    );
    assert.equal(result.ok, false, field);
    assert.equal(result.issue.code, code, field);
    assert.equal(result.issue.field, field, field);
  }

  assert.equal(
    validateBusModelSpecs({ ...validSpecs, cost: 0 }).ok,
    true,
    "zero vehicle cost is valid"
  );
});

test("validation enforces battery range and category length", () => {
  const packRange = validateBusModelSpecs({
    ...validSpecs,
    min_battery_packs: 12,
    max_battery_packs: 11,
  });
  assert.equal(packRange.issue.code, "pack_range");

  const length = validateBusModelSpecs(validSpecs, { expectedLengthM: 18 });
  assert.equal(length.issue.code, "category_length");
  assert.equal(length.issue.expectedLengthM, 18);
});

test("metadata-only edits keep the original specification snapshot unchanged", () => {
  const initial = captureBusModelSpecFormState(validSpecs, "standard");
  const same = captureBusModelSpecFormState(
    Object.fromEntries(
      Object.entries(validSpecs).map(([field, value]) => [field, ` ${value} `])
    ),
    "standard"
  );
  assert.equal(haveBusModelSpecsChanged(initial, same), false);

  const changedWeight = captureBusModelSpecFormState(
    { ...validSpecs, empty_weight_kg: 12800 },
    "standard"
  );
  assert.equal(haveBusModelSpecsChanged(initial, changedWeight), true);

  const changedCategory = captureBusModelSpecFormState(validSpecs, "articulated");
  assert.equal(haveBusModelSpecsChanged(initial, changedCategory), true);
  assert.equal(
    shouldSubmitBusModelSpecs({
      isEditMode: true,
      initialState: initial,
      currentState: same,
    }),
    false
  );
  assert.equal(
    shouldSubmitBusModelSpecs({
      isEditMode: false,
      initialState: initial,
      currentState: same,
    }),
    true
  );
});

test("specification updates preserve existing extra fields and auxiliary curves", () => {
  const existingAuxiliary = { "-10": 8.5, "20": 2.1 };
  const merged = mergeBusModelSpecs({
    currentSpecs: {
      legacy_lca_extension: { source: "existing" },
      auxiliary_consumption_kw: existingAuxiliary,
      empty_weight_kg: 12000,
      lca: {
        vehicle_name: "Old identity",
        calibration: { source: "custom", revision: 3 },
      },
    },
    formSpecs: validSpecs,
    categorySpecs: {
      size: "13m",
      bus_length_m: 13,
      lca: { vehicle_name: "Current identity", passenger_capacity: 64 },
    },
    modelType: "Standard electric bus — 13 m",
    defaultAuxiliaryConsumption: { "0": 4 },
  });

  assert.deepEqual(merged.legacy_lca_extension, { source: "existing" });
  assert.equal(merged.auxiliary_consumption_kw, existingAuxiliary);
  assert.equal(merged.empty_weight_kg, 12750);
  assert.equal(merged.size, "13m");
  assert.equal(merged.model_type, "Standard electric bus — 13 m");
  assert.equal(merged.lca.vehicle_name, "Current identity");
  assert.equal(merged.lca.passenger_capacity, 64);
  assert.deepEqual(merged.lca.calibration, {
    source: "custom",
    revision: 3,
  });
});

test("legacy 12 m passenger edits retain identity and update derived passenger fields", () => {
  const key = "standard_electric_bus_12_13m";
  const legacySpecs = {
    ...validSpecs,
    bus_length_m: 12,
    length_m: 12,
    size: "12m",
    passenger_capacity: 64,
    model_type: "Legacy standard bus — 12 m",
    lca: {
      vehicle_id: "legacy-lca-id",
      vehicle_name: "Legacy 12 m reference",
      source: "Legacy source",
      passenger_capacity: 64,
      custom_provenance: { release: "legacy-v1" },
    },
  };
  const initial = captureBusModelSpecFormState(legacySpecs, key);
  const changedPassengerCapacity = captureBusModelSpecFormState(
    { ...legacySpecs, max_passengers: 72 },
    key
  );

  const legacyExpected = resolveExpectedBusLengthM({
    isEditMode: true,
    categoryLengthM: 13,
    initialState: initial,
    currentState: changedPassengerCapacity,
    categoryWasTouched: false,
  });
  assert.equal(legacyExpected, 12);
  assert.equal(
    validateBusModelSpecs(
      { ...legacySpecs, max_passengers: 72 },
      { expectedLengthM: legacyExpected }
    ).ok,
    true
  );
  const standardCategory = getVehicleCategoryByKey(key);
  const derivedLegacySpecs = buildVehicleCategorySpecsForSubmission(
    standardCategory,
    72,
    { id: "current-13m-lca-id" },
    { currentSpecs: legacySpecs, preserveLegacyTwelveMetres: true }
  );
  const submittedLegacySpecs = mergeBusModelSpecs({
    currentSpecs: legacySpecs,
    formSpecs: { ...legacySpecs, max_passengers: 72 },
    categorySpecs: derivedLegacySpecs,
    modelType: "Legacy standard bus — 12 m",
  });
  assert.equal(submittedLegacySpecs.bus_length_m, 12);
  assert.equal(submittedLegacySpecs.length_m, 12);
  assert.equal(submittedLegacySpecs.size, "12m");
  assert.equal(submittedLegacySpecs.model_type, "Legacy standard bus — 12 m");
  assert.equal(submittedLegacySpecs.max_passengers, 72);
  assert.equal(submittedLegacySpecs.passenger_capacity, 72);
  assert.equal(submittedLegacySpecs.lca.passenger_capacity, 72);
  assert.equal(submittedLegacySpecs.lca.vehicle_id, "legacy-lca-id");
  assert.equal(
    submittedLegacySpecs.lca.vehicle_name,
    "Legacy 12 m reference"
  );
  assert.equal(submittedLegacySpecs.lca.source, "Legacy source");
  assert.deepEqual(submittedLegacySpecs.lca.custom_provenance, {
    release: "legacy-v1",
  });

  for (const scenario of [
    { isEditMode: false, categoryWasTouched: false },
    { isEditMode: true, categoryWasTouched: true },
  ]) {
    assert.equal(
      resolveExpectedBusLengthM({
        ...scenario,
        categoryLengthM: 13,
        initialState: initial,
        currentState: changedPassengerCapacity,
      }),
      13
    );
  }

  const changedCategory = captureBusModelSpecFormState(legacySpecs, "articulated");
  assert.equal(
    resolveExpectedBusLengthM({
      isEditMode: true,
      categoryLengthM: 18,
      initialState: initial,
      currentState: changedCategory,
      categoryWasTouched: false,
    }),
    18
  );
});

test("new validation and weight help messages exist in all supported languages", () => {
  const keys = [
    "buses.empty_weight_tooltip",
    "buses.physical_specs",
    "buses.spec_finite",
    "buses.spec_positive",
    "buses.spec_non_negative",
    "buses.spec_integer",
    "buses.spec_pack_range",
    "buses.spec_category_length",
    "buses.api_validation_error",
  ];

  for (const lang of ["en", "de", "fr", "it"]) {
    for (const key of keys) {
      assert.equal(typeof translations[lang][key], "string", `${lang}: ${key}`);
      assert.ok(translations[lang][key].length > 5, `${lang}: ${key}`);
    }
  }
});

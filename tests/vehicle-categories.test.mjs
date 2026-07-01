import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVehicleCategorySpecs,
  getVehicleCategoryByKey,
  inferVehicleCategoryFromSpecs,
} from "../src/config/vehicle-categories.js";
import { translations } from "../src/i18n/translations.js";

test("legacy 12 m sizes map to the standard 12/13 m vehicle category", () => {
  for (const size of ["12m", "12", "13m", "13m-city"]) {
    const category = inferVehicleCategoryFromSpecs({ size });
    assert.equal(category?.key, "standard_electric_bus_12_13m");
  }

  const category = inferVehicleCategoryFromSpecs({ bus_length_m: 12 });
  assert.equal(category?.key, "standard_electric_bus_12_13m");
});

test("vehicle category specs preserve editable passenger capacity", () => {
  const category = getVehicleCategoryByKey("standard_electric_bus_12_13m");
  const specs = buildVehicleCategorySpecs(category, 72, { id: "lca-13m" });

  assert.equal(specs.vehicle_reference_key, "standard_electric_bus_12_13m");
  assert.equal(specs.size, "13m");
  assert.equal(specs.length_m, 13);
  assert.equal(specs.bus_length_m, 13);
  assert.equal(specs.passenger_capacity, 72);
  assert.equal(specs.max_passengers, 72);
  assert.equal(specs.lca.vehicle_name, "City busSingle deck13m-cityBEV-depot2020");
  assert.equal(specs.lca.vehicle_id, "lca-13m");
});

test("vehicle categories expose translated tooltip keys", () => {
  const expectedKeys = [
    "buses.vehicle_category_tooltip_midi_9m",
    "buses.vehicle_category_tooltip_standard_12_13m",
    "buses.vehicle_category_tooltip_articulated_18m",
    "buses.cost_tooltip",
  ];

  assert.equal(
    getVehicleCategoryByKey("midi_electric_bus_9m")?.tooltipI18nKey,
    expectedKeys[0]
  );
  assert.equal(
    getVehicleCategoryByKey("standard_electric_bus_12_13m")?.tooltipI18nKey,
    expectedKeys[1]
  );
  assert.equal(
    getVehicleCategoryByKey("articulated_electric_bus_18m")?.tooltipI18nKey,
    expectedKeys[2]
  );

  for (const lang of ["en", "de", "fr", "it"]) {
    for (const key of expectedKeys) {
      assert.equal(typeof translations[lang][key], "string");
      assert.notEqual(translations[lang][key], key);
      assert.ok(translations[lang][key].length > 20);
    }
  }
});

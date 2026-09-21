import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuxiliaryHeatingTranslationKey,
  normalizeAuxiliaryHeatingType,
} from "../src/utils/heating-type.js";
import { translations } from "../src/i18n/translations.js";

test("legacy default and HP values normalize to heat pump", () => {
  for (const value of ["default", "hp", "heat_pump", "heat-pump"]) {
    assert.equal(normalizeAuxiliaryHeatingType(value), "heat_pump");
    assert.equal(
      getAuxiliaryHeatingTranslationKey(value),
      "simulation.heating_hp",
    );
  }
});

test("diesel-heater aliases and electric heating remain distinct", () => {
  for (const value of ["diesel", "ebus-dh", "diesel_heater", "diesel-heater"]) {
    assert.equal(normalizeAuxiliaryHeatingType(value), "diesel");
    assert.equal(
      getAuxiliaryHeatingTranslationKey(value),
      "simulation.heating_diesel",
    );
  }
  assert.equal(normalizeAuxiliaryHeatingType("electric"), "electric");
  assert.equal(
    getAuxiliaryHeatingTranslationKey("electric"),
    "simulation.heating_electric",
  );
});

test("heating and primary-energy labels exist in every supported language", () => {
  const keys = [
    "simulation.heating_hp",
    "simulation.heating_diesel",
    "yearly_analysis.ebus_diesel_heating",
    "yearly_analysis.primary_energy_title",
    "yearly_analysis.renewable",
    "yearly_analysis.non_renewable",
  ];
  for (const locale of ["en", "de", "fr", "it"]) {
    for (const key of keys) {
      assert.ok(translations[locale][key]?.trim(), `${locale}.${key}`);
    }
  }
});

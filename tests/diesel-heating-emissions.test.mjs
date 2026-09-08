import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptYearlyAnalysisEmissions,
  classifyDieselHeatingPresentation,
} from "../src/adapters/yearly-analysis.js";
import { translations } from "../src/i18n/translations.js";


test("emission adapter preserves numeric channels and methodology metadata", () => {
  const adapted = adaptYearlyAnalysisEmissions({
    ebus: {
      nox: {
        unit: "mg NO2-eq",
        electric: 10,
        diesel_heating: 5,
        total: 15,
        direct: 3,
        energyChain: 12,
      },
    },
    diesel_comparator: { nox: { unit: "mg NO2-eq", total: 20 } },
    data_completeness: {
      status: "complete",
      diesel_consumption_status: "available",
    },
    scope_completeness: { status: "partial", boundary: "WTW" },
    diesel_heating_methodology: {
      methodology_version: "diesel-heating-wtw-v1.0.0",
      factors: { nox: { total: 5469.256041034 } },
    },
  });

  assert.equal(adapted.ebus.indicators.nox.electric.total, 10);
  assert.equal(adapted.ebus.indicators.nox.dieselHeating.total, 5);
  assert.equal(adapted.ebus.indicators.nox.total, 15);
  assert.equal(adapted.dataCompleteness.status, "complete");
  assert.equal(adapted.scopeCompleteness.status, "partial");
  assert.equal(
    adapted.dieselHeatingMethodology.factors.nox.total,
    5469.256041034
  );
});


test("diesel-heater methodology translations exist in every locale", () => {
  const keys = [
    "yearly_analysis.environmental_scope_brief",
    "yearly_analysis.diesel_heating_included_estimated",
    "yearly_analysis.methodology_and_sources",
    "yearly_analysis.methodology_details",
    "yearly_analysis.close_methodology",
    "yearly_analysis.methodology_version",
    "yearly_analysis.diesel_heating_popover_summary",
    "yearly_analysis.diesel_heating_methodology_detail",
    "yearly_analysis.nox_convention",
    "yearly_analysis.nox_convention_detail",
    "yearly_analysis.pm10_uncertainty",
    "yearly_analysis.pm10_uncertainty_detail",
    "yearly_analysis.emissions_data_incomplete",
  ];
  for (const locale of ["en", "de", "fr", "it"]) {
    for (const key of keys) {
      assert.equal(typeof translations[locale][key], "string", `${locale}.${key}`);
      assert.ok(translations[locale][key].trim().length > 0, `${locale}.${key}`);
    }
  }
});


test("diesel-heater presentation distinguishes positive, electric, zero and incomplete cases", () => {
  assert.deepEqual(
    classifyDieselHeatingPresentation({
      configured: true, liters: 12.5, dataStatus: "complete",
    }),
    { configured: true, positive: true, zero: false, unavailable: false }
  );
  assert.deepEqual(
    classifyDieselHeatingPresentation({
      configured: false, liters: 0, dataStatus: "complete",
    }),
    { configured: false, positive: false, zero: false, unavailable: false }
  );
  assert.deepEqual(
    classifyDieselHeatingPresentation({
      configured: true, liters: 0, dataStatus: "complete",
    }),
    { configured: true, positive: false, zero: true, unavailable: false }
  );
  assert.deepEqual(
    classifyDieselHeatingPresentation({
      configured: true, liters: null, dataStatus: "partial",
    }),
    { configured: true, positive: false, zero: false, unavailable: true }
  );
});

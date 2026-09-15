import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLifecyclePhaseBar,
} from "../src/pages/Simulation/YearlyAnalysis/yearly-analysis-emissions.js";
import { translations } from "../src/i18n/translations.js";

const mixedPhases = [
  { key: "direct", value: 0.46 },
  { key: "energyChain", value: 3.82 },
  { key: "maintenance", value: 0.37 },
  { key: "vehicle", value: 2.13 },
  { key: "endOfLife", value: 0.14 },
  { key: "infrastructure", value: 1.24 },
];

test("mixed lifecycle bar uses the backend total without adding diesel heating twice", () => {
  const bar = buildLifecyclePhaseBar(
    "E-bus with diesel heating",
    mixedPhases,
    {
      total: 8_200_000,
      phase_sum: 8_160_000,
      diesel_heating: 563_000,
      phase_sum_represents: "electric_side_and_diesel_heating",
    },
    1_000_000
  );

  assert.equal(bar.total, 8.2);
  assert.equal(bar.phases, mixedPhases);
  assert.equal(Object.hasOwn(bar, "dhValue"), false);
});

test("missing backend total falls back to the phases without adding heater metadata", () => {
  const bar = buildLifecyclePhaseBar(
    "E-bus with diesel heating",
    mixedPhases,
    { diesel_heating: 563_000 },
    1_000_000
  );

  assert.ok(Math.abs(bar.total - 8.16) < 1e-10);
  assert.equal(Object.hasOwn(bar, "dhValue"), false);
});

test("diesel-heater lifecycle attribution tooltip exists in every supported language", () => {
  for (const locale of ["en", "de", "fr", "it"]) {
    const tooltip = translations[locale]["yearly_analysis.lifecycle_phases_include_dh"];
    assert.ok(typeof tooltip === "string" && tooltip.length > 0, locale);
  }
});

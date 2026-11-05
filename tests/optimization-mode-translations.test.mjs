import test from "node:test";
import assert from "node:assert/strict";

import { translations } from "../src/i18n/translations.js";

const expectedLabels = {
  en: ["Battery only", "Charging", "Joint"],
  de: ["Nur Batterie", "Laden", "Gemeinsam"],
  fr: ["Batterie uniquement", "Recharge", "Conjoint"],
  it: ["Solo batteria", "Ricarica", "Congiunta"],
};

test("optimization modes have user-facing labels in every supported language", () => {
  const keys = [
    "simulation.mode_battery_only",
    "simulation.mode_charging",
    "simulation.mode_joint",
  ];

  for (const [language, expected] of Object.entries(expectedLabels)) {
    assert.deepEqual(
      keys.map((key) => translations[language]?.[key]),
      expected,
      language,
    );
  }
});

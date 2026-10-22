import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { translations } from "../src/i18n/translations.js";

test("the General comparison copy exists in every supported locale", () => {
  const keys = [
    "analysisComparison.generalScope",
    "analysisComparison.generalScopeNote",
    "analysisComparison.commonConfiguration",
  ];
  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const key of keys) {
      assert.equal(typeof dictionary[key], "string", `${locale}: missing ${key}`);
      assert.notEqual(dictionary[key].trim(), "", `${locale}: empty ${key}`);
    }
  }
});

test("the comparison template declares one General scope without shift navigation", async () => {
  const html = await readFile(
    new URL(
      "../src/pages/Simulation/AnalysisComparison/analysis-comparison.html",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(html, /data-role="comparison-scope"[^>]+data-scope="general"/);
  assert.doesNotMatch(html, /data-role="(?:comparison-)?shift-(?:tabs|selector)"/);
});

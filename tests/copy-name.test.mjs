import assert from "node:assert/strict";
import test from "node:test";

import { appendCopyNameSuffix } from "../src/utils/copy-name.js";

test("copy names use the localized underscore suffix without extra spaces", () => {
  assert.equal(appendCopyNameSuffix("Analisi estiva", "_copia"), "Analisi estiva_copia");
  assert.equal(appendCopyNameSuffix("Summer analysis", "_copy"), "Summer analysis_copy");
  assert.equal(appendCopyNameSuffix("Analyse annuelle", "_copie"), "Analyse annuelle_copie");
  assert.equal(appendCopyNameSuffix("Jahresanalyse", "_Kopie"), "Jahresanalyse_Kopie");
});

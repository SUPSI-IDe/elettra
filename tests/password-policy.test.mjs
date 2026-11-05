import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { translations } from "../src/i18n/translations.js";
import {
  MIN_PASSWORD_LENGTH,
  meetsPasswordMinimumLength,
} from "../src/utils/password-policy.js";

test("password minimum matches the backend contract", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 12);
  assert.equal(meetsPasswordMinimumLength("a".repeat(11)), false);
  assert.equal(meetsPasswordMinimumLength("a".repeat(12)), true);
  assert.equal(meetsPasswordMinimumLength("a".repeat(64)), true);
  assert.equal(meetsPasswordMinimumLength(null), false);
});

test("registration and account forms enforce the same password minimum", async () => {
  const [registerHtml, settingsHtml] = await Promise.all([
    readFile(new URL("../src/pages/Auth/register.html", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Account/settings.html", import.meta.url), "utf8"),
  ]);

  assert.equal((registerHtml.match(/minlength="12"/g) ?? []).length, 2);
  assert.equal((settingsHtml.match(/minlength="12"/g) ?? []).length, 2);
  assert.doesNotMatch(`${registerHtml}\n${settingsHtml}`, /minlength="8"/);
});

test("password minimum guidance is translated in every supported language", () => {
  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const key of [
      "password.too_short",
      "register.password_hint",
      "register.password_too_short",
    ]) {
      assert.match(dictionary[key], /12/, `${locale}.${key}`);
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  escapeHtml,
  toText,
} from "../src/utils/html.js";

test("converts nullable and primitive values to plain text", () => {
  assert.equal(toText(null), "");
  assert.equal(toText(undefined), "");
  assert.equal(toText(false), "false");
  assert.equal(toText(42), "42");
  assert.equal(toText("A & B < C"), "A & B < C");
});

test("escapes every character that can leave an HTML text or quoted attribute context", () => {
  const payload = `&<>"'`;
  const expected = "&amp;&lt;&gt;&quot;&#39;";

  assert.equal(escapeHtml(payload), expected);
});

test("renders executable-looking markup as inert encoded text", () => {
  const payload =
    `<img src=x onerror="globalThis.__xss=1">` +
    `<svg onload='globalThis.__xss=2'></svg>` +
    `<script>globalThis.__xss=3</script>`;
  const escaped = escapeHtml(payload);

  assert.doesNotMatch(escaped, /<(?:img|svg|script)\b/i);
  assert.match(escaped, /&lt;img /);
  assert.match(escaped, /&quot;globalThis\.__xss=1&quot;/);
  assert.match(escaped, /&#39;globalThis\.__xss=2&#39;/);
});

test("does not trust strings that already look like HTML entities", () => {
  assert.equal(escapeHtml("&lt;script&gt;"), "&amp;lt;script&amp;gt;");
});

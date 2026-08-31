import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nginxTemplate = readFileSync(
  new URL("../docker/nginx.conf.template", import.meta.url),
  "utf8"
);

test("keeps the /elettra redirect relative so Docker host ports are preserved", () => {
  assert.match(nginxTemplate, /absolute_redirect\s+off\s*;/);
  assert.match(
    nginxTemplate,
    /location\s*=\s*\/elettra\s*\{\s*return\s+301\s+\/elettra\/\s*;\s*\}/s
  );
});

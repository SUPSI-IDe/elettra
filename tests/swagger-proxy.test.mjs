import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("routes Swagger UI, its OAuth callback and the schema to the configured backend", () => {
  const template = readFileSync(new URL("../docker/nginx.conf.template", import.meta.url), "utf8");
  const config = template.replaceAll("${ESC}", () => "$").replaceAll("${API_BACKEND_URL}", "http://backend:8000");
  const routes = [...config.matchAll(/location ~ "([^"]+)"\s*\{([^}]+)\}/g)];
  const swagger = routes.find(([, pattern]) => new RegExp(pattern).test("/docs"));
  assert.ok(swagger, "Swagger UI must have a proxy route");
  const [, pattern, directives] = swagger;
  const route = new RegExp(pattern);
  assert.match(directives, /proxy_pass\s+http:\/\/backend:8000;/);
  for (const path of ["/docs", "/docs/oauth2-redirect", "/openapi.json"]) {
    assert.match(path, route);
  }
  for (const path of ["/docs/unrelated", "/docs-preview", "/openapiXjson", "/openapi.json.bak", "/elettra/docs"]) {
    assert.doesNotMatch(path, route);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCartoVoyagerTileUrl } from "../src/config/carto.js";

const dockerfile = readFileSync(
  new URL("../docker/Dockerfile", import.meta.url),
  "utf8"
);
const nginxTemplate = readFileSync(
  new URL("../docker/nginx.conf.template", import.meta.url),
  "utf8"
);
const runtimeConfigWriter = readFileSync(
  new URL("../docker/40-write-runtime-config.sh", import.meta.url),
  "utf8"
);

test("builds an authenticated CARTO Voyager raster tile URL", () => {
  assert.equal(
    buildCartoVoyagerTileUrl("test_key-1.2"),
    "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=test_key-1.2"
  );
});

test("URL-encodes a supplied CARTO key", () => {
  assert.equal(
    buildCartoVoyagerTileUrl("test key"),
    "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=test%20key"
  );
});

test("rejects a missing CARTO key", () => {
  assert.throws(
    () => buildCartoVoyagerTileUrl(""),
    /CARTO_API_KEY is required/
  );
});

test("production image writes uncached runtime CARTO configuration", () => {
  assert.match(dockerfile, /40-write-runtime-config\.sh/);
  assert.match(runtimeConfigWriter, /CARTO_API_KEY is required/);
  assert.match(
    nginxTemplate,
    /location\s*=\s*\/elettra\/runtime-config\.json[\s\S]*Cache-Control "no-store, no-cache, must-revalidate"/
  );
});

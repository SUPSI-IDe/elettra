import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nginxTemplate = readFileSync(
  new URL("../docker/nginx.conf.template", import.meta.url),
  "utf8",
);

const previewLocation = nginxTemplate.match(
  /location\s+~\s+"\^\/api\/v1\/agency\/agencies\/[\s\S]*?\/network-preview\$\{ESC\}"\s*\{([\s\S]*?)\n\s*\}/,
);

test("the public agency preview has a dedicated per-IP nginx rate limit", () => {
  assert.match(
    nginxTemplate,
    /limit_req_zone\s+\$\{ESC\}binary_remote_addr\s+zone=network_preview_per_ip:10m\s+rate=1r\/s;/,
  );
  assert.ok(previewLocation, "missing the dedicated network-preview location");
  assert.match(
    previewLocation[1],
    /limit_req\s+zone=network_preview_per_ip\s+burst=10\s+nodelay;/,
  );
  assert.match(previewLocation[1], /limit_req_status\s+429;/);
});

test("network previews share a bounded cache and collapse concurrent misses", () => {
  assert.match(
    nginxTemplate,
    /proxy_cache_path\s+\/var\/cache\/nginx\/network-preview[\s\S]*keys_zone=network_preview_cache:10m[\s\S]*max_size=64m[\s\S]*inactive=1h[\s\S]*use_temp_path=off;/,
  );
  assert.ok(previewLocation, "missing the dedicated network-preview location");
  assert.match(previewLocation[1], /proxy_cache\s+network_preview_cache;/);
  assert.match(previewLocation[1], /proxy_cache_lock\s+on;/);
  assert.match(previewLocation[1], /proxy_cache_background_update\s+on;/);
  assert.match(previewLocation[1], /proxy_cache_valid\s+200\s+1h;/);
  assert.match(previewLocation[1], /proxy_cache_valid\s+404\s+1m;/);
});

test("random query strings cannot bypass the agency-preview cache", () => {
  assert.ok(previewLocation, "missing the dedicated network-preview location");
  assert.match(previewLocation[1], /proxy_cache_key\s+\$\{ESC\}uri;/);
  assert.doesNotMatch(previewLocation[1], /proxy_cache_key[^;]*(?:args|request_uri)/);
});

test("the dedicated proxy keeps forwarding and response-security headers", () => {
  assert.ok(previewLocation, "missing the dedicated network-preview location");
  assert.match(previewLocation[1], /proxy_pass\s+\$\{API_BACKEND_URL\};/);
  assert.match(
    previewLocation[1],
    /proxy_set_header\s+X-Real-IP\s+\$\{ESC\}remote_addr;/,
  );
  assert.match(previewLocation[1], /add_header\s+X-Elettra-Cache/);
  assert.match(previewLocation[1], /add_header\s+X-Frame-Options\s+"SAMEORIGIN"/);
  assert.match(previewLocation[1], /add_header\s+X-Content-Type-Options\s+"nosniff"/);
});

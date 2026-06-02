import assert from "node:assert/strict";
import test from "node:test";

import { readDeleteResponse } from "../src/api/delete-response.js";

test("delete response helper rejects 405 instead of reporting deletion", async () => {
  const response = new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    () => readDeleteResponse(response, "Unable to delete optimization run."),
    /Method Not Allowed/
  );
});

test("delete response helper reports deletion only for successful responses", async () => {
  const response = new Response(null, { status: 204 });

  await assert.deepEqual(await readDeleteResponse(response), { deleted: true });
});

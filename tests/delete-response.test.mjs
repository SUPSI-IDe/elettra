import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE_ERROR_KIND,
  DeleteResponseError,
  formatDeleteErrorMessage,
  isBlockedDeleteError,
  isDeleteFailureError,
  parseDeletionBlockersFromDetail,
  readDeleteResponse,
} from "../src/api/delete-response.js";
import { DELETION_BLOCKER_TYPES } from "../src/utils/protected-delete.js";

test("delete response helper rejects 405 instead of reporting deletion", async () => {
  const response = new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    () => readDeleteResponse(response, "Unable to delete optimization run."),
    (error) => {
      assert.match(error.message, /Method Not Allowed/);
      assert.ok(error instanceof DeleteResponseError);
      assert.equal(error.status, 405);
      assert.equal(error.kind, DELETE_ERROR_KIND.FAILURE);
      assert.equal(isDeleteFailureError(error), true);
      assert.equal(isBlockedDeleteError(error), false);
      return true;
    }
  );
});

test("delete response helper reports deletion only for successful responses", async () => {
  const response = new Response(null, { status: 204 });

  await assert.deepEqual(await readDeleteResponse(response), { deleted: true });
});

test("delete response helper classifies 409 conflict as blocked deletion", async () => {
  const response = new Response(
    JSON.stringify({
      detail: {
        message: "Resource is still referenced.",
        blockers: [
          {
            type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
            id: "ya-1",
            name: "Scenario 2026",
          },
        ],
      },
    }),
    {
      status: 409,
      headers: { "content-type": "application/json" },
    }
  );

  await assert.rejects(
    () => readDeleteResponse(response, "Unable to delete resource."),
    (error) => {
      assert.ok(error instanceof DeleteResponseError);
      assert.equal(error.status, 409);
      assert.equal(error.kind, DELETE_ERROR_KIND.BLOCKED);
      assert.equal(isBlockedDeleteError(error), true);
      assert.deepEqual(error.blockers, [
        {
          type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
          id: "ya-1",
          name: "Scenario 2026",
        },
      ]);
      return true;
    }
  );
});

test("delete response helper preserves generic failure details", async () => {
  const response = new Response(
    JSON.stringify({ detail: [{ msg: "Database unavailable" }] }),
    {
      status: 503,
      headers: { "content-type": "application/json" },
    }
  );

  await assert.rejects(
    () => readDeleteResponse(response, "Unable to delete resource."),
    (error) => {
      assert.equal(error.message, "Database unavailable");
      assert.equal(error.status, 503);
      assert.equal(error.kind, DELETE_ERROR_KIND.FAILURE);
      return true;
    }
  );
});

test("parseDeletionBlockersFromDetail accepts array and wrapped payloads", () => {
  assert.deepEqual(
    parseDeletionBlockersFromDetail([
      { type: DELETION_BLOCKER_TYPES.SHIFT, id: "s-1", name: "Morning" },
    ]),
    [{ type: DELETION_BLOCKER_TYPES.SHIFT, id: "s-1", name: "Morning" }]
  );

  assert.deepEqual(
    parseDeletionBlockersFromDetail({
      blockers: [{ type: DELETION_BLOCKER_TYPES.BUS_MODEL, id: "bm-9" }],
    }),
    [{ type: DELETION_BLOCKER_TYPES.BUS_MODEL, id: "bm-9" }]
  );
});

test("formatDeleteErrorMessage returns message for delete errors", () => {
  const blocked = new DeleteResponseError("Still referenced.", {
    status: 409,
    kind: DELETE_ERROR_KIND.BLOCKED,
  });
  assert.equal(
    formatDeleteErrorMessage(blocked, "fallback"),
    "Still referenced."
  );

  assert.equal(
    formatDeleteErrorMessage(new Error("Network down"), "fallback"),
    "Network down"
  );
});

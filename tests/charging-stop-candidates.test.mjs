import assert from "node:assert/strict";
import test from "node:test";

import {
  chargingStopSelectionKey,
  createChargingStopCandidateLoader,
  normalizeChargingStopCandidate,
  normalizeChargingStopShiftIds,
} from "../src/pages/Simulation/Runs/charging-stop-candidates.js";

test("charging-stop selection keys are stable for the same normalized shift set", () => {
  assert.deepEqual(
    normalizeChargingStopShiftIds([" shift-b ", "shift-a", "shift-b", "", null]),
    ["shift-a", "shift-b"]
  );
  assert.equal(
    chargingStopSelectionKey(["shift-b", "shift-a"]),
    chargingStopSelectionKey(["shift-a", "shift-b", "shift-a"])
  );
});

test("charging-stop candidates map the backend contract to the existing form model", () => {
  assert.deepEqual(
    normalizeChargingStopCandidate({
      stop_id: " stop-1 ",
      stop_name: " Depot ",
      is_custom: true,
      is_depot: true,
      depot_bus_count: 2.9,
    }),
    {
      stop_id: "stop-1",
      stop_name: "Depot",
      isCustom: true,
      isDepot: true,
      depotBusCount: 2,
    }
  );
  assert.deepEqual(
    normalizeChargingStopCandidate({ stop_id: "stop-2", depot_bus_count: -4 }),
    {
      stop_id: "stop-2",
      stop_name: "stop-2",
      isCustom: false,
      isDepot: false,
      depotBusCount: 0,
    }
  );
});

test("the loader shares one in-flight request for equivalent shift selections", async () => {
  let resolveRequest;
  const calls = [];
  const signal = new AbortController().signal;
  const loader = createChargingStopCandidateLoader((shiftIds, options) => {
    calls.push({ shiftIds, signal: options.signal });
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  });

  const first = loader.load(["shift-b", "shift-a", "shift-a"], { signal });
  const second = loader.load(["shift-a", "shift-b"], { signal });

  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.deepEqual(calls, [{ shiftIds: ["shift-a", "shift-b"], signal }]);

  resolveRequest([{ stop_id: "stop-1", stop_name: "Depot" }]);
  assert.deepEqual(await first, [{
    stop_id: "stop-1",
    stop_name: "Depot",
    isCustom: false,
    isDepot: false,
    depotBusCount: 0,
  }]);
});

test("failed and aborted candidate requests are not cached", async () => {
  let callCount = 0;
  const loader = createChargingStopCandidateLoader(async () => {
    callCount += 1;
    if (callCount === 1) throw new Error("temporary failure");
    return [{ stop_id: "stop-retry" }];
  });

  await assert.rejects(loader.load(["shift-a"]), /temporary failure/);
  assert.equal(loader.has("shift-a"), false);
  assert.equal((await loader.load(["shift-a"]))[0].stop_id, "stop-retry");
  assert.equal(callCount, 2);
});

test("an obsolete rejection cannot evict a replacement request for the same selection", async () => {
  const pending = [];
  const loader = createChargingStopCandidateLoader(() => new Promise((resolve, reject) => {
    pending.push({ resolve, reject });
  }));

  const obsolete = loader.load(["shift-a"]);
  await Promise.resolve();
  loader.delete("shift-a");
  const replacement = loader.load(["shift-a"]);
  await Promise.resolve();

  pending[0].reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
  await assert.rejects(obsolete, { name: "AbortError" });
  assert.equal(loader.has("shift-a"), true);
  assert.strictEqual(loader.load(["shift-a"]), replacement);

  pending[1].resolve([{ stop_id: "current-stop" }]);
  assert.equal((await replacement)[0].stop_id, "current-stop");
});

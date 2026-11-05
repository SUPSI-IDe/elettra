import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const read = (path) => readFile(new URL(path, import.meta.url), "utf8");


test("forms use all-page helpers instead of invalid oversized list requests", async () => {
  const [shiftForm, evaluationForm, registration, customStops] =
    await Promise.all([
      read("../src/pages/Fleet/Shifts/shift-form.js"),
      read("../src/pages/Simulation/Runs/add-simulation.js"),
      read("../src/pages/Auth/register.js"),
      read("../src/pages/Fleet/Custom Stops/custom-stops.js"),
    ]);

  for (const source of [shiftForm, evaluationForm, registration, customStops]) {
    assert.doesNotMatch(source, /limit\s*:\s*(?:500|1000)\b/);
  }

  assert.match(shiftForm, /fetchAllBuses\(\)/);
  assert.match(shiftForm, /fetchAllDepots\(\)/);
  assert.doesNotMatch(shiftForm, /fetchServiceDays/);
  assert.match(evaluationForm, /fetchAllBuses\(\)/);
  assert.match(registration, /fetchAllAgencies\(\)/);
  assert.match(customStops, /fetchAllDepots\(\)/);
});

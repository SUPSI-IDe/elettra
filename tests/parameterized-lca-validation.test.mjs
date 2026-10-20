import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LCA_METHOD,
  mapParameterizedLca,
  validateParameterizedLca,
} from "../src/pages/Simulation/YearlyAnalysis/parameterized-lca.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/grid94-lca.json", import.meta.url), "utf8"),
).base;

const INDICATORS = [
  "gwp100a",
  "nox",
  "pm10",
  "primaryEnergy",
  "primaryEnergyNonRenewable",
];
const PHASES = [
  "direct",
  "directNonExhaust",
  "energyChain",
  "maintenance",
  "vehicle",
  "endOfLife",
  "infrastructure",
];

const candidate = mutation => {
  const value = structuredClone(fixture);
  mutation(value);
  return value;
};

const assertInvalid = (value, expectedIssue) => {
  const validation = validateParameterizedLca(value);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.issues.some(issue => issue.includes(expectedIssue)),
    `Expected an issue containing ${JSON.stringify(expectedIssue)}; got ${JSON.stringify(validation.issues)}`,
  );
  assert.throws(
    () => mapParameterizedLca(value),
    error => error instanceof Error && error.message.includes(expectedIssue),
  );
};

test("the canonical complete LCA passes validation and mapping without mutation", () => {
  const raw = structuredClone(fixture);
  const before = structuredClone(raw);

  assert.deepEqual(validateParameterizedLca(raw), { valid: true, issues: [] });
  const mapped = mapParameterizedLca(raw);

  assert.deepEqual(raw, before);
  assert.equal(mapped.rawLca, raw);
  assert.deepEqual(Object.keys(mapped.electricYearly), INDICATORS);
  assert.equal(mapped.yearlyDistanceKm, raw.annual_km);
});

test("additional backend indicators remain in the raw export but cannot alter mapped totals", () => {
  const raw = candidate(value => {
    value.indicators.futureIndicator = { untrusted: true };
  });

  assert.deepEqual(validateParameterizedLca(raw), { valid: true, issues: [] });
  const mapped = mapParameterizedLca(raw);
  assert.deepEqual(Object.keys(mapped.electricYearly), INDICATORS);
  assert.deepEqual(mapped.rawLca.indicators.futureIndicator, { untrusted: true });
});

test("explicitly incomplete responses preserve backend and vehicle reasons", () => {
  const raw = candidate(value => {
    value.status = "incomplete";
    value.reason = "Mobitool unavailable";
    value.vehicles[0].status = "incomplete";
    value.vehicles[0].reason = "Missing upstream phase";
  });

  const validation = validateParameterizedLca(raw);
  assert.deepEqual(validation, {
    valid: false,
    issues: ["Mobitool unavailable", "Missing upstream phase"],
  });
  assert.throws(
    () => mapParameterizedLca(raw),
    /Mobitool unavailable Missing upstream phase/,
  );

  assertInvalid(
    { methodology_version: LCA_METHOD, status: "incomplete", indicators: {}, vehicles: [] },
    "Incomplete parameterized LCA",
  );
});

test("the root contract requires the supported method, activity, fleet, provenance and limitations", () => {
  assertInvalid(null, "must be an object");
  assertInvalid([], "must be an object");

  const cases = [
    [value => { value.methodology_version = "unsupported"; }, "methodology_version"],
    [value => { value.annual_km = 0; }, "annual_km must be greater than zero"],
    [value => { value.annual_km = "60000"; }, "annual_km must be a finite number"],
    [value => { value.vehicle_count = 0; }, "vehicle_count must be a positive integer"],
    [value => { value.vehicle_count = 1.5; }, "vehicle_count must be a positive integer"],
    [value => { value.vehicles = null; }, "vehicles must be an array"],
    [value => { value.vehicle_count = 2; }, "vehicles length does not match vehicle_count"],
    [value => { value.provenance = null; }, "provenance must be an object"],
    [value => { value.provenance.data_version = ""; }, "provenance.data_version"],
    [value => { value.limitations = null; }, "limitations must be an array"],
    [value => { value.limitations = [""]; }, "limitations must contain only non-empty strings"],
  ];

  cases.forEach(([mutation, issue]) => assertInvalid(candidate(mutation), issue));
});

test("every required indicator and numeric channel is validated", () => {
  INDICATORS.forEach(key => {
    assertInvalid(candidate(value => { delete value.indicators[key]; }), `indicators.${key}`);
  });

  const numericFields = [
    "electricity_operation",
    "diesel_heating",
    "other_lifecycle",
    "total",
    "diesel_comparator_total",
  ];
  numericFields.forEach(field => {
    assertInvalid(
      candidate(value => { value.indicators.gwp100a[field] = Number.NaN; }),
      `indicators.gwp100a.${field} must be a finite number`,
    );
  });
  assertInvalid(
    candidate(value => { value.indicators.gwp100a.unit = ""; }),
    "indicators.gwp100a.unit",
  );
  assertInvalid(candidate(value => { value.indicators = null; }), "indicators must be an object");
});

test("all lifecycle phases are required and totals must reconcile", () => {
  for (const collection of ["phases", "diesel_comparator_phases", "diesel_heating_phases"]) {
    PHASES.forEach(phase => {
      assertInvalid(
        candidate(value => { delete value.indicators.gwp100a[collection][phase]; }),
        `indicators.gwp100a.${collection}.${phase}`,
      );
    });
  }

  const reconciliations = [
    [
      value => { value.indicators.gwp100a.phases.direct += 1_000; },
      "phases do not sum to total",
    ],
    [
      value => { value.indicators.gwp100a.diesel_comparator_phases.direct += 1_000; },
      "diesel_comparator_phases do not sum to diesel_comparator_total",
    ],
    [
      value => { value.indicators.gwp100a.diesel_heating_phases.direct += 1_000; },
      "diesel_heating_phases do not sum to diesel_heating",
    ],
    [
      value => { value.indicators.gwp100a.electricity_operation += 1_000; },
      "components do not sum to total",
    ],
    [
      value => { value.indicators.gwp100a.saving = 0; },
      "saving does not match diesel_comparator_total minus total",
    ],
  ];
  reconciliations.forEach(([mutation, issue]) => assertInvalid(candidate(mutation), issue));
});

test("finite signed lifecycle bookkeeping remains valid when all reconciliations hold", () => {
  const raw = candidate(value => {
    const indicator = value.indicators.gwp100a;
    indicator.phases.directNonExhaust = -10;
    indicator.other_lifecycle -= 10;
    indicator.total -= 10;
  });

  assert.deepEqual(validateParameterizedLca(raw), { valid: true, issues: [] });
  assert.equal(mapParameterizedLca(raw).electricYearly.gwp100a.directNonExhaust, -10);
});

test("the grid-energy boundary enforces policy, finite quantities, 94 percent and reconciliation", () => {
  const cases = [
    [value => { value.energy_boundary = null; }, "energy_boundary must be an object"],
    [value => { value.energy_boundary.policy = "other"; }, "energy_boundary.policy"],
    [value => { value.energy_boundary.dc_kwh = -1; }, "energy_boundary.dc_kwh must be non-negative"],
    [value => { value.energy_boundary.grid_kwh = Infinity; }, "energy_boundary.grid_kwh must be a finite number"],
    [value => { value.energy_boundary.charging_losses_kwh = -1; }, "charging_losses_kwh must be non-negative"],
    [value => { value.energy_boundary.grid_to_bus_efficiency = 0.8; }, "grid_to_bus_efficiency must be 0.94"],
    [
      value => {
        value.energy_boundary.grid_kwh = value.energy_boundary.dc_kwh - 1;
        value.energy_boundary.charging_losses_kwh = 0;
      },
      "grid_kwh must not be lower than dc_kwh",
    ],
    [
      value => { value.energy_boundary.grid_kwh += 100; },
      "DC and grid energy do not match",
    ],
    [
      value => { value.energy_boundary.charging_losses_kwh += 100; },
      "charging losses do not match",
    ],
  ];
  cases.forEach(([mutation, issue]) => assertInvalid(candidate(mutation), issue));

  const zeroEnergy = candidate(value => {
    value.energy_boundary.dc_kwh = 0;
    value.energy_boundary.grid_kwh = 0;
    value.energy_boundary.charging_losses_kwh = 0;
    value.vehicles[0].dc_kwh = 0;
  });
  assert.deepEqual(validateParameterizedLca(zeroEnergy), { valid: true, issues: [] });
});

test("every physical vehicle field is validated", () => {
  ["shift_id", "reference_size", "battery_chemistry", "electricity_mix"].forEach(field => {
    assertInvalid(
      candidate(value => { value.vehicles[0][field] = ""; }),
      `vehicles[0].${field}`,
    );
  });
  [
    "bus_length_m",
    "battery_capacity_kwh",
    "lifetime_bus",
    "lifetime_battery",
    "lifetime_diesel_bus",
    "annual_km",
  ].forEach(field => {
    assertInvalid(
      candidate(value => { value.vehicles[0][field] = 0; }),
      `vehicles[0].${field} must be greater than zero`,
    );
  });
  ["dc_kwh", "diesel_heating_liters", "passengers"].forEach(field => {
    assertInvalid(
      candidate(value => { value.vehicles[0][field] = -1; }),
      `vehicles[0].${field} must be non-negative`,
    );
  });

  assertInvalid(
    candidate(value => { value.vehicles[0].status = "incomplete"; }),
    "vehicles[0].status must be complete",
  );
  assertInvalid(
    candidate(value => { value.vehicles[0].warnings = [""]; }),
    "vehicles[0].warnings",
  );
  assertInvalid(candidate(value => { value.vehicles[0] = null; }), "vehicles[0] must be an object");
});

test("fleet activity and DC energy must reconcile with vehicle aggregates", () => {
  assertInvalid(
    candidate(value => { value.vehicles[0].annual_km -= 1; }),
    "vehicle annual_km values do not sum to annual_km",
  );
  assertInvalid(
    candidate(value => { value.vehicles[0].dc_kwh -= 1; }),
    "vehicle dc_kwh values do not sum to energy_boundary.dc_kwh",
  );
});

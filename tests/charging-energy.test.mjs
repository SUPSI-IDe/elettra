import assert from "node:assert/strict";
import test from "node:test";

import { translations } from "../src/i18n/translations.js";
import {
  buildChargingEnergyBoundary,
  CHARGING_ENERGY_POLICY,
  GRID_TO_BUS_EFFICIENCY,
  gridFromDc,
  validateChargingEnergyBoundary,
} from "../src/utils/charging-energy.js";

const completeBoundary = (overrides = {}) => ({
  policy: CHARGING_ENERGY_POLICY,
  dc_kwh: 94,
  grid_kwh: 100,
  charging_losses_kwh: 6,
  grid_to_bus_efficiency: GRID_TO_BUS_EFFICIENCY,
  ...overrides,
});

test("the reporting boundary always converts DC energy at the fixed 94% efficiency", () => {
  assert.equal(gridFromDc(0), 0);
  assert.equal(gridFromDc(94), 100);
  assert.ok(Math.abs(gridFromDc(150) - 159.5744680851064) < 1e-10);

  assert.deepEqual(buildChargingEnergyBoundary(94), {
    policy: CHARGING_ENERGY_POLICY,
    dcKwh: 94,
    gridKwh: 100,
    chargingLossesKwh: 6,
    gridToBusEfficiency: GRID_TO_BUS_EFFICIENCY,
  });
});

test("invalid DC quantities cannot silently become purchased electricity", () => {
  for (const value of [null, undefined, "", -1, Infinity, -Infinity, NaN, true, false, {}, []]) {
    assert.throws(() => gridFromDc(value), /Invalid DC energy\/power/);
    assert.throws(() => buildChargingEnergyBoundary(value), /Invalid DC energy\/power/);
  }
});

test("a complete backend boundary is validated and scales its DC, grid and loss values together", () => {
  const source = completeBoundary();
  const snapshot = structuredClone(source);

  assert.equal(validateChargingEnergyBoundary(source).valid, true);
  assert.deepEqual(buildChargingEnergyBoundary(188, { boundary: source }), {
    policy: CHARGING_ENERGY_POLICY,
    dcKwh: 188,
    gridKwh: 200,
    chargingLossesKwh: 12,
    gridToBusEfficiency: GRID_TO_BUS_EFFICIENCY,
  });
  assert.deepEqual(source, snapshot, "the upstream response must not be mutated");
});

test("a backend boundary must describe the source DC quantity before scaling", () => {
  assert.equal(
    buildChargingEnergyBoundary(188, {
      boundary: completeBoundary(),
      boundaryDcEnergyKwh: 94,
    }).gridKwh,
    200,
  );
  assert.throws(
    () => buildChargingEnergyBoundary(188, {
      boundary: completeBoundary(),
      boundaryDcEnergyKwh: 95,
    }),
    /dc_kwh does not match its source energy/,
  );
});

test("missing legacy boundaries are derived locally, including zero energy", () => {
  for (const boundary of [undefined, null, {}]) {
    assert.deepEqual(buildChargingEnergyBoundary(0, { boundary }), {
      policy: CHARGING_ENERGY_POLICY,
      dcKwh: 0,
      gridKwh: 0,
      chargingLossesKwh: 0,
      gridToBusEfficiency: GRID_TO_BUS_EFFICIENCY,
    });
    assert.equal(buildChargingEnergyBoundary(94, { boundary }).gridKwh, 100);
  }
});

test("malformed or contradictory backend boundaries are rejected", () => {
  const invalidBoundaries = [
    "not-an-object",
    [],
    completeBoundary({ policy: "another-policy" }),
    completeBoundary({ dc_kwh: undefined }),
    completeBoundary({ dc_kwh: -1 }),
    completeBoundary({ grid_kwh: Infinity }),
    completeBoundary({ grid_kwh: 90 }),
    completeBoundary({ charging_losses_kwh: -1 }),
    completeBoundary({ charging_losses_kwh: 5 }),
    completeBoundary({ grid_to_bus_efficiency: 0 }),
    completeBoundary({ grid_to_bus_efficiency: 0.8 }),
    completeBoundary({ grid_to_bus_efficiency: 1 }),
    completeBoundary({ dc_kwh: 93 }),
  ];

  for (const boundary of invalidBoundaries) {
    const validation = validateChargingEnergyBoundary(boundary);
    assert.equal(validation.valid, false, JSON.stringify(boundary));
    assert.ok(validation.issues.length > 0);
    assert.throws(
      () => buildChargingEnergyBoundary(94, { boundary }),
      /Invalid charging energy boundary/,
    );
  }
});

test("a zero backend boundary cannot be scaled to positive DC energy", () => {
  const zeroBoundary = completeBoundary({
    dc_kwh: 0,
    grid_kwh: 0,
    charging_losses_kwh: 0,
  });

  assert.equal(buildChargingEnergyBoundary(0, { boundary: zeroBoundary }).gridKwh, 0);
  assert.throws(
    () => buildChargingEnergyBoundary(1, { boundary: zeroBoundary }),
    /zero DC boundary cannot scale positive energy/,
  );
});

test("all locales explain the DC, grid and charging-loss boundary", () => {
  const requiredKeys = [
    "yearly_analysis.grid_energy_short",
    "yearly_analysis.charging_losses_short",
    "yearly_analysis.annual_grid_energy_kwh",
    "yearly_analysis.annual_charging_losses_kwh",
  ];
  const tooltipPlaceholders = [
    "{count}",
    "{dcEnergy}",
    "{gridEnergy}",
    "{chargingLosses}",
    "{efficiency}",
    "{average}",
    "{price}",
  ];

  for (const locale of ["en", "de", "fr", "it"]) {
    for (const key of requiredKeys) {
      assert.equal(typeof translations[locale][key], "string", `${locale}: ${key}`);
      assert.ok(translations[locale][key].length > 0, `${locale}: ${key}`);
    }
    for (const placeholder of tooltipPlaceholders) {
      assert.ok(
        translations[locale]["yearly_analysis.energy_cost_tooltip"].includes(placeholder),
        `${locale}: missing ${placeholder}`,
      );
    }
    assert.ok(translations[locale]["yearly_analysis.energy_cost_note"].includes("{efficiency}"));
    assert.ok(translations[locale]["yearly_analysis.energy_cost_note"].includes("{price}"));
  }
});

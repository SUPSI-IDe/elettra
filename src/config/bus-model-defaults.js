/**
 * Default spec values for adding a new bus model.
 *
 * Keeping these in config avoids scattering business defaults across UI code.
 */

export const BUS_MODEL_LENGTH_OPTIONS = ["9", "13", "18"];

// INFRAS, 04.12.2025, table 11, p. 45 (2030 acquisition assumptions).
// Use the vehicle component without the battery: ELETTRA adds packs separately.
// The body costs are identical in the slow/rapid battery-development scenarios.
export const INFRAS_BUS_COST_REFERENCE = Object.freeze({
  url: "https://www.infras.ch/media/filer_public/86/db/86dbb9ed-9fc1-482e-85ca-a9f36f3da3b8/3954a_umweltbilanz_h2-busse_schlussbericht.pdf#page=45",
  publicationDate: '2025-12-04',
  referenceYear: 2030,
  table: 11,
  page: 45,
  standardLengthM: 12,
  standardBodyChf: 338375,
  articulatedBodyChf: 474032,
  // Slow battery-development scenario; initial packs, not replacement packs.
  batteryChfPerKwh: 257,
});
const DEFAULT_PACK_SIZE_KWH = 40;
const DEFAULT_PACK_COST_CHF = DEFAULT_PACK_SIZE_KWH * INFRAS_BUS_COST_REFERENCE.batteryChfPerKwh;

const BUS_MODEL_DEFAULTS_BY_LENGTH = {
  "9": {
    cost: Math.round(INFRAS_BUS_COST_REFERENCE.standardBodyChf * 9 / INFRAS_BUS_COST_REFERENCE.standardLengthM),
    max_passengers: 55,
    empty_weight_kg: 9875,
    max_battery_packs: 8,
    min_battery_packs: 5,
    battery_pack_size_kwh: DEFAULT_PACK_SIZE_KWH,
    battery_pack_cost_chf: DEFAULT_PACK_COST_CHF,
    max_charging_power_kw: 300,
    battery_pack_weight_kg: 274,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
  "13": {
    cost: INFRAS_BUS_COST_REFERENCE.standardBodyChf,
    max_passengers: 85,
    empty_weight_kg: 12750,
    max_battery_packs: 11,
    min_battery_packs: 7,
    battery_pack_size_kwh: DEFAULT_PACK_SIZE_KWH,
    battery_pack_cost_chf: DEFAULT_PACK_COST_CHF,
    max_charging_power_kw: 450,
    battery_pack_weight_kg: 274,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
  "18": {
    cost: INFRAS_BUS_COST_REFERENCE.articulatedBodyChf,
    max_passengers: 120,
    empty_weight_kg: 16325,
    max_battery_packs: 16,
    min_battery_packs: 12,
    battery_pack_size_kwh: DEFAULT_PACK_SIZE_KWH,
    battery_pack_cost_chf: DEFAULT_PACK_COST_CHF,
    max_charging_power_kw: 450,
    battery_pack_weight_kg: 274,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
};

export const getBusModelDefaultsForLength = (length) => {
  if (length == null) return null;
  const key = String(length).trim();
  return BUS_MODEL_DEFAULTS_BY_LENGTH[key] || null;
};

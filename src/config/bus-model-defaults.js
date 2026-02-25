/**
 * Default spec values for adding a new bus model.
 *
 * Keeping these in config avoids scattering business defaults across UI code.
 */

export const BUS_MODEL_LENGTH_OPTIONS = ["9", "12", "18"];

const BUS_MODEL_DEFAULTS_BY_LENGTH = {
  "9": {
    cost: 450000,
    max_passengers: 55,
    empty_weight_kg: 12000,
    max_battery_packs: 8,
    min_battery_packs: 4,
    battery_pack_size_kwh: 37,
    max_charging_power_kw: 300,
    battery_pack_weight_kg: 253,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
  "12": {
    cost: 600000,
    max_passengers: 85,
    empty_weight_kg: 14000,
    max_battery_packs: 10,
    min_battery_packs: 6,
    battery_pack_size_kwh: 37,
    max_charging_power_kw: 450,
    battery_pack_weight_kg: 253,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
  "18": {
    cost: 800000,
    max_passengers: 120,
    empty_weight_kg: 18000,
    max_battery_packs: 14,
    min_battery_packs: 10,
    battery_pack_size_kwh: 37,
    max_charging_power_kw: 450,
    battery_pack_weight_kg: 253,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
};

export const getBusModelDefaultsForLength = (length) => {
  if (length == null) return null;
  const key = String(length).trim();
  return BUS_MODEL_DEFAULTS_BY_LENGTH[key] || null;
};


/**
 * Default spec values for adding a new bus model.
 *
 * Keeping these in config avoids scattering business defaults across UI code.
 */

const BUS_MODEL_DEFAULTS_BY_LENGTH = {
  "9": {
    empty_weight_kg: 9875,
    max_battery_packs: 8,
    min_battery_packs: 5,
    battery_pack_size_kwh: 40,
    max_charging_power_kw: 300,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
  "13": {
    empty_weight_kg: 12750,
    max_battery_packs: 11,
    min_battery_packs: 7,
    battery_pack_size_kwh: 40,
    max_charging_power_kw: 450,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
  "18": {
    empty_weight_kg: 16325,
    max_battery_packs: 16,
    min_battery_packs: 12,
    battery_pack_size_kwh: 40,
    max_charging_power_kw: 450,
    battery_pack_lifetime: 8,
    bus_lifetime: 12,
  },
};

export const getBusModelDefaultsForLength = (length) => {
  if (length == null) return null;
  const key = String(length).trim();
  return BUS_MODEL_DEFAULTS_BY_LENGTH[key] || null;
};

export const ESTIMATED_SPEC_FIELDS = ["cost", "battery_pack_cost_chf", "battery_pack_weight_kg"];

export const estimateBusSpecs = (defaults, length, capacity, chemistry) => {
  const estimates = {};
  const points = defaults?.bus_body_price_points;
  const cents = value => Math.round(value * 100) / 100;
  if (length >= 9 && length <= 19 && points?.length >= 2) {
    const end = points.findIndex((point, index) => index > 0 && length <= point.length_m);
    const right = end < 0 ? points.length - 1 : end;
    const a = points[right - 1];
    const b = points[right];
    estimates.cost = cents(a.cost_chf + (length - a.length_m) *
      (b.cost_chf - a.cost_chf) / (b.length_m - a.length_m));
  }
  const battery = defaults?.battery_chemistries?.[chemistry];
  if (battery && capacity > 0) {
    estimates.battery_pack_weight_kg = cents(capacity * battery.kg_per_kwh);
    estimates.battery_pack_cost_chf = cents(capacity * battery.cost_per_kwh);
  }
  return estimates;
};

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
    bus_lifetime: 12,
    battery_pack_lifetime: 8,
    buses_maintenance: 0.3,
  },
  "12": {
    cost: 600000,
    max_passengers: 85,
    bus_lifetime: 12,
    battery_pack_lifetime: 8,
    buses_maintenance: 0.35,
  },
  "18": {
    cost: 800000,
    max_passengers: 145,
    bus_lifetime: 12,
    battery_pack_lifetime: 8,
    buses_maintenance: 0.4,
  },
};

export const getBusModelDefaultsForLength = (length) => {
  if (length == null) return null;
  const key = String(length).trim();
  return BUS_MODEL_DEFAULTS_BY_LENGTH[key] || null;
};


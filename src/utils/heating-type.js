const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim().toLowerCase();

export const normalizeAuxiliaryHeatingType = (value) => {
  const normalized = text(value);
  if (["default", "hp", "heat_pump", "heat-pump"].includes(normalized)) {
    return "heat_pump";
  }
  if (["diesel", "ebus-dh", "diesel_heater", "diesel-heater"].includes(normalized)) {
    return "diesel";
  }
  if (normalized === "electric") return "electric";
  return normalized || null;
};

export const getAuxiliaryHeatingTranslationKey = (value) => {
  const normalized = normalizeAuxiliaryHeatingType(value);
  return {
    heat_pump: "simulation.heating_hp",
    diesel: "simulation.heating_diesel",
    electric: "simulation.heating_electric",
  }[normalized] ?? null;
};

const EQUIVALENT_DIESEL_BUS_CAPEX_BY_LENGTH = {
  "9": 170000,
  "12": 250000,
  "18": 380000,
};

export const DEFAULT_OPEX_ANNUALIZATION_RATE = 0.1;
export const DEFAULT_BUS_LIFETIME_YEARS = 12;
export const DEFAULT_BATTERY_LIFETIME_YEARS = 8;

const normalizeBusLengthKey = (length) => {
  if (length === null || length === undefined || length === "") return null;

  const numeric = Number(length);
  if (Number.isFinite(numeric)) {
    return String(numeric);
  }

  const trimmed = String(length).trim();
  return trimmed || null;
};

export const getEquivalentDieselBusCapexForLength = (length) => {
  const key = normalizeBusLengthKey(length);
  if (!key) return null;
  return EQUIVALENT_DIESEL_BUS_CAPEX_BY_LENGTH[key] ?? null;
};

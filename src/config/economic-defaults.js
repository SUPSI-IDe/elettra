const EQUIVALENT_DIESEL_BUS_CAPEX_BY_LENGTH = {
  "9": 280000,
  "12": 350000,
  "18": 500000,
};

export const DEFAULT_OPEX_ANNUALIZATION_RATE = 0.03;
export const DEFAULT_BUS_LIFETIME_YEARS = 12;
export const DEFAULT_DIESEL_BUS_LIFETIME_YEARS = 10;
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

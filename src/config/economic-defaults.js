const EQUIVALENT_DIESEL_BUS_CAPEX_BY_LENGTH = {
  "9": 160000,
  "12": 240000,
  "18": 330000,
};

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


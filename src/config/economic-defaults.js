const EQUIVALENT_DIESEL_BUS_CAPEX_BY_LENGTH = {
  "9": 280000,
  "12": 350000,
  "13": 385000,
  "18": 500000,
};

export const ELECTRIC_MAINT_BASE = Object.freeze({
  intercept: 0.12,
  slope: 0.0147,
});

export const DIESEL_MAINT_BASE = Object.freeze({
  intercept: 0.14,
  slope: 0.02,
});

export const DIESEL_CONSUMPTION_BASE = Object.freeze({
  intercept: 0.1918,
  slope: 0.02,
});

const BUS_PARAMETER_DEFAULTS = {
  9: {
    diesel_consumption_l_per_km: { default: 0.34, min: 0.26, max: 0.42 },
    diesel_maintenance_chf_per_km: { default: 0.30, min: 0.22, max: 0.40 },
    electric_maintenance_chf_per_km: { default: 0.30, min: 0.24, max: 0.38 },
  },
  12: {
    diesel_consumption_l_per_km: { default: 0.42, min: 0.34, max: 0.50 },
    diesel_maintenance_chf_per_km: { default: 0.37, min: 0.28, max: 0.48 },
    electric_maintenance_chf_per_km: { default: 0.35, min: 0.28, max: 0.42 },
  },
  18: {
    diesel_consumption_l_per_km: { default: 0.55, min: 0.45, max: 0.70 },
    diesel_maintenance_chf_per_km: { default: 0.45, min: 0.34, max: 0.60 },
    electric_maintenance_chf_per_km: { default: 0.40, min: 0.32, max: 0.48 },
  },
};

export const getBusParameterDefaults = (length) => {
  const key = Number(length);
  return BUS_PARAMETER_DEFAULTS[key] ?? BUS_PARAMETER_DEFAULTS[12];
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

export const evalLinearModel = (length, intercept, slope) =>
  intercept + slope * length;

export const rescaleLinearModelFromAnchor = (
  selectedLength,
  userValue,
  baseIntercept,
  baseSlope
) => {
  const defaultValueAtSelectedLength =
    baseIntercept + baseSlope * selectedLength;

  if (
    !Number.isFinite(defaultValueAtSelectedLength) ||
    defaultValueAtSelectedLength === 0
  ) {
    return {
      intercept: baseIntercept,
      slope: baseSlope,
      scale: 1,
      defaultValueAtSelectedLength: defaultValueAtSelectedLength || 0,
    };
  }

  const scale = userValue / defaultValueAtSelectedLength;

  return {
    intercept: scale * baseIntercept,
    slope: scale * baseSlope,
    scale,
    defaultValueAtSelectedLength,
  };
};

export const getEquivalentDieselBusCapexForLength = (length) => {
  const key = normalizeBusLengthKey(length);
  if (!key) return null;
  return EQUIVALENT_DIESEL_BUS_CAPEX_BY_LENGTH[key] ?? null;
};

export const getDieselEfficiencyForLength = (length) => {
  const defaults = getBusParameterDefaults(length);
  return defaults.diesel_consumption_l_per_km.default;
};

export const getDieselMaintenanceCostForLength = (length) => {
  const defaults = getBusParameterDefaults(length);
  return defaults.diesel_maintenance_chf_per_km.default;
};

export const getElectricMaintenanceCostForLength = (length) => {
  const defaults = getBusParameterDefaults(length);
  return defaults.electric_maintenance_chf_per_km.default;
};

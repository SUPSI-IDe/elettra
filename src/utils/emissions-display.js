const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const GRAMS_PER_TONNE = 1_000_000;

export const buildAnnualCo2DisplayMetrics = (totalGrams, yearlyDistanceKm) => {
  const total = toFiniteNumber(totalGrams);
  const distance = toFiniteNumber(yearlyDistanceKm);

  return {
    totalTonnes: total != null ? total / GRAMS_PER_TONNE : null,
    gramsPerKm:
      total != null && distance != null && distance > 0
        ? total / distance
        : null,
  };
};

const DISPLAY_DEFINITIONS = {
  gwp100a: { divisor: GRAMS_PER_TONNE, unit: "t/year", decimals: 1 },
  co2: { divisor: GRAMS_PER_TONNE, unit: "t/year", decimals: 1 },
  nox: { divisor: 1_000_000, unit: "kg/year", decimals: 1 },
  pm10: { divisor: 1_000_000, unit: "kg/year", decimals: 2 },
  primaryEnergy: { divisor: 1_000, unit: "GJ/year", decimals: 1 },
  primaryEnergyNonRenewable: { divisor: 1_000, unit: "GJ/year", decimals: 1 },
};

export const getEmissionDisplayDefinition = (key) =>
  DISPLAY_DEFINITIONS[key] ?? null;

export const convertEmissionIndicatorForDisplay = (key, value) => {
  const numericValue = toFiniteNumber(value);
  const definition = getEmissionDisplayDefinition(key);

  if (numericValue == null) {
    return {
      value: null,
      unit: definition?.unit ?? "",
      decimals: definition?.decimals ?? 1,
    };
  }

  return {
    value: definition ? numericValue / definition.divisor : numericValue,
    unit: definition?.unit ?? "",
    decimals: definition?.decimals ?? 1,
  };
};

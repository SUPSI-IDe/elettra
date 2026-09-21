export const parseYearlyDistanceKm = (value) => {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
};

export const resolveYearlyDistanceKm = (overrideKm, ...fallbackCandidates) => {
  const override = parseYearlyDistanceKm(overrideKm);
  if (override != null) return override;

  for (const candidate of fallbackCandidates) {
    const fallback = parseYearlyDistanceKm(candidate);
    if (fallback != null) return fallback;
  }

  return null;
};

export const buildYearlyDistanceSliderBounds = (
  distanceKm,
  boundStepKm = 10_000,
) => {
  const base = parseYearlyDistanceKm(distanceKm);
  const boundStep = parseYearlyDistanceKm(boundStepKm);
  if (base == null || boundStep == null) return null;

  let min = Math.round((base * 0.5) / boundStep) * boundStep;
  let max = Math.round((base * 1.8) / boundStep) * boundStep;

  if (min <= 0) min = Math.max(Number.EPSILON, base * 0.5);
  if (min >= base) {
    min = base > 1 ? Math.max(1, Math.floor(base - 1)) : base * 0.5;
  }
  if (max <= base) {
    max = Math.ceil((base + 1) / boundStep) * boundStep;
  }

  return { min, max, step: base >= 1 ? 1 : Math.max(Number.EPSILON, base / 100) };
};

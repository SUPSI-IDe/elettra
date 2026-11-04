const positiveInteger = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

export const batteryPackLimits = (specs) => {
  const min = positiveInteger(specs?.min_battery_packs);
  const max = positiveInteger(specs?.max_battery_packs);
  return min !== null && max !== null && min <= max ? { min, max } : null;
};

export const defaultBatteryPacks = (limits) => limits
  ? limits.min + Math.round((limits.max - limits.min) / 2)
  : null;

export const batteryPackValidation = (value, limits) => {
  if (!limits) return "unavailable";
  if (value == null || String(value).trim() === "") return "required";
  const packs = Number(value);
  if (!Number.isSafeInteger(packs)) return "integer";
  if (packs < limits.min) return "below_min";
  if (packs > limits.max) return "above_max";
  return null;
};

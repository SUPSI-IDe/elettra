const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const firstText = (...values) => {
  for (const value of values) {
    const candidate = text(value).trim();
    if (candidate) {
      return candidate;
    }
  }

  return "";
};

/**
 * @typedef {Object} OptimizationRunInputParams
 * @property {string=} name
 */

export const normalizeOptimizationRunName = (value) => text(value).trim();

export const getOptimizationRunName = (run = {}, fallbackName = "") =>
  firstText(
    run?.input_params?.name,
    run?.inputParams?.name,
    run?.name,
    fallbackName
  );

export const getOptimizationRunDisplayName = (
  run = {},
  fallbackDisplayName = ""
) => getOptimizationRunName(run) || normalizeOptimizationRunName(fallbackDisplayName);

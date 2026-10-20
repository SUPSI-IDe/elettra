export const PARAMETERIZED_LCA_ERROR = "Unable to load parameterized LCA.";

const nonEmptyText = value =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function buildYearlyAnalysisLcaUrl(basePath, id, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value != null && value !== "") query.set(key, String(value));
  });
  const suffix = query.toString();
  return `${basePath}/${encodeURIComponent(id)}/lca${suffix ? `?${suffix}` : ""}`;
}

export function parameterizedLcaErrorMessage(
  payload,
  fallback = PARAMETERIZED_LCA_ERROR,
) {
  const detail = payload?.detail;
  const directMessage = nonEmptyText(detail);
  if (directMessage) return directMessage;

  if (Array.isArray(detail)) {
    const validationMessage = detail
      .map(item => nonEmptyText(item?.msg))
      .find(Boolean);
    if (validationMessage) return validationMessage;
  }

  return fallback;
}

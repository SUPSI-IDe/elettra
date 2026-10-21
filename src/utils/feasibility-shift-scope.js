const text = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const uniqueTexts = (values = []) => [
  ...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean)),
];

const firstText = (...values) => {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
};

const sortablePackCount = (value) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return Number.MAX_SAFE_INTEGER;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
};

export const normalizeShiftSelection = (options = {}) => ({
  shiftId: firstText(options?.selectedShiftId, options?.shiftId),
  shiftName: firstText(options?.selectedShiftName, options?.shiftName),
});

export const hasShiftSelection = (options = {}) => {
  const selection = normalizeShiftSelection(options);
  return Boolean(selection.shiftId || selection.shiftName);
};

export const matchesShiftRecord = (
  record = {},
  fallbackShiftId = "",
  options = {}
) => {
  const selection = normalizeShiftSelection(options);
  if (!selection.shiftId && !selection.shiftName) return true;

  const explicitShiftId = firstText(record?.shift_id, record?.shiftId);
  const recordShiftId = explicitShiftId || text(fallbackShiftId);

  // An identifier is authoritative. A matching name must never make a record
  // belonging to another shift appear in the selected shift.
  if (selection.shiftId) {
    return Boolean(recordShiftId && recordShiftId === selection.shiftId);
  }

  const recordShiftName = firstText(record?.shift_name, record?.shiftName);
  return Boolean(
    selection.shiftName &&
      recordShiftName &&
      recordShiftName === selection.shiftName
  );
};

export const resolvePredictionRunShiftIds = (predictionRun = {}) => {
  const directId = firstText(
    predictionRun?.shift_id,
    predictionRun?.shiftId,
    predictionRun?.summary?.shift_id,
    predictionRun?.summary?.shiftId,
    predictionRun?.contextual_parameters?.shift_id,
    predictionRun?.contextual_parameters?.shiftId
  );
  if (directId) return [directId];

  const idLists = [
    predictionRun?.shift_ids,
    predictionRun?.shiftIds,
    predictionRun?.summary?.shift_ids,
    predictionRun?.summary?.shiftIds,
    predictionRun?.contextual_parameters?.shift_ids,
    predictionRun?.contextual_parameters?.shiftIds,
  ];

  return uniqueTexts(idLists.flatMap((value) =>
    Array.isArray(value) ? value : []
  ));
};

export const resolvePredictionRunShiftNames = (predictionRun = {}) => {
  const directName = firstText(
    predictionRun?.shift_name,
    predictionRun?.shiftName,
    predictionRun?.summary?.shift_name,
    predictionRun?.summary?.shiftName,
    predictionRun?.contextual_parameters?.shift_name,
    predictionRun?.contextual_parameters?.shiftName
  );
  if (directName) return [directName];

  const nameLists = [
    predictionRun?.shift_names,
    predictionRun?.shiftNames,
    predictionRun?.summary?.shift_names,
    predictionRun?.summary?.shiftNames,
    predictionRun?.contextual_parameters?.shift_names,
    predictionRun?.contextual_parameters?.shiftNames,
  ];

  return uniqueTexts(nameLists.flatMap((value) =>
    Array.isArray(value) ? value : []
  ));
};

export const matchesPredictionRunShift = (predictionRun = {}, options = {}) => {
  const selection = normalizeShiftSelection(options);
  if (!selection.shiftId && !selection.shiftName) return true;

  const runShiftIds = resolvePredictionRunShiftIds(predictionRun);
  if (selection.shiftId) {
    // A result that combines multiple physical shifts cannot safely be shown
    // as the result of any one of them.
    return runShiftIds.length === 1 && runShiftIds[0] === selection.shiftId;
  }

  const runShiftNames = resolvePredictionRunShiftNames(predictionRun);
  return (
    runShiftNames.length === 1 && runShiftNames[0] === selection.shiftName
  );
};

export const scopePredictionRunsByShift = (predictionRuns = [], options = {}) => {
  const runs = Array.isArray(predictionRuns) ? predictionRuns : [];
  const scopedRuns = hasShiftSelection(options)
    ? runs.filter((run) => matchesPredictionRunShift(run, options))
    : runs;

  return [...scopedRuns].sort((left, right) => {
    const leftPacks = sortablePackCount(
      left?.contextual_parameters?.num_battery_packs
    );
    const rightPacks = sortablePackCount(
      right?.contextual_parameters?.num_battery_packs
    );
    return leftPacks - rightPacks;
  });
};

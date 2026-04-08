import { getCurrentUserId } from "../../../store";

const LEGACY_STORAGE_KEY = "elettra_yearly_analyses";
const USER_STORAGE_KEY_PREFIX = `${LEGACY_STORAGE_KEY}:user:`;

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const getCurrentOwnerId = () => text(getCurrentUserId()).trim();

const storageKeyForOwner = (ownerId) =>
  ownerId ? `${USER_STORAGE_KEY_PREFIX}${encodeURIComponent(ownerId)}` : "";

const generateId = () =>
  "ya-" +
  Date.now().toString(36) +
  "-" +
  Math.random().toString(36).slice(2, 8);

const parseStoredAnalyses = (raw) => {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getAnalysisOwnerId = (analysis) =>
  text(analysis?.user_id ?? analysis?.owner_user_id ?? "").trim();

const belongsToOwner = (analysis, ownerId) => {
  const analysisOwnerId = getAnalysisOwnerId(analysis);
  return !analysisOwnerId || analysisOwnerId === ownerId;
};

const readAll = (ownerId = getCurrentOwnerId()) => {
  const key = storageKeyForOwner(ownerId);
  if (!key) return [];
  try {
    return parseStoredAnalyses(localStorage.getItem(key)).filter((analysis) =>
      belongsToOwner(analysis, ownerId)
    );
  } catch {
    return [];
  }
};

const writeAll = (analyses, ownerId = getCurrentOwnerId()) => {
  const key = storageKeyForOwner(ownerId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(analyses));
  } catch {
    // non-fatal
  }
};

export const saveAnalysis = (analysis) => {
  const ownerId = getCurrentOwnerId();
  if (!ownerId) {
    throw new Error("Unable to save yearly analysis without an authenticated user.");
  }

  const entry = {
    ...analysis,
    user_id: ownerId,
    id: analysis.id || generateId(),
    created_at: analysis.created_at || new Date().toISOString(),
  };
  const all = readAll(ownerId);
  const idx = all.findIndex((a) => a.id === entry.id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.unshift(entry);
  }
  writeAll(all, ownerId);
  return entry;
};

export const loadAnalyses = () =>
  readAll().sort(
    (a, b) =>
      new Date(b?.created_at ?? 0).getTime() -
      new Date(a?.created_at ?? 0).getTime()
  );

export const loadAnalysis = (id) =>
  readAll().find((a) => a.id === text(id)) ?? null;

export const deleteAnalysis = (id) => {
  const all = readAll().filter((a) => a.id !== text(id));
  writeAll(all);
};

// ── KPI definitions (shared across create + results pages) ──────────

export const ADDITIVE_KPIS = [
  { key: "totalEnergyKwh", label: "Total energy", unit: "kWh", yearlyLabel: "Yearly energy", yearlyUnit: "kWh/year" },
  { key: "drivetrainEnergyKwh", label: "Drivetrain energy", unit: "kWh", yearlyLabel: "Yearly drivetrain energy", yearlyUnit: "kWh/year" },
  { key: "auxiliaryEnergyKwh", label: "Auxiliary energy", unit: "kWh", yearlyLabel: "Yearly auxiliary energy", yearlyUnit: "kWh/year" },
  { key: "distanceKm", label: "Distance", unit: "km", yearlyLabel: "Yearly distance", yearlyUnit: "km/year" },
];

export const computeYearlyTotals = (scenarioResults) => {
  const totals = {};
  for (const kpi of ADDITIVE_KPIS) {
    let sum = 0;
    let valid = false;
    for (const sr of scenarioResults) {
      if (sr.error) continue;
      const value = sr.kpis?.[kpi.key];
      if (value != null) {
        sum += value * sr.occurrences;
        valid = true;
      }
    }
    totals[kpi.key] = valid ? sum : null;
  }
  return totals;
};

export const MODE_LABELS = {
  battery_only: "Battery only",
  charging_only: "Charging",
  joint: "Joint",
};

// ── KPI definitions (shared across create + results pages) ──────────

export {
  ADDITIVE_KPIS,
  computeYearlyTotals,
} from "../../../utils/yearly-analysis-model";

export const MODE_LABELS = {
  battery_only: "Battery only",
  charging_only: "Charging",
  joint: "Joint",
};

export const MODE_LABEL_KEYS = {
  battery_only: "simulation.mode_battery_only",
  charging_only: "simulation.mode_charging",
  charging: "simulation.mode_charging",
  joint: "simulation.mode_joint",
};

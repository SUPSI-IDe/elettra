// ── KPI definitions (shared across create + results pages) ──────────

export const ADDITIVE_KPIS = [
  { key: "totalEnergyKwh", label: "Total energy", unit: "kWh", yearlyLabel: "Yearly energy", yearlyUnit: "kWh/year" },
  { key: "drivetrainEnergyKwh", label: "Drivetrain energy", unit: "kWh", yearlyLabel: "Yearly drivetrain energy", yearlyUnit: "kWh/year" },
  { key: "auxiliaryEnergyKwh", label: "Auxiliary energy", unit: "kWh", yearlyLabel: "Yearly auxiliary energy", yearlyUnit: "kWh/year" },
  { key: "distanceKm", label: "Simulated distance", unit: "km", yearlyLabel: "Yearly simulated distance", yearlyUnit: "km/year" },
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

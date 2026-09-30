/** Forecast variants are alternatives, not additional physical buses. */
export function selectOptimizationReferences(runs, shiftIds, mode, fixedPackCount = null) {
  if (!shiftIds.length || new Set(shiftIds).size !== shiftIds.length) {
    throw new Error("Select distinct physical shifts.");
  }
  if (mode === "charging_only" && (!Number.isInteger(fixedPackCount) || fixedPackCount < 1)) {
    throw new Error("Select the battery pack count for charging-only optimisation.");
  }
  return Object.fromEntries(shiftIds.map((shiftId) => {
    const variants = runs.filter((run) => run.shift_id === shiftId && run.status === "completed");
    const candidates = variants.filter((run) => {
      const packs = run.contextual_parameters?.num_battery_packs;
      return Number.isInteger(packs) && packs > 0 &&
        (mode !== "charging_only" || packs === fixedPackCount);
    }).sort((a, b) => b.contextual_parameters.num_battery_packs - a.contextual_parameters.num_battery_packs ||
      String(b.id).localeCompare(String(a.id)));
    if (!candidates.length) throw new Error(`No completed reference forecast for shift ${shiftId}.`);
    return [shiftId, candidates[0].id];
  }));
}

export function optimizationVerificationStatus(run) {
  const result = run?.results;
  if (!result) return "pending";
  const rows = result.per_bus_summary ?? [];
  if (new Set(rows.map((r) => r.shift_id)).size !== rows.length) return "duplicate_physical_shifts";
  return result.integrity_audit?.status ??
    (result.forecast_verification?.status === "verified" ? "verified" : "unverified");
}

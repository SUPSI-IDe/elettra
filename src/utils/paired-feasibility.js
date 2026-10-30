// A calculation error or an unverified design is not proof of infeasibility.
export function basisOutcome(row = {}) {
  if (["pending", "running"].includes(row.status)) return "pending";
  if (["failed", "error"].includes(row.status)) return "failed";
  if (!["completed", "done"].includes(row.status)) return "unknown";
  if (row.verification_status === "verified" && row.electrification_feasible === true) return "feasible";
  if (["physical_limits_exceeded", "infeasible"].includes(row.verification_status)
      && row.electrification_feasible === false) return "infeasible";
  return "unknown";
}

export function pairedFeasibility(run = {}) {
  if (!run.basis_summaries) return null;
  const mean = basisOutcome(run.basis_summaries.mean);
  const q95 = basisOutcome(run.basis_summaries.aggregate_q95);
  if (mean === "feasible" && q95 === "feasible") return {tone: "positive", key: "both_feasible"};
  if (mean === "infeasible" && q95 === "infeasible") return {tone: "negative", key: "both_infeasible"};
  if (mean === "feasible" && q95 === "infeasible") return {tone: "warning", key: "mean_only"};
  if (mean === "infeasible" && q95 === "feasible") return {tone: "warning", key: "q95_only"};
  return {tone: "neutral", key: "incomplete"};
}

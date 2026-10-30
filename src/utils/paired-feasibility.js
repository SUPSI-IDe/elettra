// A calculation error or an unverified design is not proof of infeasibility.
export function evaluationStatus(run = {}) {
  if (run.basis_summaries) {
    const profiles = ["mean", "aggregate_q95"].map(basis =>
      evaluationStatus(run.basis_summaries[basis] ?? {status: "unavailable"}));
    if (profiles.some(row => row.tone === "warning")) return {state: "running", tone: "warning"};
    if (profiles.some(row => row.tone === "negative")) return {state: "failed", tone: "negative"};
    return {state: "completed", tone: "positive"};
  }
  const status = String(run.status ?? "pending").trim().toLowerCase();
  if (["pending", "running"].includes(status)) return {state: status, tone: "warning"};
  const verification = run.verification_status ?? run.results?.forecast_verification?.status;
  const solver = run.solver_status ?? run.results?.solver_status;
  if (verification === "time_budget_exhausted" || /time.?limit/i.test(solver ?? "")) {
    return {state: "failed", tone: "negative", reason: "timeout"};
  }
  if (["failed", "error"].includes(status) || run.results?.error || /^error/i.test(solver ?? "")) {
    return {state: "failed", tone: "negative", reason: "error"};
  }
  if (!["completed", "done"].includes(status)) return {state: "failed", tone: "negative", reason: "unavailable"};
  if (verification && !["verified", "physical_limits_exceeded", "infeasible"].includes(verification)) {
    return {state: "failed", tone: "negative", reason: "unverified"};
  }
  // A proven infeasible result is still a successfully completed calculation.
  // Historical completed runs may predate forecast-verification metadata.
  return {state: "completed", tone: "positive"};
}

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

import { formatNumber } from "../../../utils/number-format";
import { t } from "../../../i18n";
import { textContent as esc } from "../../../ui-helpers";
import { renderAggregateEnergy } from "./aggregate-energy";

const number = formatNumber;

export function renderInfeasibilityReasons(run, shiftId) {
  const diagnostic = run.results?.infeasibility_diagnostics;
  if (diagnostic?.status !== "available") {
    return `<p>${esc(t("simulation.diagnostic_unknown"))}</p>`;
  }
  const reasons = (diagnostic.reasons ?? []).filter(r => !shiftId ||
    (r.shift_id ? r.shift_id === shiftId : r.shift_ids ? r.shift_ids.includes(shiftId) : true));
  return `<p>${esc(t("simulation.diagnostic_scope"))}</p>${reasons.map(reason => {
    const values = Object.fromEntries(Object.entries(reason).map(([key,value]) => [key, typeof value === "number" ? number(value) : value]));
    return `<p class="aggregate-warning">${esc(t(`simulation.diagnostic_${reason.code}`,values))}</p>`;
  }).join("")}${!reasons.length ? `<p>${esc(t("simulation.diagnostic_other_block"))}</p>` : ""}`;
}

export function renderInfeasibilityBatteries(run, shiftId) {
  const diagnostic = run.results?.infeasibility_diagnostics;
  if (diagnostic?.status !== "available") return "";
  // Only the battery card consumes the relaxed result. The parent evaluation,
  // paired status, costs and charging infrastructure retain the original result.
  const diagnosticRun = {...run, results: diagnostic};
  return Object.keys(diagnostic.battery_results ?? {})
    .filter(id => !shiftId || id === shiftId)
    .map(id => renderAggregateEnergy(diagnosticRun, id, {diagnostic:true})).join("");
}

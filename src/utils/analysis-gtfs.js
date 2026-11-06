import { fetchAllShifts } from "../api/shifts";
import { t } from "../i18n";
import { textContent } from "../ui-helpers";
import { datasetSummaryHtml, provenanceForShift } from "./gtfs-datasets.js";

export const mountAnalysisGtfs = async (section, record, explicitIds = []) => {
  const features = record?.features ?? {};
  const snapshot = record?.input_params?.gtfs_provenance ?? features.gtfs_provenance;
  const ids = [...new Set([
    ...Object.keys(snapshot?.shifts ?? {}), ...explicitIds,
    ...(record?.input_params?.shift_ids ?? features.config?.shift_ids ?? []),
    ...(features.config?.fixedConfiguration?.shiftIds ?? []),
  ].filter(Boolean).map(String))];
  if (!ids.length) return;
  const panel = section.querySelector('[data-role="analysis-gtfs"]');
  if (!panel) return;
  const generation = Symbol();
  panel.gtfsGeneration = generation;
  const render = (shifts = []) => {
    if (panel.gtfsGeneration !== generation) return;
    const current = new Map(shifts.map((s) => [String(s.id), s]));
    panel.innerHTML = `<h2>${textContent(t("gtfs.analysis_title"))}</h2><div class="gtfs-analysis-grid">${ids.map((id) => {
      const shift = current.get(id);
      const provenance = provenanceForShift(record, id, shift);
      const name = shift?.name ?? features.meta?.shiftNamesById?.[id] ?? id;
      return `<div><strong>${textContent(name)}</strong>${datasetSummaryHtml(provenance.datasets, t, provenance)}</div>`;
    }).join("")}</div>`;
    panel.hidden = false;
  };
  render();
  try { render(await fetchAllShifts()); } catch { /* Recorded metadata remains available. */ }
};

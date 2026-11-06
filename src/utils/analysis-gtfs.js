import { fetchAllShifts } from "../api/shifts";
import { t } from "../i18n";
import { textContent } from "../ui-helpers";
import { datasetKey, datasetLabel, sortDatasets, datasetSummaryHtml, provenanceForShift } from "./gtfs-datasets.js";

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
    const entries = ids.map((id) => {
      const shift = current.get(id);
      const provenance = provenanceForShift(record, id, shift);
      const name = shift?.name ?? features.meta?.shiftNamesById?.[id] ?? id;
      return { name, ...provenance };
    });
    const signature = ({ datasets, source }) => JSON.stringify([source,
      Array.isArray(datasets) ? sortDatasets(datasets).map(d => [datasetKey(d), d.valid_from, d.valid_to]) : null]);
    const shared = entries.every(entry => signature(entry) === signature(entries[0]));
    const editions = new Set(entries.flatMap(entry => (entry.datasets ?? []).map(datasetKey)));
    const datasets = entries[0].datasets;
    const label = shared
      ? Array.isArray(datasets)
        ? datasets.length === 1 ? datasetLabel(datasets[0], t) : t(datasets.length ? "gtfs.mixed" : "gtfs.none")
        : t("gtfs.unavailable")
      : t(editions.size > 1 ? "gtfs.mixed" : "gtfs.per_block");
    const historical = entries.some(entry => entry.source === "current");
    const open = panel.querySelector('details')?.open ?? false;
    const details = shared
      ? datasetSummaryHtml(datasets, t, entries[0])
      : `<div class="gtfs-analysis-grid">${entries.map(entry => `<div><strong>${textContent(entry.name)}</strong>${datasetSummaryHtml(entry.datasets, t, entry)}</div>`).join("")}</div>`;
    panel.innerHTML = `<details class="gtfs-disclosure"${open ? " open" : ""}>
      <summary><span class="gtfs-disclosure__label">${textContent(t("gtfs.label"))}</span><span>${textContent(label)}</span>${historical ? `<span class="gtfs-disclosure__source">${textContent(t("gtfs.current_short"))}</span>` : ""}<span class="gtfs-disclosure__hint">${textContent(t("gtfs.details"))}</span></summary>
      <div class="gtfs-disclosure__content">${details}</div>
    </details>`;
    panel.hidden = false;
  };
  render();
  try { render(await fetchAllShifts()); } catch { /* Recorded metadata remains available. */ }
};

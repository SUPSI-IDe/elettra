const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

export const datasetKey = (d) => d ? `${d.gtfs_year}|${d.gtfs_file_date}` : "";
export const dateLabel = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? "")
  ? date.split("-").reverse().join("/") : "—";
export const sortDatasets = (datasets = []) => [...datasets].sort((a, b) =>
  Number(b.gtfs_year) - Number(a.gtfs_year) || String(b.gtfs_file_date).localeCompare(String(a.gtfs_file_date)));
export const datasetLabel = (d, t) => `${d.gtfs_year} · ${t("gtfs.file")} ${dateLabel(d.gtfs_file_date)}`;

export const datasetSummaryHtml = (datasets, t, { source = null } = {}) => {
  const rows = Array.isArray(datasets) ? datasets : null;
  const content = rows?.length ? rows.map((d) =>
    `<span>${escapeHtml(datasetLabel(d, t))}</span><span>${escapeHtml(t("gtfs.validity"))}: ${escapeHtml(dateLabel(d.valid_from))}–${escapeHtml(dateLabel(d.valid_to))}</span>`
  ).join("") : `<span>${escapeHtml(t(rows ? "gtfs.none" : "gtfs.unavailable"))}</span>`;
  return `<div class="gtfs-metadata" data-role="gtfs-metadata">${rows?.length > 1 ? `<strong>${escapeHtml(t("gtfs.mixed"))}</strong>` : ""}${content}${source ? `<span class="gtfs-metadata__source">${escapeHtml(t(`gtfs.${source}`))}</span>` : ""}</div>`;
};

export const provenanceForShift = (record, shiftId, currentShift) => {
  const provenance = record?.input_params?.gtfs_provenance ?? record?.features?.gtfs_provenance;
  if (provenance?.version === 1 && Object.hasOwn(provenance.shifts ?? {}, shiftId)) {
    return { datasets: provenance.shifts[shiftId], source: "recorded" };
  }
  return { datasets: currentShift?.gtfs_datasets, source: "current" };
};

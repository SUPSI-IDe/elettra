import "./yearly-analysis-runs.css";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import { loadAnalyses, deleteAnalysis, MODE_LABELS } from "./yearly-analysis-store";

const text = (v) => (v === null || v === undefined ? "" : String(v));

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return "—"; }
};

const scenariosSummary = (scenarios = []) => {
  if (!scenarios.length) return "—";
  const temps = scenarios.map((s) => `${s.temperature}°C`).join(", ");
  const total = scenarios.reduce((sum, s) => sum + (s.occurrences ?? 0), 0);
  return `${temps} (${total}d)`;
};

export const initializeYearlyAnalysisRuns = (root = document, options = {}) => {
  const section = root.querySelector("section.yearly-analysis-runs");
  if (!section) return null;

  const cleanups = [];
  const tbody = section.querySelector('[data-role="ya-runs-body"]');
  const emptyMsg = section.querySelector('[data-role="empty-message"]');
  const flashEl = section.querySelector('[data-role="flash"]');
  const selectAllCb = section.querySelector('[data-role="select-all"]');

  let analyses = [];

  if (options.flashMessage && flashEl) {
    flashEl.textContent = options.flashMessage;
    flashEl.hidden = false;
  }

  const renderRows = () => {
    analyses = loadAnalyses();
    if (!analyses.length) {
      if (tbody) tbody.innerHTML = "";
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }
    if (emptyMsg) emptyMsg.hidden = true;

    if (tbody) {
      tbody.innerHTML = analyses
        .map((a) => {
          const id = text(a.id);
          const shifts = (a.meta?.shiftNames ?? []).join(", ") || "—";
          const mode = a.meta?.modeLabel ?? MODE_LABELS[a.config?.mode] ?? "—";
          const status = a.status ?? "—";
          const statusCls = { completed: "completed", partial: "partial", failed: "failed" }[status] ?? "";
          return `<tr data-id="${textContent(id)}">
            <td class="checkbox"><input type="checkbox" /></td>
            <td>${textContent(formatDate(a.created_at))}</td>
            <td title="${textContent(shifts)}">${textContent(shifts)}</td>
            <td>${textContent(mode)}</td>
            <td>${textContent(scenariosSummary(a.scenarios))}</td>
            <td><span class="ya-status-badge ${statusCls}">${textContent(status)}</span></td>
            <td><a class="ya-results-link" data-action="view-results" data-id="${textContent(id)}">View</a></td>
          </tr>`;
        })
        .join("");
    }
  };

  renderRows();

  // ── Actions ─────────────────────────────────────────────────────

  const handleNewAnalysis = () => triggerPartialLoad("create-yearly-analysis");
  section.querySelector('[data-action="new-analysis"]')?.addEventListener("click", handleNewAnalysis);
  cleanups.push(() => section.querySelector('[data-action="new-analysis"]')?.removeEventListener("click", handleNewAnalysis));

  const handleTableClick = (e) => {
    const link = e.target.closest("[data-action='view-results']");
    if (link) {
      e.preventDefault();
      triggerPartialLoad("yearly-analysis-results", { analysisId: link.dataset.id });
    }
  };
  if (tbody) { tbody.addEventListener("click", handleTableClick); cleanups.push(() => tbody.removeEventListener("click", handleTableClick)); }

  const handleDeleteSelected = () => {
    const checked = tbody?.querySelectorAll("tr:has(input:checked)") ?? [];
    if (!checked.length) return;
    checked.forEach((row) => {
      const id = row.dataset.id;
      if (id) deleteAnalysis(id);
    });
    renderRows();
  };
  section.querySelector('[data-action="delete-selected"]')?.addEventListener("click", handleDeleteSelected);
  cleanups.push(() => section.querySelector('[data-action="delete-selected"]')?.removeEventListener("click", handleDeleteSelected));

  if (selectAllCb) {
    const handleSelectAll = () => {
      const boxes = tbody?.querySelectorAll('input[type="checkbox"]') ?? [];
      boxes.forEach((cb) => { cb.checked = selectAllCb.checked; });
    };
    selectAllCb.addEventListener("change", handleSelectAll);
    cleanups.push(() => selectAllCb.removeEventListener("change", handleSelectAll));
  }

  return () => cleanups.forEach((h) => h());
};

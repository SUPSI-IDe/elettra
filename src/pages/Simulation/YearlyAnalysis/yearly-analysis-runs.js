import "./yearly-analysis-runs.css";
import { triggerPartialLoad } from "../../../events";
import { t } from "../../../i18n";
import { textContent } from "../../../ui-helpers";
import { MODE_LABELS, MODE_LABEL_KEYS } from "./yearly-analysis-store";
import {
  fetchYearlyAnalyses,
  fetchYearlyAnalysis,
  deleteYearlyAnalysis,
  fetchPredictionRuns,
  deletePredictionRun,
} from "../../../api/simulation";
import { isAuthenticated } from "../../../api/session";
import { installPaginationControl } from "../../../dom/pagination";
import { DEFAULT_PAGE_SIZE } from "../../../api/pagination";
import { bindSelectAll } from "../../../dom/tables";

const text = (v) => (v === null || v === undefined ? "" : String(v));

const modeLabel = (mode, fallback = "") => {
  const key = MODE_LABEL_KEYS[mode];
  return key ? t(key) : fallback || MODE_LABELS[mode] || mode || "—";
};

const statusLabel = (status) => {
  const key = `yearly_analysis.status_${text(status).toLowerCase()}`;
  const translated = t(key);
  return translated === key ? status || "—" : translated;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return "—"; }
};

const scenariosSummary = (scenarios = []) => {
  if (!scenarios.length) return "—";
  const temps = scenarios.map((s) => `${s.temperature}°C`).join(", ");
  const total = scenarios.reduce((sum, s) => sum + (s.occurrences ?? 0), 0);
  return `${temps} (${total}${t("yearly_analysis.days_short")})`;
};

const buildAnalysisName = (a) => {
  if (a.name) return a.name;
  const f = a.features ?? {};
  const meta = f.meta ?? {};
  const shifts = (meta.shiftNames ?? []).join(", ");
  const model = meta.busModelName ?? "";
  const date = a.created_at ? new Date(a.created_at).toLocaleDateString() : "";
  return [shifts, model, date].filter(Boolean).join(" · ") || text(a.id).slice(0, 8);
};

export const initializeYearlyAnalysisRuns = (root = document, options = {}) => {
  const section = root.querySelector("section.yearly-analysis-runs");
  if (!section) return null;

  const cleanups = [];
  const tbody = section.querySelector('[data-role="ya-runs-body"]');
  const table = section.querySelector("table");
  const emptyMsg = section.querySelector('[data-role="empty-message"]');
  const flashEl = section.querySelector('[data-role="flash"]');
  const selectAllCb = section.querySelector('[data-role="select-all"]');
  const loadingEl = section.querySelector('[data-role="loading"]');
  const searchInput = section.querySelector("#ya-filter");
  const paginationContainer = section.querySelector(
    '[data-role="ya-runs-pagination"]'
  );

  let analyses = [];
  let filteredAnalyses = [];
  const featuresCache = new Map();

  // ── Pagination state ──────────────────────────────────────────────
  let skip = 0;
  let limit = DEFAULT_PAGE_SIZE;
  const pagination = installPaginationControl(paginationContainer, {
    onPageChange: (nextSkip) => {
      skip = Math.max(0, nextSkip);
      void loadAnalyses();
    },
    onPageSizeChange: (nextLimit) => {
      limit = nextLimit;
      skip = 0;
      void loadAnalyses();
    },
  });
  if (pagination) {
    cleanups.push(() => pagination.destroy());
  }

  if (options.flashMessage && flashEl) {
    flashEl.textContent = options.flashMessage;
    flashEl.hidden = false;
  }

  const renderRows = () => {
    if (selectAllCb) {
      selectAllCb.checked = false;
    }

    if (!filteredAnalyses.length) {
      if (tbody) tbody.innerHTML = "";
      if (emptyMsg) emptyMsg.hidden = false;
      if (selectAllCb && table) {
        bindSelectAll(selectAllCb, table);
      }
      return;
    }
    if (emptyMsg) emptyMsg.hidden = true;

    if (tbody) {
      tbody.innerHTML = filteredAnalyses
        .map((a) => {
          const id = text(a.id);
          const f = a.features ?? {};
          const meta = f.meta ?? {};
          const shifts = (meta.shiftNames ?? []).join(", ") || "—";
          const mode = modeLabel(f.config?.mode, meta.modeLabel);
          const status = f.status ?? "—";
          const statusCls = { completed: "completed", partial: "partial", failed: "failed" }[status] ?? "";
          const scenarios = f.scenarios ?? [];
          return `<tr data-id="${textContent(id)}">
            <td class="checkbox"><input type="checkbox" aria-label="${textContent(t("yearly_analysis.select_analysis"))}" /></td>
            <td>${textContent(formatDate(a.created_at))}</td>
            <td>${textContent(a.name || "—")}</td>
            <td title="${textContent(shifts)}">${textContent(shifts)}</td>
            <td>${textContent(mode)}</td>
            <td>${textContent(scenariosSummary(scenarios))}</td>
            <td><span class="ya-status-badge ${statusCls}">${textContent(statusLabel(status))}</span></td>
            <td class="ya-actions-cell">
              <a class="ya-results-link table-action-link" data-action="view-results" data-id="${textContent(id)}">${textContent(t("common.view"))}</a>
            </td>
          </tr>`;
        })
        .join("");
    }

    if (selectAllCb && table) {
      bindSelectAll(selectAllCb, table);
    }
  };

  const applyFilter = () => {
    const query = text(searchInput?.value).trim().toLowerCase();

    filteredAnalyses = query
      ? analyses.filter((analysis = {}) => {
          const features = analysis.features ?? {};
          const meta = features.meta ?? {};
          const shifts = (meta.shiftNames ?? []).join(", ");
          const mode = modeLabel(features.config?.mode, meta.modeLabel);
          const status = features.status ?? "";
          return [
            analysis.name,
            shifts,
            mode,
            status,
            analysis.id,
            buildAnalysisName(analysis),
          ]
            .map((value) => text(value).toLowerCase())
            .some((value) => value.includes(query));
        })
      : analyses;

    renderRows();
  };

  // The yearly-analysis list endpoint returns lightweight items
  // (id, optimization_run_id, name, created_at) and no longer includes
  // `features`.  Hydrate features via the detail endpoint for the
  // visible page so the existing table cells (mode, shift names,
  // scenarios, status) keep working.
  const hydrateFeatures = async (rows) => {
    const targets = rows.filter(
      (row) => row?.id && !row?.features && !featuresCache.has(text(row.id))
    );
    if (!targets.length) return;
    await Promise.allSettled(
      targets.map(async (row) => {
        const id = text(row.id);
        try {
          const detail = await fetchYearlyAnalysis(id);
          featuresCache.set(id, detail);
          if (detail && typeof detail === "object") {
            Object.assign(row, detail);
          }
        } catch (error) {
          console.warn(`Failed to load yearly analysis ${id}`, error);
          featuresCache.set(id, null);
        }
      })
    );
  };

  // ── Load from API ──────────────────────────────────────────────

  const loadAnalyses = async () => {
    if (loadingEl) loadingEl.hidden = false;
    pagination?.setBusy(true);
    try {
      const envelope = await fetchYearlyAnalyses({ skip, limit });
      analyses = Array.isArray(envelope?.items) ? envelope.items : [];
      pagination?.update(envelope);
    } catch (err) {
      analyses = [];
      if (flashEl) {
        flashEl.textContent = err?.message ?? t("yearly_analysis.failed_load");
        flashEl.hidden = false;
      }
    } finally {
      if (loadingEl) loadingEl.hidden = true;
      pagination?.setBusy(false);
    }

    // Render lightweight rows immediately, then hydrate features so
    // mode/shift/scenario/status columns populate without blocking the
    // initial paint.
    applyFilter();
    await hydrateFeatures(analyses);
    applyFilter();
  };

  // ── Actions ─────────────────────────────────────────────────────

  const handleNewAnalysis = () => triggerPartialLoad("create-yearly-analysis");
  section.querySelector('[data-action="new-analysis"]')?.addEventListener("click", handleNewAnalysis);
  cleanups.push(() => section.querySelector('[data-action="new-analysis"]')?.removeEventListener("click", handleNewAnalysis));

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    cleanups.push(() => searchInput.removeEventListener("input", applyFilter));
  }

  const handleTableClick = (e) => {
    const link = e.target.closest("[data-action='view-results']");
    if (link) {
      e.preventDefault();
      triggerPartialLoad("yearly-analysis-results", { analysisId: link.dataset.id });
    }
  };
  if (tbody) { tbody.addEventListener("click", handleTableClick); cleanups.push(() => tbody.removeEventListener("click", handleTableClick)); }

  const deleteLinkedPredictionRuns = async (analysisId) => {
    let runs;
    try {
      runs = await fetchPredictionRuns({ yearly_analysis_id: analysisId });
    } catch {
      return;
    }
    const items = Array.isArray(runs) ? runs : (runs?.items ?? runs?.results ?? []);
    if (!items.length) return;

    const first = items[0];
    try {
      const result = await deletePredictionRun(first.id);
      if (result?.reason === "not_supported") return;
    } catch {
      return;
    }

    const rest = items.slice(1);
    await Promise.allSettled(rest.map((r) => r?.id ? deletePredictionRun(r.id) : Promise.resolve()));
  };

  const handleDeleteSelected = async () => {
    const checked = tbody?.querySelectorAll("tr:has(input:checked)") ?? [];
    if (!checked.length) return;

    const confirmMessage = t("yearly_analysis.delete_confirm", {
      count: checked.length,
    });
    if (!confirm(confirmMessage)) return;

    for (const row of checked) {
      const id = row.dataset.id;
      if (!id) continue;
      try {
        await deleteLinkedPredictionRuns(id);
        await deleteYearlyAnalysis(id);
      } catch (err) {
        console.error(`Failed to delete analysis ${id}:`, err);
      }
    }

    await loadAnalyses();
  };
  section.querySelector('[data-action="delete-selected"]')?.addEventListener("click", handleDeleteSelected);
  cleanups.push(() => section.querySelector('[data-action="delete-selected"]')?.removeEventListener("click", handleDeleteSelected));

  if (isAuthenticated()) {
    loadAnalyses();
  }

  return () => cleanups.forEach((h) => h());
};

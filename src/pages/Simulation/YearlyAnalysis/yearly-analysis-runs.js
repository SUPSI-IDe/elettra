import "./yearly-analysis-runs.css";
import "../shared/state-indicator.css";
import { triggerPartialLoad } from "../../../events";
import {
  formatBatchDeletionFeedback,
  settleBatchDeletion,
} from "../../../utils/batch-delete";
import { t } from "../../../i18n";
import { textContent } from "../../../ui-helpers";
import { MODE_LABELS, MODE_LABEL_KEYS } from "./yearly-analysis-store";
import {
  fetchYearlyAnalyses,
  fetchAllYearlyAnalyses,
  fetchYearlyAnalysis,
  updateYearlyAnalysis,
  deleteYearlyAnalysis,
  fetchPredictionRuns,
  deletePredictionRun,
} from "../../../api/simulation";
import { isAuthenticated } from "../../../api/session";
import { installPaginationControl } from "../../../dom/pagination";
import { DEFAULT_PAGE_SIZE } from "../../../api/pagination";
import { bindSelectAll } from "../../../dom/tables";
import { initializeRenameDialog } from "../../../dom/rename-dialog";
import { renderEntityRowActions } from "../../../dom/entity-details";
import { appendCopyNameSuffix } from "../../../utils/copy-name";

const text = (v) => (v === null || v === undefined ? "" : String(v));

const modeLabel = (mode, fallback = "") => {
  const key = MODE_LABEL_KEYS[mode];
  return key ? t(key) : fallback || MODE_LABELS[mode] || mode || "—";
};

const statusLabel = (status) => {
  const normalized = text(status).trim().toLowerCase();
  const key = `yearly_analysis.status_${normalized}`;
  const translated = t(key);
  if (translated !== key) return translated;
  const sharedKey = ({
    pending: "simulation.status_pending",
    running: "simulation.status_running",
    done: "simulation.status_completed",
    error: "simulation.status_failed",
  })[normalized];
  return sharedKey ? t(sharedKey) : status || "—";
};

const statusTone = (status) => ({
  completed: "positive",
  done: "positive",
  partial: "warning",
  pending: "warning",
  running: "warning",
  failed: "negative",
  error: "negative",
})[text(status).trim().toLowerCase()] ?? "neutral";

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return "—"; }
};

const buildAnalysisName = (a) => {
  if (a.name) return a.name;
  const f = a.features ?? {};
  const meta = f.meta ?? {};
  const shifts = (meta.shiftNames ?? []).join(", ");
  const date = a.created_at ? new Date(a.created_at).toLocaleDateString() : "";
  return [shifts, date].filter(Boolean).join(" · ") || text(a.id).slice(0, 8);
};

const setFlashMessage = (section, message) => {
  const flashEl = section?.querySelector('[data-role="flash"]');
  if (!flashEl) return;
  if (message) {
    flashEl.textContent = message;
    flashEl.hidden = false;
  } else {
    flashEl.textContent = "";
    flashEl.hidden = true;
  }
};

export const buildYearlyAnalysisRowsMarkup = (analyses = []) =>
  analyses
    .map((analysis = {}) => {
      const id = text(analysis.id);
      const features = analysis.features ?? {};
      const meta = features.meta ?? {};
      const shifts = (meta.shiftNames ?? []).join(", ") || "—";
      const mode = modeLabel(features.config?.mode, meta.modeLabel);
      const status = features.status ?? "—";
      const renderedStatus = statusLabel(status);
      const tone = statusTone(status);
      const displayName = analysis.name || "—";
      const rowActions = renderEntityRowActions({
        details: `${t("common.view_details")}: ${displayName}`,
        rename: `${t("common.rename")}: ${displayName}`,
        duplicate: `${t("common.duplicate")}: ${displayName}`,
        remove: `${t("common.delete")}: ${displayName}`,
        order: ["details", "rename", "duplicate", "delete"],
      });

      return `<tr data-id="${textContent(id)}">
        <td class="checkbox"><input type="checkbox" aria-label="${textContent(t("yearly_analysis.select_analysis"))}" /></td>
        <td class="name">${textContent(displayName)}</td>
        <td class="created">${textContent(formatDate(analysis.created_at))}</td>
        <td class="shifts" title="${textContent(shifts)}">${(meta.shiftNames ?? []).length
          ? meta.shiftNames.map(name => `<span class="ya-runs-shift-name">${textContent(name)}</span>`).join(', ')
          : '—'}</td>
        <td>${textContent(mode)}</td>
        <td class="status"><span class="simulation-state-indicator simulation-state-indicator--${tone}" role="img" tabindex="0" aria-label="${textContent(renderedStatus)}" title="${textContent(renderedStatus)}"></span></td>
        <td class="actions">${rowActions}</td>
      </tr>`;
    })
    .join("");

export const initializeYearlyAnalysisRuns = (root = document, options = {}) => {
  const section = root.querySelector("section.yearly-analysis-runs");
  if (!section) return null;

  const cleanups = [];
  const renameDialog = initializeRenameDialog(section, {
    title: t("common.rename"),
    nameLabel: t("simulation.field_name"),
    cancelLabel: t("common.cancel"),
    saveLabel: t("common.save"),
    fallbackError: t("common.rename_failed"),
  });
  cleanups.push(() => renameDialog?.destroy());
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
      tbody.innerHTML = buildYearlyAnalysisRowsMarkup(filteredAnalyses);
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
  // status) keep working.
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
    // mode/shift/status columns populate without blocking the
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

  const handleTableClick = async (e) => {
    const actionButton = e.target.closest("[data-row-action]");
    if (!actionButton) return;
    e.preventDefault();
    const analysisId = actionButton.closest("tr")?.dataset?.id;
    const analysis = analyses.find((candidate) => text(candidate?.id) === analysisId);
    if (!analysisId || !analysis) return;

    if (actionButton.dataset.rowAction === "rename") {
      renameDialog?.open({
        value: analysis.name || "",
        trigger: actionButton,
        onSubmit: async (name) => {
          const updated = await updateYearlyAnalysis(analysisId, { name });
          Object.assign(
            analysis,
            updated && typeof updated === "object" ? updated : { name },
          );
          const cached = featuresCache.get(analysisId);
          if (cached && typeof cached === "object") Object.assign(cached, { name });
          applyFilter();
          setFlashMessage(section, t("common.rename_success"));
        },
      });
      return;
    }
    if (actionButton.dataset.rowAction === "duplicate") {
      if (!analysis.features) {
        try {
          const detail = await fetchYearlyAnalysis(analysisId);
          if (detail && typeof detail === "object") Object.assign(analysis, detail);
        } catch (error) {
          setFlashMessage(
            section,
            error?.message || t("yearly_analysis.failed_load"),
          );
          return;
        }
      }
      let existingNames;
      try { existingNames = (await fetchAllYearlyAnalyses()).map(item => item.name || buildAnalysisName(item)); }
      catch (error) { setFlashMessage(section, error?.message || t('yearly_analysis.failed_load')); return; }
      triggerPartialLoad("create-yearly-analysis", {
        prefill: {
          name: appendCopyNameSuffix(
            analysis.name || buildAnalysisName(analysis),
            t("common.copy_name_suffix"),
            existingNames,
          ),
          optimizationRunId: analysis.optimization_run_id,
          occupancyPercent: analysis.features?.config?.occupancy_percent,
        },
      });
      return;
    }
    if (actionButton.dataset.rowAction === "delete") {
      void deleteAnalyses([analysisId], actionButton);
      return;
    }
    if (actionButton.dataset.rowAction === "details") {
      triggerPartialLoad("yearly-analysis-results", { analysisId });
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

  const deleteAnalyses = async (ids, trigger = null) => {
    if (!ids.length) return;
    const confirmMessage = t("yearly_analysis.delete_confirm", {
      count: ids.length,
    });
    if (!confirm(confirmMessage)) return;

    if (trigger) trigger.disabled = true;
    try {
      const result = await settleBatchDeletion(ids, async (id) => {
          await deleteLinkedPredictionRuns(id);
          await deleteYearlyAnalysis(id);
      });

      setFlashMessage(
        section,
        result.failedCount
          ? formatBatchDeletionFeedback(result, t, (error) =>
              error?.message || t("yearly_analysis.delete_failed")
            )
          : ""
      );

      await loadAnalyses();
    } finally {
      if (trigger?.isConnected) trigger.disabled = false;
    }
  };

  const handleDeleteSelected = async () => {
    const checked = tbody?.querySelectorAll("tr:has(input:checked)") ?? [];
    const ids = Array.from(checked, (row) => row.dataset.id).filter(Boolean);
    await deleteAnalyses(ids);
  };
  section.querySelector('[data-action="delete-selected"]')?.addEventListener("click", handleDeleteSelected);
  cleanups.push(() => section.querySelector('[data-action="delete-selected"]')?.removeEventListener("click", handleDeleteSelected));

  if (isAuthenticated()) {
    loadAnalyses();
  }

  return () => cleanups.forEach((h) => h());
};

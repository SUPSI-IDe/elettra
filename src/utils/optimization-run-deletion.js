import {
  DELETE_ERROR_KIND,
  formatDeleteErrorMessage,
  isBlockedDeleteError,
} from "../api/delete-response.js";
import {
  DELETION_BLOCKER_TYPES,
  formatBlockedDeletionMessage,
  guardProtectedDeletion,
} from "./protected-delete.js";

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const OPTIMIZATION_RUN_BLOCK_KEYS = Object.freeze({
  introKey: "simulation.delete_blocked_intro",
  footerKey: "simulation.delete_blocked_footer",
});

/**
 * Find yearly analyses that reference any of the selected optimization runs.
 *
 * Uses yearly-analysis list items only (`optimization_run_id`, `id`, `name`).
 *
 * @param {unknown} yearlyAnalyses
 * @param {unknown} selectedRunIds
 * @returns {import("./protected-delete.js").DeletionBlocker[]}
 */
export const findYearlyAnalysisBlockersForRuns = (
  yearlyAnalyses,
  selectedRunIds
) => {
  const selectedIds = new Set(
    (Array.isArray(selectedRunIds) ? selectedRunIds : [])
      .map((id) => text(id))
      .filter(Boolean)
  );

  if (!selectedIds.size) {
    return [];
  }

  const analyses = Array.isArray(yearlyAnalyses) ? yearlyAnalyses : [];
  const seenAnalysisIds = new Set();
  const blockers = [];

  for (const analysis of analyses) {
    const runId = text(analysis?.optimization_run_id);
    if (!runId || !selectedIds.has(runId)) {
      continue;
    }

    const analysisId = text(analysis?.id);
    if (analysisId) {
      if (seenAnalysisIds.has(analysisId)) {
        continue;
      }
      seenAnalysisIds.add(analysisId);
    }

    const blocker = {
      type: DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS,
    };
    if (analysisId) {
      blocker.id = analysisId;
    }

    const name = text(analysis?.name);
    if (name) {
      blocker.name = name;
    }

    blockers.push(blocker);
  }

  return blockers;
};

/**
 * Load yearly analyses and determine whether deletion may proceed.
 *
 * Fails safe: dependency-check errors block deletion and surface a flash message.
 *
 * @param {Object} options
 * @param {string[]} options.selectedRunIds
 * @param {() => Promise<unknown[]>} options.fetchAllYearlyAnalyses
 * @param {(message: string) => void} [options.showFlash]
 * @param {(key: string, params?: Record<string, string|number>) => string} [options.translate]
 * @returns {Promise<{ proceed: boolean, reason?: string, blockers?: import("./protected-delete.js").DeletionBlocker[] }>}
 */
export const prepareOptimizationRunDeletion = async ({
  selectedRunIds,
  fetchAllYearlyAnalyses,
  showFlash,
  translate,
} = {}) => {
  try {
    const yearlyAnalyses = await fetchAllYearlyAnalyses();
    const blockers = findYearlyAnalysisBlockersForRuns(
      yearlyAnalyses,
      selectedRunIds
    );
    const { blocked } = guardProtectedDeletion({
      blockers,
      showFlash,
      translate,
      ...OPTIMIZATION_RUN_BLOCK_KEYS,
    });

    if (blocked) {
      return { proceed: false, reason: "blocked", blockers };
    }

    return { proceed: true, blockers: [] };
  } catch (error) {
    const message =
      typeof translate === "function"
        ? translate("simulation.delete_dependency_check_failed")
        : "Unable to verify dependencies.";
    if (typeof showFlash === "function") {
      showFlash(message);
    }
    return { proceed: false, reason: "dependency_check_failed", error };
  }
};

/**
 * Map a DELETE failure to a user-visible blocked-deletion message when applicable.
 *
 * @param {unknown} error
 * @param {(key: string, params?: Record<string, string|number>) => string} [translate]
 * @returns {{ kind: "blocked" | "failure", message?: string, error: unknown }}
 */
export const resolveOptimizationRunDeleteFailure = (error, translate) => {
  if (isBlockedDeleteError(error)) {
    if (error.blockers?.length) {
      return {
        kind: DELETE_ERROR_KIND.BLOCKED,
        message: formatBlockedDeletionMessage(error.blockers, translate, {
          ...OPTIMIZATION_RUN_BLOCK_KEYS,
        }),
        error,
      };
    }

    return {
      kind: DELETE_ERROR_KIND.BLOCKED,
      message: formatDeleteErrorMessage(
        error,
        typeof translate === "function"
          ? translate("delete_error.blocked")
          : "Unable to delete: this resource is still in use."
      ),
      error,
    };
  }

  return { kind: DELETE_ERROR_KIND.FAILURE, error };
};

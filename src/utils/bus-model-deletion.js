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
import { getOptimizationRunName } from "./optimization-run.js";

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const BUS_MODEL_BLOCK_KEYS = Object.freeze({
  introKey: "buses.delete_blocked_intro",
  footerKey: "buses.delete_blocked_footer",
});

/**
 * Find optimization runs that reference any of the selected bus models.
 *
 * Uses optimization-run list items only (`bus_model_id`, `id`, `name`).
 *
 * @param {unknown} optimizationRuns
 * @param {unknown} selectedModelIds
 * @returns {import("./protected-delete.js").DeletionBlocker[]}
 */
export const findOptimizationRunBlockersForBusModels = (
  optimizationRuns,
  selectedModelIds
) => {
  const selectedIds = new Set(
    (Array.isArray(selectedModelIds) ? selectedModelIds : [])
      .map((id) => text(id))
      .filter(Boolean)
  );

  if (!selectedIds.size) {
    return [];
  }

  const runs = Array.isArray(optimizationRuns) ? optimizationRuns : [];
  const seenRunIds = new Set();
  const blockers = [];

  for (const run of runs) {
    const modelId = text(run?.bus_model_id);
    if (!modelId || !selectedIds.has(modelId)) {
      continue;
    }

    const runId = text(run?.id);
    if (runId) {
      if (seenRunIds.has(runId)) {
        continue;
      }
      seenRunIds.add(runId);
    }

    const blocker = {
      type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
    };
    if (runId) {
      blocker.id = runId;
    }

    const name = text(getOptimizationRunName(run));
    if (name) {
      blocker.name = name;
    }

    blockers.push(blocker);
  }

  return blockers;
};

/**
 * Load optimization runs and determine whether bus-model deletion may proceed.
 *
 * Fails safe: dependency-check errors block deletion and surface a flash message.
 *
 * @param {Object} options
 * @param {string[]} options.selectedModelIds
 * @param {() => Promise<unknown[]>} options.fetchAllOptimizationRuns
 * @param {(message: string) => void} [options.showFlash]
 * @param {(key: string, params?: Record<string, string|number>) => string} [options.translate]
 * @returns {Promise<{ proceed: boolean, reason?: string, blockers?: import("./protected-delete.js").DeletionBlocker[] }>}
 */
export const prepareBusModelDeletion = async ({
  selectedModelIds,
  fetchAllOptimizationRuns,
  showFlash,
  translate,
} = {}) => {
  try {
    const optimizationRuns = await fetchAllOptimizationRuns();
    const blockers = findOptimizationRunBlockersForBusModels(
      optimizationRuns,
      selectedModelIds
    );
    const { blocked } = guardProtectedDeletion({
      blockers,
      showFlash,
      translate,
      ...BUS_MODEL_BLOCK_KEYS,
    });

    if (blocked) {
      return { proceed: false, reason: "blocked", blockers };
    }

    return { proceed: true, blockers: [] };
  } catch (error) {
    const message =
      typeof translate === "function"
        ? translate("buses.delete_dependency_check_failed")
        : "Unable to verify dependencies.";
    if (typeof showFlash === "function") {
      showFlash(message);
    }
    return { proceed: false, reason: "dependency_check_failed", error };
  }
};

/**
 * Map a bus-model DELETE failure to a user-visible message when applicable.
 *
 * @param {unknown} error
 * @param {(key: string, params?: Record<string, string|number>) => string} [translate]
 * @returns {{ kind: "blocked" | "failure", message?: string, error: unknown }}
 */
export const resolveBusModelDeleteFailure = (error, translate) => {
  if (isBlockedDeleteError(error)) {
    if (error.blockers?.length) {
      return {
        kind: DELETE_ERROR_KIND.BLOCKED,
        message: formatBlockedDeletionMessage(error.blockers, translate, {
          ...BUS_MODEL_BLOCK_KEYS,
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

  return {
    kind: DELETE_ERROR_KIND.FAILURE,
    message: formatDeleteErrorMessage(
      error,
      typeof translate === "function"
        ? translate("delete_error.generic")
        : "Unable to delete resource."
    ),
    error,
  };
};

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

const DEFAULT_DETAIL_CONCURRENCY = 5;

const SHIFT_BLOCK_KEYS = Object.freeze({
  introKey: "shifts.delete_blocked_intro",
  footerKey: "shifts.delete_blocked_footer",
});

/**
 * @param {unknown} run
 * @returns {string[]}
 */
export const resolveShiftIdsFromRun = (run) => {
  const directIds = [
    run?.input_params?.shift_ids,
    run?.inputParams?.shift_ids,
    run?.shift_ids,
    run?.shiftIds,
  ].find((value) => Array.isArray(value));

  if (Array.isArray(directIds)) {
    return directIds.map((id) => text(id)).filter(Boolean);
  }

  const single = text(run?.shift_id ?? run?.shiftId);
  return single ? [single] : [];
};

/**
 * List items omit `input_params`; detail records include it.
 *
 * @param {unknown} run
 * @returns {boolean}
 */
export const hasReliableShiftIds = (run) => {
  if (run?.input_params != null || run?.inputParams != null) {
    return true;
  }

  if (Array.isArray(run?.shift_ids) || Array.isArray(run?.shiftIds)) {
    return true;
  }

  return Boolean(text(run?.shift_id ?? run?.shiftId));
};

/**
 * @param {unknown} run
 * @param {Set<string>} selectedShiftIds
 * @returns {boolean}
 */
export const runReferencesAnyShift = (run, selectedShiftIds) => {
  return resolveShiftIdsFromRun(run).some((shiftId) =>
    selectedShiftIds.has(shiftId)
  );
};

/**
 * @param {unknown} optimizationRuns
 * @param {unknown} selectedShiftIds
 * @returns {import("./protected-delete.js").DeletionBlocker[]}
 */
export const findOptimizationRunBlockersForShifts = (
  optimizationRuns,
  selectedShiftIds
) => {
  const selectedIds = new Set(
    (Array.isArray(selectedShiftIds) ? selectedShiftIds : [])
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
    if (!runReferencesAnyShift(run, selectedIds)) {
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
 * Fetch optimization-run details needed for shift dependency checks.
 *
 * Fails safe: any required detail failure rejects the whole operation.
 *
 * @param {Object} options
 * @param {unknown[]} options.runs
 * @param {(runId: string) => Promise<unknown>} options.fetchOptimizationRunDetail
 * @param {number} [options.concurrency]
 * @returns {Promise<unknown[]>}
 */
export const loadOptimizationRunsForShiftDependencyCheck = async ({
  runs = [],
  fetchOptimizationRunDetail,
  concurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => {
  if (typeof fetchOptimizationRunDetail !== "function") {
    throw new Error("Missing optimization run detail fetcher.");
  }

  const uniqueRuns = [];
  const seenRunIds = new Set();
  for (const run of Array.isArray(runs) ? runs : []) {
    const runId = text(run?.id);
    if (!runId || seenRunIds.has(runId)) {
      continue;
    }
    seenRunIds.add(runId);
    uniqueRuns.push(run);
  }

  const detailCache = new Map();
  const failures = [];
  const limit = Math.max(1, Math.floor(Number(concurrency)) || DEFAULT_DETAIL_CONCURRENCY);
  const hydrated = [];

  const loadDetail = async (run) => {
    const runId = text(run?.id);
    if (!runId) {
      failures.push(new Error("Missing optimization run id."));
      return;
    }

    if (hasReliableShiftIds(run)) {
      hydrated.push(run);
      return;
    }

    if (detailCache.has(runId)) {
      const cached = detailCache.get(runId);
      if (cached === null) {
        failures.push(new Error(`Unable to load optimization run ${runId}.`));
        return;
      }
      hydrated.push({ ...run, ...cached });
      return;
    }

    try {
      const detail = await fetchOptimizationRunDetail(runId);
      if (!detail || typeof detail !== "object") {
        detailCache.set(runId, null);
        failures.push(new Error(`Invalid optimization run detail for ${runId}.`));
        return;
      }
      detailCache.set(runId, detail);
      hydrated.push({ ...run, ...detail });
    } catch (error) {
      detailCache.set(runId, null);
      failures.push(error);
    }
  };

  for (let index = 0; index < uniqueRuns.length; index += limit) {
    const batch = uniqueRuns.slice(index, index + limit);
    await Promise.all(batch.map((run) => loadDetail(run)));
  }

  if (failures.length) {
    throw failures[0];
  }

  return hydrated;
};

/**
 * @param {Object} options
 * @param {string[]} options.selectedShiftIds
 * @param {() => Promise<unknown[]>} options.fetchAllOptimizationRuns
 * @param {(runId: string) => Promise<unknown>} options.fetchOptimizationRunDetail
 * @param {(message: string) => void} [options.showFlash]
 * @param {(key: string, params?: Record<string, string|number>) => string} [options.translate]
 * @param {number} [options.concurrency]
 */
export const prepareShiftDeletion = async ({
  selectedShiftIds,
  fetchAllOptimizationRuns,
  fetchOptimizationRunDetail,
  showFlash,
  translate,
  concurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => {
  try {
    const listRuns = await fetchAllOptimizationRuns();
    const runsWithDetails = await loadOptimizationRunsForShiftDependencyCheck({
      runs: listRuns,
      fetchOptimizationRunDetail,
      concurrency,
    });
    const blockers = findOptimizationRunBlockersForShifts(
      runsWithDetails,
      selectedShiftIds
    );
    const { blocked } = guardProtectedDeletion({
      blockers,
      showFlash,
      translate,
      ...SHIFT_BLOCK_KEYS,
    });

    if (blocked) {
      return { proceed: false, reason: "blocked", blockers };
    }

    return { proceed: true, blockers: [] };
  } catch (error) {
    const message =
      typeof translate === "function"
        ? translate("shifts.delete_dependency_check_failed")
        : "Unable to verify dependencies.";
    if (typeof showFlash === "function") {
      showFlash(message);
    }
    return { proceed: false, reason: "dependency_check_failed", error };
  }
};

/**
 * @param {unknown} error
 * @param {(key: string, params?: Record<string, string|number>) => string} [translate]
 * @returns {{ kind: "blocked" | "failure", message?: string, error: unknown }}
 */
export const resolveShiftDeleteFailure = (error, translate) => {
  if (isBlockedDeleteError(error)) {
    if (error.blockers?.length) {
      return {
        kind: DELETE_ERROR_KIND.BLOCKED,
        message: formatBlockedDeletionMessage(error.blockers, translate, {
          ...SHIFT_BLOCK_KEYS,
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

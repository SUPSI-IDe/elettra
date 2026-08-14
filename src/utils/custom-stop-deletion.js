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
import { resolveDepotStopIdsFromShiftForDeletion } from "../pages/Fleet/Shifts/shift-utils.js";

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

export const DEFAULT_DETAIL_CONCURRENCY = 5;

const CUSTOM_STOP_BLOCK_KEYS = Object.freeze({
  introKey: "custom_stops.delete_blocked_intro",
  footerKey: "custom_stops.delete_blocked_footer",
});

/**
 * depot.id      = depot resource identity (DELETE target)
 * depot.stop_id = linked GTFS stop identity used by references
 *
 * @param {unknown} selectedDepotIds
 * @param {unknown[]} depots
 * @returns {{ ok: boolean, stopIds: string[] }}
 */
export const resolveSelectedDepotStopIds = (selectedDepotIds, depots = []) => {
  const ids = Array.isArray(selectedDepotIds) ? selectedDepotIds : [];
  const stopIds = [];

  for (const depotId of ids) {
    const normalizedDepotId = text(depotId);
    if (!normalizedDepotId) {
      return { ok: false, stopIds: [] };
    }

    const depot = (Array.isArray(depots) ? depots : []).find(
      (candidate) => text(candidate?.id) === normalizedDepotId
    );
    const stopId = text(depot?.stop_id);
    if (!stopId) {
      return { ok: false, stopIds: [] };
    }
    stopIds.push(stopId);
  }

  return { ok: true, stopIds: [...new Set(stopIds)] };
};

/**
 * @param {unknown[]} records
 * @param {(record: unknown) => string} getRecordId
 * @param {(record: unknown) => boolean} hasReliableFields
 * @param {(id: string) => Promise<unknown>} fetchDetail
 * @param {number} [concurrency]
 * @returns {Promise<unknown[]>}
 */
export const hydrateRecordsWithDetails = async ({
  records = [],
  getRecordId,
  hasReliableFields,
  fetchDetail,
  concurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => {
  if (typeof fetchDetail !== "function") {
    throw new Error("Missing detail fetcher.");
  }
  if (typeof getRecordId !== "function" || typeof hasReliableFields !== "function") {
    throw new Error("Missing record helpers.");
  }

  const uniqueRecords = [];
  const seenIds = new Set();
  for (const record of Array.isArray(records) ? records : []) {
    const recordId = text(getRecordId(record));
    if (!recordId || seenIds.has(recordId)) {
      continue;
    }
    seenIds.add(recordId);
    uniqueRecords.push(record);
  }

  const detailCache = new Map();
  const failures = [];
  const limit = Math.max(
    1,
    Math.floor(Number(concurrency)) || DEFAULT_DETAIL_CONCURRENCY
  );
  const hydrated = [];

  const loadDetail = async (record) => {
    const recordId = text(getRecordId(record));
    if (!recordId) {
      failures.push(new Error("Missing record id."));
      return;
    }

    if (hasReliableFields(record)) {
      hydrated.push(record);
      return;
    }

    if (detailCache.has(recordId)) {
      const cached = detailCache.get(recordId);
      if (cached === null) {
        failures.push(new Error(`Unable to load record ${recordId}.`));
        return;
      }
      hydrated.push({ ...record, ...cached });
      return;
    }

    try {
      const detail = await fetchDetail(recordId);
      if (!detail || typeof detail !== "object") {
        detailCache.set(recordId, null);
        failures.push(new Error(`Invalid detail for record ${recordId}.`));
        return;
      }
      detailCache.set(recordId, detail);
      hydrated.push({ ...record, ...detail });
    } catch (error) {
      detailCache.set(recordId, null);
      failures.push(error);
    }
  };

  for (let index = 0; index < uniqueRecords.length; index += limit) {
    const batch = uniqueRecords.slice(index, index + limit);
    await Promise.all(batch.map((record) => loadDetail(record)));
  }

  if (failures.length) {
    throw failures[0];
  }

  return hydrated;
};

/**
 * Legacy explicit-field fallback only. Live shift detail responses omit these fields.
 *
 * @param {unknown} shift
 * @returns {string[]}
 */
export const resolveDepotIdsFromShift = (shift) => {
  const depotIds = [
    shift?.start_depot_id,
    shift?.startDepotId,
    shift?.start_depot?.id,
    shift?.end_depot_id,
    shift?.endDepotId,
    shift?.end_depot?.id,
  ]
    .map((value) => text(value))
    .filter(Boolean);

  return [...new Set(depotIds)];
};

/**
 * Shift list items omit structure; detail records include it.
 *
 * @param {unknown} shift
 * @returns {boolean}
 */
export const hasReliableShiftDepotIds = (shift) => {
  if (!shift || typeof shift !== "object") {
    return false;
  }

  return Array.isArray(shift.structure) && shift.structure.length > 0;
};

/**
 * @param {unknown} shift
 * @param {Set<string>} selectedDepotStopIds
 * @returns {boolean}
 */
export const shiftReferencesAnyDepot = (shift, selectedDepotStopIds) => {
  const stopIds = Array.isArray(shift?._depotStopIds) ? shift._depotStopIds : [];
  return stopIds
    .map((value) => text(value))
    .filter(Boolean)
    .some((stopId) => selectedDepotStopIds.has(stopId));
};

/**
 * @param {unknown} run
 * @returns {string[]}
 */
export const resolveChargingStationStopIdsFromRun = (run) => {
  const stations =
    run?.input_params?.charging_stations ??
    run?.inputParams?.charging_stations ??
    run?.charging_stations ??
    run?.chargingStations;

  if (!Array.isArray(stations)) {
    return [];
  }

  return [
    ...new Set(
      stations
        .map((station) => text(station?.stop_id ?? station?.stopId))
        .filter(Boolean)
    ),
  ];
};

/**
 * @param {unknown} run
 * @returns {boolean}
 */
export const hasReliableChargingStations = (run) =>
  run?.input_params != null || run?.inputParams != null;

/**
 * @param {unknown} run
 * @param {Set<string>} selectedDepotStopIds
 * @returns {boolean}
 */
export const runReferencesAnyDepot = (run, selectedDepotStopIds) =>
  resolveChargingStationStopIdsFromRun(run).some((stopId) =>
    selectedDepotStopIds.has(stopId)
  );

/**
 * @param {unknown} shifts
 * @param {unknown} selectedDepotStopIds
 * @returns {import("./protected-delete.js").DeletionBlocker[]}
 */
export const findShiftBlockersForDepots = (shifts, selectedDepotStopIds) => {
  const selectedIds = new Set(
    (Array.isArray(selectedDepotStopIds) ? selectedDepotStopIds : [])
      .map((id) => text(id))
      .filter(Boolean)
  );

  if (!selectedIds.size) {
    return [];
  }

  const seenShiftIds = new Set();
  const blockers = [];

  for (const shift of Array.isArray(shifts) ? shifts : []) {
    if (!shiftReferencesAnyDepot(shift, selectedIds)) {
      continue;
    }

    const shiftId = text(shift?.id);
    if (shiftId) {
      if (seenShiftIds.has(shiftId)) {
        continue;
      }
      seenShiftIds.add(shiftId);
    }

    const blocker = {
      type: DELETION_BLOCKER_TYPES.SHIFT,
    };
    if (shiftId) {
      blocker.id = shiftId;
    }

    const name = text(shift?.name);
    if (name) {
      blocker.name = name;
    }

    blockers.push(blocker);
  }

  return blockers;
};

/**
 * @param {unknown} optimizationRuns
 * @param {unknown} selectedDepotStopIds
 * @returns {import("./protected-delete.js").DeletionBlocker[]}
 */
export const findOptimizationRunBlockersForDepots = (
  optimizationRuns,
  selectedDepotStopIds
) => {
  const selectedIds = new Set(
    (Array.isArray(selectedDepotStopIds) ? selectedDepotStopIds : [])
      .map((id) => text(id))
      .filter(Boolean)
  );

  if (!selectedIds.size) {
    return [];
  }

  const seenRunIds = new Set();
  const blockers = [];

  for (const run of Array.isArray(optimizationRuns) ? optimizationRuns : []) {
    if (!runReferencesAnyDepot(run, selectedIds)) {
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
 * @param {import("./protected-delete.js").DeletionBlocker[]} shiftBlockers
 * @param {import("./protected-delete.js").DeletionBlocker[]} optimizationRunBlockers
 * @returns {import("./protected-delete.js").DeletionBlocker[]}
 */
export const aggregateDepotDeletionBlockers = (
  shiftBlockers,
  optimizationRunBlockers
) => [...shiftBlockers, ...optimizationRunBlockers];

const enrichShiftsWithDepotStopIds = async ({
  shifts = [],
  fetchShiftInfo,
  fetchTripStops,
  concurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => {
  if (typeof fetchShiftInfo !== "function") {
    throw new Error("Missing shift info fetcher.");
  }
  if (typeof fetchTripStops !== "function") {
    throw new Error("Missing trip stops fetcher.");
  }

  const tripStopCache = new Map();
  const enriched = [];
  const failures = [];
  const limit = Math.max(
    1,
    Math.floor(Number(concurrency)) || DEFAULT_DETAIL_CONCURRENCY
  );

  const enrichOne = async (shift) => {
    const shiftId = text(shift?.id);
    if (!shiftId) {
      failures.push(new Error("Missing shift id."));
      return;
    }

    try {
      const shiftInfo = await fetchShiftInfo(shiftId);
      const depotStopIds = await resolveDepotStopIdsFromShiftForDeletion({
        shift,
        shiftInfo,
        fetchTripStops,
        tripStopCache,
      });
      enriched.push({ ...shift, _depotStopIds: depotStopIds });
    } catch (error) {
      failures.push(error);
    }
  };

  for (let index = 0; index < shifts.length; index += limit) {
    const batch = shifts.slice(index, index + limit);
    await Promise.all(batch.map((shift) => enrichOne(shift)));
  }

  if (failures.length) {
    throw failures[0];
  }

  return enriched;
};

/**
 * @param {Object} options
 * @param {unknown[]} options.selectedDepotStopIds
 * @param {() => Promise<unknown[]>} options.fetchAllShifts
 * @param {(shiftId: string) => Promise<unknown>} options.fetchShiftDetail
 * @param {(shiftId: string) => Promise<unknown>} options.fetchShiftInfo
 * @param {(tripId: string) => Promise<unknown>} options.fetchTripStops
 * @param {() => Promise<unknown[]>} options.fetchAllOptimizationRuns
 * @param {(runId: string) => Promise<unknown>} options.fetchOptimizationRunDetail
 * @param {number} [options.concurrency]
 */
export const collectDepotDeletionBlockers = async ({
  selectedDepotStopIds,
  fetchAllShifts,
  fetchShiftDetail,
  fetchShiftInfo,
  fetchTripStops,
  fetchAllOptimizationRuns,
  fetchOptimizationRunDetail,
  concurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => {
  const [listShifts, listRuns] = await Promise.all([
    fetchAllShifts(),
    fetchAllOptimizationRuns(),
  ]);

  const shiftsWithDetails = await hydrateRecordsWithDetails({
    records: listShifts,
    getRecordId: (shift) => shift?.id,
    hasReliableFields: hasReliableShiftDepotIds,
    fetchDetail: fetchShiftDetail,
    concurrency,
  });

  const [shiftsWithDepotStopIds, runsWithDetails] = await Promise.all([
    enrichShiftsWithDepotStopIds({
      shifts: shiftsWithDetails,
      fetchShiftInfo,
      fetchTripStops,
      concurrency,
    }),
    hydrateRecordsWithDetails({
      records: listRuns,
      getRecordId: (run) => run?.id,
      hasReliableFields: hasReliableChargingStations,
      fetchDetail: fetchOptimizationRunDetail,
      concurrency,
    }),
  ]);

  return aggregateDepotDeletionBlockers(
    findShiftBlockersForDepots(shiftsWithDepotStopIds, selectedDepotStopIds),
    findOptimizationRunBlockersForDepots(runsWithDetails, selectedDepotStopIds)
  );
};

const failDependencyCheck = (showFlash, translate) => {
  const message =
    typeof translate === "function"
      ? translate("custom_stops.delete_dependency_check_failed")
      : "Unable to verify dependencies.";
  if (typeof showFlash === "function") {
    showFlash(message);
  }
  return {
    proceed: false,
    reason: "dependency_check_failed",
  };
};

/**
 * @param {Object} options
 * @param {string[]} options.selectedDepotIds
 * @param {unknown[]} [options.depots]
 * @param {string[]} [options.selectedDepotStopIds]
 * @param {() => Promise<unknown[]>} options.fetchAllShifts
 * @param {(shiftId: string) => Promise<unknown>} options.fetchShiftDetail
 * @param {(shiftId: string) => Promise<unknown>} options.fetchShiftInfo
 * @param {(tripId: string) => Promise<unknown>} options.fetchTripStops
 * @param {() => Promise<unknown[]>} options.fetchAllOptimizationRuns
 * @param {(runId: string) => Promise<unknown>} options.fetchOptimizationRunDetail
 * @param {(message: string) => void} [options.showFlash]
 * @param {(key: string, params?: Record<string, string|number>) => string} [options.translate]
 * @param {number} [options.concurrency]
 */
export const prepareCustomStopDeletion = async ({
  selectedDepotIds,
  depots = [],
  selectedDepotStopIds: providedStopIds,
  fetchAllShifts,
  fetchShiftDetail,
  fetchShiftInfo,
  fetchTripStops,
  fetchAllOptimizationRuns,
  fetchOptimizationRunDetail,
  showFlash,
  translate,
  concurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => {
  const normalizedDepotIds = (Array.isArray(selectedDepotIds) ? selectedDepotIds : [])
    .map((id) => text(id))
    .filter(Boolean);

  let selectedDepotStopIds = (Array.isArray(providedStopIds) ? providedStopIds : [])
    .map((id) => text(id))
    .filter(Boolean);

  if (!selectedDepotStopIds.length) {
    const resolved = resolveSelectedDepotStopIds(normalizedDepotIds, depots);
    if (!resolved.ok) {
      return failDependencyCheck(showFlash, translate);
    }
    selectedDepotStopIds = resolved.stopIds;
  }

  if (
    normalizedDepotIds.length &&
    selectedDepotStopIds.length !== normalizedDepotIds.length
  ) {
    return failDependencyCheck(showFlash, translate);
  }

  try {
    const blockers = await collectDepotDeletionBlockers({
      selectedDepotStopIds,
      fetchAllShifts,
      fetchShiftDetail,
      fetchShiftInfo,
      fetchTripStops,
      fetchAllOptimizationRuns,
      fetchOptimizationRunDetail,
      concurrency,
    });
    const { blocked } = guardProtectedDeletion({
      blockers,
      showFlash,
      translate,
      ...CUSTOM_STOP_BLOCK_KEYS,
    });

    if (blocked) {
      return { proceed: false, reason: "blocked", blockers };
    }

    return { proceed: true, blockers: [] };
  } catch (error) {
    const message =
      typeof translate === "function"
        ? translate("custom_stops.delete_dependency_check_failed")
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
 */
export const resolveCustomStopDeleteFailure = (error, translate) => {
  if (isBlockedDeleteError(error)) {
    if (error.blockers?.length) {
      return {
        kind: DELETE_ERROR_KIND.BLOCKED,
        message: formatBlockedDeletionMessage(error.blockers, translate, {
          ...CUSTOM_STOP_BLOCK_KEYS,
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

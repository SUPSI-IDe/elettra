const text = (value) =>
  value === null || value === undefined ? "" : String(value);

export const normalizeChargingStopShiftIds = (shiftIds = []) =>
  [...new Set(
    (Array.isArray(shiftIds) ? shiftIds : [])
      .map((shiftId) => text(shiftId).trim())
      .filter(Boolean)
  )].sort();

export const chargingStopSelectionKey = (shiftIds = []) =>
  normalizeChargingStopShiftIds(shiftIds).join(",");

export const normalizeChargingStopCandidate = (candidate = {}) => {
  const stopId = text(candidate.stop_id ?? candidate.stopId).trim();
  const rawDepotBusCount = Number(
    candidate.depot_bus_count ?? candidate.depotBusCount ?? 0
  );

  return {
    stop_id: stopId,
    stop_name: text(
      candidate.stop_name ?? candidate.stopName ?? stopId
    ).trim(),
    isCustom: Boolean(candidate.is_custom ?? candidate.isCustom),
    isDepot: Boolean(candidate.is_depot ?? candidate.isDepot),
    depotBusCount: Number.isFinite(rawDepotBusCount)
      ? Math.max(0, Math.trunc(rawDepotBusCount))
      : 0,
  };
};

export const createChargingStopCandidateLoader = (fetchCandidates) => {
  if (typeof fetchCandidates !== "function") {
    throw new TypeError("fetchCandidates must be a function");
  }

  const cache = new Map();

  return {
    keyFor: chargingStopSelectionKey,
    has: (key) => cache.has(key),
    delete: (key) => cache.delete(key),
    clear: () => cache.clear(),
    load(shiftIds, { signal } = {}) {
      const normalizedShiftIds = normalizeChargingStopShiftIds(shiftIds);
      const key = chargingStopSelectionKey(normalizedShiftIds);
      if (!key) return Promise.resolve([]);
      if (cache.has(key)) return cache.get(key);

      const pending = Promise.resolve()
        .then(() => fetchCandidates(normalizedShiftIds, { signal }))
        .then((payload) =>
          (Array.isArray(payload) ? payload : [])
            .map(normalizeChargingStopCandidate)
            .filter((candidate) => candidate.stop_id)
        )
        .catch((error) => {
          if (cache.get(key) === pending) {
            cache.delete(key);
          }
          throw error;
        });

      cache.set(key, pending);
      return pending;
    },
  };
};

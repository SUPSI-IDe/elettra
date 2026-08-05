/**
 * Resolves prediction runs by id without issuing one request per id.
 *
 * `GET /prediction-runs/` cannot serve as a filtered batch call: it declares no
 * query parameters and ignores the ones we send, always returning the caller's
 * entire history as a bare array. It is still the cheaper option once a page
 * needs more ids than the browser will fetch in parallel — one response instead
 * of a queue of requests. Below that point the per-id route wins, because the
 * list grows with the account's history and never paginates.
 *
 * Ids the server reports as absent are remembered, so a run that no longer
 * exists is asked for once per session rather than on every visit.
 */

// Browsers cap HTTP/1.1 connections per host at six, so a seventh id is where a
// fan-out stops running in parallel and starts queueing.
export const DEFAULT_LIST_THRESHOLD = 7;

const idOf = (value) =>
  value === null || value === undefined ? "" : String(value);

const asRunArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

export const createPredictionRunIndex = ({
  fetchOne,
  fetchAll,
  listThreshold = DEFAULT_LIST_THRESHOLD,
}) => {
  const runsById = new Map();
  const absentIds = new Set();

  const prime = (payload) => {
    for (const run of asRunArray(payload)) {
      const id = idOf(run?.id);
      if (!id) continue;
      runsById.set(id, run);
      absentIds.delete(id);
    }
  };

  const invalidate = () => {
    runsById.clear();
    absentIds.clear();
  };

  const resolveByList = async (unresolved, errors) => {
    try {
      prime(await fetchAll());
    } catch (error) {
      errors.push({ id: null, error });
      return;
    }
    // The list is the account's complete history, so an id it did not carry
    // does not exist.
    for (const id of unresolved) {
      if (!runsById.has(id)) absentIds.add(id);
    }
  };

  const resolveOneByOne = async (unresolved, errors) => {
    const settled = await Promise.allSettled(
      unresolved.map((id) => fetchOne(id))
    );

    settled.forEach((result, index) => {
      const id = unresolved[index];
      if (result.status === "fulfilled") {
        if (result.value) runsById.set(id, result.value);
        else absentIds.add(id);
        return;
      }
      if (result.reason?.status === 404) absentIds.add(id);
      else errors.push({ id, error: result.reason });
    });
  };

  /**
   * @returns {Promise<{runs: Array, byId: Map, missing: string[], errors: Array}>}
   *   `missing` holds ids the server says do not exist; `errors` holds failures
   *   that say nothing about whether the run exists. Callers should show an
   *   empty state for the first and a failure state for the second.
   */
  const resolve = async (ids, { refresh = false } = {}) => {
    const wanted = [
      ...new Set((Array.isArray(ids) ? ids : []).map(idOf).filter(Boolean)),
    ];

    if (refresh) {
      for (const id of wanted) {
        runsById.delete(id);
        absentIds.delete(id);
      }
    }

    const unresolved = wanted.filter(
      (id) => !runsById.has(id) && !absentIds.has(id)
    );
    const errors = [];

    if (unresolved.length >= listThreshold) {
      await resolveByList(unresolved, errors);
    } else if (unresolved.length) {
      await resolveOneByOne(unresolved, errors);
    }

    const byId = new Map();
    for (const id of wanted) {
      if (runsById.has(id)) byId.set(id, runsById.get(id));
    }

    return {
      runs: [...byId.values()],
      byId,
      missing: wanted.filter((id) => !byId.has(id)),
      errors,
    };
  };

  return { resolve, prime, invalidate };
};

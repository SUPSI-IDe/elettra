/**
 * Screens shift ids against the caller's own shift list before anything fetches
 * them one at a time.
 *
 * Unlike prediction runs, the shift list cannot stand in for the detail call: it
 * returns the lightweight `ShiftListItemRead` projection (id, name, bus_id,
 * trip_count) while most callers need the full structure. What it can do is
 * answer "does this id still exist?", and that is where the cost sits — a shift
 * an optimization references but that no longer exists costs two failed
 * requests (`/info`, then the `fetchShiftById` fallback) and two console
 * warnings, per id. Callers that only need a name can be served from the
 * projection outright.
 *
 * The sweep costs one request per 100 shifts, so it only pays once the caller is
 * asking about more ids than the sweep will cost.
 *
 * Screening always fails open: if the sweep cannot be done, every id is returned
 * as a candidate and the caller behaves exactly as it did before.
 */

// A sweep is a handful of paginated requests; below this many ids the per-id
// route is cheaper even when every one of them is a dangling reference.
export const DEFAULT_SCREEN_THRESHOLD = 8;

const idOf = (value) =>
  value === null || value === undefined ? "" : String(value);

export const createShiftIndex = ({
  fetchAll,
  listThreshold = DEFAULT_SCREEN_THRESHOLD,
}) => {
  let summariesById = null;

  const invalidate = () => {
    summariesById = null;
  };

  const sweep = async (errors) => {
    try {
      const shifts = await fetchAll();
      const next = new Map();
      for (const shift of Array.isArray(shifts) ? shifts : []) {
        const id = idOf(shift?.id);
        if (id) next.set(id, shift);
      }
      summariesById = next;
    } catch (error) {
      errors.push({ error });
    }
  };

  /**
   * @returns {Promise<{candidates: string[], missing: string[], summaries: Map, errors: Array}>}
   *   `candidates` are ids worth fetching — either confirmed to exist or not
   *   screened at all. `missing` are ids the list proves are gone; skip them.
   *   `summaries` holds the list projection for whatever was screened.
   */
  const screen = async (ids) => {
    const wanted = [
      ...new Set((Array.isArray(ids) ? ids : []).map(idOf).filter(Boolean)),
    ];
    const errors = [];

    if (!summariesById && wanted.length >= listThreshold) {
      await sweep(errors);
    }

    if (!summariesById) {
      return { candidates: wanted, missing: [], summaries: new Map(), errors };
    }

    const summaries = new Map();
    const candidates = [];
    const missing = [];

    for (const id of wanted) {
      if (summariesById.has(id)) {
        summaries.set(id, summariesById.get(id));
        candidates.push(id);
      } else {
        missing.push(id);
      }
    }

    return { candidates, missing, summaries, errors };
  };

  return { screen, invalidate };
};

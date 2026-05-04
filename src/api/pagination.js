/**
 * Shared pagination helpers used by paginated backend endpoints.
 *
 * The backend exposes a uniform paginated envelope:
 *
 *   {
 *     items:        T[],
 *     total:        number,
 *     skip:         number,
 *     limit:        number,
 *     count:        number,
 *     has_next:     boolean,
 *     has_previous: boolean,
 *   }
 *
 * The endpoints accept ?skip=...&limit=... where `limit` must be one of
 * 20, 50 or 100.  We never request all records with a single big limit
 * such as 1000 — when callers genuinely need every row, they should use
 * `fetchAllPages` which iterates page-by-page using the maximum allowed
 * page size.
 */

/** Allowed page sizes accepted by the backend. */
export const PAGE_SIZE_OPTIONS = Object.freeze([20, 50, 100]);

/** Default page size used when the caller does not specify one. */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size accepted by the backend. */
export const MAX_PAGE_SIZE = 100;

/**
 * Coerce a value into one of the allowed page sizes.  Falls back to the
 * provided default (typically `DEFAULT_PAGE_SIZE`) when the value is not
 * one of the allowed options.
 *
 * @param {number|string|null|undefined} value
 * @param {number} [fallback=DEFAULT_PAGE_SIZE]
 * @returns {number}
 */
export const coercePageSize = (value, fallback = DEFAULT_PAGE_SIZE) => {
  const numeric = Number(value);
  if (PAGE_SIZE_OPTIONS.includes(numeric)) {
    return numeric;
  }
  return PAGE_SIZE_OPTIONS.includes(fallback) ? fallback : DEFAULT_PAGE_SIZE;
};

/**
 * Coerce a `skip` value to a non-negative integer.
 *
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
export const coerceSkip = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
};

/**
 * Build a `{skip, limit}` query object suitable for the paginated API
 * endpoints.  Both values are normalized to the allowed ranges.
 *
 * @param {number} [skip=0]
 * @param {number} [limit=DEFAULT_PAGE_SIZE]
 */
export const buildPaginationParams = (skip = 0, limit = DEFAULT_PAGE_SIZE) => ({
  skip: coerceSkip(skip),
  limit: coercePageSize(limit),
});

/**
 * Normalize a server response into the canonical paginated envelope.
 *
 * The new backend always returns the envelope shape directly, but this
 * helper also tolerates legacy bare arrays and `{ results: [...] }`
 * payloads so the frontend keeps working during deployment overlap.
 *
 * @template T
 * @param {T[] | { items?: T[]; results?: T[]; total?: number; skip?: number; limit?: number; count?: number; has_next?: boolean; has_previous?: boolean } | null | undefined} response
 * @param {number} [skip=0]
 * @param {number} [limit=DEFAULT_PAGE_SIZE]
 * @returns {{ items: T[]; total: number; skip: number; limit: number; count: number; has_next: boolean; has_previous: boolean }}
 */
export const normalizePaginatedResponse = (
  response,
  skip = 0,
  limit = DEFAULT_PAGE_SIZE
) => {
  const normalizedSkip = coerceSkip(skip);
  const normalizedLimit = coercePageSize(limit);

  if (Array.isArray(response)) {
    const items = response;
    return {
      items,
      total: items.length,
      skip: normalizedSkip,
      limit: normalizedLimit,
      count: items.length,
      has_next: false,
      has_previous: normalizedSkip > 0,
    };
  }

  if (response && typeof response === "object") {
    const items = Array.isArray(response.items)
      ? response.items
      : Array.isArray(response.results)
        ? response.results
        : [];
    const count = Number.isFinite(response.count)
      ? Number(response.count)
      : items.length;
    const total = Number.isFinite(response.total)
      ? Number(response.total)
      : items.length;
    const responseSkip = Number.isFinite(response.skip)
      ? Number(response.skip)
      : normalizedSkip;
    const responseLimit = PAGE_SIZE_OPTIONS.includes(Number(response.limit))
      ? Number(response.limit)
      : normalizedLimit;

    return {
      items,
      total,
      skip: responseSkip,
      limit: responseLimit,
      count,
      has_next:
        typeof response.has_next === "boolean"
          ? response.has_next
          : responseSkip + count < total,
      has_previous:
        typeof response.has_previous === "boolean"
          ? response.has_previous
          : responseSkip > 0,
    };
  }

  return {
    items: [],
    total: 0,
    skip: normalizedSkip,
    limit: normalizedLimit,
    count: 0,
    has_next: false,
    has_previous: normalizedSkip > 0,
  };
};

/**
 * Fetch every page of a paginated endpoint by iterating with the maximum
 * allowed page size and concatenating the results.  Use this only when
 * the caller genuinely needs every row (typically to populate selectors
 * or maps); list pages should drive pagination via UI controls instead.
 *
 * @template T
 * @param {(params: { skip: number; limit: number }) => Promise<{ items: T[]; total?: number; count?: number; has_next?: boolean }>} fetchPage
 * @param {{ pageSize?: number; extraParams?: Record<string, unknown>; maxPages?: number }} [options]
 * @returns {Promise<T[]>}
 */
export const fetchAllPages = async (fetchPage, options = {}) => {
  const pageSize = coercePageSize(options.pageSize, MAX_PAGE_SIZE);
  const maxPages = Number.isFinite(options.maxPages)
    ? Math.max(1, Math.floor(Number(options.maxPages)))
    : 200;
  const extraParams = options.extraParams ?? {};

  const aggregated = [];
  let skip = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchPage({ ...extraParams, skip, limit: pageSize });
    const envelope = normalizePaginatedResponse(response, skip, pageSize);
    aggregated.push(...envelope.items);

    const advanced = envelope.count || envelope.items.length;
    if (!envelope.has_next || advanced === 0) {
      break;
    }
    skip += advanced;
    if (Number.isFinite(envelope.total) && skip >= envelope.total) {
      break;
    }
  }

  return aggregated;
};

/**
 * Compute the human-readable range "Showing {start}–{end} of {total}"
 * style numbers based on the paginated response state.
 *
 * @param {{ skip: number; limit: number; count: number; total: number }} state
 */
export const computeRange = ({ skip = 0, count = 0, total = 0 } = {}) => {
  if (!Number.isFinite(total) || total <= 0 || count <= 0) {
    return { start: 0, end: 0 };
  }
  const start = skip + 1;
  const end = Math.min(skip + count, total);
  return { start, end };
};

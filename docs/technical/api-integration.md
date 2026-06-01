# API Integration

> Last updated: 2026-06-01

How the ELETTRA frontend communicates with the backend API.

---

## API client (`src/api/client.js`)

The central module providing:

### `API_ROOT`

Resolved from `src/config.js`. In development, this is typically empty (relative paths). In production, it can be set via `VITE_API_ROOT`.

### `authHeaders()`

Returns headers with the JWT token:

```javascript
{ accept: "application/json", Authorization: "Bearer <token>" }
```

### `installAuthRedirectHandler(onUnauthorized)`

Wraps `globalThis.fetch` to intercept 401/403 responses on API calls. When detected, invokes the provided callback (which clears the session and navigates to login).

---

## API modules

Each domain has its own module in `src/api/`:

| Module | Domain | Key operations |
|--------|--------|---------------|
| `auth.js` | Authentication | `authenticate`, `registerUser` |
| `session.js` | Session | `initializeSession`, `isAuthenticated`, `handleUnauthorizedSession` |
| `buses.js` | Buses | CRUD for bus instances |
| `bus-models.js` | Bus models | CRUD for bus model specifications |
| `depots.js` | Depots | CRUD for depot locations |
| `shifts.js` | Shifts | CRUD + shift info + yearly distance |
| `gtfs.js` | GTFS data | Routes, trips, stops, calendar, variants, elevation |
| `simulation.js` | Simulation | Prediction runs, optimization runs, yearly analysis, economic comparison, weather clusters |
| `environmental.js` | Environmental | LCA vehicles, vehicle impact, shift yearly impact, electricity mixes |
| `pagination.js` | Utility | `buildPaginationParams`, `fetchAllPages`, `normalizePaginatedResponse` |

All modules are re-exported from `src/api/index.js`.

---

## Common patterns

### Error handling

Every API function follows this pattern:

```javascript
const response = await fetch(url, { method, headers, body });
const payload = await response.json().catch(() => null);
if (!response.ok) {
  const message =
    payload?.detail?.[0]?.msg ??
    payload?.detail ??
    "Fallback error message.";
  throw new Error(typeof message === "string" ? message : JSON.stringify(message));
}
return payload;
```

Errors are normalized from the backend's FastAPI validation format (`detail[0].msg` for Pydantic errors, `detail` string for custom errors).

### Pagination

Backend endpoints return paginated responses. The frontend handles this with:

- `buildPaginationParams(skip, limit)` — Normalizes parameters
- `normalizePaginatedResponse(payload, skip, limit)` — Extracts `items`, `total`, metadata
- `fetchAllPages(fetcher)` — Iterates through all pages automatically

### Polling

Long-running operations (prediction runs, optimization runs) use polling:

```javascript
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60; // or 200 for optimization

// Poll until status is "completed", "done", "failed", or "error"
```

---

## Simulation workflow (API orchestration)

The most complex API flow is creating a feasibility evaluation:

1. `fetchBusModelById(id)` — Get model specs
2. For each battery pack count in range:
   - `createPredictionRuns({...})` — POST prediction run
3. `waitForPredictionRuns(ids)` — Poll until all complete
4. `createOptimizationRun({..., prediction_run_ids})` — POST optimization
5. `waitForOptimizationCompletion(runId)` — Poll until done

This is orchestrated in `createOptimizationRun()` and `createPredictionRunVariants()` within `src/api/simulation.js`.

---

## Backend API paths

| Frontend constant | Path prefix |
|-------------------|-------------|
| `API_ROOT` | Base URL (empty or absolute) |
| `SIMULATION_PATH` | `${API_ROOT}/api/v1/simulation` |
| `YEARLY_ANALYSIS_PATH` | `${API_ROOT}/api/v1/yearly-analysis` |
| `ECONOMIC_PATH` | `${API_ROOT}/api/v1/economic` |
| `ENV_PATH` | `${API_ROOT}/api/v1/environmental` |

Auth endpoints use `${API_ROOT}/auth/`.
Fleet endpoints use `${API_ROOT}/api/v1/user/`.
GTFS endpoints use `${API_ROOT}/api/v1/gtfs/`.

---

## Adding a new API call

1. Create or extend a module in `src/api/`
2. Use `authHeaders()` for authenticated endpoints
3. Follow the error handling pattern above
4. Export from `src/api/index.js` if broadly used
5. Handle pagination if the endpoint is paginated

---

## Related documentation

- [Architecture](architecture.md) — System overview and auth flow
- [API Reference](../api-reference.md) — Full endpoint catalog
- [Frontend Structure](frontend-structure.md) — Where API modules fit in the codebase

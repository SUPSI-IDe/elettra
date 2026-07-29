# Prediction-run and shift 404s, and the N+1 request fan-out

Status: done (frontend) / open (backend data)
Type: bug

Split out of ticket 14, which recorded this as a backend observation. It had a
frontend half too. The frontend half is resolved; the 404s are a server-side data
problem and stay open.

## Answered: the 404s are data, not routing

Probed against `isaac-elettra.dacd.supsi.ch:8002` with the test account on
2026-07-29.

The route is correct. `GET /prediction-runs/{run_id}` exists in the live
`/openapi.json`, matches the client exactly, and returns **200** for an id that
exists. No trailing-slash mismatch, no ownership scoping — everything involved
belongs to the same user as the token.

The test dataset has lost referential integrity:

- The 20 optimization runs reference **260 prediction_run_ids; 0 of 260 resolve.**
- The `input_params.shift_ids` on those runs (60 each) are **also 404** on
  `/api/v1/shifts/{id}`.
- 404 prediction runs do still exist for the account (created 2026-02-25 →
  2026-06-02), but none on any shift the surviving optimization runs reference.

So the shifts and their prediction runs were deleted and the optimization runs
were left pointing at them — no cascade, or a cleanup that missed them. Nothing
the frontend can repair. Needs a reseed or a backend cleanup of orphaned
optimization runs; **still open.**

A useful side effect: the list entry for a prediction run is byte-identical to
its per-id response, which is what makes the batching below safe.

## Fixed: the fan-out

New module `api/prediction-run-index.js` resolves prediction runs by id and
decides how to fetch them. The list endpoint cannot be used as a *filtered* batch
call — it ignores every query parameter and returns the account's whole history,
unpaginated (that is now ticket 18) — so the rule is a threshold rather than
"always batch":

- **≥ 7 unresolved ids** → one list request, indexed by id. Seven is where a
  fan-out stops fitting in the browser's six-connection-per-host budget and
  starts queueing.
- **< 7** → per-id requests, because the list body grows with account history and
  one small request beats pulling all of it.

Resolved runs and ids the server reports as absent are both remembered, so a
dangling reference is asked for once per session rather than on every visit.

The resolver separates **missing** (the server says it does not exist → empty
state) from **errors** (the request failed → error state); `fetchPredictionRun`
now attaches `error.status` so 404 can be told apart from 503. Ten unit tests in
`tests/prediction-run-index.test.mjs`.

Call sites:

- `simulation-results.js:9092` — `Promise.all` → resolver. A 404 no longer
  rejects the page load, so cost and efficiency keep rendering instead of being
  poisoned by the prediction failure, and the predictions panel falls through to
  its existing `simulation.predictions_no_data` empty state.
- `simulation-runs.js:892` — `enrichPredictionRunParameters` was resolving *every*
  prediction run id of *every* row while only ever reading the first id of rows
  missing a temperature or occupancy. Narrowed to what it reads. The page-local
  `predictionRunCache` was dropped; the resolver owns caching now.
- `api/simulation.js:151` — the creation poll. Uses `refresh: true`, so the
  threshold collapses each cycle to one list request while many runs are pending
  and reverts to per-id lookups as the set drains. A run that vanishes mid-poll
  now fails immediately instead of timing out after three minutes; request
  failures are tolerated and retried on the next cycle, which the old
  `Promise.all` could not do.
- `api/simulation.js:308` — post-poll fetch, now served from the poll's cache: 0
  extra requests.
- `yearly-analysis-results.js:578` — `backfillQuantiles`, same swap.

`deletePredictionRun` invalidates the index.

## Fixed: the same fan-out on shifts

The results page fired ~124 requests to `/api/v1/user/shifts/{id}`, nearly all
404 for the same orphaned-data reason — a referenced shift that no longer exists
costs *two* failed requests (`/info`, then the `fetchShiftById` fallback) and two
console warnings, per id.

The prediction-run trick does not transfer directly: the shift list returns the
lightweight `ShiftListItemRead` projection (id, name, bus_id, trip_count) while
most callers need the full structure, so it cannot replace the detail call. What
it can do is answer *does this id still exist* — which is where the whole cost
sits. New `api/shift-index.js` sweeps the user's shift list once per session
(one request per 100 shifts; 4 for this account's 364) and partitions ids into
candidates and proven-gone.

Screening **always fails open**: if the sweep cannot be done, every id comes back
a candidate and callers behave exactly as before. The sweep only runs for a
caller asking about at least 8 ids, since below that the per-id route is cheaper
than the sweep itself — but once any caller has swept, every later screen is
free, however narrow.

Call sites:

- `simulation-results.js` — `resolveShiftPresentation` screens its own id, so
  every path through it benefits; `resolveShiftTabs` and `resolveShiftSummary`
  prime the screen with the full id list first so that per-id screening has a
  sweep to consult.
- `simulation-runs.js:817` — `enrichShiftNames` only wants a name, and the
  projection carries it, so screening resolves the wide case outright and leaves
  nothing to fetch per id. It still falls back to `fetchShiftById` for a
  candidate whose projection has no name.

`createShift` / `updateShift` / `deleteShift` invalidate the index.

## Verification

Measured in the browser at 1440×900 against the live backend, counting
`performance.getEntriesByType('resource')`:

| Page | endpoint | before | after |
|---|---|---|---|
| Feasibility evaluation list (20 rows) | prediction-runs | 260 | 4 (per-id — only 4 rows needed enrichment) |
| Feasibility evaluation list | user/shifts | 128 | 4 (one sweep) |
| Feasibility results (60 shifts, 60 prediction ids) | prediction-runs | 60 | 1 (one 614 KiB list call) |
| Feasibility results | user/shifts | 124 | 2 (sweep already warm from the list page) |

Console on the results page went from 60 failed prediction requests plus a
page-wide error state to one warning line — `[elettra] 60 of 60 prediction runs
no longer exist.` — with the Predictions tab showing "No prediction summaries
available." and the Efficiency tab rendering its content normally. All 60 shift
tabs still render, named as before.

Checked for regression: the evaluation list renders identically row for row, and
Fleet → Shifts (real, live data, untouched code paths) still lists shifts with
their names and distances.

`npm run build` clean, `npm test` 44/44 passing.

## Observed, not fixed

The 2 requests left on the results page are `/{shift_id}/yearly-distance` for the
active shift, via `utils/shift-distance.js`. Not a fan-out — two requests for one
shift — and that module has its own caching layer shared with several other
pages, so screening there wants its own verification pass rather than being
folded into this one.

## Split out

- **Ticket 18** — the list endpoint ignores its `yearly_analysis_id` filter, and
  two yearly-analysis callers trust it (one deletes an arbitrary run, one mixes
  unrelated analyses' KPIs together)

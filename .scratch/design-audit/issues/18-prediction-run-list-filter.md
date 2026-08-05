# The prediction-run list endpoint ignores its filter, and two callers trust it

Status: needs-triage
Type: bug

Split out of ticket 17. The fan-out half of 17 is done; this is what verifying it
against the live API turned up.

## The endpoint

`GET /api/v1/simulation/prediction-runs/` declares **no query parameters** in the
backend's OpenAPI schema and ignores the ones the client sends. Requesting it
with a bogus `yearly_analysis_id` returns the same 614 KiB body as requesting it
bare — the caller's entire history, as a flat array, unpaginated.

`api/simulation.js:370` — `fetchPredictionRuns({ yearly_analysis_id })` — builds
that parameter anyway, so every caller believes it is receiving one analysis's
runs and is actually receiving all of them.

Compounding it: every prediction run in the test dataset has
`yearly_analysis_id: null` (404 of 404), so client-side filtering on that field
would return nothing at all. Whatever fix is chosen has to be checked against
data where the field is actually populated.

## Caller 1 — deletes an arbitrary run

`yearly-analysis-runs.js:243` — `deleteLinkedPredictionRuns(analysisId)` asks for
one analysis's runs, receives everyone's, and calls
`deletePredictionRun(items[0].id)` on whatever happens to be first. That is a
delete aimed at an unrelated analysis's data.

It is inert today only by accident: `DELETE /prediction-runs/{run_id}` **does not
exist** in the backend schema (only `GET` is defined), so the call fails and the
handler returns early. Restoring the route would turn this into data loss.

Two decisions needed: whether per-analysis deletion is still wanted at all, and
whether the backend should grow the DELETE route.

## Caller 2 — mixes unrelated analyses' numbers together

`yearly-analysis-results.js:591` builds `summaryByTemp` from the unfiltered list,
keyed only by external temperature, then patches those summaries into the
displayed KPIs wherever a scenario's quantiles are missing. With the filter
ignored, a summary from an unrelated analysis that happens to share a temperature
silently overwrites the right numbers. No error, no empty state — just wrong
values.

This is the more urgent of the two: it is live, silent, and affects displayed
results.

## Work

1. Confirm with the backend whether the list endpoint should filter, or whether
   the frontend must filter client-side
2. Fix the delete-the-wrong-run bug at `yearly-analysis-runs.js:243`
3. Fix the KPI cross-contamination at `yearly-analysis-results.js:591`
4. Decide whether `deletePredictionRun` should exist at all, given the route does
   not

## Evidence

Probed against `isaac-elettra.dacd.supsi.ch:8002` with the test account on
2026-07-29. Route inventory from the live `/openapi.json`.

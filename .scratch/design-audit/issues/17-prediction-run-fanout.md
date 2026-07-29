# Prediction-run 404s and N+1 request fan-out

Status: needs-triage
Type: bug

Split out of ticket 14, which recorded this as a backend observation. It has a
frontend half too.

## Backend / test data

Every prediction run in the test dataset 404s:

```
GET /api/v1/simulation/prediction-runs/<id>
```

`simulation-results` consequently renders only "Prediction run not found".

Unclear whether this is stale test data, a seeding gap, or a real route problem —
needs checking against the API before assuming which.

## Frontend: the fan-out

`simulation-results.js:9093`

```js
? await Promise.all(predRunIds.map((id) => fetchPredictionRun(id)))
```

One request per prediction run, uncached, on every page visit — roughly 200 failed
requests for the test dataset. This is a defect regardless of what the server
returns: with a healthy backend it is 200 *successful* requests where a batch call
would do.

A list endpoint already exists:

```js
// api/simulation.js:370
export const fetchPredictionRuns = async ({ yearly_analysis_id } = {}) => { … }
```

Similar fan-out patterns to check while in here:

- `api/simulation.js:152` — `[...pending].map((id) => fetchPredictionRun(id))`
- `api/simulation.js:309` — `ids.map((id) => fetchPredictionRun(id))`

## Work

1. Determine whether the 404s are data or routing
2. Switch `simulation-results.js:9093` to the batch endpoint, or add caching if
   the batch endpoint cannot be filtered the way the call site needs
3. Ensure a 404 degrades to one empty-state message rather than N console errors

Not styling work — this sat in the design audit only because it surfaced while
verifying pages in the browser.

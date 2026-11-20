# Feasibility evaluation JSON export

`buildFeasibilityExportDocument` in `src/utils/feasibility-export.js` serializes
snapshots produced by `buildFeasibilityAssessment`. It performs no network
requests, optimization or numeric assessment. Schema 1 identifies this document
with `kind: feasibility_evaluation`; its version is independent of the annual
analysis export schema.

## Inputs and consistency

The caller supplies `designs`, an array of `{ assessment, shiftAssessments }`.
Each `assessment` has General scope. Its block snapshots must cover exactly the
union of the model's block IDs and diagnostic block IDs. All must have the same
saved source run, effective operating assumptions, investment ledger and scoped
forecast inputs. Missing, duplicate or inconsistent block snapshots are rejected.

`entryRunId` identifies the design from which the user opened the evaluation;
it defaults to the first supplied design. The evaluation root comes from the
recorded paired references or source-run relationship. Unrelated families,
conflicting references and duplicate basis slots are rejected. The order of
the supplied designs does not change their contents or the evaluation root.

`unavailableProfiles` can describe an unloaded Mean/Q95 profile with `basis`,
`runId`, `status` and optional `error`. Supported states are `unavailable`,
`pending`, `running`, `failed` and `not_calculated`. The latter requires a null
run ID and must be established by the caller's lookup. Without recorded
references or a lookup result, an absent profile is `not_recorded`, which does
not assert that no historical comparison exists.

An optional `sourceRun` can preserve the original source as audit when a newer
compatible calculation occupies the same basis. It must match the family root;
it appears in `evaluation.sourceRecord` and never occupies another profile slot.
`collectionIssues` records loading failures alongside data-availability issues.

## Download collection

The General header's download captures the displayed run, forecasts, price
context and names at click time. Changing profile while it loads does not change
that export. The collector uses terminal cached designs and refreshes unfinished
counterparts. Historical basis lookups use GET only and never start optimization.

Missing forecast IDs are fetched through the per-ID route with at most four
parallel reads, independently of the UI's history cache. This also retrieves
older forecasts outside the server's bounded history list. Each request group
has a timeout and export-local cancellation. Leaving the page aborts collection
and suppresses any late download. Loading failures produce a partial file where
possible; inconsistent design/family data produces an error and permits retry.

## Document structure

| Field | Meaning |
| --- | --- |
| `evaluation` | Root ID, entry ID and name, plus the entry snapshot's recorded family execution/outcome. Recorded summaries can precede the loaded designs; use `profiles` and each design's verdict for the exported results. |
| `exportedAt`, `units`, `methodology` | Export timestamp, numeric units and shared technical-assessment method. Numbers retain model precision. |
| `profiles` | Available or missing Mean/Q95 slots; historical median/configured bases retain additional, explicitly named slots. `available` describes a loaded completed design, including a proven infeasible design. |
| `designs` | One independent configuration, General summary and set of block assessments per loaded design. |
| `dataQuality` | Availability issues from designs and missing profiles, with run/block IDs where applicable. |

`units` describes the normalized assessment fields. Raw `sourceData` retains
the upstream field names, units and method metadata.

Each design includes:

- `run`, `basis`, `execution`, `verdict`: saved identity, exact decision basis,
  method version, its own execution state and the technical verdict/evidence;
- `configuration`: original inputs, including recorded bus-model, GTFS and
  operating data where present;
- `operatingAssumptions`: values used by the shared model, labelled `recorded`
  for supported saved battery/timing assumptions or
  `inputs_and_historical_defaults` otherwise;
- `provenance`: recorded GTFS data, requested/selected/reference forecast IDs,
  missing forecast IDs and the existing HVAC resource;
- `general`: the fleet design, shared infrastructure, full physical investment
  ledger, failure information and diagnostics;
- `shifts`: the scoped technical assessments;
- `sourceData`: original results and forecast records for audit, including
  trajectories and diagnostic data that are not a verified physical operation.

The General section contains the complete design. It does not manufacture an
aggregate consumption or SOC from one selected block. Shared infrastructure is
reported once per design. The largest per-bus battery and the sum of investments
across physical blocks retain their separate meanings. Mean and Q95 designs
are alternatives; do not add their investments, charging energy or capacities.

## Vehicle blocks and technical evidence

Each block includes battery configuration/summary, decision consumption,
energy comparison, supporting energy balance, sizing effect, forecast rows,
operation, diagnostics, provenance and availability.

`consumption` identifies the actual decision basis and source. In particular,
Aggregate Q95 comes from an available aggregate profile or solver trajectory;
missing Q95 remains null. Forecast quantiles and the supporting `energyBalance`
distribution are not substitutes for that decision consumption. The exporter
does not sum per-trip quantiles to reconstruct an aggregate profile.

`scope.assessmentKind` distinguishes physical, diagnostic and unverified
records. For physical results, `operation.result` preserves the same normalized
SOC and charging plan used by the page. Its availability status is separate from
`verificationStatus`. Unverified historical operation can be retained with
status `unverified`. Diagnostic records have `operation.result: null` and
`energyBalance: null`; their diagnostic source and comparison remain explicit.
They do not establish a verified daily/overnight charging plan.

Clock values are minutes since the service-day start, including values above
1440 for subsequent days. SOC fractions refer to residual capacity; nominal,
usable and SOC-limit energies remain separate. Charging plans distinguish no
sessions (`empty`), missing detail (`unavailable`) and partial detail (`partial`).

Pending, running or failed designs do not publish a current consumption,
energy comparison or operation. Their inputs and raw audit data remain present.
A failed Q95 family member does not hide a completed Mean design. An execution
failure or timeout is not exported as proven infeasibility. Historical results
without modern verification metadata remain explicitly historical/unverified.

## Availability and boundaries

`dataQuality.status: complete` means the exported inputs/sections are available,
not that every model boundary is exhaustive or that a design is feasible.
Partial output includes machine-readable issue codes for missing forecasts,
unknown consumption, incomplete charging, missing recorded provenance,
unavailable investment or execution/profile states. Current catalogue price
fallbacks are marked in the investment ledger and availability issues. They
are not relabelled frozen historical prices.

No missing measured quantity is converted into zero. Effective historical
defaults are identified by the operating-assumption source. Unsupported saved
operating-assumption versions produce a partial export; their raw inputs are
retained. Non-finite numbers are rejected rather than silently changed by JSON
encoding. Returned documents are detached from every supplied snapshot.

The file covers technical feasibility and its selected investments. Annual
TCO and environmental assessment belong to the annual-analysis export. Full
HVAC reproduction inputs remain in the dedicated HVAC download; the document
explicitly reports that they are not embedded and provides its resource.

## Verification

The permanent unit matrix in `tests/feasibility-export.test.mjs` covers both
profiles across all three optimization modes and uniform/mixed batteries,
plus unavailable profiles, historical records, inconsistent families,
missing inputs and diagnostic/failure states. Collector tests separately cover
read-only lookup, exact forecast IDs, request limits, retry, timeout and
cancellation.

`test-support/feasibility-export-reconciliation.js` uses only Node assertions,
without importing the assessment or serializer. It checks the actual serialized
file: fleet investment sums, frozen vehicle prices, battery costs, profile/run
references, missing forecast IDs, decision consumption, energy intensity,
SOC limits, operational energy and charging-session duration/power. Shared
infrastructure must not appear as a per-block expense; diagnostic blocks must
not publish a physical operation.

One shared browser scenario registration runs in both the source and compiled
application, through `tests/e2e/feasibility-export.spec.js` and
`tests/dist/feasibility-export.spec.js`. Tests navigate the real application and
parse actual browser downloads. They do not inject result markup or import
application modules into the page. Acceptance covers all optimization modes,
uniform/mixed batteries, saved-result reload, unavailable profiles and retry,
click-time context, cancellation, invalid references, diagnostic Q95 results,
old forecast IDs outside a bounded history list and all four UI languages.
Visible consumption, SOC and charging values are compared with the downloaded
values, allowing only display rounding. The same conservation assertions run
on the downloaded JSON.

The guide's existing language and delayed-image/anchor tests also check the
new workflow, including the compiled guide. Source and preview suites must run
sequentially because they use the same port. Focused commands:

```sh
taskset --cpu-list 0-7 node --test tests/feasibility-export.test.mjs tests/feasibility-export-loader.test.mjs tests/feasibility-assessment.test.mjs tests/user-guide.test.mjs tests/guide-image-dimensions.test.mjs
taskset --cpu-list 0-7 npx playwright test tests/e2e/feasibility-export.spec.js tests/e2e/guide-layout-stability.spec.js
taskset --cpu-list 0-7 npm run build
taskset --cpu-list 0-7 npx playwright test --config playwright.dist.config.js tests/dist/feasibility-export.spec.js tests/dist/guide-layout-stability.spec.js
```

Browser tests mock `/api/v1/version` and every expected API read; unexpected
requests fail their assertions. The bounded-history fixture deliberately
truncates the list while retaining per-ID records: its UI history warning is
expected, and the export must still recover the exact saved IDs. HTTP failure
responses are explicit scenario inputs, not ignored proxy errors.

These deterministic fixtures verify frontend serialization, UI reconciliation
and bundle integration. They do not validate the backend optimizer, database
contents or a deployed service.

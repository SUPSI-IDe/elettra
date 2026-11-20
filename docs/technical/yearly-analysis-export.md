# Annual analysis JSON export

The General download serializes the shared annual assessment used by the fleet
dashboard. The serializer is `src/utils/yearly-analysis-export.js`; it receives
fleet and group snapshots from `buildYearlyAssessment` and does not recalculate
economic results. The page supplies the dashboard's current snapshots, including
edits that have already changed the displayed assessment.

## Schema versions

`schemaVersion: 4` identifies the shared-assessment document for analyses with a
saved fleet investment ledger with bus and battery prices, using the same
eligibility rule as the fleet dashboard. Analyses without those inputs retain
the existing schema 3 path during the historical-result migration. Consumers should select
their parser by `schemaVersion`.

Schema 4 replaces the old top-level `header`, `efficiency`, `costs` and `emissions`
layout. It does not expose those names as aliases for new calculations.

| Field | Contents |
| --- | --- |
| `analysis`, `exportedAt` | Analysis identity, name, saved execution status and export time. The execution status does not imply that every assessment section is complete. |
| `units`, `methodology` | Units of activity/economics, TCO method version, charging policy and the available LCA method version. LCA indicators retain their own native units. |
| `provenance` | Recorded GTFS provenance, weather reference, bus-model snapshot and source feasibility ID. Missing references remain null. |
| `configuration` | The recorded configuration, including individual frozen investments, batteries, infrastructure and operating assumptions. |
| `assumptions` | Effective assessment inputs, including prices, horizon, discount rate, component lifetimes, maintenance method and annual mileage mappings. |
| `technicalBaseline` | Simulated activity and original technical results, scenarios, physical vehicles and infrastructure. These remain separate from changes to assessed annual mileage. |
| `general` | Complete fleet activity, economic assessment and environmental response/state. |
| `groups` | Battery groups with additive fleet contributions and separately scoped representative-bus values. |
| `shifts` | Vehicle-block identities, technical results, fixed configuration, assessed activity and references to assessment groups. |
| `dataQuality` | Availability of current fleet/group assessments and shift data, with reasons for partial output. This describes data availability, not completeness of the lifecycle modelling boundary. |

## Fleet, groups and representative buses

`general.scope.kind` is always `fleet`, regardless of the representative selected
in the dashboard when downloading.

For each entry in `groups`, `fleetContribution.scope.kind` is `vehicle_group`.
Its activity and economic amounts describe all physical buses in that group.
Group contributions reconcile to fleet totals when the underlying assessment is
complete.

`representativeBus.scope.kind` is `representative_bus`; its `allocation` is
`1 / physicalVehicleCount`. Absolute activity and financial amounts, including
replacement payments and cumulative cost points, are divided by that count.
Per-km TCO, annuity factors, lifetimes, event years, break-even year and the
residual-only crossing flag retain their original meaning. Shared infrastructure
is counted once in the fleet and allocated by the existing assessment model.

`economics` retains the model's `electric`, `diesel`, `comparison`,
`differencePerKm`, `dieselHeatingLiters`, `status` and `issues`. A design contains
initial investment, annual OPEX, discounted lifetime cost (`presentValue`),
annual-equivalent cost, TCO per kilometre, capital components, operating items,
replacements and residual values. Comparison points preserve their event type
and time; they are not resampled or rounded for the download.

Each shift's `technicalResults` contains the original scenario KPIs, uncertainty
and prediction identifiers where recorded. Its `assessedActivity` reflects the
effective mileage scenario. `assessmentGroupId` refers to an exported group.
`environmentScope: representative_group` directs the consumer to that group's
representative environmental assessment. The export does not invent independent
per-shift impacts from pooled backend vehicle inventories. An unavailable
technical result or activity remains null.

Fleet and group assessed activity also remain null when required original
vehicle activity is missing. Mileage scaling must not turn an unknown measured
quantity into an exported zero; known individual blocks remain available.

## Environmental availability

Each `environment` section includes `status`, `matchesAssumptions`, `isStale`,
`error`, `reason`, `result` and `previousResult`.

`result` is populated only when the response is done, matches the current
assessment assumptions/scope and is not stale. Its exported status is `complete`.
Loading or failed assessments have a null current result; any retained response
is separately identified as `previousResult`. A done response with no applicable
current result has status `unavailable`. Consumers must not add previous results
to current fleet/group totals.

Fleet results preserve the upstream fleet LCA payload. Representative results
preserve the same scoped payload used by the environmental download, including
backend `shift_ids`, physical counts, attribution metadata and provenance.
Full HVAC reproduction inputs remain available through the dedicated HVAC
download; this document retains the recorded configuration and weather reference.

## Precision and consistency

The document retains model precision. Formatting displayed CHF or kWh values is a
consumer concern; small floating-point differences require a numeric tolerance.
Group snapshots with different effective assumptions or vehicle activity/design
are rejected instead of being combined with the fleet snapshot. Returned export
objects are detached from the saved inputs and shared assessment snapshots.

Dedicated regressions are in `tests/yearly-analysis-export.test.mjs`. The annual
result browser tests check downloaded values against the current dashboard,
including heterogeneous batteries, changed tariffs/mileage and the separate
environmental download.

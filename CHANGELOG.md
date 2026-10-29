# Changelog

## [0.7.3] - 2026-10-29

### Fixed

- Historical shift summaries and battery detail tables determine physical-limit status from required and installable pack counts. A deficit above a fixed battery remains a shortfall without being incorrectly called a physical-limit violation when its diagnostic requirement fits within the model's maximum.
- Desktop/mobile regressions verify consistency between the shift summary and the battery card for diagnostic requirements both within and beyond the physical limit.

## [0.7.2] - 2026-10-29

### Fixed

- Battery diagrams distinguish diagnostic packs above a fixed battery from packs beyond the installable maximum. A diagnostic requirement of 18 packs with 10 fixed and 16 installable now shows 10 selected, 6 unused and 2 unavailable packs, with both deficits explicitly explained.
- Added unit and desktop/mobile browser regressions for fixed-battery deficits within and beyond the physical limit, including historical results.

## [0.7.1] - 2026-10-29

### Added

- Mean or aggregate-Q95 optimization for battery, charger and joint evaluations, with explicit reuse or creation of compatible results.
- Battery pack visualization separating selected, unused and diagnostic excess packs, nominal and usable capacity, and SOH.
- Fixed-plan mean/Q95 capacity margins, verified SOC and conditional whole-shift Monte Carlo completion results from backend 1.3.0.

### Changed

- New evaluations prepare one physical forecast reference per shift; the backend recalculates at the selected battery mass.
- General reports all analyzed shifts and the largest selected battery without presenting it as a common verified battery.
- Four-language guidance and historical-result states distinguish aggregate Q95 from sums of trip quantiles.

### Fixed

- Per-shift margins use each selected battery rather than the fleet maximum.
- Unverified results remain distinct from physical battery-limit violations.
- Release metadata includes the required changelog entry and a permanent version/changelog regression check. This release supersedes the unpublished v0.7.0 release candidate.

### Verification

- 474 unit tests, 202 desktop/mobile browser executions, production build and visual inspection.
- Backend validation includes 698 tests and the 40502 reference: 13/14 packs without pantograph and 10/10 with pantograph for mean/aggregate Q95.

## [0.6.0] - 2026-10-23

### Added

- The public guide now explains the fleet-expansion, charging-infrastructure and initial-electrification use cases, mapping each planning question to BATTERY_ONLY, CHARGING or JOINT through an accessible responsive workflow.
- Yearly economics export the resolved assumptions, reconciled operating costs, component-level annualized capital and per-shift shared-infrastructure allocations needed to audit multi-bus results.

### Changed

- General yearly economics now scale bus and battery investment with the physical vehicle count while counting shared charging infrastructure once.
- General and shift scopes use one resolved set of energy, fuel, maintenance and annualization assumptions; shift OPEX reconciles exactly with General when all shifts are combined.
- Bus bodies, batteries, charging infrastructure and diesel buses are annualized over their respective useful lives, with aligned replacement schedules, residual values, cumulative curves and break-even calculations.
- Shift cost views present owned vehicle capital separately from shared infrastructure allocated by annual DC-energy contribution, with clearer explanatory text and exports.

### Fixed

- Previous and Next buttons and the rows-per-page selector work again across paginated result lists.
- Multi-shift JOINT yearly analyses no longer reuse single-vehicle capital totals or independent maintenance defaults that made General costs disagree with the sum of shift costs.

### Verification

- Added permanent unit and desktop/mobile browser regressions for multi-bus capital, shared-cost allocation, economic assumptions, OPEX reconciliation, lifecycle annualization, JSON exports, use-case documentation and pagination.
- Verified 472 Node tests, 190 desktop/mobile browser executions and the production build.

## [0.5.0] - 2026-10-22

### Added

- Yearly results now separate the shared physical configuration in General from dedicated tabs for every shift, each with Efficiency, Costs and Emissions views.
- Complete annual exports contain one General section and one section for every physical shift, while annual comparisons remain focused on General totals.
- Shift emissions include an independent annual-distance control, and shift economics include annual OPEX, allocated shared CAPEX and break-even analysis.

### Changed

- Annual analyses keep the bus, battery and charging infrastructure selected by the source feasibility evaluation fixed across all temperature scenarios and shifts.
- Shared investment costs are counted once in General and attributed to shift comparisons by each shift's share of annual DC energy, with the allocation rule explained in the interface.
- Feasibility and yearly result pages follow the compact Fleet visual language, with consistent cards, typography, metric rows, navigation and responsive behavior.
- Feasibility evaluation lists use accessible red/green status indicators with explanatory header tooltips, and yearly shift summaries sit directly below the General/shift selector.

### Fixed

- Historical and current multi-shift annual results are reconstructed strictly by shift identity, without reusing aggregate, equally named or unrelated shift data.
- Missing, partial and failed annual outcomes remain explicit without presenting incomplete aggregate values as final results.
- The feasibility list keeps the Results column readable and contains horizontal overflow on narrow screens.

### Verification

- Added permanent unit and desktop/mobile browser coverage for fixed annual configuration, multi-shift reconstruction, exports, shared-cost allocation, General-only comparisons, responsive layouts, status indicators and safe rendering.
- Verified 447 Node tests, 164 desktop/mobile browser executions and the production build.

## [0.4.0] - 2026-10-21

### Added

- Feasibility results now separate the common fleet configuration from dedicated tabs for every physical shift, with no ambiguous aggregate-shift view.
- The General view reports the shared battery, charging infrastructure, covered shifts, limiting shifts and detailed charger configuration.
- Every shift view includes its operational summary, visual energy analysis, SOC limits, charging sessions, sensitivity drivers and optional prediction details.

### Changed

- Battery-only, charging-only and joint results distinguish fixed and optimized battery and infrastructure decisions while applying one common bus configuration to every selected shift.
- Shift energy adequacy reconciles mean demand with planned charging, keeps prediction quantiles as context and reports minimum, maximum and usable SOC limits explicitly.
- General and shift summaries use compact, consistent data typography and charging sessions use one concise row per phase.

### Fixed

- Predictions and operational details are scoped strictly by shift identity, preventing equally named, aggregate or unrelated shift data from being reused.
- Missing, partial, historical, infeasible and no-charging results remain explicit without presenting incomplete totals as final decisions.

### Verification

- Added dedicated unit and desktop/mobile browser coverage for all optimization modes, multi-shift navigation, shared infrastructure, charging plans, energy balance, SOC limits, responsive layout and incomplete historical results.
- Verified 383 Node tests, 138 desktop/mobile browser executions, the 52-test feasibility regression set and the production build.

## [0.3.0] - 2026-10-20

### Security

- User-controlled and backend-provided text is escaped across fleet, simulation and annual-assessment renderers to prevent HTML injection.

### Changed

- Complete parameterized-LCA responses are validated structurally before any environmental total is displayed, including indicators, lifecycle phases, energy boundaries, vehicle inventories and aggregate reconciliation.
- Annual electricity costs consistently distinguish bus-side DC energy, purchased grid energy and charging losses in totals, scenarios and exports while retaining the fixed 94% grid-to-bus policy.
- Annual LCA results expose backend provenance, methodological limitations and vehicle warnings in the interface and preserve them in exports.
- LCA requests omit empty query strings and report FastAPI validation details with a safe fallback for empty or malformed HTTP responses.

### Verification

- Added unit and desktop/mobile browser regressions for HTML safety, malformed and incomplete LCA payloads, energy-boundary edge cases, provenance, exports and HTTP client behavior.
- Verified 303 Node tests, 90 desktop/mobile browser executions and the production build.

## [0.2.0] - 2026-09-30

### Added

- Parameterized annual Mobitool LCA, with separate electricity, auxiliary diesel and non-energy inventories, lifecycle phases, assumptions and reproducible exports.
- Mileage adjustments request a new backend LCA instead of scaling vehicle manufacturing locally. Incomplete LCA responses never fall back to the historical environmental method.

### Changed

- Electricity costs use purchased grid energy at fixed 94% grid-to-bus infrastructure efficiency; consumed DC energy and charging losses remain separately visible.
- Charging powers are labelled DC, with a downstream AC-connection estimate that is not an optimizer constraint. Forecasts and SOC calculations are unchanged.
- Costs remain accessible when the LCA service is unavailable.

### Verification

- Added reproducible API fixtures and browser checks for the grid boundary, backend mileage recalculation, exports and incomplete-service handling.
- Verified 272 Node tests, 78 desktop/mobile browser executions and production build; coordinated staging uses the backend release candidate and isolated data stores.

## [0.1.16] - 2026-09-30

### Fixed

- Battery-specific forecasts remain available for comparison, while optimization submits exactly one physical reference per selected duty.
- Charging-only evaluation requires an explicit fixed battery count instead of implicitly using several alternative vehicle configurations.
- Results show the full-forecast verification status and reference pack count. Unverified or duplicated historical optimizations cannot initialize a new yearly analysis; existing analyses remain readable.

### Verification

- Added unit and desktop/mobile browser regressions for all three optimization modes, seven forecast variants and one physical reference.
- Verified 269 unit tests, 74 browser executions, production build and an isolated API/browser replay.
- Release v0.1.15 built successfully but its release-publication job stopped because the changelog entry was missing. It was not deployed; the tag and artifact are retained unchanged.

## [0.1.14] - 2026-09-23

### Fixed

- Feasibility optimization and battery-sizing tables now center headers, populated rows and empty states consistently for both feasible and infeasible results.
- Yearly scenario summaries, environmental grouped headers and result-page actions now follow their intended column and layout alignment.
- Dense bus, shift and feasibility-run tables retain readable column widths and scroll horizontally on narrow screens; yearly result tabs likewise keep localized labels accessible.
- Feasibility-run creation dates no longer inherit action-column styling.

### Changed

- Added repository safeguards for version selection, remote synchronization, release verification and Compose-owned deployments.

### Verification

- Added permanent desktop and mobile regression coverage for feasible, infeasible, empty, grouped-header, responsive, localized, action and date-column alignment cases.
- Verified 265 unit tests, 68 browser executions and the production build on the synchronized `v0.1.13` baseline.

## [0.1.13] - 2026-09-22

### Changed

- Feasibility decisions now explicitly use mean demand, while Q05, Q50 and Q95 remain visible as comparison scenarios.
- Results identify the mean as the decision basis in verdicts, margins, battery adequacy, prediction tables and charts, and warn when Q50 exceeds usable energy without changing the mean-based verdict.

### Verification

- Added regression coverage for a feasible mean demand of 411.6 kWh with Q50 demand of 424.1 kWh against 420.0 kWh of usable battery energy.
- Verified 265 unit tests, 50 browser executions and the production build.

## [0.1.12] - 2026-09-22

### Changed

- New feasibility evaluations now use the median (Q50) demand scenario consistently for optimization, battery sizing, margins, overview metrics and economic inputs.
- Feasibility results now show Q05, Q50 and Q95 as the prediction range without displaying separate mean-consumption values.
- Feasibility verdicts now state their demand basis explicitly; historical evaluations retain a legacy mean-based label instead of being silently reinterpreted as Q50 results.
- Battery-limit status is now distinct from the demand-scenario feasibility verdict, avoiding ambiguous unqualified “Feasible” labels.

### Verification

- Added unit coverage for the Q50 request contract, historical-run classification and translated result labels.
- Expanded the feasibility-results browser fixture to verify Q05/Q50/Q95 presentation, Q50-qualified verdicts and the absence of mean values on desktop and mobile Chromium.
- Verified 265 unit tests, 50 browser executions and the production build.

## [0.1.11] - 2026-09-22

### Fixed

- Feasibility evaluation results now render auxiliary-heating labels through the shared heating-type formatter instead of referencing the removed `HEATING_LABELS` mapping.
- The general-information panel and sensitivity/feasibility card now display heat-pump, diesel and electric heating labels without aborting results-page loading.

### Verification

- Added feasibility-results browser regression coverage for every supported heating type and for the asynchronously loaded sensitivity card on desktop and mobile Chromium.
- Verified 260 unit tests, 50 browser executions, the production build and the live `40502_20260922` evaluation.

## [0.1.10] - 2026-09-21

### Fixed

- The yearly-distance emissions control now opens at the saved analysis distance instead of displaying a misleading zero value, and it keeps a positive range for short-distance cases.
- All annual emissions, lifecycle components, primary-energy indicators and mixed diesel-heating values now scale consistently when the comparison distance changes.
- Emissions comparison totals now use tonnes per year and per-distance values use grams per kilometre, eliminating the previous factor-of-1,000 display error.
- Heat-pump and diesel-heater configurations now use explicit, consistent labels throughout simulation results, yearly analysis and exported data.
- The yearly emissions export now records source and selected distances, the applied scale factor, stable indicator names, and an unambiguous electric/diesel actor structure.

### Added

- Added the renewable and non-renewable primary-energy breakdown to the yearly-analysis detail panel when the backend supplies it.

### Verification

- Added 18 unit tests for distance handling, emissions units, heating labels, annual scaling, primary energy and the export schema.
- Added five end-to-end scenarios, exercised on desktop and mobile Chromium, covering saved-distance initialisation, deliberate distance rescaling, emissions comparison units, heating labels and primary-energy rendering.
- Verified 260 unit tests, 46 browser executions and the production build.

## [0.1.9] - 2026-09-17

### Fixed

- The bare application URL now opens the public landing page for signed-out users, making the user-guide link immediately visible.
- Both return links in the user guide now target the landing page explicitly instead of relying on the application's default route.

### Verification

- Expanded the browser test matrix to cover the landing page, login and registration return paths, browser history, both guide return links, all nine guide sections and direct section URLs.
- Added bidirectional language-persistence coverage for English, German, French and Italian, including reloads.
- Verified the complete navigation matrix on desktop and mobile viewports and limited parallel browser workers to keep the suite reliable.

## [0.1.8] - 2026-09-17

### Added

- Added a public, task-oriented user guide at `/elettra/guide/`, linked directly from the landing page.
- Added complete guide content in English, German, French and Italian, with the application language preference retained across navigation and reloads.
- Added eight existing ELETTRA interface screenshots covering navigation, custom stops, shifts, feasibility configuration and results, and yearly efficiency and emissions results. Captions are translated and each image can be opened at full resolution.
- Added print-friendly and responsive guide layouts for desktop and mobile use.

### Changed

- Configured the guide as a dedicated Vite build entry so that `/elettra/guide/` works consistently in development and in the packaged nginx image.

### Verification

- Added structural tests for guide translations, sections, local image assets and editorial-placeholder removal.
- Added desktop and mobile browser tests for landing-page navigation, language persistence, responsive layout and screenshot loading.

## [0.1.7] - 2026-09-15

### Fixed

- The yearly-analysis CO₂ lifecycle chart no longer adds diesel-heater emissions a second time. Its displayed e-bus total now uses the backend total, consistently with the emissions-saved KPI.
- The redundant diesel-heater chart segment and legend entry were removed. The backend's Direct and Energy chain phases already contain that contribution.
- The lifecycle chart's methodology tooltip now explains the heater attribution and the comparison scope in English, German, French and Italian.

### Verification

- Added regression tests for the mixed diesel-heating lifecycle total, the phase-only fallback and the four tooltip translations.

## [0.1.6] - 2026-09-09

### Changed

- Clarified the well-to-wheel emissions methodology in the yearly-analysis documentation and interface.

## [0.1.5] - 2026-09-08

### Added

- Exposed the diesel-heater emissions methodology in the yearly-analysis interface.

Earlier versions are documented in the [GitHub releases](https://github.com/SUPSI-IDe/elettra/releases).

# Changelog

## [1.4.4-rc.1] - 2026-11-25

- Update the four-language user guide with the sequential vehicle-block planner, route colours, bus battery estimates, service-day selection, paired feasibility results and equivalent annual costs.
- Clarify how typical-day prediction intervals are calculated, which feasibility results can start a yearly analysis, and what the comparison and its exports cover.

## [1.4.3] - 2026-11-25

- Correct the AMSA partner name to Autolinea Mendrisiense SA on the About page in all four languages.

## [1.4.2] - 2026-11-25

- Show total equivalent annual cost for electric and diesel buses, with annualized investment alongside operating costs.
- Run the browser suite across two GitHub-hosted runners before publishing the frontend image.

## [1.4.1] - 2026-11-25

- Serve Swagger UI at `/docs` and the backend’s OpenAPI schema at `/openapi.json` through the frontend proxy. Compatible with backend 1.9.0.

## [1.4.1-rc.1] - 2026-11-25

- Serve Swagger UI at `/docs` and the backend’s OpenAPI schema at `/openapi.json` through the frontend proxy.

## [1.4.0] - 2026-11-24

- Build and edit vehicle blocks activity by activity, find trips from the current terminus, and select a service day for feasibility studies.
- Calculate typical-day energy uncertainty with independent Monte Carlo sampling for each trip and scale each day's interval by its annual occurrence count.
- Restore fleet cost and emissions charts when returning to General, show charging stop names in infeasible results, and use localized copy names when duplicating items.
- Pair with backend 1.9.0.

## [1.4.0-rc.2] - 2026-11-24

- Restore the fleet cost and emissions charts when returning to General from a vehicle block.
- Calculate typical-day energy uncertainty by sampling each trip independently across vehicle blocks. Scale each typical day's interval by its number of occurrences for annual contributions. Pair with backend 1.9.0-rc.2.
- Show the charging stop name in raw feasibility data even when an infeasible design contains only the stop ID. Use the saved name when available.
- Name the first duplicate with the localized copy suffix. Add a number only when that name is taken.

## [1.4.0-rc.1] - 2026-11-24

- Build vehicle blocks one activity at a time, from the starting depot through GTFS trips, empty transfers and depot stays to the return. Plan in whole minutes, including after midnight, and edit or insert activities in the saved sequence.
- Find departures from the bus’s current terminus and add direct trips in one click. Expand the list for trips requiring an empty transfer, and compare timetable variants in aligned, scrollable stop-time previews.
- Choose a service day for feasibility studies and select vehicle blocks that run on that day within the selected GTFS edition. Pair with backend 1.9.0-rc.1.

## [1.3.0] - 2026-11-24

- Set vehicle prices by bus length and select LFP or NMC battery defaults. The bus form shows nominal capacity limits and the price per kWh and preserves manual pack price and mass.
- Use project-horizon TCO in annual dashboards and exports, and keep annual charts and economic controls stable while assumptions change.
- Plan intermediate stays at custom stops, edit saved vehicle blocks and export feasibility results for Mean and Aggregate Q95 designs.
- Align battery, intermediate-stay and charging-infrastructure inputs when labels wrap. Pair with backend 1.8.0.

## [1.3.0-rc.3] - 2026-11-24

- Show minimum and maximum nominal battery capacity and the current price per kWh in the bus model form. Usable capacity is set in the feasibility study.
- Align inputs when labels wrap in the bus battery panel, intermediate stays and charging infrastructure costs.

## [1.3.0-rc.2] - 2026-11-23

- Enter actual bus lengths, with automatic Mobitool class selection and interpolated vehicle prices. Choose LFP or NMC and retain manual pack mass and price overrides.
- Use the backend project-horizon TCO for annual fleet and group views and JSON exports. Keep results consistent when assumptions change or a saved analysis is reopened.
- Keep annual cost charts and the slider position stable during price and mileage edits while pending TCO requests are coalesced.
- Accept fractional CHF estimates when editing annual economic assumptions. Pair with backend 1.8.0-rc.1.

## [1.3.0-rc.1] - 2026-11-23

### Added

- Support intermediate stays at custom stops, with transfers and multiple service periods in one vehicle block.
- Add a dedicated stay editor for saved blocks with a live whole-programme preview, added/excluded trips, Apply, Cancel and atomic undo.
- Export complete feasibility evaluations as JSON, preserving available Mean and Aggregate Q95 designs, recorded inputs and availability details.

### Changed

- Simplify saved-block editing and allow compatible trips to be inserted throughout the working day while preserving GTFS times.
- Use sourced INFRAS vehicle and initial-battery cost defaults, with an explicitly estimated 9 m vehicle cost and translated source tooltips.
- Default non-depot terminal candidates to one plug; keep depot defaults based on the selected blocks returning to each depot.
- Number duplicates progressively within the original name family across models, stops, blocks, feasibility evaluations and yearly analyses.
- Align all four online-guide languages and the Markdown chapters with the refined creation, editing, defaults, duplication and export workflows.

### Fixed

- Keep annual JSON exports consistent with shared fleet assessments, saving state, LCA state and the configuration displayed in the application.
- Collect feasibility exports from saved assessments without starting a new optimization; preserve separate alternative designs and explicit unavailable data.
- Build release containers, smoke-test bundles and downloadable archives with relative API paths instead of inheriting a remote API origin.
- Handle malformed saved-block trip metadata without an uncaught hydration error, show the existing error feedback and block writes.
- Wait for cold application navigation to finish in guide regressions and allow repeated-duplication tests enough total time for two complete cycles, without relaxing assertion timeouts.

### Compatibility

- Frontend-only prerelease compatible with backend `1.7.0`; no database migration or saved-data rewrite is required.
- Publish as a GitHub prerelease without moving stable container aliases, including `latest`.

## [1.2.0] - 2026-11-20

### Added

- Introduce the guided vehicle-block composer with schedule review, undo, safe depot connections, compact row actions and live translations.
- Present infeasible evaluations consistently across General and individual vehicle blocks, including saved physical battery limits and contextual help for unavailable Q95 consumption.

### Changed

- Improve feasibility and annual-analysis headers, contextual explanations and responsive layouts.
- Align the multilingual guide and screenshots with the new composer and result views.

### Fixed

- Keep guide deep-link headings stable while screenshots load.
- Preserve the selected vehicle-block result across language changes, returning safely to General if the block is unavailable.

### Release

- Promote the functionality validated in `1.2.0-rc.4` without functional changes.
- Compatible with backend `1.7.0`; no database migration or saved-data rewrite is required.

## [1.2.0-rc.4] - 2026-11-20

### Fixed

- Reserve the guide screenshots' intrinsic dimensions so delayed images do not move deep-link headings out of view.
- Preserve the selected vehicle-block result scope across language changes, with a safe return to General when the block is unavailable.

### Tests

- Cover both fixes in shared desktop/mobile source and optimized-bundle regressions, with staging-backed integration and target guards.

### Compatibility

- Frontend-only prerelease compatible with backend `1.7.0`; no database migration or saved-data rewrite is required.
- Publish as a prerelease without moving stable container aliases, including `latest`.

## [1.2.0-rc.3] - 2026-11-20

### Changed

- Include the multilingual guide alignment, refreshed screenshots and documentation regression checks prepared for `1.2.0-rc.2`.
- Synchronize existing browser checks with SVG relayout and asynchronous tab focus restoration, preserving their colour, stop-order and keyboard assertions.

### Compatibility

- Documentation and test updates only; application behavior and backend `1.7.0` compatibility are unchanged.
- The `1.2.0-rc.2` tag is retained as the failed CI candidate; no container or GitHub release was published for it.
- Publish as a prerelease without moving stable container aliases, including `latest`.

## [1.2.0-rc.2] - 2026-11-20

### Documentation

- Align all four online guide languages with infeasible-result diagnostics, battery estimates, orange Mean/Q95 outcomes and unavailable Q95 consumption.
- Explain contextual tooltips and distinguish verified operational detail from diagnostic results.
- Align the guided vehicle-block instructions with the editor order and refresh the feasibility and annual-result screenshots, including new composer and infeasible-result examples.
- Synchronize the Markdown guide baseline and add focused documentation regression checks.

### Compatibility

- Documentation-only update to `1.2.0-rc.1`; application behavior and backend `1.7.0` compatibility are unchanged.
- Publish as a prerelease without moving stable container aliases, including `latest`.

## [1.2.0-rc.1] - 2026-11-20

### Added

- Add a guided vehicle-block composer with schedule review, undo, safe depot connections and live translations.
- Add compact row actions for vehicle blocks and localized validation across fleet forms.
- Present established infeasible evaluations consistently across General and individual vehicle blocks, including saved diagnostic battery limits and missing Q95 consumption.

### Changed

- Move contextual explanations for fleet investment, charging infrastructure and infeasibility into accessible tooltips.
- Align the demand scenario, optimization mode and feasibility outcome in the fleet header, with consistent Mean and Q95 wording.
- Wrap long vehicle-block lists without hiding names or expanding result cards and annual-analysis tables.
- Split annual efficiency minima and maxima into separate lines and keep values clear on desktop and mobile.
- Preserve saved feasibility verdicts, physical pack limits, costs and available energy data; unavailable Q95 consumption remains N/A with contextual help.

### Validation and compatibility

- Validate 669 unit tests, 424 desktop browser tests, 424 mobile browser tests, the production build and 21 optimized-bundle smoke tests on the integrated application.
- Frontend-only prerelease compatible with backend `1.7.0`; no database migration or saved-data rewrite is required.
- Publish as a prerelease without moving stable container aliases, including `latest`.

## [1.1.0] - 2026-11-19

### Added

- Add compact per-row actions for feasibility evaluations and yearly analyses: view details, rename, duplicate and delete.
- Prefill duplicated yearly analyses from their source evaluation and occupancy, with localized editable copy-name suffixes.

### Changed

- Promote the functionality validated in `1.1.0-rc.1`, with no functional changes.
- Remove the top-level feasibility Duplicate action and keep individual deletion alongside the existing selected-row batch deletion.
- Distinguish Rename from the generic Edit action with its own icon and label detail navigation as View details.
- Update the multilingual online guide for the compact actions and duplication workflows.

### Release

- Pair with backend `1.7.0`. No database migration or saved-data rewrite is required.
- Keep large-fleet diagnostics and tolerance benchmarks outside routine release checks.

## [1.1.0-rc.1] - 2026-11-18

### Added

- Add compact per-row actions for feasibility evaluations and yearly analyses: view details, rename, duplicate and delete.
- Prefill duplicated yearly analyses from their source evaluation and occupancy, with localized editable copy-name suffixes.

### Changed

- Remove the top-level feasibility Duplicate action and keep individual deletion alongside the existing selected-row batch deletion.
- Distinguish Rename from the generic Edit action with its own icon and label detail navigation as View details.
- Update the multilingual online guide for the compact actions and duplication workflows.

### Validation and compatibility

- Validate 646 frontend tests, 286 desktop browser tests, 286 mobile browser tests, the production build and two optimized-bundle smoke tests; verify the deployed bundle against the live backend contract.
- Frontend-only release compatible with backend `1.7.0`; no database migration or saved-data rewrite is required.
- Publish as a prerelease without moving stable container aliases, including `latest`.

## [1.0.0] - 2026-11-18

### Added

- Rename feasibility evaluations and yearly analyses directly from their lists.
- Show positioning progress while creating custom stops.

### Changed

- Promote the functionality validated in `1.0.0-rc.2`, with no functional changes.
- Consolidate SOH, technical-time, HVAC and GTFS result information and clarify Mean/Aggregate Q95 comparisons.
- Refine yearly-analysis loading, navigation, cost charts, charging-maintenance assumptions and emissions disclosures.
- Combine multi-line vehicle blocks into a shared space-time diagram with consistent route colours and distinct non-revenue trips.
- Improve diagram sizing, desktop/mobile scrolling and route lookup, and align the multilingual user guide.

### Release

- Pair with backend `1.7.0`. No database migration is required; existing analyses and installation-specific vehicle-block data are preserved.
- Keep large-fleet diagnostics and tolerance benchmarks outside routine release checks.

## [1.0.0-rc.2] - 2026-11-17

### Changed

- Combine multi-line vehicle blocks into one space-time diagram with shared stops and a consistent colour for each line.
- Use blue for single-line duties, orange dashed lines for non-revenue movements, and consistent singular or plural route legends.
- Resolve the individual routes of imported service trips, including duties that alternate between lines 4 and 6.
- Expand short diagrams to fill the available space on desktop and mobile while preserving readable spacing, internal scrolling and scroll position during resizing.
- Generalize the depot-connection label to non-revenue trips and update the vehicle-block guide.

### Validation and compatibility

- Add regression coverage for route lookup, multi-line diagrams, colours, legends and responsive sizing; isolate production-bundle version requests from the real backend.
- Limit local test processes and their descendants to eight CPU cores.
- Pair with backend `1.7.0-rc.2`. TPL vehicle-block corrections remain installation data and are not included in the release archive or container image.
- Publish as a prerelease without moving stable container aliases.

## [1.0.0-rc.1] - 2026-11-17

### Added

- Rename feasibility evaluations and yearly analyses directly from their lists.
- Show positioning progress while creating custom stops.

### Changed

- Consolidate SOH, technical-time, HVAC and GTFS information into compact result disclosures.
- Clarify Mean and Aggregate Q95 energy comparisons and simplify infeasible result views.
- Refine feasible vehicle-block summaries, charging sessions and energy charts.
- Improve yearly-analysis loading, navigation, cost charts, economic settings and emissions disclosures.
- Distinguish charging maintenance as an editable annual investment percentage or a fixed CHF/year amount.
- Place raw feasibility data access in the page header and refresh the multilingual guide and screenshots.

### Validation and compatibility

- Pair with backend `1.7.0-rc.1`. Existing saved analyses are preserved.
- The large-fleet legacy diagnostic reached its solver time limit; the tolerance benchmark was interrupted because of execution time and memory use. OSRM tests were intentionally excluded. These opt-in diagnostics remain separate from routine release checks.
- Publish as a prerelease without moving stable container aliases.

## [0.11.0] - 2026-11-10

### Added

- Show the saved HVAC policy and authenticated reproduction inputs in feasibility and yearly-analysis results, including hourly PVGIS GHI provenance and terminal auxiliary energy.

### Changed

- Refine the yearly fleet overview into a compact dashboard with annual distance, bus-side and grid energy, minimum/maximum vehicle-block efficiency, electric TCO and climate impact.
- Present fleet costs and emissions more compactly, place editable assumptions below their charts and keep the previous environmental chart visible while a recalculation is pending.
- Simplify vehicle-block efficiency and annual comparison layouts while preserving the existing numerical and scope boundaries.
- Align the multilingual online guide, screenshots and Markdown documentation with the current annual-analysis, HVAC and release workflows.

### Release

- Promote the functionality validated in `0.11.0-rc.1`, with no functional changes. Pair with backend `1.6.0`. Apply missing backend migration `010_hvac_weather_snapshots.sql`; existing feasibility and yearly-analysis records are not rewritten.

## [0.11.0-rc.1] - 2026-11-10

### Added

- Show the saved HVAC policy and authenticated reproduction inputs in feasibility and yearly-analysis results, including hourly PVGIS GHI provenance and terminal auxiliary energy.

### Changed

- Refine the yearly fleet overview into a compact dashboard with annual distance, bus-side and grid energy, minimum/maximum vehicle-block efficiency, electric TCO and climate impact.
- Present fleet costs and emissions more compactly, place editable assumptions below their charts and keep the previous environmental chart visible while a recalculation is pending.
- Simplify vehicle-block efficiency and annual comparison layouts while preserving the existing numerical and scope boundaries.
- Align the multilingual online guide, screenshots and Markdown documentation with the current annual-analysis, HVAC and release workflows.

### Staging candidate

- Pair with backend `1.6.0-rc.1`. Apply backend migration `010_hvac_weather_snapshots.sql`; existing feasibility and yearly-analysis records are not rewritten.

## [0.10.0] - 2026-11-09

### Added

- Select one GTFS edition for new feasibility and annual analyses, preserve it when duplicating vehicle blocks and display the recorded provenance in saved results.
- Add consistent detail dialogs and centered actions for fleet entities, including support for editing legacy custom stops.

### Changed

- Search shifts on the server before pagination so matching entries remain discoverable beyond the current page, while preserving page-size changes, navigation and clearing the filter.
- Keep feasibility bus-model selection stable and present GTFS context and analysis results with compact, expandable provenance details.
- Clarify feasibility results by distinguishing configured SoC limits from reached values and by placing the selected battery forecast directly before its initial physical-maximum reference.
- Show the active Mean/Q95 consumption figures in the vehicle-block summary and present the charging plan, additional information and GTFS provenance as consistent white disclosure cards.

### Fixed

- Translate the Mean demand profile consistently as “Media” throughout the Italian interface, including paired feasibility outcomes and help text.

### Release

- Promote the functionality validated in 0.10.0-rc.2. Frontend-only update compatible with backend `1.5.0`; existing data remains compatible and no database migration is required.

## [0.10.0-rc.2] - 2026-11-08

### Changed

- Clarify feasibility results by distinguishing configured SoC limits from reached values and by placing the selected battery forecast directly before its initial physical-maximum reference.
- Show the active Mean/Q95 consumption figures in the vehicle-block summary and present the charging plan, additional information and GTFS provenance as consistent white disclosure cards.

### Fixed

- Translate the Mean demand profile consistently as “Media” throughout the Italian interface, including paired feasibility outcomes and help text.
- Mock yearly-distance requests in feasibility browser tests so missing API fixtures no longer produce misleading fallback warnings.

### Staging candidate

- Frontend-only update compatible with backend `1.5.0-rc.1`; no backend release or database migration is required.

## [0.10.0-rc.1] - 2026-11-08

### Added

- Select one GTFS edition for new feasibility and annual analyses, preserve it when duplicating vehicle blocks and display the recorded provenance in saved results.
- Add consistent detail dialogs and centered actions for fleet entities, including support for editing legacy custom stops.

### Changed

- Search shifts on the server before pagination so matching entries remain discoverable beyond the current page, while preserving page-size changes, navigation and clearing the filter.
- Keep feasibility bus-model selection stable and present GTFS context and analysis results with compact, expandable provenance details.

### Staging candidate

- Pair with backend `1.5.0-rc.1`. Existing data remains compatible and no database schema migration is required.

## [0.9.0] - 2026-11-05

### Added

- Add an authenticated home explaining the application sections in four languages. The ELETTRA logo and guide return links open the appropriate home for the current session.

### Fixed

- Preserve the complete feasibility configuration across repeated duplication, including CHF infrastructure costs, fixed battery reference packs, SOC limits, charging constraints, forecast settings and solver options.
- Display negligible infrastructure costs as zero without modifying untouched saved values. Prevent incomplete copies when source resources cannot be recovered.
- Restore fleet deletion, vehicle-block editing, registration, pagination and annual-analysis creation workflows.

### Release

- Promote the functionality validated in 0.9.0-rc.3. Existing historical costs and results are preserved; incorrectly configured historical evaluations require review and recalculation.

## [0.9.0-rc.3] - 2026-11-05

### Fixed

- Preserve the full feasibility configuration when duplicating: selected vehicle blocks and bus model, battery reference packs, SOC bounds, charging limits and costs, legacy per-point prices, timing constraints, forecast settings and solver options.
- Show infrastructure cost inputs below CHF 0.000000001 as `0`. Preserve the saved value when untouched; an explicit edit to zero is saved as zero.
- Refuse partial copies when original resources or forecasts cannot be recovered. Preserve nonstandard occupancy/SOC values and legacy battery sizing instead of silently replacing them with defaults.
- Compare complete optimization and forecast requests across repeated Mean/Q95 copies in every optimization mode, with standard, custom, near-zero and legacy costs.

### Staging candidate

- Frontend-only correction, compatible with backend 1.4.1-rc.2. Existing evaluations and historical costs are not rewritten; previously incorrect inputs still require review and recalculation.

## [0.9.0-rc.2] - 2026-11-05

### Fixed

- Preserve charging-point and site fixed costs in CHF when duplicating feasibility evaluations. Repeated copies no longer divide the costs by 1,000 or incorrectly mark standard costs as custom.
- Add browser regressions for repeated Mean and Q95 copies in all three optimization modes, covering standard and custom depot/pantograph costs, zero costs and fractional CHF amounts.

### Staging candidate

- Keep CHF inputs, investments and exports consistent with explicitly scaled kCHF bus-model tables and annual charts. Previously saved evaluations with incorrect inputs must be reviewed and recalculated.

## [0.9.0-rc.1] - 2026-11-05

### Added

- Introduce an authenticated home in four languages explaining the main sections and planning workflow, with direct links to each section.
- Open the internal home after login and through the ELETTRA logo and Home navigation entry.

### Fixed

- Preserve the authenticated navigation flow when returning from the user guide; signed-in users no longer see the public login landing page.
- Restore fleet deletion, vehicle-block editing, registration, pagination and annual-analysis creation workflows.
- Cancel superseded route loads and clean up page handlers to keep repeated navigation reliable.

### Staging candidate

- Integrate the home and stable CRUD fixes on a dedicated branch. Publish as a GitHub Pre-release without changing stable Docker aliases.

## [0.8.1] - 2026-11-05

### Fixed

- Prevent circular production chunks from stopping the application before its first view is rendered.
- Exercise the optimized `dist` bundle in Chromium during release and Pages workflows so source-only browser tests cannot miss packaging regressions.

## [0.8.0] - 2026-11-05

### Added

- Add complete fleet and representative-bus annual analyses with electric/diesel TCO, emissions comparisons, multi-depot support, saved assumptions and auditable exports.
- Calculate paired Mean and aggregate-Q95 feasibility designs, with independent charging plans, SOC verification and consistent General/vehicle-block results.
- Add a multilingual user guide covering the current planning use cases and workflows, with an always-visible sidebar link that opens the guide in a new tab.

### Changed

- Batch forecasting and charging-stop loading, load distances on demand and keep long-running simulation jobs bounded and recoverable.
- Present localized optimization modes, validation feedback and per-vehicle-block outcomes, including explicit guidance when a result cannot be determined.
- Align forms, deletion flows, pagination, runtime configuration and frontend/backend contracts across desktop and mobile layouts.

### Security

- Harden authentication, role permissions, user-data isolation, HTML rendering, destructive operations and external runtime dependencies.
- Require the dedicated staging frontend, backend and database targets for integration tests.

## [0.8.0-rc.6] - 2026-11-04

### Staging candidate

- Preserve every selected vehicle block when a feasibility evaluation stops during input validation, using current vehicle-block names and per-block outcomes from the backend.
- Explain which vehicle blocks failed validation, which were not evaluated, and the exact depot mismatch without presenting a calculation failure as an infeasible design.
- Keep legacy failed evaluations safe and usable, including results with only an error string or failed status, while preventing unavailable cost, distance, prediction and emissions calculations.
- Require the complete staging frontend, backend and database targets for integration tests. Publish as a GitHub Pre-release without changing stable Docker aliases.

## [0.8.0-rc.5] - 2026-11-04

### Staging candidate

- Submit all annual weather scenarios and vehicle blocks in one forecast request, preserving each block's assigned battery size and progress reporting.
- Initialize charging-only battery packs at the selected model's integer midpoint. Model changes refresh the default; subsequent user edits remain intact.
- Show validation feedback beside the first invalid field and scroll/focus it before evaluation confirmation, including missing selections, battery limits and infrastructure inputs.
- Publish as a GitHub Pre-release; stable Docker aliases, including `latest`, remain unchanged.

## [0.8.0-rc.4] - 2026-11-04

### Staging candidate

- Use the ELETTRA E as the favicon, with a transparent symbol on a blue background.
- Validate fixed battery pack counts against the selected bus model's minimum and maximum, including model changes and loading states, with localized inline explanations.
- Batch charging-stop candidate loading and load vehicle-block distances on demand.
- Integrate the annual fleet analysis, electric/diesel TCO and emissions comparisons, depot charging and paired Mean/Q95 evaluation work into main.
- Skip GitHub Pages deployment for pre-release versions. Publish as a GitHub Pre-release and preserve stable Docker aliases, including `latest`.

## [0.8.0-rc.3] - 2026-10-30

### Staging candidate

- Use green for completed evaluations, yellow while either Mean or Q95 is pending/running, and red for errors or incomplete verification, including timeouts.
- Explain indeterminate feasibility explicitly instead of implying that calculation errors prove infeasibility. Add localized status reasons and desktop/mobile regressions.
- Publish as a GitHub Pre-release; stable Docker aliases remain unchanged.

## [0.8.0-rc.2] - 2026-10-30

### Staging candidate

- Align comparison fallback text with translations and allow long guide headings to wrap on narrow screens (RC1 stopped at the CI gate and was not published).

- Add fleet and representative-bus annual analyses with assigned-duty consumption, editable mileage by bus/battery group, electric/diesel TCO, restored emissions comparisons and exports.
- Save annual assumptions automatically with a compact explanatory tooltip, serialized writes and retry on failure; share physical assumptions between Costs and Emissions.
- Default charging-infrastructure maintenance to 2% of initial investment per year and diesel service life to 12 years; keep both editable.
- Show bus, battery and infrastructure investment consistently in CHF, including fixed-site and power-dependent costs.
- Support multiple arrival depots using the weather of the depot receiving most buses. Improve annual confirmation/progress dialogs and evaluation layouts.
- Publish this RC as a GitHub Pre-release with version-specific images; stable Docker aliases, including `latest`, are unchanged. Deployment targets staging only.

### Added

- Calculate complete Mean and aggregate-Q95 designs in one feasibility evaluation. The result selector switches the entire design without starting another optimization; paired outcomes appear together in the list.
- Show the selected design’s energy requirement and SOC, with a charging policy that favours lower SOC and occupies the pantograph for the complete dwell.
- Preserve separate design identities for costs and yearly analyses, and explain pending or failed alternatives without relabelling the displayed result.
- Add unit and desktop/mobile regressions for all three optimization modes and update the guide in four languages.

## [0.7.4] - 2026-10-29

### Fixed

- Preserve the requested Mean/Q95 basis through asynchronous result refreshes and General/shift navigation. The stored result keeps its original basis until the user explicitly opens or creates another evaluation.
- Added desktop/mobile regressions proving that rerendering restores the requested basis, repeats only a read-only compatibility lookup and never starts an optimization automatically.

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

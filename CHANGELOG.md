# Changelog

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

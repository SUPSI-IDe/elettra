# Changelog

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

# Dead code and broken CSS found during the audit

Status: needs-triage
Type: task

## Broken CSS (silently dropped by the parser)

- `yearly-analysis-results.css:1315–1319` — final media query contains a dangling selector `.ya-costs-kpi-grid,` immediately followed by `}`. Malformed rule; whatever it was meant to do at that breakpoint does not happen. Reconstruct intent or delete.

## Orphaned file with contradictory palette

- `src/pages/Simulation/YearlyAnalysis/yearly-analysis-charts.js` — **nothing imports it anywhere in the repo**. It carries a cost palette with a renamed key (`usage` vs `energy`), a different LCA phase palette, and a primary-energy palette that contradicts the three live files (`#6fbeec`/`#1f4e79` vs success-green/`#e67e22`). Recommend deleting; if it's meant to come back, align its palettes first. **Decision: delete?**

## Dead UI: compare-section

- `simulation-runs.html:15` — `<div class="compare-section" data-role="compare-section" hidden>` with full markup (selects, compare button) and a working click-handler wiring in simulation-runs.js (compareBtn → `triggerPartialLoad("simulation-comparison")`), but **no code ever sets `hidden = false`**; verified live — selecting 2+ completed runs does not reveal it. Either wire up the reveal or remove the section + its CSS (`.compare-*` in simulation-runs.css). **Decision: feature or leftovers?**

## Dead/no-op declarations

- buses.css:134 — re-declares shared `.form-group` gap verbatim
- simulation-runs.css:12 — re-declares shared `.table-controls` margin verbatim
- add-simulation.css:60, 80 — self-referential var fallbacks
- style.css:2224 — `var(--space-xs, var(--space-sm))` misleading fallback
- simulation-results.css:1446 — `var(--radius-sm, 6px)` fallback contradicts token
- sim-results:2374 / ya-results:1291 — redundant responsive padding overrides
- style.css:55 — `--radius-2xl: 14px` is now dead. Ticket 07 folded the Shifts cards to `--panel-radius` and ticket 10 moved `.shift-progress__content` to `--radius-xl`, leaving no consumers. Delete unless the 14px tier is being kept deliberately.

## Backend observation (not frontend work, recording for visibility)

Every prediction run for the test dataset 404s (`GET /api/v1/simulation/prediction-runs/<id>`), so simulation-results renders only "Prediction run not found" and the console logs ~200 failed requests per page visit.

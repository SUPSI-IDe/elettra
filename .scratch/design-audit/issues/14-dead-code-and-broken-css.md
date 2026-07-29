# Dead code and broken CSS found during the audit

Status: done
Type: task

## Decisions taken

Resolved 2026-07-29. Two verification gates ran before any deletion; both cleared.

### Removed: run-level simulation comparison (superseded)

`simulation-comparison` compared two individual feasibility runs, reachable only
through a `compare-section` block on the runs list that nothing ever unhid — the
markup shipped with a hardcoded `hidden` attribute and no code path removed it.
The handler, the route and all four languages' translations were complete, so the
feature had been built and translated but never released.

`analysis-comparison` (its own top-level nav section) already ships a working
comparison UI for yearly analyses, so run-level comparison was judged superseded
rather than revived.

**Gate — checked before deleting:** everything `simulation-comparison.js` computed
came from shared modules that `simulation-results.js` also uses
(`utils/economic-costs.js` → `buildDiscountedProjectedCostTrend`,
`computeEquivalentAnnualCost`, `computeScheduleResidualValue`;
`config/economic-defaults`; the `fetchEconomicComparison` / `fetchEconomicDefaults`
/ LCA endpoints). No unique modelling was lost — structurally it was the single-run
results page rendered twice side by side.

**Capability lost, on the record:** run-level comparison, including its
`predictions` tab. `analysis-comparison` has overview / efficiency / cost /
emissions and no predictions panel, and compares yearly analyses rather than
individual runs. Recoverable from git history if it is ever wanted back.

Deleted:

- `simulation-comparison.{js,html,css}` (2,759 lines)
- `navigation.js` — import, `SHELL_SECTION_BY_SLUG` entry, router case
- `simulation-runs.html` — the `compare-section` block
- `simulation-runs.js` — select/button queries, `populateCompareSelects`,
  `handleCompareClick`, listener and cleanup; `loadRunsAndPopulate` wrapper
  removed so the initializer calls `loadRuns()` directly
- `simulation-runs.css` — 11 `.compare-*` rules
- `style.css` — `.compare-btn:disabled` and `.compare-btn:disabled:hover` from the
  shared disabled-button selector lists
- `translations.js` — 11 `simulation.compare_*` keys × 4 languages = 44 entries

Kept: `simulation.tab_costs` / `tab_efficiency` / `tab_emissions` /
`tab_predictions` and `common.close` — used by the comparison page but shared with
other pages.

Uncommitted audit styling on `simulation-comparison.css` was captured as a diff
before removal, in case the feature is revived.

### Removed: orphaned `yearly-analysis-charts.js`

Never imported anywhere, in the entire repo history (`git log -S` over `src/`
returns nothing), yet it kept receiving feature commits — people were editing a
file that had never run.

**Gate — checked before deleting:** all seven exports have live counterparts,
fingerprinted by their `chart_aria_*` i18n keys. `renderProjectedCostTrend` was
strictly *older* than live code: `ff2b3c3` moved the discounting into
`utils/economic-costs.js` (with tests) and updated this file's aria label to say
"present-value" while leaving its local `buildProjectedTrend` on the undiscounted
linear formula. It was stale **and** mislabelled.

The palette contradictions the audit flagged (`usage` vs `energy`, a divergent LCA
phase palette, `#6fbeec`/`#1f4e79` primary energy) were symptoms of the fork, not
the cause.

### Fixed: malformed CSS rule

`yearly-analysis-results.css` — the file's last rule was a dangling
`.ya-costs-kpi-grid,` followed by `}`, silently dropped by the parser. Recovered
the original intent from `9312a7d`: both KPI grids collapsed to a single column at
≤480px. Someone later deleted the `.ya-summary-cards` half and left the comma.

**Decision: delete the dangling selector rather than restore.** The phone KPI
layout is a design question in its own right, not dead-code cleanup — split to
ticket 16 so it gets decided deliberately.

### Removed: `--radius-2xl: 14px`

`style.css` — zero consumers after ticket 07 folded the Shifts cards to
`--panel-radius` and ticket 10 moved `.shift-progress__content` to `--radius-xl`.
The scale is now 4 / 6 / 8 / 10 / 9999 with `--radius-xl` as the deliberate ceiling.
Usage at time of removal: sm 12, md 45, lg 38, xl 20, 2xl 0, full 1.

### Removed: 19 dead `var(--alias, var(--canonical))` fallbacks

`simulation-results.css` (16) and `add-simulation.css` (3), rewritten to
`var(--alias)`. The first token always resolved — `style.css` carries a legacy
alias layer (`--background-alt`, `--bg-card`, `--border-light`, `--color-text`, …)
— so every fallback branch was unreachable. Each one read as "this token might not
exist," which is the doubt the audit exists to remove. Provably no visual change.

Retiring the ~20-alias layer itself is **out of scope** and still open.

## Already fixed by earlier tickets — dropped from this one

Listed in the original audit, resolved by tickets 07 / 09 / 10 / 11 before this
ticket was worked:

- buses.css:134 — duplicate `.form-group` gap
- simulation-runs.css:12 — duplicate `.table-controls` margin
- add-simulation.css:60, 80 — self-referential var fallbacks
- style.css:2224 — `var(--space-xs, var(--space-sm))`
- simulation-results.css:1446 — `var(--radius-sm, 6px)`
- sim-results:2374 / ya-results:1291 — redundant responsive padding overrides

## Split out

- **Ticket 16** — KPI grid layout at ≤480px
- **Ticket 17** — prediction-run 404s and the N+1 request fan-out

## Verification

`npm run build` clean, `npm test` 26/26 passing. No references to
`compare-*`, `simulation-comparison`, `yearly-analysis-charts` or `--radius-2xl`
remain in `src/`.

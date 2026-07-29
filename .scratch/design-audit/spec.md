# Frontend Design Consistency Audit

Date: 2026-07-28
Baseline: commit `9a5e061` (clean tree), branch `user-interface`
Scope: all 16 page CSS files + `src/style.css` + JS-defined colors/typography (d3 charts, Leaflet). Presentation surface only: colour, spacing, typography, radii, shadows, borders, interactive states. Layout/responsiveness excluded.
Arbitration rule: **majority wins** per role; ties and ambiguities flagged as *decision needed*.

## Method

- Four parallel static audits (typography, color, spacing, surfaces & interactive states) over every in-scope CSS/JS file.
- Visual verification pass against the live app (Playwright, viewport 1440×900, test account): 13 screenshots covering Buses, Custom Stops, Shifts, shift visualization, Feasibility evaluation list + results shell, add-simulation form, Yearly analyses list, create-yearly-analysis form, Analysis comparison, Settings, About. Screenshots in the session scratchpad (`shots/`).
- **Not visually verified** (no data in the test account; findings for these are source-level only): simulation-results tab content (all runs 404 on prediction data), simulation-comparison, yearly-analysis-results, analysis-comparison with selections.

## State of the system (executive summary)

The token system in `style.css` is solid and the **list pages are in good shape**: `about.css`, `settings.css`, `custom-stops.css`, `yearly-analysis-runs.css`, `simulation-detail.css`, `shift-visualization.css` and most of `buses.css`/`shifts.css` are fully or nearly fully tokenized. Table cell padding, pagination, page headers, page titles, status badges (the shared ones), meta label/value pairs, and sort buttons are consistent app-wide.

The drift concentrates in three places:

1. **The results pages** (`simulation-results.css` ~156 hardcoded values, `yearly-analysis-results.css` ~112) and their duplicated components. Several components are copy-pasted between the two pages (or between results and comparison) and have drifted: tooltips, badges, params grids, infeasibility notices, slider panels, mission bars.
2. **Chart code in JS** never references the token system: ~150 hardcoded colors/font sizes across `simulation-results.js`, `simulation-comparison.js`, `yearly-analysis-results.js`, `trip-preview.js`, `shift-timeline.js`. The cost-stack, LCA-phase, and pollutant palettes are copy-pasted 3–4×. `trip-preview.js` uses a Tailwind palette alien to the app.
3. **Interactive states**: focus styles are missing or explicitly removed on many controls (accessibility defect), two conflicting disabled-button treatments stack on the same selectors, and four different row-hover tints coexist.

Also found (not presentation drift, but real): a text-overlap rendering defect in the Buses table, a dead `compare-section` UI that nothing ever unhides, an orphaned `yearly-analysis-charts.js` with a contradictory palette, and one malformed CSS rule that the parser silently drops.

## Verdicts by role

| Role | Majority verdict | Ticket |
|---|---|---|
| Focus states | 3px `--color-focus-ring` box-shadow ring, everywhere | 01 |
| Chart palettes | Tokenize; single shared palette module | 02 |
| Table header typography | Two tiers: list `sm/600`, dense `2xs/700`; fold stragglers | 03 |
| Table body cells | List `md`, dense `sm`; fix `.stops-table` (2xs) and `.investment-table` (md) | 03 |
| KPI labels | Tie: `sm/600` vs `xs/700` — **decision needed** | 04 |
| KPI values | Slim majority `md/700` vs global `xl/700` — **decision needed** | 04 |
| KPI tile padding | `--control-padding-block × --control-padding-inline` | 04 |
| KPI grid gap | `--space-sm` (dense majority; shared default says `md`) | 04 |
| Badges | Pill radius + shared `.badge`; pill-vs-rect **decision needed** | 05 |
| Row hover | `--color-row-hover-bg` token; tinted-vs-plain for dense tables **decision needed** | 06 |
| Row selected | Shared tokens + inset bar; fix add-simulation | 06 |
| Card/panel treatment | 1px border + `--panel-radius` + `--shadow-sm`; Shifts 14px outlier **decision needed** | 07 |
| Card/panel padding | `--panel-padding` (lg) standard, `md` dense tier | 07 |
| Table container | Border + `--radius-lg` + `--shadow-sm` for standalone tables | 07 |
| Button radius | `--radius-md` | 08 |
| Button padding | `sm × md` | 08 |
| Button weight | 500 vs 600 split in style.css itself — **decision needed** | 08 |
| Button transitions | Tokens exist; canonical duration **decision needed** | 08 |
| Disabled treatment | Token gray-swap block; delete conflicting opacity rules | 08 |
| Form labels | `lg/600` global; compact tier **decision needed** (md vs sm both exist) | 09 |
| Form inputs | `lg`, `--radius-md`, `--border-medium`, teal focus ring | 09 |
| Modals | `--radius-xl` + shared shadow; blur-or-not **decision needed** | 10 |
| Tooltips/info icons | Three builds of the same component; dark-vs-light **decision needed** | 10 |
| Section headings | Page-level `xl/600`, in-panel `lg/600`; fold `heading-sm` stragglers | 03 |
| Empty states | `md` text, `--space-lg` padding | 03 |
| Chart text | Ticks 10px majority, labels 11px/600; needs tokens; kill 8px | 02 |
| Uppercase letter-spacing | `0.04em` | 13 |

Mechanical inventories (every hardcoded value with file:line and target token) live in tickets 11 (spacing), 12 (color), 13 (typography), and the radius/shadow list in 07/08.

## Decisions needed (blocking items, grouped)

1. **KPI label/value typography** — genuine tie (ticket 04).
2. **Badge shape** — pill vs 4px rect; currently mixed within one page (ticket 05).
3. **Dense-table hover tint** — token gray vs brand-tinted; four variants today (ticket 06).
4. **Shifts cards at `--radius-2xl`** — only page with 14px cards (ticket 07).
5. **Button font-weight** (500 vs 600) and **canonical transition duration** (ticket 08).
6. **Compact form tier** — md and sm both exist for labels/inputs (ticket 09).
7. **Tooltip surface** — dark `--color-tooltip-bg` vs white surface; **modal backdrop blur** yes/no (ticket 10).
8. **Chart red/orange vs UI danger/warning** — merge or keep distinct series colors (ticket 02).
9. **`--font-size-xs` (11px) < `--font-size-2xs` (12px)** — inverted naming; rename or live with it (ticket 13).
10. **Delete orphaned `yearly-analysis-charts.js` and dead compare-section UI** (ticket 14).

## Out-of-scope observations (recorded, not part of this audit's fix phase)

- Buses table: Name column text overlaps the Vehicle-category column at 1440×900 (visual defect; ticket 15).
- Backend: every prediction run for the test dataset 404s (`/api/v1/simulation/prediction-runs/*`), so the results pages render only an error state; the console reports ~200 failed requests per visit.
- The simulation-runs "Compare simulations" section (`simulation-runs.html:15`) is permanently `hidden`; no JS references `data-role="compare-section"` (ticket 14).
- `yearly-analysis-results.css:1315–1319` contains a malformed final media-query rule (dangling selector) that the parser silently drops (ticket 14).

## Tickets

| # | Slug | Status |
|---|---|---|
| 01 | focus-states | done |
| 02 | chart-palette-tokens | needs-triage |
| 03 | table-and-heading-typography | needs-triage |
| 04 | kpi-tiles | needs-triage |
| 05 | badges-pills | needs-triage |
| 06 | row-states | needs-triage |
| 07 | cards-panels-containers | needs-triage |
| 08 | buttons | needs-triage |
| 09 | form-controls | needs-triage |
| 10 | dialogs-tooltips-info-icons | needs-triage |
| 11 | mechanical-spacing | ready-for-agent |
| 12 | mechanical-color | ready-for-agent |
| 13 | mechanical-typography | needs-triage |
| 14 | dead-code-and-broken-css | needs-triage |
| 15 | bug-buses-column-overlap | needs-triage |

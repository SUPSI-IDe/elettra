# Mechanical: hardcoded spacing → tokens

Status: ready-for-agent
Type: task

Rule: values that map exactly to a token get the token; "between-token" values (marked *candidate*) snap to the **nearest token** unless doing so visibly changes a verified-consistent pair — then keep both sides equal and note it. Token scale: xs .25 / 2xs .375 / sm .5 / 2sm .75 / md 1 / 2md 1.25 / lg 1.5 / xl 2 / 2xl 2.5 / 3xl 3 (rem); `--control-padding-block` .65rem, `--control-padding-inline` .75rem.

Clean files (skip): about.css, settings.css, custom-stops.css, shift-visualization.css, shifts.css, simulation-detail.css, yearly-analysis-runs.css.

## The `0.65rem` magic number (recurring — it IS `--control-padding-block`)

buses.css:199, analysis-comparison.css:40, 51, add-simulation.css:171, 188, style.css:646, 1148, 1905, create-yearly-analysis.css:16, 24, ya-results:209, 438, 1103 → use `var(--control-padding-block)` where it's control padding, else snap.

## Exact token matches (straight swaps)

- simulation-comparison.css:141–142, sim-results:251–252, 514, ya-results:673–674, 714–715 — tooltip offsets 6px→`2xs`, 8px→`sm`
- ya-results:308 `0.5rem 1.5rem`→`sm lg`; :666 4px→`xs`; :708, 1139 6px→`2xs`; :676, 718 tooltip `8px 10px`→`sm 2sm` (match sim-results twins); :1271 4px→`xs`
- create-yearly-analysis.css:16 `0.5/0.75`→`sm/2sm`; :24 `0.5rem`→`sm`; :40 `0.25rem`→`xs`; :58 `0.25rem`→`xs`
- style.css:534 4px→`xs`; :1938 4px→`xs`
- sim-results:746 `0.6rem`→`control-padding-block` (matches sibling close buttons)

## Candidates (snap to nearest; grouped by file)

- **analysis-comparison.css**: 69 (0.6→sm), 71 (0.15→xs or 0), 96 (0.6→sm)
- **add-simulation.css**: 85 (0.6→sm), 171/188 (0.65→control-padding-block), 333 (1.35→2md or lg)
- **simulation-comparison.css**: 241 (0.6→sm), 269 (0.15/0.6 — badge, see ticket 05), 294 (0.85→2sm or md), 368 (0.6→sm)
- **simulation-runs.css**: 184 (0.6→sm), 204 (1.4→lg)
- **simulation-results.css**: 67, 91, 309–334 (slider micro-grid — keep internally consistent with ya-results twin, extract shared component first), 406, 611–630 (0.95→md), 803, 901, 1055, 1092, 1135, 1165, 1208, 1342, 1613, 1654, 1674, 1723, 1794, 1971 (1.1→2md), 2013, 2033, 2040, 2071, 2080, 2135, 2262, 2329, 2333, 2398
- **create-yearly-analysis.css**: 7 (0.4/0.55 — align with add-simulation `2xs sm`, ticket 09), 8 (0.2→2xs), 11 (0.45→sm), 20 (0.3→2xs), 24–25 (0.55/0.65/0.3/1.1), 55 (0.35→2xs)
- **yearly-analysis-results.css**: 100, 208–210, 239–240, 254, 293, 309, 314–315, 354–368, 376, 399, 553, 747–768 (slider twin), 827–876, 1065, 1103, 1186, 1192, 1201, 1234–1240, 1264 (1.1→2md), 1307
- **buses.css**: 196 (0.45→sm), 199
- **style.css** (shared primitives — highest leverage): 617, 646 (0.9→2sm or md), 1148 (badge — ticket 05), 1728 (0.6→sm), 2064 (2px)

## Cleanups (no visual change)

- add-simulation.css:60, 80 — self-referential fallbacks `var(--space-sm, var(--space-sm))`
- style.css:2224 — `var(--space-xs, var(--space-sm))` misleading fallback
- simulation-runs.css:12 — restates shared `.table-controls` margin, delete
- sim-results:2374 + ya-results:1291 — responsive `md` overrides redundant with `--layout-content-padding` already dropping at ≤1024

## Page container padding

Majority `--layout-content-padding`. Fix buses.css:8 (add-bus-model uses `--space-lg` literal, missing responsive drops). `.visualize-shift` at `--space-sm` (shifts.css:369) is a 4-step outlier — flag to user before changing (may be intentional full-bleed).

## Other role verdicts to apply (from the semantic audit)

- Tab-panel section gap: `lg` is the larger cluster (results base `.tab-panel` at `md` is the odd one; YA uses `md`) — flag, then unify
- Table controls margin-bottom: `md` (bump yearly-analysis-runs.css:6 and shifts.css:125 from `sm`)
- Key-value row rhythm: `2xs` vertical (fold simulation-detail.css:84 `sm`, sim-results:1165 `0.22rem`, analysis-comparison.css:71 `0.15rem`)
- Params/meta strips: standardize on shared `.meta-list` gap (`xs lg`) + `sm × md` padding; 6 hand-rolled variants (ya-results:209, create-YA:24, simulation-comparison:241, sim-results:1336, 1937, ya-results:1234); NOTE `.efficiency-params-grid` has the same class name with different layout on two pages

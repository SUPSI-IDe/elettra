# Unify focus-visible treatment (accessibility)

Status: done
Type: task

Majority mechanism (keep): `box-shadow: 0 0 0 3px var(--color-focus-ring)` — used by table-controls buttons, td buttons, `.table-action-link` (style.css:838–843), about-btn (style.css:367), user-menu-toggle (style.css:507), nav links (style.css:664), and the shared form-input focus (style.css:1323–1342).

## Defects — focus explicitly removed with no replacement (fix first)

- `simulation-results.css:360` — `.results-cost-variables__range:focus { outline: none }`
- `yearly-analysis-results.css:784, 793` — `.ya-cost-variables__range` outline removed on base rule and `:focus`
- `simulation-results.css:1045` — `.efficiency-info-icon:focus { outline: none }`
- `shifts.css:390` — `.visualize-shift__back:focus` removes underline, no ring

## Color-only focus styles (effectively invisible — add the ring)

- `style.css:812` — `button.list-primary-action:focus-visible` sets only `color`
- `style.css:1295` — `.btn-primary:focus-visible` sets only `color`
- Sort buttons: `shifts.css:312`, `simulation-runs.css:58`, `add-simulation.css:127` — text color change only

## No custom focus style at all (UA default; add the ring)

btn-secondary, form-actions buttons, compare-btn, ac-export-btn, btn-close-results, ya-btn-close, ya-toolbar-btn, sim-data-btn, results-tab/ya-tab/results-shift-tab, ya-chart-unit-button, pagination buttons, landing/login buttons, close-button, shift-form buttons, ac-select, pagination select, add-simulation shift-search & number inputs.

## Competing mechanisms to converge

- `yearly-analysis-results.css:175, 618` — details toggles use `outline: 3px solid var(--color-focus-ring); outline-offset: -3px` instead of box-shadow
- `style.css:340` — language-select uses `0 0 0 2px var(--color-focus-ring-strong)`
- `add-simulation.css:49` — error focus ring `rgba(211,47,47,0.12)` ≈ `--color-negative-muted` (alpha off by 0.02); use the token

## Acceptance

Every interactive element shows the 3px `--color-focus-ring` box-shadow on `:focus-visible`. No `outline: none` without a replacement. Verified by tabbing through each page.

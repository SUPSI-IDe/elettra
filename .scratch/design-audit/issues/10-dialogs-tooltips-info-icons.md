# Dialogs, tooltips, and info icons

Status: needs-triage
Type: task

## Modals / dialogs

- Panel radius spread: 8px (usable-soc-warning, add-simulation.css:331), 10px (sim-data-panel sim-results:776, ya-config-dialog ya-results:135), 12px (simulation-progress add-simulation.css:283), 14px `--radius-2xl` (shift-progress). Majority verdict: `--radius-xl`.
- Shadow: `0 8px 32px rgba(0,0,0,.18)` ×4 → `--shadow-modal` token; outlier `0 12px 34px` (add-simulation.css:332).
- Overlay scrim `rgba(0,0,0,0.45)` is consistent ×5 but untokenized → add `--color-overlay`.
- `backdrop-filter: blur(2px)` only on the two progress overlays (add-simulation.css:278, shifts.css:238), absent on sim-data/ya-config/usable-soc. **Decision: blur or not, once.**
- Dialog padding is consistent (`xl`; progress overlays `xl × 2xl`) — keep.

## Info icon + tooltip — three builds of one component

1. buses vehicle-category-info (buses.css:196–199): 1px border circle, dark tooltip, animated, **the only one with :focus-visible** — best a11y
2. results costs-title-info (sim-results:246–256): filled circle, white tooltip, `--shadow-md`/`--radius-md`, tokenized padding `sm × 2sm`
3. ya-results copies (ya-results:657–723): same component names as (2) but drifted to px values — `8px 10px` padding, hardcoded 6px radius, `0.12` shadow, `2xs` font (vs `xs` in the twins)
4. efficiency-info-icon (sim-results:1045): tooltip-less, focus outline removed

Mechanical: ya-results should re-converge on the sim-results tokenized version; all icons get the buses-style focus treatment (ticket 01). Icon bg `rgba(0,99,154,0.12)` recurs ×3 — tokenize with `--color-chart-primary` (ticket 02).

## Tooltip surface — decision needed

- Dark: `--color-tooltip-bg #1e293b` (costs-kpi-tooltip sim-results:519–524, buses tooltip, shift-timeline.js:147 as `rgba(0,0,0,0.8)`)
- Light: white surface + `#94a3b8` stroke (7 SVG chart tooltips: simulation-results.js:2141, 2328, 2407, 2583; yearly-analysis-results.js:428, 1073, 1262)

Two visual languages for the same role. Pick one; then tokenize the border (`--color-tooltip-border`) or switch all to `--color-tooltip-bg`.

## Tooltip offsets (mechanical)

`calc(100% + 6px)` / `right: -8px` hardcoded at simulation-comparison.css:141–142, sim-results:251–252, 514, ya-results:673–674, 714–715; buses.css:196 uses `0.45rem`. Map to `--space-2xs`/`--space-sm`.

## Dropdowns (fine)

user-menu-dropdown + autocomplete-dropdown agree (`--radius-md`, 1px `--border-medium`); just tokenize their `0 4px 12px rgba(0,0,0,0.1)` shadow ≈ `--shadow-md` (style.css:540, 1973).

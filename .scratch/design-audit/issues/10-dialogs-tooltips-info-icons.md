# Dialogs, tooltips, and info icons

Status: done (CSS scope; SVG chart tooltips deferred to ticket 02)
Type: task

## Comments

- 2026-07-29: Resolved through a grilling session; implemented in the same pass.
  - **Scope**: CSS only. The 7 d3/SVG chart tooltips and `shift-timeline.js` move to ticket 02, which inherits the surface decision below.
  - **Tooltip surface**: light wins (4–2 in CSS, 11–3 counting the SVG rects). `--color-tooltip-bg` (`#1e293b`) deleted; replaced by `--color-tooltip-surface`, `--color-tooltip-border`, `--color-tooltip-text`. Renamed rather than repointed so a missed call site fails visibly instead of rendering white-on-white.
  - **Arrow**: dropped. `.costs-kpi-tooltip` was the only one with a pointer; 4 of 5 had none.
  - **Info icon**: filled circle at 0.95rem, `color-mix(in srgb, var(--color-brand-secondary) 12%, transparent)`, brand-secondary italic `i` (majority 3–2). `.vehicle-category-info` and `.efficiency-info-icon` converge onto it, retiring `--action-blue` and the `opacity: 0.75` treatment as icon idioms.
  - **Tooltip text**: `--font-size-2xs` (12px). Genuine 3–3 tie broken on readability — these carry paragraphs, and 11px is the badge/glyph tier.
  - **Motion**: `display: none` + `transition-behavior: allow-discrete` + `@starting-style`. Gives buses' fade everywhere while keeping hidden tooltips out of their containers' scroll extent (they live inside `overflow: auto` table wrappers). `--tooltip-enter-offset` flips the entry direction for upward tooltips.
  - **Consolidation**: one definition in `style.css`, selector-list aliased onto the historical class names (`.info-icon`/`.info-tooltip` are canonical for new call sites). No class renames — three of the four pages cannot be rendered on the test account. This also fixed a live collision: `.costs-title-info`/`.costs-title-tooltip` were defined at identical specificity in both `simulation-results.css` and `yearly-analysis-results.css`, so one build was already dead.
  - **Seam**: the shared block owns surface, type and motion; call sites own only anchor edge and width (`min(20rem, 75vw)` for prose, `260px` for short hints).
  - **Backdrop blur**: kept as an intentional role distinction, not drift — `blur(2px)` on the two blocking progress overlays, none on the three dialogs. It was already 100% consistent within each role.
  - **a11y**: because hidden tooltips leave the a11y tree, the six unlabelled `.ya-info-icon` spans in `yearly-analysis-results.js` now go through an `infoTip()` helper that also emits an escaped `aria-label`.
- Follow-up for ticket 14: `--radius-2xl` is now dead — `.shift-progress__content` was its last consumer.

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

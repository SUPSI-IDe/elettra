# Centralize chart palettes and chart typography

Status: needs-triage
Type: task

Chart code never references the CSS token system. Palettes are copy-pasted 3–4× across files. Recommendation: one shared chart-palette module (JS constants reading CSS custom properties, or exported constants mirrored as tokens) consumed by all chart code.

## Inherited from ticket 10 (decided 2026-07-29, binding)

The SVG chart tooltips were deferred here from ticket 10, which settled their appearance:

- Light surface. The 7 d3 tooltip rects (`simulation-results.js:2141, 2328, 2407, 2583`; `yearly-analysis-results.js:428, 1073, 1262`) point their fill at `--color-tooltip-surface` and their stroke at `--color-tooltip-border` — the `#94a3b8` stroke goes away.
- `shift-timeline.js:147`'s `rgba(0, 0, 0, 0.8)` HTML tooltip converts to the same light treatment; `--color-tooltip-bg` no longer exists.
- Tooltip label fill → `--color-tooltip-text`; tooltip text size → `--font-size-2xs` (12px).
- No pointer arrows.

## Duplicated palettes (consistent today, one edit from drift)

- **Cost stack** `#4f86c6 / #d4881f / #5f8f2f`: simulation-results.js:110, simulation-comparison.js:108–110, yearly-analysis-results.js:204 (+ dead ya-charts.js with a renamed key)
- **LCA phases** `#e74c3c #e67e22 #f1c40f #3498db #9b59b6 #1abc9c`: simulation-results.js:136–142, simulation-comparison.js:132–138, yearly-analysis-results.js:1999–2005
- **Pollutants** NOx `#d4a017`, PM10 `#8b6914`: simulation-results.js:7187–7188, simulation-comparison.js:1340–1341, yearly-analysis-results.js:2762–2763
- **Efficiency/quantile** drivetrain `#6fbeec` (= `--color-brand-accent`), auxiliary `#f5a623` (= `--color-warning`), total/q50 `#00639a`: simulation-results.js:3386–3393, yearly-analysis-results.js:961, 1089

## Hardcoded duplicates of existing tokens (mechanical)

- `#2e7d32` = `--color-success`: ~10 spots (simulation-results.js:108, 2426, 2442, 2450, 2460, 2469, 2595; simulation-comparison.js:114; yearly-analysis-results.js:203)
- `#1c1c1c` = `--color-text-main`: 12 label fills across the three chart files
- `#6fbeec`, `#f5a623` inline: simulation-results.js:5240, 3386–3393

## One-offs needing new tokens

- `#00639a` "chart primary blue" — ~25 uses (series strokes, info-icon bgs, methodology notes, uncertainty bands) across simulation-results (css+js), yearly-analysis-results (css+js), simulation-comparison.css. Add `--color-chart-primary`. Near-duplicate of tokenized `--color-sim-a #1a6fa0` — **decision: merge or keep both**.
- `#abe828` optimized/scenario-B lime bars (simulation-results.js:3045, 4977, 5259) + `#587a00` labels (:5005) + alpha uses (css:1101, 1622; simulation-comparison.css:39). Only the dark text (`--color-sim-b`) and 0.14 bg are tokenized. Add `--color-sim-b-accent`.
- Axis/annotation grays: `#666` (~24×), `#888` (5×), `#999` (2×) → map to `--color-text-subtle` / one muted token.
- Tooltip stroke `#94a3b8` (7×) → token (see ticket 10).
- `#2980b9` ELECTRIC_BAR_COLOR (simulation-results.js:7390) — a *different* blue than the `#00639a` used for "electric" elsewhere.
- trip-preview.js Tailwind palette (route `#2563eb`, emeralds `#10b981/#059669/#065f46`, grays `#e5e7eb/#d1d5db/#9ca3af/#6b7280`, ring `#7f1d1d`) → map to app tokens; route line should use `--color-trip-line` (`#007bff`) — **decision: which blue wins for "the route"** (`#007bff` is the token but is used in only one place; `#2563eb` and `#00639a` also play this part).
- shift-timeline.js:147 tooltip bg `rgba(0,0,0,0.8)` → `--color-tooltip-bg`.

## Decisions needed

1. Should chart series red `#e74c3c` / oranges `#e67e22`,`#d4881f` collapse into UI `--color-danger`/`--color-warning`, or stay distinct series colors (then: name them as chart tokens)? Three near-identical oranges across tabs currently read as accidental.
2. Merge `#00639a` with `--color-sim-a` or keep both blues?
3. Which blue is canonical for route/trip lines on maps?

## Chart typography (from the typography audit)

- Ticks: 10px majority; 11px in consumption/route charts; 9px in horizontal bars; **8px only in simulation-comparison.js:1599, 1712 — below legibility floor, eliminate**. Datum labels: 11px/600 majority.
- No tokens exist for chart text; add e.g. `--font-size-chart-tick` / reuse `xs`/`2xs` where they coincide (11px = xs, 12px = 2xs).
- shift-timeline.js:149 `0.75rem` → `var(--font-size-2xs)`; shift-visualization.css:18 hardcodes `'Inter', sans-serif` → `var(--font-family-base)`.

# Mechanical: hardcoded colors → tokens (CSS)

Status: ready-for-agent
Type: task

Chart-JS colors are ticket 02; this ticket covers CSS files + the near-token swaps that need no design decision. Fully clean files: about.css, settings.css, buses.css, custom-stops.css, shift-visualization.css, simulation-detail.css, yearly-analysis-runs.css.

## var() fallback mismatches (latent bugs — fallback ≠ token value)

- simulation-results.css:1537 `var(--brand-teal, #00639a)` — token is `#0f3c3c`
- simulation-runs.css:125 `var(--text-secondary, #999)` — token is `#4f4f4f`
- simulation-results.css:2245, 2261 `var(--text-secondary, #888)`; :2297 `(…, #777)`
- add-simulation.css:298 `var(--color-primary, #2563eb)` — token is teal, fallback blue

Fix: remove the fallbacks or make them equal the token.

## New tokens to add (recurring untokenized values)

- `--color-overlay: rgba(0,0,0,0.45)` — shifts.css:237; add-simulation.css:277, 323; simulation-results.css:763; ya-results:125
- `--color-row-zebra-bg: rgba(0,0,0,0.015)` — simulation-results.css:1011; ya-results:495
- `--color-warning-text: #b95d0a` — simulation-results.css:1232 (drop the `!important`), 2281 (token `--color-warning` is too light for text; deliberate, used 3×)
- `--shadow-modal` (ticket 07), `--color-chart-primary #00639a` (ticket 02), `--radius-full` (ticket 05)

## Near-token swaps (straight replacements)

- `#7a1a10` → `--badge-danger-text` (simulation-results.css:1649)
- `#1e7e46` → `--color-success` (simulation-results.css:2273)
- `rgba(192,57,43,0.12/0.06)` → `--color-negative-muted` (sim-results:1106, 1627, 1642)
- `rgba(171,232,40,0.18)` → `--color-sim-b-bg` or new accent token (sim-results:1101, 1622; ticket 02)
- `rgba(149,165,166,0.12)` → `--color-chart-neutral` alpha (sim-results:2057)
- `rgba(111,190,236,x)` → `--color-brand-accent` alpha (sim-results:277; simulation-comparison.css:33; ya-results:740, 773)
- `rgba(245,166,35,0.12)` → `--color-warning` alpha (analysis-comparison.css:98)
- `#f0f4f4` → `--color-disabled-bg` (shifts.css:729)
- `rgba(255,255,255,0.96)` → `--color-surface` (simulation-results.css:322)
- add-simulation.css:48–49 error ring → `--color-negative-muted`

## Env-table tone rows (simulation-results.css:2269–2297) — one-off cluster

`#1e7e46` (→ success), `#e67e22` border / `#b95d0a` text (→ warning family per above), `#5b8def` / `#4271c9` neutral-blue pair (no token — tokenize or fold into `--color-chart-primary` family), `#bdc3c7` muted border (≈ `--color-border`).

## Shifts timeline gradients (odd token reuse, low priority)

shifts.css:584–585, 693 use the *focus-ring base color* `#8ee5e3` and *sidebar-end* `#b1e8e8` as decorative gradients; shifts.css:613, 618 grid strokes are `--color-brand-primary` alphas; shifts.css:811 hover is ticket 06. Give the timeline its own decorative tokens or reuse brand tokens explicitly.

## Also

- create-yearly-analysis.css:46 swatch outline `rgba(15,23,42,0.08)` — one-off, tokenize if kept
- ya-results:261 shadow `rgba(15,60,60,0.14)` ≈ `--shadow-sm` (ticket 07)

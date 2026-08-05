# Mechanical: hardcoded colors → tokens (CSS)

Status: done
Type: task

## Outcome (2026-07-29)

25 literal edits + 59 alpha-literal swaps across 9 files. As with ticket 11, the
line numbers below are from baseline `9a5e061` and are stale — tickets 05/06/07
had already landed `--color-overlay`, `--color-row-zebra-bg`, `--shadow-modal`,
`--radius-full`, the `rgba(149,165,166,…)` and add-simulation error-ring swaps.
Applied by content match.

**New tokens** — `--color-warning-text: #b95d0a`, `--color-info-text: #4271c9`
(the env-table amber/neutral row tones), `--color-chart-primary: #00639a`,
`--color-accent-lime: #abe828`, `--color-teal-tint: #8ee5e3`,
`--color-teal-tint-soft: #b1e8e8`, `--color-swatch-ring: rgba(15,23,42,0.08)`.

**Existing tokens rewired onto them** (values unchanged, relationships now
explicit rather than coincidental): `--color-sidebar-end`, `--color-focus-ring`,
`--color-sim-a-bg`, `--color-sim-b-bg`, `--color-positive-muted`,
`--color-negative-muted`, the three `--color-row-*` tints.

**Alpha-literal sweep — scope extension.** The ticket named the brand-primary
alphas only for the shifts timeline strokes, but `rgba(15,60,60,…)` appears ~15×
in `style.css` and the same pattern holds for danger, warning, brand-accent,
chart-primary and the lime/teal tints. Rather than tokenize one file and leave
the identical pattern raw next to it, every alpha literal whose base colour is a
token became `color-mix(in srgb, var(--token) N%, transparent)` — arithmetically
identical output, so no visual change. Families covered: brand-primary, danger,
positive, chart-primary, brand-accent, accent-lime, warning, teal-tint(-soft).

**Also applied**: `#7a1a10` → `--badge-danger-text`; `#1e7e46` →
`--color-success`; `#f0f4f4` → `--color-disabled-bg`; `rgba(192,57,43,0.06)` →
`--color-negative-muted`; `rgba(255,255,255,0.96/1)` → `--color-surface`; the
ya unit-button shadow → `--shadow-sm`; all six raw-literal `var()` fallbacks
removed (`#00639a`, `#888`, `#777`, `#999`, `#2563eb`, `#f5a623` — every one of
those tokens does exist, so the fallbacks were dead as well as wrong).

**`!important` on the sensitivity margin trio** — dropped from all three, not
just `__margin-tight`. Verified inert first: the class sits on
`.efficiency-sensitivity-card__row`, nothing else sets that element's colour, its
`> span` / `> strong` children win on specificity regardless, and the JS sets no
inline colour. Dropping only one of the three would have left the set asymmetric.

Left raw, out of this ticket's enumerated scope:

- **White/black alpha decoratives** in `style.css` (sidebar rules, scrim tints,
  `rgba(0,0,0,0.06)`). Several already have dedicated tokens; the rest need
  naming decisions rather than a mechanical swap.
- **Login form-feedback tones** `#fdecea` / `#e8f5e9` and the
  `.login-about-link:hover` `#d0eded` — one-off surfaces with no near token; the
  shared `.form-feedback` has no background tones to fold them into.
- **`rgba(39,174,96,…)`** in `.env-chart-section--prominent` — a green gradient
  that belongs to no current token family; belongs with ticket 02.
- **`--kpi-tone: hsl(…)`** triples — *unified after the fact* (see below).
- **`rgba(0,99,154,…)` sites are now `--color-chart-primary`**, defined here so
  the CSS side stops repeating the literal. Ticket 02 still owns the chart
  palette proper and may rename or restructure it.

## Follow-up: env KPI card tone triples unified

The three `--kpi-tone: hsl(…)` values were duplicated verbatim in
`simulation-results.css` and `yearly-analysis-results.css`, along with the
identical `border-color` + 10% wash they drive. Now:

- `--color-kpi-positive` / `--color-kpi-negative` / `--color-kpi-neutral` +
  `--kpi-tint-strength: 10%` live in `style.css`. Values unchanged — they are
  deliberately softer than `--color-positive` / `--color-danger` because they
  paint a whole card border plus a background wash, so they were *not* folded
  into the semantic pair.
- Each page file's three modifiers now set only `--kpi-tone: var(--color-kpi-*)`,
  and the shared `border-color` + `background` pair is stated once per file
  across a grouped selector. The `white` literal became `--color-surface`.

**Why the paint rule stays in the page files rather than `style.css`**: the build
emits one stylesheet with `style.css` first, so a same-specificity rule there
would lose to each page's own `.env-kpi-card` / `.ya-env-kpi-card` base rule
(which sets `border` and `background`). Unifying the *values* removes the drift
risk without touching cascade order.

Verified `color-mix(… var(--kpi-tint-strength) …)` — a `var()` in the percentage
slot — computes identically to the previous literal in Chrome. Custom-property
substitution happens before the declaration is parsed, so this is spec behaviour
rather than an engine quirk, but only Chrome was checked directly.

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

# Mechanical: typography tokens and literals

Status: done
Type: task

## Outcome (2026-07-29)

Decision: **consolidate**. The 11px tier was removed; `--font-size-xs` is now
the sole small-text token at 12px. Former 11px uses now render at 12px for
better readability.

Also applied:

- Added `--font-family-mono`; the results and detail views now use it. The shift
  visualization now inherits the complete base font fallback stack.
- Centralized duplicated sort-arrow typography in the shared `.sort-arrow`
  class, aligned the one 0.85em disclosure arrow to 0.8em, and folded the bus
  optional note into the shared hint styling.
- Removed the 1.05em yearly-analysis highlight outlier, normalized the lone
  0.02em label tracking to 0.04em, and changed the lone reset from `0` to
  `normal`.

Already resolved before this ticket: the Settings and Shifts headings already
explicitly use `font-weight: 600`.

Deliberately retained: the bus-model kicker's 0.08em tracking is an intentional
display treatment, and the page-title clamp's 1.375rem lower bound remains its
single sanctioned responsive literal.

Mostly mechanical; one naming decision blocks part of it.

## Token-size decision (implemented)

Previously, the project had separate 11px and 12px token tiers with inverted
names. The 11px tier was removed and its uses now reference the readable 12px
`--font-size-xs` token.

## Straight swaps

- shift-visualization.css:18 — `'Inter', sans-serif` → `var(--font-family-base)` (currently loses the fallback chain)
- Add `--font-family-mono` and use at ya-results:313 (`.ya-mono`) and simulation-detail.css:127 (`.result-shift`)
- Missing `font-weight: 600` (render at UA-default 700; visually confirmed on Settings): settings.css:24–29, shifts.css:59–64
- Sort arrows `font-size: 0.8em` duplicated ×3 (shifts.css:318, simulation-runs.css:64, add-simulation.css:133) → shared class or token
- simulation-results.css:1318 toggle arrow `0.85em` vs its twin at :1594 `0.8em` — align
- buses.css:27 `.optional-note 0.8em` — fold into a shared hint style
- ya-results:312 `.ya-highlight-value 1.05em` — candidate token or drop to 1em

## Letter-spacing

Standard is `0.04em` (~20 uses). Fold: `0.03em` (badge family + emissions/predictions labels — tickets 04/05), `0.02em` (simulation-results.css:2244), `0.08em` (buses.css:50 kicker — possibly intentional display style; flag). Reset keyword: use `normal` (majority) not `0` (ya-results:1120).

## Page title clamp

style.css:1079 `.page-title` uses `clamp(1.375rem, 2vw, var(--font-size-2xl))` — the 1.375rem floor is untokenized (between heading-md and 2xl); tokenize or accept as the one sanctioned literal.

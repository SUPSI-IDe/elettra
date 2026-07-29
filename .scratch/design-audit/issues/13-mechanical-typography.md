# Mechanical: typography tokens and literals

Status: needs-triage
Type: task

Mostly mechanical; one naming decision blocks part of it.

## Token-naming decision (blocks nothing else, decide first though)

`--font-size-xs` (0.6875rem/11px) is **smaller** than `--font-size-2xs` (0.75rem/12px) — inverted vs every common convention, and the audit found xs/2xs confusion in tooltip/badge sizes that this likely caused. Options: rename (one-shot sed across repo) or document and live with it.

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

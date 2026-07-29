# Table row hover / selected states

Status: done
Type: task

## Hover — four tints coexist

- **Token** `--color-row-hover-bg` / `--bg-subtle` (list tables via style.css:953; simulation-comparison.css:343; create-yearly-analysis.css:38) — majority
- Teal `rgba(15,60,60,0.04)` — yearly-analysis-results.css:288, 976, 1155
- Blue `rgba(0,99,154,0.05/0.04)` — simulation-results.css:1519, 2204, 2310
- Teal `rgba(15,138,135,0.05)` — shifts.css:811 (scheduled-trips)

Decision: plain token everywhere, or a single tinted hover for dense/zebra tables (the brand-primary teal alpha matches the selected-row token family; the blue is the outlier either way).

## Selected

- Shared standard: `--color-row-selected-bg` + 3px inset teal bar (style.css:953–982) — buses, shifts, custom stops, simulation-runs, ya-runs.
- Fix: add-simulation shift-table (add-simulation.css:158–164) uses `--brand-teal-bg` with no inset bar — align to the shared tokens.

## Zebra

`rgba(0,0,0,0.015)` hardcoded twice (simulation-results.css:1011, yearly-analysis-results.css:495) — add a token (e.g. `--color-row-zebra-bg`).

## Comments

- 2026-07-29: Added `--color-row-dense-hover-bg` (the shared teal tint) and applied it to the dense and striped analysis tables. Standard list and scheduled-trip rows now use the neutral `--color-row-hover-bg`. Added `--color-row-zebra-bg` and replaced both duplicated overview-row stripe values. The add-simulation shift table now uses the shared selected and selected-hover tokens with the standard inset selection bar.

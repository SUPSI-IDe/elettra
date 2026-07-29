# Table, heading, and state-message typography tiers

Status: needs-triage
Type: task

## Table headers (largest divergence in the app)

De facto two-tier system with stragglers:

- **List tier** `sm/600` + `--color-text-subtle` (global default, style.css:890–900): Buses, Shifts, Custom Stops, simulation-runs.
- **Dense tier** `2xs/700`: yearly-analysis-results.css:283, 301, 951, 1117; simulation-results.css:1504, 1826, 2169; add-simulation.css:108, 226.
- **Stragglers to fold into the dense tier**: yearly-analysis-runs.css:27 (`xs/700`), simulation-comparison.css:330–331 (`xs/600`), simulation-results.css:2241 (`xs/600`), create-yearly-analysis.css:36 + simulation-results.css:651 (`2xs/600`).

Decision: formalize the two tiers (recommended — matches list-vs-analytic reality) or unify entirely.

## Table body cells

- List tier `md` (global style.css:876); dense tier `sm` (all results/analysis tables).
- Outliers: add-simulation.css:217, 252 `.stops-table` at `2xs` (fold into `sm`); simulation-results.css:555 `.investment-table` at `md` inside a dense context (fold into `sm`).

## Section headings

- Page-level h2: majority `xl/600` (9 uses). Fold in: about.css:68 (`heading-sm`), shifts.css:424, 479 (`heading-sm`), simulation-results.css:1675 infeasibility h3 (`heading-sm` — its comparison-page twin at simulation-comparison.css:373 is already `xl`).
- In-panel section titles: coherent lower tier `lg/600` (ya-res-section-title, env-section-title, efficiency-section-title, costs-inputs-section-title) — keep as a recognized tier.
- **Missing font-weight (renders 700)**: settings.css:24–29 `.settings-card-header h2`, shifts.css:59–64 `.shift-form-card__header h2`, shifts.css:63. Add `font-weight: 600`. Visually confirmed on the Settings page.

## Card titles

Majority `lg/600` (global `.card-title` style.css:1104 + 4 pages). Deviants: yearly-analysis-results.css:1044 (`lg/700`), simulation-results.css:1148 (`md/700`), simulation-results.css:1763 (`sm/700` h4).

## Empty-state / status messages

- Text: majority `md` (8 components). Deviants to fold: simulation-results.css:1265, simulation-detail.css:19, shifts.css:503, 763 (`lg`); yearly-analysis-results.css:440 (`sm`). Progress overlays at `lg` may stay (larger on purpose).
- Padding: majority `--space-lg` (9 components). Bump yearly-analysis-runs.css:64 (`sm`). `.infeasibility-tab-notice` differs between its two pages (`3xl×xl` results vs `xl×lg` comparison) — align (decision: which).

## Tabs

Majority `sm/500 → active 600` (results-tab, ya-tab, comparison twin). Fix `.sim-data-tab` (simulation-results.css:801–808): no transition, no active weight bump — align with `.results-tab`. `.results-shift-tab` at `xs/600` is a plausible sub-tab tier — keep, but note it.

## Chart legends

Majority `sm`; fold simulation-comparison.css:189 (`xs`).

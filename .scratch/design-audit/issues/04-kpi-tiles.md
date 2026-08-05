# KPI / stat tile consistency

Status: resolved
Type: task

## Labels (uppercase micro-labels) — tie, decision needed

- `sm/600/uppercase/0.04em` (the global `.metric-label` standard, style.css:1251): ya-summary-card__label (ya-results:349), ya-uncertainty-summary-item__label (:383), ya-overview-col__title (:477), efficiency-summary-item__label (sim-results:1383)
- `xs/700/uppercase/0.04em`: costs-kpi-label (sim-results:485), ya-costs-kpi-label (ya-results:920), env-kpi-card__title (sim-results:1998), ac-kpi-title (analysis-comparison:137)
- `xs/700/0.03em`: emissions-kpi-label (sim-results:2337)
- `2xs/700/0.03–0.04em`: overview-col__title (sim-results:989), predictions-metric__label (:1729), efficiency-sensitivity-card__drivers-label (:1192)

Note: `.ya-overview-col__title` (sm/600) and its sibling copy `.overview-col__title` (2xs/700) are the same component on two pages with two styles. **Decision: `sm/600` (global standard) vs `xs/700` — effectively tied 5:5.** Letter-spacing: standardize `0.04em` regardless.

## Values

- `xl/700` — global `.metric-value` (style.css:1261), ya-summary-card__value
- `md/700` — slim majority among page KPIs (costs-kpi-value sim-results:496, ya-costs-kpi-value ya-results:931, env-kpi-card__val-num sim-results:2023, ac-kpi-diff analysis-comparison:164)
- `lg/700 or 600` — emissions-kpi-value (:2345), ya-env-kpi vals (ya-results:1077/1089), predictions-metric__value (:1737)

**Decision: is xl a "hero" tier and md the inline tier (formalize both), or unify?**

## Tile padding — majority: `--control-padding-block × --control-padding-inline`

Used by costs-kpi-card (sim-results:473), ya-costs-kpi-card (ya-results:909), ya-critical-item (:414), efficiency-summary-item (sim-results:1377). Migrate:
- emissions-kpi-card sim-results:2329 (`× 0.85rem`)
- predictions-metric :1723 (`2sm × 0.85rem`)
- ya-uncertainty-summary-item ya-results:376 (`0.6rem × 2sm`)
- ya-summary-card ya-results:342 (`2sm × md`)
- env pair (env-kpi-card sim-results:1971, ya-env-kpi-card ya-results:1017) at `md × 1.1rem` — deliberate larger tile, but tokenize 1.1rem (→ `2md` or `md`)

## Grid gap — working majority: `--space-sm` (8 uses) though shared `.kpi-grid` defaults to `md`

Either add a dense modifier to `.kpi-grid` in style.css or change the default. Outlier: ya-env-kpi-row (ya-results:1009) at `lg`.

## Answer

Implemented the shared `sm/600/uppercase/0.04em` KPI-label standard and a
single `md/700` primary-value tier. Normalized KPI tile padding to the shared
control padding tokens and standardized KPI grid gaps to `--space-sm`,
including the yearly emissions row.

# KPI grids render 3-up at phone widths

Status: needs-decision
Type: design

Split out of ticket 14, which removed the broken rule that used to cover this.

## What happens

`.kpi-grid` (style.css) lays out as:

```css
grid-template-columns: repeat(auto-fit, minmax(var(--kpi-tile-min, 10rem), 1fr));
```

Both yearly-analysis KPI grids set `--kpi-tile-min: 8.5rem` (136px):

- `.ya-summary-cards` — yearly-analysis-results.css
- `.ya-costs-kpi-grid` — yearly-analysis-results.css

At a 480px viewport the content box is roughly 440px, so `auto-fit` lands on
**3 columns of ~136px**. Each tile holds a label plus a formatted number
(currency, kWh), which is where values start wrapping or truncating.

`.ya-env-kpi-row` sets `--kpi-tile-min: 12.5rem` and is not affected the same way.

## History

`9312a7d` originally shipped an override collapsing both grids to a single column:

```css
@media (max-width: 480px) {
  .ya-costs-kpi-grid,
  .ya-summary-cards {
    grid-template-columns: 1fr;
  }
}
```

A later commit deleted the `.ya-summary-cards` half and left a dangling comma,
which made the whole rule malformed — so the parser dropped it and neither grid
got the override. The 3-up layout has therefore been live for some time without
anyone choosing it.

Ticket 14 removed the dangling selector rather than restoring the rule, on the
grounds that this is a design decision rather than dead-code cleanup.

## Decision needed

Is 3-up at ~136px the intended phone layout, or should these grids collapse?

Options, if collapsing:

1. Restore the original override — `grid-template-columns: 1fr` at ≤480px
2. Express it through the token the grid already reads — `--kpi-tile-min: 100%`
   at ≤480px, which is more consistent with the audit's tokenization direction
3. Raise `--kpi-tile-min` so `auto-fit` collapses on its own, without a media
   query — worth checking what value gives 2-up at 480px and 3-up above it

Also worth settling: whether 480px is a target viewport for this app at all. If
it is not, the answer is simply "leave it".

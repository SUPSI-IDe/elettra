# Comparison and Export

The **Analysis comparison** page compares two saved yearly analyses in the
**General** scope using their configuration summaries and aggregate annual
results. Use the source analysis to inspect a named vehicle block or choose a
representative bus.

---

## Start a comparison

Open **Simulations → Analysis comparison** and choose **Analysis A** and
**Analysis B** from the saved yearly analyses available to your account.
Both selections are required to display the comparison. An analysis can
appear in the list even if some results are incomplete.

The absolute difference is **Analysis B − Analysis A**. A positive result
means B is larger than A. The relative difference divides that result by A and
expresses it as a percentage. An absolute difference requires both values, and
a relative difference also requires a non-zero A.

---

## Compatibility summary

The **Compatible** badge requires the same non-empty set of vehicle blocks
and the same optimization mode. The comparison uses block IDs where available
and can fall back to recorded block names for historical analyses. If one
criterion differs but the analyses share a block, block count or mode, the
page shows **Partially comparable**. Otherwise it shows **Not directly
comparable**. The badge is advisory and the metrics remain available when data
exist.

The summary shows common blocks, block counts and the simulated annual
distances. The JSON records a separate distance-basis check, which accepts
a difference of up to 5% of the larger distance. Before attributing a
difference to a single decision, check the underlying vehicle blocks, GTFS
edition, weather and activity, inherited feasibility design, and cost and
emissions assumptions.

---

## Comparison sections

| Section | Contents |
|---|---|
| **Overview** | Executive indicators and high-level differences |
| **Efficiency** | Simulated annual distance and energy, drivetrain and auxiliary energy, specific consumption and battery information |
| **Cost** | Annual electric and diesel costs, energy, annualized investment, maintenance, CHF/km and annual savings |
| **Emissions** | Aggregate environmental indicators and completeness metadata |
| **Details / Export** | Combined table of efficiency, cost and emissions metrics, with CSV and JSON actions |

The A and B columns refer to the chosen yearly analyses. Each source can also
contain an internal electric-versus-diesel assessment. Comparison uses saved
simulation totals for distance and energy, the annual cost endpoint and its
standard assumptions or the local cost fallback, and the fleet environmental
endpoint. The latter can read saved physical LCA assumptions. To compare scenarios
with edited tariffs or annual mileage, use **Download all results (JSON)** from
each source analysis and compare the same fields and scopes. Those source
exports preserve the effective edited assessment, including the project-cost
cash flows.

---

## Environmental limitations

Environmental differences require values for both analyses. If diesel-heater
consumption is required and missing, the affected reduction is omitted. Read
environmental results alongside their data and scope completeness indicators.

---

## Export options

- **Export CSV** in **Details / Export** downloads `analysis-comparison.csv`.
  Each row includes the General scope, category, metric and unit, A/B values,
  the absolute and relative differences, and A/B statuses for data and scope
  completeness. Missing values appear as blank cells.
- **Export JSON** in **Details / Export** and **Download JSON** below the
  comparison both download `analysis-comparison.json`. It contains the
  General scope, the difference definition, the comparison models for A and B,
  the compatibility checks and the same metric rows. The models contain
  identifying information, vehicle-block references, battery and aggregate
  charging configuration, scenario counts, distance, section statuses, and
  available energy, cost and emissions summaries.

For vehicle-block technical results, detailed project economics, and the
assumptions of a single yearly analysis, open that analysis, select **General**,
and choose **Download all results (JSON)** beside **Close**. The contents are
described in the [Yearly Analysis export guide](yearly-analysis.md#export).

---

## Export a feasibility evaluation

Open the saved feasibility result, select **General**, and choose
**Download all results (JSON)** at the bottom, next to **Close**. This separate
schema 1 export includes all
vehicle blocks and available Mean/Q95 designs, with their technical evidence,
configuration and investments. It reads existing calculations only. Check its
availability warnings before interpreting partial or historical results.
See [Feasibility Results](simulation-results.md#export-the-complete-evaluation)
for the complete workflow and the distinction from yearly exports.

---

## Good comparison practice

- Name analyses after their principal difference, such as bus model, heating,
  occupancy, or charging strategy.
- Change one material assumption at a time when possible.
- Keep vehicle-block sets, GTFS editions, annual distance, and assessment
  boundaries consistent.
- Record external tariff, cost, and factor sources with their dates.
- Treat missing values as missing, not as zero.

---

## Next steps

- [Yearly Analysis](yearly-analysis.md) — Review the source analyses and their scopes
- [Overview](overview.md) — Return to the end-to-end workflow

---

> Reference versions: Frontend v1.4.4 · Backend v1.9.0
>
> Last updated: 2026-11-26

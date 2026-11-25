# Comparison and Export

> Last updated: 2026-11-25
> Interface baseline: Frontend v1.4.4-rc.1

The **Analysis comparison** page compares two saved yearly analyses in the
**General** scope using their configuration summaries and aggregate annual
results.

---

## Start a comparison

Open **Simulations → Analysis comparison** and choose **Analysis A** and
**Analysis B**. The page loads the common configuration and aggregate annual
results of both analyses.

Differences are reported as:

```text
Analysis B − Analysis A
```

A positive difference means that B is larger than A for that metric.

---

## Compatibility summary

The **Compatible** badge requires the same non-empty set of vehicle blocks
and the same optimization mode. The summary displays common vehicle blocks,
the number of blocks in each analysis, and the annual distances.

Before interpreting differences, check the annual distance, GTFS edition,
economic assumptions and other inputs that could account for the change.
Attribute a difference to a single decision only when the other relevant
assumptions are consistent.

---

## Comparison sections

| Section | Contents |
|---|---|
| **Overview** | Executive indicators and high-level differences |
| **Efficiency** | Aggregate annual energy, distance, and efficiency context |
| **Cost** | Annual and lifecycle economic indicators, subject to compatible assumptions |
| **Emissions** | Aggregate environmental indicators and completeness metadata |
| **Details / Export** | Combined table of efficiency, cost and emissions metrics, with CSV and JSON actions |

Each yearly analysis can contain an internal electric/diesel assessment. The
A and B columns refer to the selected yearly analyses.

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

For the complete JSON of a single yearly analysis, open that analysis, select
**General**, and choose **Download all results (JSON)** beside **Close**. See
[Yearly Analysis](yearly-analysis.md#export) for the
contents of the yearly analysis export.

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

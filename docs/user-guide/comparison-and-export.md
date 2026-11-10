# Comparison and Export

> Last updated: 2026-11-09
> Interface baseline: Frontend v0.11.0-rc.1

The Analysis comparison page compares **two saved yearly analyses** side by
side. It does not compare two feasibility runs directly, and it is not limited
to an electric-versus-diesel chart.

---

## Start a comparison

Open **Simulations → Analysis comparison** and choose **Analysis A** and
**Analysis B**. The page loads the common configuration and aggregate annual
results of both analyses.

Differences are reported as:

```text
Analysis B − Analysis A
```

A positive difference therefore means that B is larger than A for that metric;
whether that is beneficial depends on the metric.

---

## Compatibility summary

The compatibility section identifies whether the analyses can be interpreted
as a direct comparison. Review differences in:

- vehicle-block set and service scope;
- bus and battery configuration;
- GTFS provenance;
- annual distance and temperature scenarios;
- occupancy, heating, and other operating assumptions;
- optimization mode and charging infrastructure;
- environmental data and methodology completeness.

A comparison can still render when inputs differ, but its deltas should not be
treated as the effect of one decision unless the other boundaries are held
consistent.

The page compares the **General** scope. Individual vehicle-block results are
not paired or compared on this page.

---

## Comparison sections

| Section | Contents |
|---|---|
| **Overview** | Executive indicators and high-level differences |
| **Efficiency** | Aggregate annual energy, distance, and efficiency context |
| **Cost** | Annual and lifecycle economic indicators, subject to compatible assumptions |
| **Emissions** | Aggregate environmental indicators and completeness metadata |
| **Details / Export** | Input details, provenance, compatibility information, and export controls |

Each yearly analysis can contain an internal electric/diesel assessment. The
Analysis comparison page compares the saved yearly scenarios A and B; keep
those two comparison levels distinct.

---

## Environmental limitations

Environmental deltas are shown only when the required inputs are sufficiently
complete. Exports preserve data-completeness, scope-completeness, fuel-profile,
and factor-methodology metadata.

If required diesel-heater consumption is missing, the affected reduction is
omitted instead of treating the missing contribution as zero. The current
yearly boundary is partial and must not be described as a complete absolute LCA.

---

## Export options

The current comparison interface provides dedicated exports:

- **Export CSV** in **Details / Export** for tabular comparison data;
- **Export JSON** in **Details / Export** for structured comparison data;
- **Download JSON** below the comparison for the complete structured payload.

The exports include the comparison values and supporting scope/provenance data
available to the page. Review compatibility warnings before using a delta in a
decision record.

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

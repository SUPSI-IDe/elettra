# Comparison and Export

> Last updated: 2026-06-01

Compare feasibility evaluation results side-by-side to assess the economic and environmental trade-offs between electric and diesel bus operations.

---

## Comparison view

The comparison page allows you to compare a completed feasibility evaluation against an equivalent diesel bus scenario.

### Accessing comparison

From the feasibility evaluation list or results page, select a run to compare.

---

## Economic comparison

### Parameters

The comparison uses these configurable economic parameters:

| Parameter | Description | Typical default |
|-----------|-------------|-----------------|
| Diesel bus CAPEX | Equivalent diesel bus cost | 280,000–500,000 CHF (by length) |
| Diesel consumption | Fuel efficiency (L/km) | 0.34–0.55 (by length) |
| Diesel maintenance | Maintenance cost (CHF/km) | 0.30–0.45 (by length) |
| Electric maintenance | Maintenance cost (CHF/km) | 0.30–0.40 (by length) |
| Bus lifetime | Operational years | 12 (electric), 10 (diesel) |
| Battery lifetime | Replacement cycle | 8 years |
| Annualization rate | Discount rate for OPEX | 3% |

### Cost stacking

The comparison presents stacked bar charts breaking down:

| Component | Electric | Diesel |
|-----------|----------|--------|
| Vehicle CAPEX | Bus body + battery packs | Bus purchase |
| Energy OPEX | Electricity cost | Diesel fuel cost |
| Maintenance OPEX | Electric maintenance | Diesel maintenance |
| Infrastructure | Charging station cost (if applicable) | — |

### Key output metrics

| Metric | Description |
|--------|-------------|
| Total annual cost (CHF) | Full cost of ownership per year |
| CHF/km | Cost per kilometer |
| Delta (%) | Electric cost relative to diesel |

---

## Emissions comparison

The comparison includes lifecycle emissions:

| Indicator | Scope |
|-----------|-------|
| CO₂ equivalent | Manufacturing + operational |
| NOₓ | Operational emissions |
| PM10 | Operational emissions |

Electric buses typically show lower operational emissions but may have higher manufacturing emissions (battery production). The net benefit depends on the electricity mix and annual distance.

*To verify*: Whether LCA vehicle selection is exposed in the comparison UI or uses automatic defaults.

---

## What drives the comparison

Based on analysis of actual ELETTRA simulations:

- **Annual utilization** is the strongest cost driver. Higher yearly km dilutes CAPEX over more km, favoring electric.
- **Battery pack count** directly affects electric CAPEX. More packs = higher upfront cost.
- **Electricity vs diesel price** determines OPEX advantage.
- **Bus length** affects all defaults (larger buses have higher costs on both sides).

---

## Export options

*To verify*: The current export capabilities. Browser print/PDF may be the primary export method. No dedicated CSV/PDF export button was identified in the codebase.

---

## Run-to-run comparison

Beyond the electric-vs-diesel economic comparison, users can compare multiple feasibility evaluations to understand how parameter changes affect results:

- Same shift with different SOC settings
- Same shift with different temperatures
- Same route with different bus models
- With vs without charging stations

---

## Next steps

- [Yearly Analysis](yearly-analysis.md) — Get annualized results for more robust comparison
- [Feasibility Evaluation](feasibility-evaluation.md) — Create additional runs to compare

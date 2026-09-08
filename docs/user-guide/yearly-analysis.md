# Yearly Analysis

> Last updated: 2026-06-01

A yearly analysis extends a single feasibility evaluation across a full year of representative weather conditions, producing annualized cost and emissions estimates.

---

## Purpose

A single feasibility evaluation represents one day at one temperature. A yearly analysis answers: "What does this shift cost and emit **over an entire year** considering all weather conditions the location experiences?"

---

## Creating a yearly analysis

1. Navigate to **Simulation > Yearly analysis**
2. Click to create a new analysis
3. Select a completed feasibility evaluation (optimization run) as the basis
4. Give it a name
5. The system automatically generates weather-weighted scenarios

---

## How it works

### Temperature clustering (PVGIS TMY)

ELETTRA uses PVGIS Typical Meteorological Year data for the depot/shift location:

1. Retrieves hourly temperature data for the location
2. Clusters temperatures into representative groups (default: k=8 clusters)
3. Each cluster has a representative temperature and a weight (proportion of the year)
4. Time window: typically 05:00–24:00 (operating hours)

### Scenario generation

For each temperature cluster:
- A prediction run is executed with the cluster's representative temperature
- Energy consumption is predicted for that temperature scenario
- The result is weighted by the cluster's annual occurrence

### Quantile-based uncertainty

Each prediction produces three quantile estimates:
- **Q05** — Low-demand estimate (5th percentile, optimistic)
- **Q50** — Median estimate (most likely)
- **Q95** — High-demand estimate (95th percentile, pessimistic)

The Q05–Q95 range represents the prediction model's uncertainty.

---

## Results

### Yearly summary

| Metric | Description |
|--------|-------------|
| Annual consumption (kWh/year) | Weather-weighted total energy demand |
| Annual cost (CHF/year) | Annualized cost of ownership |
| CHF/km | Annual cost divided by yearly distance |
| Annual emissions | Weighted CO₂/NOₓ/PM10 |

### Diesel-heater environmental results

For VECTO analyses, the saved diesel fuel energy is the authoritative input.
The application converts it to litres with the versioned Swiss average fuel
profile used by both the cost and emissions endpoints. Historical legacy
analyses retain their original litre value and provenance.

The heater contribution is well-to-wheel: exhaust emissions appear in
`direct`, while fuel production and delivery appear in `energyChain`. NOₓ is
shown as NO₂-equivalent so direct measurements and the Mobitool upstream
inventory can be added consistently. The PM10 interval is the observed range
of two valid tests, not a confidence interval.

The results screen distinguishes:

- **data completeness** — whether the required consumption and factors exist;
- **scope completeness** — whether the environmental model covers a complete
  LCA boundary.

The current boundary remains partial: an operational electric-side result,
allocated using Mobitool phase shares, plus the diesel heater WTW result.
Comparison reductions are hidden when required heater consumption data are
missing. With positive consumption the interface shows “Diesel heating
included · estimated values”; that statement is absent for electric heating
and explicit zero consumption. Use the keyboard- and touch-accessible
methodology-and-sources control for the factor version, NOₓ convention, source
links and PM10 caveat.

### Efficiency by temperature

A chart showing:
- X-axis: temperature (°C) — one point per cluster
- Y-axis: specific consumption (kWh/km)
- Q50 line with Q05–Q95 uncertainty band
- Shows how efficiency degrades in cold weather

### Annual contribution breakdown

How each temperature cluster contributes to the annual total:
- Bar chart weighted by occurrence
- Q05/Q50/Q95 bars for each cluster
- Highlights which conditions drive annual costs

### Scenario table

Detailed per-cluster data:
- Representative temperature
- Weight (% of year)
- Consumption (kWh/km) with uncertainty
- Feasibility per scenario

---

## Interpreting the results

- **Cold clusters dominate costs**: Even though cold days are less frequent, their higher energy demand (due to heating) contributes disproportionately to annual costs.
- **Wide Q05–Q95 bands** indicate high uncertainty — results depend heavily on actual operational conditions.
- **Narrow bands** indicate reliable predictions regardless of operational variation.
- Compare electric vs diesel annual costs to determine economic viability.

---

## Relationship to feasibility evaluation

| Single evaluation | Yearly analysis |
|-------------------|-----------------|
| One temperature | All representative temperatures |
| One-day snapshot | Full-year weighted average |
| Feasible/infeasible | Feasibility per scenario |
| Daily cost | Annualized cost |

---

## Next steps

- [Comparison and Export](comparison-and-export.md) — Compare yearly results across configurations
- [Simulation Results](simulation-results.md) — Understand the single-day basis

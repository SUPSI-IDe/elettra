# Simulation Results

> Last updated: 2026-10-29

After a feasibility evaluation completes, ELETTRA displays comprehensive results covering feasibility, costs, efficiency, emissions, and battery adequacy.

---

## Results overview

The results page is organized into sections (cards/panels):

1. General information
2. Bus information
3. Feasibility verdict
4. Cost breakdown
5. Efficiency analysis
6. SOC profile
7. Emissions assessment
8. Charging infrastructure
9. Battery adequacy
10. Sensitivity analysis

---

## General information

| Field | Description |
|-------|-------------|
| Name | Evaluation name |
| Optimization ID | Unique run identifier |
| Creation date | When the evaluation was launched |
| Simulation type | Optimization mode (battery_only / charging_only / joint) |
| Shift name | Selected shift(s) |
| External temperature | Configured temperature |
| Occupancy | Configured passenger load |
| Heating type | Heat pump or diesel |
| Min/Max SOC | Configured SOC bounds |

---

## Bus information

| Field | Description |
|-------|-------------|
| Bus model | Model name and manufacturer |
| Cost | Bus body cost (CHF) |
| Bus length | 9m / 12m / 18m |
| Max passengers | Capacity |
| Bus lifetime | Years |
| Battery pack cost | Cost per pack (CHF) |
| Battery lifetime | Years |

---

## Feasibility verdict and battery margin

The verdict identifies the actual optimization basis: **Mean** or **Aggregate
Q95**. Solver success, physical battery limits and full-forecast verification
are separate facts. An unverified result does not certify feasibility.

General summarizes all analyzed shifts, shared infrastructure and the largest
selected battery. Each bus retains its own selected battery; the maximum is not
a common battery silently imposed on every shift. All selected shifts
participate in sizing.

The battery card in each shift shows nominal capacity, usable capacity between
SOC limits (including SOH), selected packs and unused installable packs.
Diagnostic excess packs are separated in red and never counted as installed
capacity. Charging-only uses a fixed battery.

Two bars compare the usable capacity required by the mean and representative
Q95 profiles on the **same mass and charging plan**. These requirements come
from maximum temporal energy drawdown, not total consumption minus charging.
They are not independently optimized battery sizes. A red deficit for the
alternative profile does not invalidate the verified basis of the displayed
result. The SOC chart includes the persisted verified trajectory and the two
fixed-plan diagnostic profiles; the charging plan gives actual session timing.

The sampling details show sample count, seed and Monte Carlo uncertainty.
When available, completion percentage is measured over independently sampled
whole trajectories, with charging curtailed at maximum SOC. This conditional
per-shift simulation does not guarantee fleet reliability.

Choose **Mean / Aggregate Q95** beside the battery to check for a compatible
result. Open it to switch the whole design, or explicitly start one new
optimization. Until then the displayed values keep their original basis.
Historical evaluations retain their original semantics; missing aggregate
analysis requires a new evaluation. Historical per-trip quantiles are not
relabelled as aggregate Q95.

---

## Cost breakdown (D3 charts)

### CAPEX vs OPEX

Stacked bar chart comparing:
- **Electric bus**: vehicle CAPEX + battery CAPEX + energy OPEX + maintenance OPEX
- **Equivalent diesel bus**: vehicle CAPEX + fuel OPEX + maintenance OPEX

### Key metrics

| Metric | Description |
|--------|-------------|
| Total annual cost (CHF) | Annualized total cost of ownership |
| CHF/km | Cost per kilometer driven |
| Electric vs diesel delta | Percentage cost advantage/disadvantage |

### Economic parameters

The comparison uses configurable defaults for:
- Diesel fuel price, consumption (L/km), maintenance cost
- Electric energy price, maintenance cost
- Bus and battery lifetimes
- OPEX annualization rate (default: 3%)

---

## Efficiency analysis

| Metric | Description |
|--------|-------------|
| Total consumption (kWh) | Energy used for the entire shift |
| Specific consumption (kWh/km) | Efficiency per kilometer |
| Auxiliary consumption (kWh) | Energy used for heating/cooling |
| Auxiliary share (%) | Proportion of total consumption from auxiliaries |
| Drivetrain consumption (kWh) | Energy used for traction |

---

## SOC profile

A line chart showing battery State of Charge throughout the shift:
- X-axis: time or distance along the shift
- Y-axis: SOC (%)
- Min/max SOC bounds shown as reference lines
- Charging events visible as SOC increases

---

## Emissions assessment

Comparison of lifecycle emissions between electric and diesel operations:

| Indicator | Description |
|-----------|-------------|
| CO₂ equivalent (GWP100a) | Greenhouse gas emissions |
| NOₓ | Nitrogen oxide emissions |
| PM10 | Particulate matter |

Results include both operational and manufacturing (LCA) contributions (*to verify*: full extent of LCA coverage in UI).

---

## Charging infrastructure

If charging stations were configured:
- Total energy charged during shift (kWh)
- Charging events (stop, duration, power)
- Number of slots used
- Infrastructure cost allocation (for `charging_only` / `joint` modes)

---

## Battery adequacy

| Field | Description |
|-------|-------------|
| Optimized battery packs | Number selected by the optimizer |
| Total capacity (kWh) | Packs × pack size |
| Usable capacity (kWh) | Total × usable SOC% |
| Q05 demand (kWh) | Optimistic comparison scenario |
| Mean demand (kWh) | Official feasibility decision scenario |
| Q50 demand (kWh) | Median comparison scenario |
| Q95 demand (kWh) | Conservative stress scenario |
| Margin (kWh / %) | How much usable capacity exceeds mean demand |

---

## Sensitivity analysis

The results page may include sensitivity information showing how the feasibility verdict changes under:
- Different usable SOC values
- Temperature variations
- Occupancy changes
- Heating type switch

See [FEASIBLE_TPL_SIMULATIONS.md](../FEASIBLE_TPL_SIMULATIONS.md) for a detailed research example of sensitivity analysis.

---

## Actions from results

- **Compare** — Add this run to a comparison view
- **Yearly analysis** — Create a yearly analysis from this run
- **Duplicate** — Re-run with modified parameters
- **Back to list** — Return to the evaluation list

---

## Next steps

- [Yearly Analysis](yearly-analysis.md) — Extend these results across a full year of weather
- [Comparison and Export](comparison-and-export.md) — Compare multiple runs side-by-side

# Simulation Results

> Last updated: 2026-06-01

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

## Feasibility verdict

The core output: **feasible** or **infeasible**.

- **Feasible**: The optimizer found a valid battery/charging configuration that keeps SOC within bounds throughout the shift.
- **Infeasible**: No combination of available battery packs and charging stations satisfies the energy demand within the SOC constraints.

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
| Energy demand (kWh) | Predicted shift consumption |
| Margin (kWh / %) | How much usable capacity exceeds demand |

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

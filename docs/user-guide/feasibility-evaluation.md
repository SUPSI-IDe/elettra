# Feasibility Evaluation

> Last updated: 2026-06-01

A feasibility evaluation (optimization run) determines whether a shift can be operated with an electric bus given specific battery, charging, and environmental parameters.

---

## Workflow

1. Navigate to **Simulation > Feasibility evaluation**
2. Click **New** to create a new evaluation
3. Configure parameters (see below)
4. Launch and wait for completion
5. View results

---

## Configuration parameters

### Name

A descriptive name for the evaluation (e.g., "Line 1 Winter 50% SOC").

### Shift selection

Select one or more shifts from your fleet. The table shows:
- Shift name
- Assigned bus model
- Daily distance (km)
- Yearly distance (km)

Shifts can be filtered and sorted.

### Bus model

Select the bus model to use for this evaluation. Defaults to the model assigned to the selected shift but can be overridden to test different bus configurations.

### Optimization mode

| Mode | Description |
|------|-------------|
| **battery_only** | Optimize battery pack count. No charging infrastructure cost is considered. Charging stations can still be specified for operational feasibility. |
| **charging_only** | Fixed battery. Optimize charging station placement and slot count. |
| **joint** | Simultaneously optimize both battery sizing and charging infrastructure. |

### Operational parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| External temperature (°C) | Ambient temperature affecting auxiliary consumption | 15 |
| Occupancy (%) | Average passenger load as % of max capacity | 50 |
| Auxiliary heating type | `default` (heat pump) or `diesel` (diesel heater) | default |
| Usable SOC (%) | Percentage of battery capacity available for use | 50 |

### Usable SOC explained

Usable SOC defines the operational battery window. For example, 50% usable SOC with max SOC of 90% means:
- Min SOC = 40%
- Max SOC = 90%
- Usable energy = 50% of total capacity

Available options: 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%.

A wider usable SOC provides more energy but may reduce battery lifetime.

### Charging stations

When shifts are selected, ELETTRA loads available stops (end-stops from GTFS trips plus depots). For each stop you can:
- Enable/disable as a charging location
- Configure number of plugs
- Set power per plug (kW)
- Set cost per plug (CHF) — for `charging_only` and `joint` modes

Depot/custom stops are pre-selected by default.

---

## What happens when you launch

1. **Prediction runs** are created — one per battery pack count in the allowed range (e.g., 7 to 11 for a 12m bus). Each predicts energy consumption using the greybox model.
2. The system **polls** until all prediction runs complete.
3. An **optimization run** is submitted with all prediction results.
4. The optimizer determines the minimum battery pack count (and/or charging station allocation) that keeps SOC within bounds.
5. Results are displayed automatically.

---

## Execution time

Typical execution: 30 seconds to 3 minutes depending on:
- Number of shifts
- Number of battery pack variants
- Solver complexity (joint mode is slower)

A progress overlay shows the current status.

---

## Managing evaluations

The evaluation list page supports:
- Sorting and filtering by name, date, status
- Viewing results for completed runs
- Duplicating configurations
- Deleting runs
- Comparing multiple runs

---

## Next steps

- [Simulation Results](simulation-results.md) — Interpret the output
- [Yearly Analysis](yearly-analysis.md) — Extend results to a full year

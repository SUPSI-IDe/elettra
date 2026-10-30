# Feasibility Evaluation

> Last updated: 2026-10-29

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

### Consumption basis

Each new evaluation calculates **Mean** and **Aggregate Q95** together. Q95 is calculated from independent samples
of each trip occurrence and then aggregated across the whole shift. It is not
the sum of each trip's Q95. The default is 100,000 samples, with bounded
refinement when precision is insufficient or a no-charging pack threshold is
ambiguous. Each profile gets its own complete optimized design. There is no
solver run per sample; distributions at matching battery masses are reused.

Battery-only optimizes packs with fixed infrastructure. Charging-only preserves
the selected battery. Joint optimizes both. All selected shifts compete for the
same chargers and power limits. A full forecast at the selected battery mass
must verify the final design before it is reported as verified.

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

1. One physical reference forecast per shift is prepared (the fixed battery for charging-only, otherwise the model maximum).
2. Mean and aggregate-Q95 profiles are prepared.
3. Each profile gets a design optimization choosing the allowed variables for all shifts. The two calculations currently run sequentially.
4. The complete forecast is recomputed at each chosen mass. The fixed design is verified while optimizing SOC reserve, favouring buses with lower SOC subject to feasibility for all shifts. A connected bus occupies the same pantograph for its entire stop, even after charging finishes. A failed verification may reanchor within bounded iterations.
5. Diagnostics use each verified charging plan and independent trajectories estimate conditional shift completion. The reserve objective replaces the existing verification objective; it does not add another solver pass.

---

## Execution time

Typical execution: 30 seconds to 3 minutes depending on:
- Number of shifts
- Forecast preparation, sampling and any required mass reanchoring
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

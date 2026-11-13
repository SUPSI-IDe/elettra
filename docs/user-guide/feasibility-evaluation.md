# Feasibility Evaluation

> Last updated: 2026-11-09
> Interface baseline: Frontend v0.11.0

A feasibility evaluation tests whether the selected vehicle blocks can be
operated with the configured bus, battery, charging, and environmental inputs.
New evaluations calculate a **Mean** design and an **Aggregate Q95** design
together.

---

## Create an evaluation

Open **Simulations → Feasibility evaluation** and select **New**.

### 1. Name and GTFS timetable

Enter a descriptive name and select one GTFS timetable edition. The vehicle
block table then shows only compatible records. Changing the edition clears the
current selection, and historical blocks that mix editions are excluded.

### 2. Vehicle blocks and bus model

Select one or more vehicle blocks. Search and sorting operate on the available
compatible set. The bus-model choice follows the selected blocks and remains
stable while other form inputs are changed; review it explicitly whenever the
selected blocks change.

### 3. Optimization mode

| Mode | Fixed input | Optimized decision | Typical use |
|---|---|---|---|
| **Battery only** (`battery_only`) | Charging configuration | Battery pack count | Fleet expansion with existing chargers |
| **Charging** (`charging_only`) | Installed battery pack count | Charging locations, power, and plugs within configured candidates | Charging-infrastructure expansion |
| **Joint** (`joint`) | User constraints and candidates | Battery and charging configuration together | Initial electrification investment |

Charging mode requires a fixed pack count within the selected bus model's
allowed minimum and maximum. Battery-only and Joint can size each vehicle
individually or use the same battery size for all selected blocks, depending on
the battery-sizing option.

The optimizer does not discover unconstrained geographic sites or choose a
commercial vehicle. It works only with the supplied candidates and limits.

### 4. Operating assumptions

| Parameter | Current initial value | Meaning |
|---|---:|---|
| External temperature | -5 °C | Ambient condition for the technical gate |
| Average passengers | 100% | Occupancy applied to the prediction |
| Heating type | Heat pump/default | Auxiliary-heating technology; diesel is also available |
| State of health (SOH) | 70% | Residual capacity as a fraction of initial capacity |
| Battery usage policy | SOC on residual capacity | Applies the SOC window to residual capacity |
| Minimum / maximum SOC | 40% / 90% | Reference operating limits |
| Allowed minimum / maximum SOC | 10% / 95% | Expansion limits for constant initial usable energy |
| Technical time per session | 1 minute | Total connection and disconnection time, including depot charging |
| Terminal layover reduction | 0 minutes | Additional charging-time deduction at terminals, excluding depots |

These battery assumptions apply to the whole evaluation. SOC percentages refer
to residual capacity: 500 kWh initially at SOH 70% leaves 350 kWh, of which the
default 40–90% window makes 175 kWh usable.

The alternative **Constant initial usable energy** policy preserves the reference
window at SOH 100%. With a 40–90% reference, it preserves 50% of initial capacity:
250 kWh for an initial 500 kWh battery. At SOH 70%, the applied window becomes
18.57–90%. The minimum SOC decreases first, down to the allowed minimum of 10%;
only then does the preferred maximum of 90% increase towards the allowed 95%.
Incompatible combinations must be corrected before evaluation.

The applied SOC limits are distinct from SOC actually reached by the optimized
trajectory. An applied minimum below 20% produces an informational warning;
it does not block submission or require confirmation. Charging uses configured
power limits without an SOC-dependent charging curve.

### 5. Charging and depot behavior

Candidate locations come from relevant service stops and custom operational
locations. Depending on the selected mode, configure availability, installed or
maximum plugs, power per plug, and installation costs.

Additional options can:

- verify the next day's departure using the depot stay already represented by
  the vehicle block;
- simulate controllable smart charging that reduces depot peaks while
  preserving the selected design and daytime charging;
- expose advanced infrastructure-cost assumptions.

A connected bus occupies the same plug for its full stop, even after energy
delivery finishes.

Technical time is deducted once per charging session, including at depots.
Its default of 1 minute covers connection and disconnection together. At a
terminal, a configured layover reduction of x minutes leaves the stop duration
minus (1 + x) minutes available for charging; depots have no terminal reduction.
Changing this margin requires a new optimization. It is a deterministic time
margin, not a hardware test or stochastic delay model: it does not shift trips,
propagate delays or add energy demand.

---

## Mean and Aggregate Q95

Both profiles receive a complete design: battery, charging infrastructure, and
charging schedule. Switching profiles on the results page does not start a new
calculation.

Aggregate Q95 is derived from independently sampled trip occurrences and
aggregated over the complete vehicle block; it is not the sum of each trip's
individual Q95. It is a conservative consumption profile, not a statement that
SOC feasibility is guaranteed with 95% probability.

For each chosen design, ELETTRA recomputes the complete forecast at the selected
battery mass and verifies the fixed design. A successful solver state and a
physically valid, forecast-verified design are separate conditions.

---

## Starting and monitoring the evaluation

The confirmation dialog summarizes the number of vehicle blocks and the
optimization mode. Progress is reported for consumption estimates, Mean, and
Q95, and the result opens after both calculations finish.

Run time depends on the number and complexity of vehicle blocks, forecast
preparation, sampling, battery-mass refinement, and optimization mode. Do not
interpret a pending or failed execution as a technical verdict.

---

## Duplicate an evaluation safely

From the evaluation list, select exactly one record and choose **Duplicate**.
The form restores, where available:

- GTFS edition, vehicle blocks, and bus model;
- optimization and battery-sizing modes;
- fixed battery reference for Charging mode;
- temperature, occupancy, heating, and SOC limits;
- SOH, battery usage policy, expansion limits and technical charging times;
- charging candidates, constraints, and infrastructure costs;
- forecast settings, depot options, and solver-related options.

If original resources or compatible forecasts are unavailable, duplication is
cancelled instead of submitting a partial copy. Historical copies created by
older versions may still require manual review and recalculation.
Historical battery assumptions are preserved, including SOH 100% and zero
technical time where recorded or historically assumed; new-evaluation defaults
do not overwrite them.

The list also supports search, sorting, viewing results, and deletion. Analysis
comparison is performed between saved yearly analyses, not between feasibility
records.

---

## Next steps

- [Feasibility Results](simulation-results.md) — Read the technical verdict and each vehicle block
- [Yearly Analysis](yearly-analysis.md) — Assess a verified design over a representative year

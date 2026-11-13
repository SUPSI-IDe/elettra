# Feasibility Evaluation

> Last updated: 2026-11-13
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
| Capacity reference | Residual | Capacity to which the usable percentage applies |
| Usable capacity | 50% | Fraction of the selected reference available for operation |
| Maximum residual usage | 85% | Editable only with the Initial reference |

These assumptions apply to the whole evaluation. The form shows SOH, usable
capacity and a **Residual / Initial** capacity reference; **Maximum residual
usage** appears only for Initial. SOC limits are calculated automatically. A short
preview shows the resulting energy; tooltips explain the controls and show the calculated SOC window.
SOH changes capacity, not the installed packs’ physical mass or cost.

With 500 kWh initially, SOH 70% and usable capacity 50%, **Residual** provides
175 kWh; **Initial** preserves 250 kWh. Their applied SOC windows are respectively
40–90% and 18.57–90%. Initial is incompatible when the requested fraction divided
by SOH exceeds maximum residual usage.

For fractions U (usable capacity), h (SOH) and M (maximum residual usage), the
applied window width is U for Residual and U/h for Initial. Residual automatically
uses M = max(0.85, U). The allowed upper bound is H = max(0.95, M), the lower
bound L = H − M, and the reference maximum is min(H, max(0.90, L + U)). The
applied minimum decreases first; only after reaching L does the maximum increase
up to H. Thus the default preference is 90% and default expansion range 10–95%.
The API and usable-energy formula remain unchanged:
initial capacity × SOH × (applied maximum SOC − applied minimum SOC).

Applied limits differ from SOC actually reached in the optimized trajectory.
A minimum below 20% produces a short informational warning without blocking
submission or requiring confirmation. Charging uses configured power limits
without an SOC-dependent charging curve. Duplication preserves saved SOC bounds
unless the battery assumptions are edited.

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

**Optional charging parameters** is collapsed by default, like the infrastructure
cost options. Open it to edit **Connecting/disconnecting the bus** (default
1 minute) and **Delay allowance at terminals** (default 0 minutes). Duplicated
evaluations with nondefault timing values open this section automatically.

Connection and disconnection time is combined and deducted once per charging
session, including depots: a 5-minute stop minus 1 technical minute leaves
4 minutes available. The terminal delay allowance is a conservative,
deterministic margin, excluding depots: a 6-minute stop minus 1 technical minute
and 2 minutes of allowance leaves 3 minutes available. It does not shift trips,
propagate delays or add energy demand. Changing it requires a new optimization.

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
- temperature, occupancy, heating, and saved SOC bounds;
- SOH, capacity reference, usable capacity, maximum residual usage and technical charging times;
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

# Feasibility Evaluation

A feasibility evaluation tests whether the selected vehicle blocks can be
operated with the configured bus, battery, charging, and environmental inputs.
New evaluations calculate a **Mean** design and an **Aggregate Q95** design
together.

---

## Create an evaluation

Open **Simulations → Feasibility evaluation** and select **New**.

### 1. Name, GTFS timetable and service day

Enter a descriptive name, select one GTFS timetable edition and choose a
service day. The table lists vehicle blocks that run on that day in the
selected edition. Changing the edition clears the current selection. Changing
the day removes selected blocks that do not run on the new day.

### 2. Vehicle blocks and bus model

Select one or more vehicle blocks. Search and sorting operate on the available
compatible set. In **Bus model override**, check the single bus model that the
evaluation will use for the selected blocks. The form proposes a model from the
selected blocks and keeps the choice while you edit other inputs. Review the
model whenever you change the block selection.

### 3. Optimization mode

| Planning question | What you provide | Mode | What ELETTRA determines |
|---|---|---|---|
| I know where to charge. What is the smallest battery that can cover the selected vehicle blocks? | The bus model and existing or planned charging sites, with fixed plug counts and power per plug | **Battery only** | The minimum number of battery packs and when to charge |
| I have chosen the bus and battery. Where should I charge? | The bus model, fixed battery pack count, candidate sites, maximum plug counts, and fixed power per plug | **Charging** | Which sites to use, how many plugs to install at each, and when to charge |
| Which combination minimizes the upfront investment in batteries and charging plugs? | The bus model, candidate sites, plug limits, power per plug, and battery and charging costs | **Joint** | The battery pack counts, charging sites and plug counts that minimize upfront investment, plus when to charge |

Charging mode requires a fixed pack count within the selected bus model's
allowed minimum and maximum. Battery-only and Joint can size each vehicle
individually or use the same battery size for all selected blocks, depending on
the battery-sizing option.

For a **Battery only** purchase, compare the packs required for each block in the Mean and Q95 designs. You choose the bus model and manufacturer. Fleet TCO includes the modeled capital cost of every selected charging site with at least one plug, even if its chargers are already installed or unused. The estimate covers charging points, site infrastructure and the grid connection. Consult your accounts for actual past spending.

For **Charging**, compare the selected plugs at each candidate site with your installed inventory to identify additions. The calculation considers only the sites you specify.

For **Joint**, record the packs and chargers together. Carry that verified design into yearly analysis and compare total cost with diesel on the same service. Detailed depot layout and grid connection require a separate engineering study.

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

#### Battery capacity and SOH

At 70% SOH, a battery with 500 kWh of initial capacity has 350 kWh of residual
capacity. With usable capacity set to 50%, the capacity reference determines
how much energy is usable.

| Capacity reference | Usable energy | Applied SOC window |
|---|---:|---:|
| Residual | 175 kWh | 40–90% |
| Initial | 250 kWh | 18.57–90% |

Initial is incompatible when the requested usable fraction divided by SOH
exceeds maximum residual usage.

For fractions U (usable capacity), h (SOH) and M (maximum residual usage), the
applied window width is U for Residual and U/h for Initial. Residual automatically
uses M = max(0.85, U). The allowed upper bound is H = max(0.95, M), the lower
bound L = H − M, and the reference maximum is min(H, max(0.90, L + U)). The
applied minimum decreases first; only after reaching L does the maximum increase
up to H. Thus the default preference is 90% and default expansion range 10–95%.
Usable energy equals residual capacity (initial capacity × SOH as a fraction)
times the applied SOC window width as a fraction.

Applied limits differ from SOC actually reached in the optimized trajectory.
A minimum below 20% produces a short informational warning without blocking
submission or requiring confirmation. Charging uses configured power limits
without an SOC-dependent charging curve. Duplication preserves saved SOC bounds
unless the battery assumptions are edited.

### 5. Charging and depot behavior

Candidate locations come from relevant service stops and custom operational
locations. Depending on the selected mode, configure availability, installed or
maximum plugs, power per plug, and installation costs.

For a new evaluation, non-depot terminal candidates start with **1 plug** in
all three optimization modes. A depot instead starts with the number of
selected blocks returning to that depot: **N blocks → N buses → N plugs**.
Counts are per depot, not the total number of blocks at unrelated depots.
These values remain editable. Battery only uses the installed count;
Charging and Joint use it as the maximum allowed.

With the default powers, one terminal plug corresponds to a 450 kW site limit,
while N depot plugs correspond to 150 × N kW. Review the plug counts and power
limits before starting. Duplication preserves saved charging inputs rather
than replacing them with new-evaluation defaults.

**Verify next-day departure with depot charging** checks whether the same bus
can recharge between the planned return and the next day’s departure and start
the same vehicle block at its required departure SOC. The option is enabled by
default for new evaluations. Include the depot where each block starts and ends
in the selected charging infrastructure. For example, if a block starts and
ends at Depot A and pauses at Depot B during the day, select Depot A for the
next-day check.

With that check enabled, **Simulate smart charging in the depot** can reduce
charging peaks while preserving the selected design and daytime charging.
Advanced infrastructure-cost assumptions are available separately.

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

## How to use Mean and Aggregate Q95

In the **Bus model and optimization mode** card, **Mean and Q95** is an
explanation of what the form calculates. One **Start evaluation** submits both
designs with the same selected blocks, operating assumptions and limits. After
the results open, use **Show optimized result** beside the scope tabs to switch
between the saved **Mean** and **Q95** designs.

Use **Mean** to see the design sized for expected consumption under the chosen
conditions. Use **Q95** to see what changes when sizing for a representative
high-consumption profile. Compare the verdict, selected packs, charging
infrastructure and plan in [Feasibility Results](simulation-results.md#compare-the-mean-and-q95-designs).

For each Monte Carlo sample, ELETTRA draws consumption independently for each
trip occurrence, including repeated trips, and sums those draws over the
vehicle block. Aggregate Q95 is the 95th percentile of the simulated block
totals. Roughly 95% of those totals are at or below this value. The calculation
uses a representative sequence of trip consumptions whose total matches that
percentile. Timing, charger access and the SOC limits also determine whether
the vehicle block can operate. The percentile describes energy demand under
the model assumptions. A sum of individual trip percentiles would answer a
different question.

For each chosen design, ELETTRA recomputes the complete forecast at the selected
battery mass and verifies the fixed design. A successful solver state and a
physically valid, forecast-verified design are separate conditions.

---

## Starting and monitoring the evaluation

Select **Start evaluation** and confirm the number of vehicle blocks and the
optimization mode. The progress dialog tracks consumption estimates, Mean and
Q95 separately. After both calculations finish, ELETTRA opens Mean if it
completed, or Q95 if Mean failed and Q95 completed. Completed infeasible results
can open with diagnostics. If both calculations fail, the list displays the
failure count.

Run time depends on the number and complexity of vehicle blocks, forecast
preparation, sampling, battery-mass refinement, and optimization mode. Do not
interpret a pending or failed execution as a technical verdict.

---

## Duplicate an evaluation safely

From the evaluation list, choose **Duplicate** on the source row; row selection
is not required. ELETTRA checks all list pages for the first available suffix
in the original name family: `_copy`, `_copy_1`, `_copy_2`, and so on. The name
remains editable and the suffix follows the interface language.
The form restores, where available:

- GTFS edition, vehicle blocks, and bus model;
- optimization and battery-sizing modes;
- fixed battery reference for Charging mode;
- temperature, occupancy, heating, and saved SOC bounds;
- SOH, capacity reference, usable capacity, maximum residual usage and technical charging times;
- charging candidates, constraints, and infrastructure costs;
- forecast settings, depot options, and solver-related options.

If original resources or compatible forecasts are unavailable, duplication is
canceled.

The list also supports search, sorting, viewing results, and deletion. Analysis
comparison is performed between saved yearly analyses, not between feasibility
records.

---

## Next steps

- [Feasibility Results](simulation-results.md) — Read the technical verdict and each vehicle block
- [Yearly Analysis](yearly-analysis.md) — Assess a verified design over a representative year

---

> Reference versions: Frontend v1.4.5-rc.1 · Backend v1.9.0
>
> Last updated: 2026-11-26

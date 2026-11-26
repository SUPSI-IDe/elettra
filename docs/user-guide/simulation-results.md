# Feasibility Results

The feasibility result page is the technical gate between service preparation
and yearly assessment. Read the overall verdict first, then inspect every
vehicle block and the complete Mean/Q95 design before creating a yearly
analysis.

[Read the verdict](#read-the-technical-verdict) · [Check battery and SOC](#consumption-histogram-and-soc-trajectory) · [Troubleshoot](#infeasible-configurations) or [export](#export-the-complete-evaluation).

---

## Result navigation

The page header provides four independent contexts:

1. **Result scope** — **General** or one named vehicle block.
2. **Show optimized result** — **Mean** or **Q95** for paired evaluations.
3. **GTFS provenance** — the timetable edition recorded when the evaluation
   was created.
4. **Operating assumptions** — compact SOH, Technical times and HVAC cards
   open the corresponding saved battery, timing and auxiliary-energy assumptions.

## Compare the Mean and Q95 designs

Start in **General**. In **Show optimized result** beside the scope tabs,
select **Mean**, then **Q95**. Compare the verdict, battery sizes and shared
charging resources of the two designs. Open a vehicle block to compare
its operating margin and charging plan. The selected tab stays open when you
switch between available results. Each choice loads its saved, complete design
and requires no new calculation.

Mean uses expected trip consumption under the evaluation assumptions. Q95
uses a representative profile at the 95th percentile of simulated total
consumption over the block. Where demand falls in the block and when and how
fast the bus can charge determine its minimum SOC. Use the SOC trajectory
to check the selected design. The 95% refers to modeled consumption totals
and any simulated completion percentage is conditional on the selected plan
and model.

If the requested result is pending, failed or unavailable, the selector keeps
the current design and displays a message. The design shown still belongs to
the active profile. Return to the evaluation list to check its status.

---

## Start with General

For a feasible design, General summarizes the common evaluation context:

- optimization mode and active decision basis;
- overall feasibility status;
- vehicle blocks covered by the result;
- largest selected battery and the blocks that drive sizing;
- shared charging infrastructure, power, delivered energy, and installation
  cost where available.

Each vehicle block retains the battery selected for it. The largest battery
shown in General is a fleet summary, not a battery silently imposed on every
block unless uniform sizing was explicitly selected.

All selected vehicle blocks participate in sizing and can compete for shared
charging resources. A problem in one block can therefore stop or constrain the
evaluation of the others.

---

## Read the technical verdict

Keep these states separate:

| State | Interpretation |
|---|---|
| **Feasible** | Optimization completed, the physical pack limit is respected, and the selected design passed complete-forecast verification |
| **Infeasible** | The completed calculation established that the design violates a constraint under the tested assumptions, such as the physical pack limit, charger access or depot power |
| **Not determined** | The calculation produced no technical verdict. A source-data or configuration validation problem may have blocked one or more vehicle blocks |
| **Pending or running** | The calculation is still in progress |
| **Failed, unverified or unavailable** | There is no verified verdict to use for that profile. A calculation may have failed or timed out, or the result may be unavailable |

A successful solver execution alone does not certify feasibility. Conversely,
a block marked not evaluated because another block failed is not automatically
infeasible.

When a result is **Not determined**, check the reported cause in **General**. If a vehicle block is identified, open it and follow **How to resolve**. For example, a block returns to its starting depot and you ask ELETTRA to verify the next day’s departure, but the only selected charging site is a terminus. Validation stops before battery sizing. If the operating plan includes charging at the depot, select the depot as a charging site and run a separately named evaluation.

An orange **paired feasibility verdict** means that one profile is feasible and
the other is infeasible. Read the label to identify which design passed.
An incomplete pair has a separate outcome. Numeric availability is separate:
an infeasible Q95 result may contain consumption values or lack them.

The demand scenario, optimization mode and outcome share the fleet header.
Explanations for **Fleet evaluation**, **Batteries and bus investment**,
**Charging infrastructure for the selected vehicle blocks** and **Charging
infrastructure investment by site** are available through their information
icons rather than repeated paragraphs.

### Infeasible configurations

General uses the same layout for every established infeasible result: known
constraints, the scope of any battery estimate, and a table of affected vehicle
blocks. The table lists selected packs, the installable maximum, estimated
required packs, and missing packs relative to the selected battery. Requirements
above the physical maximum are highlighted. An em dash means no value was
established; it is not zero. Select a block name to open its battery graphic.

Battery figures can come from two different analyses:

- The saved optimization result may contain virtual additional packs. These
  describe a diagnostic shortfall, not an installable design verified at the
  full battery mass.
- When the complete daily cycle is infeasible, a separate diagnostic may
  exclude restoration of the initial SOC before the next departure. Its scope
  is stated explicitly. Even a verified daytime battery does not establish a
  feasible complete daily cycle.

Fixed-battery shortfalls within the installable maximum, insufficient depot
power, unavailable plugs, overlapping plug occupancy and unusable charging
windows use this same presentation. A shared depot constraint need not identify
an individual limiting block. Missing or incomplete diagnostics produce an
explicit explanation, without inventing battery counts or energy values.

Recharge before the next departure is reported separately. A battery shortfall
alone does not establish a depot recharge shortfall. Diagnostic depot bounds
are not a verified overnight charging plan. Timeouts, calculation errors and
unverified results remain separate from proven infeasibility. Feasible results
retain their existing summary and operational detail.

Infeasible vehicle-block details use one layout for both saved optimizer
results and separate diagnostics: block summary,
battery graphic, and **More information** with the saved operating conditions.
Unavailable battery details keep an explicit placeholder in the same layout.
The tooltip beside the outcome explains identified battery or charging constraints.
The battery estimate and color legend have their own tooltips; numeric limits
and missing packs remain visible without repeated explanatory paragraphs.
General table headings explain estimated and missing packs in tooltips.
Help is available by hover, keyboard focus, or tap; Escape closes it.

The consumption tooltip identifies a diagnostic solver trajectory, a reference
forecast at its recorded pack count, or an unavailable value. Missing aggregate
Q95 is never replaced by summed per-trip quantiles. Energy-deficit comparisons
require a known charging amount and a compatible consumption reference.
An unavailable Q95 consumption is shown as **N/A**, with a short tooltip
explaining that the saved result does not contain it. Its kWh/km value remains
an em dash, without a separate tooltip.

A block without a battery shortfall in a relaxed diagnostic is labeled
accordingly, without asserting that its complete daily cycle is feasible.
Diagnostic blocks do not display virtual SOC or charging plans as verified
physical operation. Physical, feasible blocks retain their existing detail,
including when another block makes the overall evaluation infeasible.

---

## Inspect every vehicle block

For a physically verified vehicle block, **Vehicle block operational summary**
reports:

- active Mean or Q95 total consumption;
- active specific consumption in kWh/km;
- minimum and maximum SOC actually reached;
- charged energy and number of charging sessions.

Use **Battery and energy margin** for selected packs, the installable maximum,
nominal and usable capacities, and the available margin when recorded.

**Configured SOC window** shows the limits applied in the evaluation.
**Minimum SOC reached** and **Maximum SOC reached** are trajectory outcomes.

SOC percentages refer to **residual capacity**.

Usable energy (kWh) = residual capacity (kWh) × (configured maximum SOC % − configured minimum SOC %) / 100.

See the [battery capacity and SOH example](feasibility-evaluation.md#battery-capacity-and-soh).

The operational-energy view combines usable battery energy, planned charging,
and temporal energy drawdown. Required usable energy is derived from the
verified trajectory at the selected mass and schedule; it is not simply total
consumption minus charged energy.

---

## Consumption histogram and SOC trajectory

Open a vehicle block and choose **Mean** or **Q95** in **Show optimized result**.
In **Battery and energy margin**, **Energy consumed during the vehicle block**
counts sampled trip sequences by their total consumption in kWh. It uses
predictions for the selected battery mass. Charged energy stays separate from
the histogram. The vertical marker shows the active design's Mean or Q95
consumption.

In **SOC along the vehicle block · selected optimized design**, check the curve
against the horizontal minimum and maximum limits and use the summary to read
the SOC actually reached. The chart indicates the verified optimizer SOC where
available. Between departure and arrival it draws a linear approximation of
trip consumption and preserves the timing of stops and planned charging.
In **Method and sampling precision**, you can see the sample count and the
Monte Carlo interval for the estimated Q95. That interval describes sampling
precision. In the SOC chart's information tooltip, **Simulated vehicle block
completion** is a separate estimate of the share of sampled trajectories that
respected the SOC limits with this plan, when the estimate is available.

In the illustrated Q95 design, the histogram counts 200,000 simulated
sequences. The selected 14 packs of 50 kWh provide 700 kWh nominal and
490 kWh usable between 20% and 90% SOC at SOH 100%. A 62.5 kWh depot charge
helps the bus meet 539.2 kWh of demand. The SOC ranges from 153.3 to
630.0 kWh. The minimum is 13.3 kWh above the lower limit of 140 kWh.

In **More information**, the energy-forecast table identifies the role of every
forecast used in sizing. The forecast for the selected and verified battery is
listed directly before the initial physical-maximum reference, so the two
different pack counts and purposes remain explicit.

Forecast rows can include Q05, Mean, Q50, and Q95 consumption, specific
consumption, drivetrain and auxiliary energy, mass, distance, and pack count.
The active feasibility basis remains Mean or Aggregate Q95; the other columns
are supporting distribution information.

---

## Charging plan

When a charging plan is available, inspect each session’s location and time,
including the day offset when it continues into the next day. Its card shows
three metrics: **Planned stop**, **Available for charging** and **Energy charged**.
The **Charging details** tooltip contains connection/disconnection time, terminal
delay allowance, active and idle charging time, and average power.

Available time is the stop duration after connection/disconnection and any
terminal delay allowance; actual charging may use less time. With full-stop
connection, these times describe the planned stop.

Battery-only evaluations can schedule charging within the fixed infrastructure.
The plan may have no sessions or be partially unavailable. If a complete daily
cycle was verified, **Daily cycle and depot charging** shows energy charged
during the vehicle block and between return and the next departure separately.
In the vehicle-block view, compare departure SOC with the target and open
**Depot charging schedule** for the time, power and energy in each interval. In an
infeasible result, open the **Identified constraints** tooltip beside the verdict
or block status for the available depot diagnostic.

If smart charging completed, in **General** expand **Simulated charging peak
with smart charging** under **Daily cycle and depot charging**. Compare
**Previous feasible plan** and **With peak shaving** for each depot in kW DC.
The baseline is the feasible schedule before peak shaving. The two values
include bus charging at the depot, including any overlapping in-service load.
If peak shaving did not complete, ELETTRA retains the feasible schedule and
reports that the daily cycle was verified.

Distinguish available charging time, active charging time, connected time and
available time without charging. The default technical time is 1 minute total
for connection and disconnection, once per session, including at depots. A
terminal layover reduction of x minutes additionally reduces terminal charging
time: stop duration minus (1 + x) minutes; depots only lose the technical minute.
The recorded margin is deterministic and changing it requires a new optimization;
it does not test hardware, shift trips, propagate delays or add energy demand.

**Charging plan** and **More information** are expandable white cards. They
keep detailed sessions, prediction inputs, configured SOC limits, and supporting
values available without obscuring the primary verdict.

---

## GTFS and raw configuration data

The compact GTFS disclosure shows the edition recorded at evaluation creation.

**View raw feasibility data** is always visible at the top right of the page,
in place of the close icon, in both General and individual vehicle-block views.
It opens a dialog with supporting configuration panels for general
inputs, bus information, charging-station information, scenario/scaling data,
and investment breakdown. Use these values to audit the displayed result, not
to replace the result's status and provenance labels. Close the dialog to
return to the result; no additional disclosure needs to be opened first.

---

## Export the complete evaluation

In **General**, choose **Download all results (JSON)** at the bottom of the
results, next to **Close**, as in yearly analysis. The schema 1 file
(`kind: feasibility_evaluation`) contains all vehicle blocks and both available
**Mean** and **Aggregate Q95** designs, regardless of the currently displayed
profile. The download reads saved calculations and never starts optimization.

Each design includes its own configuration, technical verdict, battery and
vehicle investments, shared infrastructure, decision consumption, SOC limits,
charging plan, forecast references and recorded provenance. Shared infrastructure
is counted once per design. Mean and Q95 are alternative designs: do not add
their investments or energy values. Numbers retain their precision in the file;
the interface may round them for display.

Collection captures the context when you click. Missing forecasts or unavailable,
pending or failed profiles are reported explicitly; the file may be partial.
Download again to retry loading. An inconsistent calculation family produces an
error instead of combining unrelated designs. Leaving the page cancels a pending
download. A partial file is not proof of infeasibility, and diagnostic records do
not establish a verified charging plan. Missing values remain missing, rather than zero.

Original results and forecast records remain available for audit. Complete HVAC
reproduction inputs require the separate HVAC download. Annual costs and emissions
belong to the yearly-analysis export. See the
[technical JSON contract](../technical/feasibility-export.md) for field meanings
and availability states.

---

## What belongs in yearly analysis

Feasibility answers whether the design can operate under the selected technical
scenario. Representative annual energy, cost, and environmental performance
belong to the yearly analysis. Do not treat a cold or conservative feasibility
scenario as an annual average.

---

## Next steps

- [Yearly Analysis](yearly-analysis.md) — Reuse the verified design across annual weather scenarios
- [Feasibility Evaluation](feasibility-evaluation.md) — Revise assumptions and run a new evaluation

---

> Reference versions: Frontend v1.4.5 · Backend v1.9.0
>
> Last updated: 2026-11-26

# Feasibility Results

> Last updated: 2026-11-20
> Interface baseline: Frontend v1.2.0-rc.2

The feasibility result page is the technical gate between service preparation
and yearly assessment. Read the overall verdict first, then inspect every
vehicle block and the complete Mean/Q95 design before creating a yearly
analysis.

---

## Result navigation

The page header provides four independent contexts:

1. **Result scope** — **General** or one named vehicle block.
2. **Consumption basis** — **Mean** or **Q95** for paired evaluations.
3. **GTFS provenance** — the timetable edition recorded when the evaluation
   was created.
4. **Operating assumptions** — compact SOH, Technical times and HVAC cards
   open the corresponding saved battery, timing and auxiliary-energy assumptions.

Changing Mean/Q95 opens the complete optimized design for that profile,
including its battery, charger configuration, and charging schedule. It does
not merely change a demand line on an otherwise fixed result.

Historical single-basis evaluations retain their original semantics. When an
alternative design was never calculated, the interface may expose an explicit
compatibility calculation rather than relabelling historical per-trip
quantiles as Aggregate Q95.

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
| **Infeasible** | Optimization completed but the proposed service/design failed a technical constraint, such as exceeding the physical battery limit |
| **Not determined** | The calculation stopped before a feasibility verdict could be produced |
| **Pending/failed execution** | No final technical conclusion is available |

A successful solver execution alone does not certify feasibility. Conversely,
a block marked not evaluated because another block failed is not automatically
infeasible.

When a calculation is not determined, General lists the outcome of every
selected block. The block view identifies the reason, any blocking vehicle
block, and translated **How to resolve** guidance. Correct the indicated source
data or configuration and run a separately named evaluation.

An orange outcome means **feasible with Mean but infeasible with Q95**.
The technical verdict and numeric data availability are independent: an
infeasible Q95 result may contain consumption values or lack them.

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
The battery estimate and colour legend have their own tooltips; numeric limits
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

A block without a battery shortfall in a relaxed diagnostic is labelled
accordingly, without asserting that its complete daily cycle is feasible.
Diagnostic blocks do not display virtual SOC or charging plans as verified
physical operation. Physical, feasible blocks retain their existing detail,
including when another block makes the overall evaluation infeasible.

---

## Inspect every vehicle block

For a physically verified vehicle block, the summary reports:

- active Mean or Q95 total consumption;
- active specific consumption in kWh/km;
- required and selected battery packs;
- nominal and usable battery capacity;
- physical pack limit and battery margin;
- minimum and maximum SOC actually reached;
- charged energy and number of charging sessions.

**Configured SOC window** identifies the limits entered in the evaluation.
**Minimum SOC reached** and **Maximum SOC reached** are trajectory outcomes.
They must not be presented as the same quantity.

SOC percentages refer to **residual capacity**. The battery assumptions show
initial, residual and usable capacity, SOH, usage policy, applied SOC window,
technical time and terminal layover reduction. Usable energy is initial kWh ×
SOH × (applied maximum SOC − applied minimum SOC); physical pack counts remain
unchanged by this conversion. The forecast and energy tables use the same SOH
and applied window.

For an initial 500 kWh battery at SOH 70%, residual capacity is 350 kWh. The
default residual-capacity policy with SOC 40–90% gives 175 kWh usable. Constant
initial usable energy with a 40–90% reference preserves 250 kWh and applies
18.57–90% at SOH 70%. It lowers the minimum towards the allowed 10% before
raising the preferred maximum of 90% towards the allowed 95%. The informational
warning concerns an **applied minimum below 20%**, not the minimum reached by
the trajectory; it does not require confirmation.

The operational-energy view combines usable battery energy, planned charging,
and temporal energy drawdown. Required usable energy is derived from the
verified trajectory at the selected mass and schedule; it is not simply total
consumption minus charged energy.

---

## Visual analysis and forecasts

The visual analysis shows the relationship between energy consumption,
available battery energy, planned charging, and SOC coverage. Read it together
with the verdict and pack limit rather than as an independent feasibility test.

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

For Charging and Joint evaluations, inspect each session’s location and time,
including the day offset when it continues into the next day. Its card shows
three metrics: **Planned stop**, **Available for charging** and **Energy charged**.
The **Charging details** tooltip contains connection/disconnection time, terminal
delay allowance, active and idle charging time, and average power.

Available time is the stop duration after connection/disconnection and any
terminal delay allowance; actual charging may use less time. With full-stop
connection, these times describe the planned stop. Historical freely connected
sessions may describe only the connected interval.

Battery-only evaluations may show fixed charging already supplied by the
configuration, or no charging plan. A partial or unavailable plan is reported
as such rather than filled with invented sessions.

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
For historical results without a complete snapshot, the interface explicitly
labels provenance derived from current vehicle-block data.

**View raw feasibility data** is always visible at the top right of the page,
in place of the close icon, in both General and individual vehicle-block views.
It opens a dialog with supporting configuration panels for general
inputs, bus information, charging-station information, scenario/scaling data,
and investment breakdown. Use these values to audit the displayed result, not
to replace the result's status and provenance labels. Close the dialog to
return to the result; no additional disclosure needs to be opened first.

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

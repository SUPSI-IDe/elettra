# Feasibility Results

> Last updated: 2026-11-09
> Interface baseline: Frontend v0.10.0

The feasibility result page is the technical gate between service preparation
and yearly assessment. Read the overall verdict first, then inspect every
vehicle block and the complete Mean/Q95 design before creating a yearly
analysis.

---

## Result navigation

The page header provides three independent contexts:

1. **Result scope** — **General** or one named vehicle block.
2. **Consumption basis** — **Mean** or **Q95** for paired evaluations.
3. **GTFS provenance** — the timetable edition recorded when the evaluation
   was created.

Changing Mean/Q95 opens the complete optimized design for that profile,
including its battery, charger configuration, and charging schedule. It does
not merely change a demand line on an otherwise fixed result.

Historical single-basis evaluations retain their original semantics. When an
alternative design was never calculated, the interface may expose an explicit
compatibility calculation rather than relabelling historical per-trip
quantiles as Aggregate Q95.

---

## Start with General

General summarizes the common evaluation context:

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

---

## Inspect every vehicle block

The vehicle-block summary reports:

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

For Charging and Joint evaluations, inspect each session for:

- location and time;
- day offset when charging continues into the next day;
- connection duration;
- delivered energy;
- average charging power.

Battery-only evaluations may show fixed charging already supplied by the
configuration, or no charging plan. A partial or unavailable plan is reported
as such rather than filled with invented sessions.

**Charging plan** and **More information** are expandable white cards. They
keep detailed sessions, prediction inputs, configured SOC limits, and supporting
values available without obscuring the primary verdict.

---

## GTFS and raw configuration data

The compact GTFS disclosure shows the edition recorded at evaluation creation.
For historical results without a complete snapshot, the interface explicitly
labels provenance derived from current vehicle-block data.

**View raw feasibility data** opens supporting configuration panels for general
inputs, bus information, charging-station information, scenario/scaling data,
and investment breakdown. Use these values to audit the displayed result, not
to replace the result's status and provenance labels.

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

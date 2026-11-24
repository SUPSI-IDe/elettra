# Yearly Analysis

> Last updated: 2026-11-23
> Interface baseline: Frontend v1.3.0

A yearly analysis keeps the bus, battery, and charging design selected by a
completed feasibility evaluation fixed and applies it to representative
temperature scenarios. It does not resize the battery, redesign charging, or
repeat the technical feasibility decision.

The current result page separates two questions:

- **General** assesses the whole fleet, or a representative bus group, through
  annual activity, costs, and environmental impacts;
- each named **vehicle block** shows its own temperature-dependent efficiency
  and annual energy contribution.

---

## Create a yearly analysis

Open **Simulations → Yearly analyses** and select **New**.

1. Enter a descriptive analysis name.
2. Select an eligible, completed feasibility evaluation.
3. Review the inherited vehicle blocks, optimization mode, sizing temperature,
   selected packs, and capacity.
4. Set the average passenger occupancy for the annual predictions.
5. Review the representative temperatures, annual occurrences, and weather
   reference.
6. Confirm and start the analysis.

Each weather scenario is applied to every selected vehicle block. Annual totals
weight scenario energy by its occurrence. Q05–Q95 values describe prediction
spread for the scenario-weighted estimate; they do not resize the design or
replace the feasibility verdict.

If the occurrences do not cover the intended year, the form reports the
mismatch. Resolve that boundary before interpreting annual values.

---

## Duplicate a saved analysis

Choose **Duplicate** on the source row to open a new-analysis form with the
source feasibility evaluation and occupancy already selected. Review the
inherited inputs before starting the new calculation.

The editable proposed name uses `_copy_1`, `_copy_2`, and so on, localized to
the interface language. Copying a copy continues the original name family's
numbering rather than repeating the suffix. The next number follows the
highest existing copy number across all list pages.

---

## Preserved configuration and provenance

The analysis inherits the feasibility evaluation's:

- bus model and physical vehicle count;
- vehicle blocks and battery group assigned to each block;
- selected battery configurations;
- charging infrastructure and schedule context;
- optimization and operating assumptions;
- recorded GTFS timetable edition.

The result preserves this snapshot instead of silently following later edits.
Use the compact **GTFS timetable** disclosure and **View configuration data**
to inspect it.

The compact **HVAC assumptions** disclosure identifies the policy used by the
saved result:

- feasibility uses one engineering GHI value for each temperature;
- yearly analysis uses hourly PVGIS GHI, interpolated at each service minute in
  the local GTFS timezone;
- terminal HVAC covers at most the last 10 minutes at the same non-depot stop,
  with an empty bus and no thermal-inertia model.

It also reports trip and terminal HVAC energy, traceability data, and JSON
downloads of the assumptions or complete reproduction inputs. Historical
results retain their recorded legacy policy.

---

## General: annual fleet assessment

The **Annual fleet assessment** starts with a compact six-metric summary:

- annual distance, bus-side DC energy, and purchased grid electricity;
- minimum/maximum average vehicle-block efficiency, electric TCO, and climate
  impact.

Efficiency **Min** and **Max** appear on separate lines, each with its vehicle
block name; values remain vertically centred beside the label. Long vehicle
block lists wrap within cells in the annual-analysis list without hiding
names or widening the table.

Use **Representative bus / Fleet** to switch between the complete fleet and a
group sharing the same bus model and battery size. Vehicle blocks remain in the
group assigned by feasibility; changing the display scope does not reassign
them.

### Costs

The Costs view shows a compact electric/diesel TCO row, annual operating-cost
and cumulative discounted-cost charts, break-even, and detailed investment and
operating tables.

**Edit economic assumptions** is an expandable card below the charts. Changes
are saved automatically in the yearly analysis and reused by Costs and
Emissions. They update the displayed assessment but do not rerun feasibility or
alter the selected technical design.

Inside this card, **Additional economic parameters** contains maintenance,
the assessment horizon, discount rate, diesel purchase price and component
lifetimes. **Calculation method and boundaries** is a separate explanatory
disclosure covering TCO, time horizon, residual values and assessment limits.

For charging infrastructure maintenance, select either an editable percentage
of charging investment per year or a fixed amount in CHF/year. The default
percentage is **2%/year**, with the INFRAS 2026 reference range of **2–5%**.
This is not a default of CHF 2/year. Historical analyses retain their saved
method and values; a fixed amount of zero excludes infrastructure maintenance.
Check the selected method and its units when reviewing an older analysis.

The percentage applies to the full charging investment, including chargers,
shared works and connection. Maintenance is counted once per fleet, excluding
buses and batteries. The tooltip beside the reference explains this modelling
assumption.

### Emissions

The Emissions view presents climate impact by lifecycle phase, energy boundary,
environmental indicators, assumptions/provenance, and further information.
The current model is explicitly partial rather than a complete absolute vehicle
LCA.

**Activity and diesel consumption** is an expandable card below the phase
charts. There is one mileage control per bus model and battery size, plus the
diesel-consumption control. A mileage change scales the assigned blocks in that
group proportionally while preserving their distance-weighted consumption.

When a control changes, the previous environmental bars remain visible with an
update status until the recalculated response arrives. A failed refresh leaves
the previous result visible and marks the update failure.

For VECTO analyses, saved diesel-heater fuel energy is converted with the
versioned Swiss average fuel profile. Missing required heater consumption is
kept missing: affected reductions are omitted instead of treating it as zero.

---

## Vehicle-block efficiency

Select a named vehicle block. Below the HVAC and GTFS information cards, a compact
white summary reports annual energy, simulated distance, and average
efficiency. The efficiency content is shown directly, without another
single-item tab.

It includes:

- specific consumption by representative temperature with uncertainty;
- annual energy contribution by temperature scenario;
- a yearly/daily energy-unit toggle where available;
- expandable scenario, battery, critical-condition, and annual uncertainty
  details.

Cold scenarios can have high consumption but contribute according to their
recorded annual occurrence. Read scenario intensity together with its weight.

Historical analyses that do not contain the current frozen investment/activity
structure can use the legacy result layout or show General only. ELETTRA does
not invent unavailable per-block values from an aggregate total.

---

## Export

**Download all results (JSON)** appears in General, next to the close action.
The export contains General and a separate entry for every available vehicle
block, including assumptions, provenance, scope, and allocation metadata where
available.

For analyses with the current fleet investment snapshot, the file uses JSON
schema 4 and includes fleet totals, representative groups and the effective
economic assumptions. Simulated technical activity is kept separate from edited
annual mileage. Environmental results identify their scope and availability;
previous responses retained during an update are labelled separately. Historical
analyses without that investment snapshot retain schema 3.

The complete JSON always contains fleet totals and all representative groups,
even when a single representative bus is selected. The separate download in
**Emissions** follows the selected scope and becomes available when its current
assessment is ready. After a failed update, use **Retry** to obtain current
environmental results.

The complete file also reports whether the current assumptions have been saved.
An export made during a pending or failed save still describes the displayed
assessment. Check the save status before closing; a failed save or invalid input
keeps the result page open so the changes can be corrected or saved again.

The [JSON export contract](../technical/yearly-analysis-export.md) describes the
fields, units and version differences.

---

## Next steps

- [Comparison and Export](comparison-and-export.md) — Compare two saved yearly analyses
- [Feasibility Results](simulation-results.md) — Return to the fixed technical design

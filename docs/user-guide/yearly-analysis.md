# Yearly Analysis

> Last updated: 2026-11-10
> Interface baseline: Frontend v0.10.0

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

Select a named vehicle block. Directly below the scope selector, a compact
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

---

## Next steps

- [Comparison and Export](comparison-and-export.md) — Compare two saved yearly analyses
- [Feasibility Results](simulation-results.md) — Return to the fixed technical design

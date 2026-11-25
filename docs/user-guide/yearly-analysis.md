# Yearly Analysis

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

1. Enter a **Name** and select a completed, feasible, eligible evaluation in
   **Simulation**. It must have a recorded battery-pack count. When both Mean
   and Aggregate Q95 are eligible, select the intended saved variant.
2. Review the inherited vehicle blocks, optimization mode, sizing temperature,
   pack counts and capacities. A multi-block evaluation can carry different
   batteries for different blocks.
3. Set **Average passengers on board (%)** for the annual forecasts. The form
   proposes the source evaluation’s occupancy if it is one of the available
   options and otherwise selects 50%.
4. Review the automatically selected weather reference depot and the
   read-only **Temperature scenarios**. ELETTRA uses the vehicle blocks’
   arrival depots to establish the weather reference when available. Each row
   shows a representative
   daytime temperature (05:00–24:00) and its occurrences in days/year.
   A total other than 365 produces a warning. A total of zero prevents
   the analysis from starting.
5. Click **Run yearly analysis**, check the block count, scenario count and
   reference depot, then select **Start analysis**. ELETTRA applies each
   scenario to all the vehicle blocks in the evaluation, keeping each block’s
   battery and charging design. The results open automatically when finished.

---

## Duplicate a saved analysis

Choose **Duplicate** on the source row to open a new-analysis form with the
source feasibility evaluation and occupancy already selected. Review the
inherited inputs before starting the new calculation.

The editable proposed name uses the first available suffix in the original
name family: `_copy`, `_copy_1`, `_copy_2`, and so on. ELETTRA checks all list
pages and uses the suffix for the interface language.

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

Efficiency **Min** and **Max** identify the blocks with the lowest and highest
average bus-side consumption in kWh/km. For a group with one block, the summary
shows that block’s value.

Use **Representative bus / Fleet** to switch between the whole fleet and the
per-bus results of a group sharing the same bus model and battery size. In the
fleet scope, the group table shows the number of physical buses, annual distance
per bus and distance-weighted consumption for each configuration. Vehicle blocks
retain their feasibility assignments. The current assessment uses 94% charging
efficiency to convert bus-side DC energy to purchased grid electricity.

### Costs

The Costs view shows a compact electric/diesel TCO row, a cumulative discounted-cost chart with break-even,
and detailed investment and operating tables. The **Total equivalent annual cost**
bars combine energy, maintenance and annualized investment. The purple
segment shows purchases and replacements, net of the residual value at the end
of the analysis period, discounted and converted to an equivalent annual
amount. The cumulative chart on the right shows when costs and the final
residual-value credit occur. Dividing a bar total by the annual distance for
the same scope gives the TCO in CHF/km.

Bus and battery investment follows the physical buses in scope. Shared
charging infrastructure counts once for the fleet, with an equal share per
physical bus. The electric and diesel designs use the same mileage, analysis
horizon and discount rate. The comparison excludes drivers and diesel refuelling
infrastructure. Break-even is the first year after which discounted electric
costs stay below diesel costs through the selected horizon. The result flags a
crossing due only to the final residual value.

Open **Edit economic assumptions** below the charts to change electricity price
(CHF/kWh of purchased grid electricity), diesel price (CHF/l), diesel consumption
(l/km), electric and diesel bus maintenance (CHF/km), and annual mileage
(km per bus) for each battery group. **Additional economic parameters** contains
charging infrastructure maintenance, analysis horizon and component lifetimes
(years), discount rate (%), and diesel purchase price (CHF/bus).
**Calculation method and boundaries** explains how TCO treats those inputs and
the residual values. Changes save automatically. Costs and Emissions share the
mileage and physical assumptions relevant to both views, while the linked
technical design and simulated block results retain their original inputs.

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

Select a named vehicle block to see its original simulated annual energy,
distance and average consumption, followed by its temperature charts and
expandable scenario, battery and critical-condition details. The
specific-consumption chart shows kWh/km. Use **kWh/year** or **kWh/day** on
the energy-contribution chart to switch between the cluster’s weighted annual
contribution and the consumption of one representative day. In the eight-cluster
guide example, the block uses 245 kWh/day at −4 °C. That cluster represents 40
days, so its point estimate contributes 9,800 kWh/year. Its daily Q05–Q95 range
is 221.4–268.4 kWh/day. The chart uses the underlying values to show a weighted
range of 8,857–10,735 kWh/year.

For each temperature scenario, ELETTRA draws sampled consumption independently
for each trip, including trips across different blocks, and sums the trips in
scope before taking the quantiles. Q50 is the median and Q05–Q95 is the central
90% of the modelled consumption for that representative day. In kWh/km, the
sampled total is divided by the corresponding distance. In kWh/year, the same
scenario quantiles scale by the cluster’s day count. The weighted range applies
to that scenario’s contribution. The annual total is presented as a point
estimate, and scenarios without quantiles still show their point estimates.

Historical analyses can use a legacy layout with Costs and Emissions on
individual block tabs. Historical block cost reports can allocate shared
infrastructure by annual DC energy. An older analysis with aggregate-only
results may show only General.

---

## Export

**Download all results (JSON)** appears in General, next to the close action.
The export contains General and a separate entry for every available vehicle
block. It retains the frozen configuration, source feasibility evaluation,
recorded GTFS and weather references, and the saved scenario energy and
distance, uncertainty and forecast identifiers where available. The separate
HVAC download provides the complete HVAC reproduction inputs.

For analyses with the current fleet investment snapshot, the file uses JSON
schema 4 and includes fleet totals, representative groups and the effective
economic assumptions. Simulated technical activity is kept separate from edited
annual mileage. Environmental results identify their scope and availability;
previous responses retained during an update are labelled separately. Use the
group’s fleet contribution to add group values to a fleet total and the
representative-bus entry to read values per bus. Vehicle blocks point to their
group for environmental results. Historical analyses without the investment
snapshot retain schema 3.

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

---

> Reference versions: Frontend v1.4.4-rc.4 · Backend v1.9.0-rc.2
>
> Last updated: 2026-11-25

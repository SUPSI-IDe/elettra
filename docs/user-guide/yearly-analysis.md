# Yearly Analysis

> Last updated: 2026-11-09
> Interface baseline: Frontend v0.10.0

A yearly analysis keeps one verified bus, battery, and charging design fixed and
applies it to representative temperature scenarios. It reports common fleet
configuration in **General** and annual operation separately for every available
vehicle block.

It does not resize the battery, redesign charging infrastructure, or repeat the
technical feasibility decision.

---

## Create a yearly analysis

Open **Simulations → Yearly analyses** and select **New**.

1. Enter a descriptive analysis name.
2. Select an eligible, completed feasibility evaluation.
3. Review the inherited vehicle blocks, optimization mode, sizing temperature,
   selected packs, and capacity.
4. Set the average passenger occupancy for the annual predictions.
5. Review the temperature scenarios, annual occurrences, and weather-reference
   location.
6. Confirm and start the analysis.

Each weather scenario is applied to every selected vehicle block. Progress is
shown while the predictions run, and the result opens when the analysis
finishes.

---

## Temperature scenarios

Temperature scenarios are loaded from the weather-clustering data associated
with the selected evaluation's location. The form shows:

- representative daily average temperature for the operating window;
- occurrences in days per year;
- the total occurrence count;
- the weather-reference depot/location.

Each scenario produces consumption predictions for the selected fixed design.
The annual totals weight scenario energy by its occurrence. Q05–Q95 ranges show
model uncertainty around the scenario prediction; they do not resize the
battery or replace the earlier technical verdict.

If occurrences do not cover the intended year, the form reports the mismatch.
Review that boundary before interpreting annual values.

---

## Preserved provenance

The yearly analysis inherits the feasibility evaluation's:

- bus model and physical vehicle count;
- vehicle blocks;
- selected battery configuration;
- charging infrastructure and schedule context;
- optimization and operating assumptions;
- recorded GTFS timetable edition.

The result preserves this snapshot instead of silently following later changes
to a vehicle block. The compact GTFS disclosure and **View configuration data**
make the saved inputs and provenance available for review.

---

## Result scopes

### General

General shows information shared by the complete analysis:

- inherited bus and operating assumptions;
- common battery configuration;
- shared charging locations and power;
- physical vehicle count;
- fleet-level bus, battery, and charging-infrastructure investment context;
- aggregate annual indicators where available.

Bus and battery CAPEX is multiplied by the physical vehicle count inherited
from feasibility. Shared charging infrastructure is counted once for the fleet.

### Vehicle block

Select a named vehicle block to open **Efficiency**, **Costs**, and
**Emissions**. A compact summary below the scope selector reports yearly energy,
simulated distance, and average efficiency for that block.

Historical analyses that contain only aggregate data show General only. ELETTRA
does not invent per-block values by splitting an aggregate total.

---

## Efficiency

The Efficiency tab includes:

- specific consumption by temperature with its uncertainty band;
- annual energy contribution by temperature scenario;
- a toggle between yearly and daily energy units where available;
- expandable detailed scenario, battery, critical-condition, and annual
  uncertainty values.

Cold scenarios can have high consumption but contribute according to their
recorded annual occurrence. Interpret both the scenario intensity and its
weight.

---

## Costs

Vehicle-block operating costs use that block's own annual energy and distance.
Capital scope is handled separately:

- bus and battery CAPEX belongs in full to the physical vehicles assigned to
  that vehicle block;
- shared charging infrastructure remains a single fleet investment;
- only the shared infrastructure cost is allocated to a vehicle block, normally
  by its share of annual DC energy shown in Emissions;
- annual distance is used as a fallback allocation basis only when complete DC
  energy is unavailable.

The cost view can include electric and diesel OPEX, vehicle-block CAPEX,
replacement and annualization assumptions, cumulative discounted cost, and
break-even indicators. Check the displayed allocation note before comparing
vehicle blocks.

Changing interactive economic assumptions affects the estimate shown in the
browser; it does not change the saved technical feasibility design.

---

## Emissions and environmental scope

The Emissions tab uses the vehicle block's annual energy boundary and presents
CO₂-equivalent, NOₓ as NO₂-equivalent, and PM10 indicators where the required
data are complete.

The current model is explicitly partial rather than a complete absolute vehicle
LCA. It covers the operational electric-side result and its energy supply chain,
with lifecycle phases shown as a transparent allocation, plus diesel-heater
well-to-wheel impacts when applicable.

For VECTO analyses, saved diesel-heater fuel energy is converted with the
versioned Swiss average fuel profile. Exhaust contributions appear in the
direct phase and fuel production/delivery in the energy-chain phase. The PM10
interval is the observed range of two valid tests, not a confidence interval.

The interface distinguishes:

- **data completeness** — required consumption and factors are available;
- **scope completeness** — the model covers the desired environmental boundary.

If required diesel-heater consumption is missing, comparison reductions are
omitted rather than treating the missing contribution as zero. Use the
methodology-and-sources control to review factor versions, conventions, source
links, and limitations.

---

## Export

**Download all results (JSON)** is available in General. The export contains the
General result and a separate entry for every available vehicle block, including
provenance, assumptions, scope, and allocation metadata where available.

---

## Next steps

- [Comparison and Export](comparison-and-export.md) — Compare two saved yearly analyses
- [Feasibility Results](simulation-results.md) — Return to the fixed technical design

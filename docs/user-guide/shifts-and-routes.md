# Vehicle Blocks and Routes

> Last updated: 2026-11-09
> Interface baseline: Frontend v0.11.0-rc.1

A vehicle block is the ordered service assigned to one bus over a day. It joins
scheduled GTFS trips to the movements required before, between, and after them.
Vehicle blocks are the service inputs selected by feasibility evaluations.

---

## Create a vehicle block

Open **Fleet → Vehicle blocks** and select **Add vehicle block**.

### 1. Enter the basic information

Provide a recognizable name and choose the candidate bus model. The bus model
supplies the battery limits, mass, capacity, charging power, and cost inputs used
later by the evaluation.

### 2. Select the GTFS timetable edition

A new vehicle block initially selects the newest available GTFS edition. Choose
the edition before filtering by line and day.

Changing the edition after adding trips requires confirmation because the
selected trips are cleared. This prevents trips from different timetable
editions from being combined silently. The saved edition becomes part of the
vehicle block's provenance.

### 3. Filter and add scheduled trips

Select a line and day, then add the required departures in operating order. The
available list contains only trips from the selected GTFS edition. **Add all**
adds the trips currently presented by the filters; individual trips can also be
added or removed.

### 4. Define the boundaries

Set the start location and time, then the return location and time. These
locations can include operational custom stops such as depots. ELETTRA includes
the connecting auxiliary journeys required to represent the complete vehicle
block.

Auxiliary or deadhead movements consume energy even without passengers.
Omitting them can make the technical assessment too optimistic.

### 5. Review and save

Use the ordered-trip table and timeline to check:

- departure and arrival sequence;
- gaps and overlaps;
- start and return connections;
- total operating interval;
- distance and route plausibility.

Save only after the displayed service represents the complete daily duty.

---

## Recorded GTFS provenance

The vehicle-block detail and visualization surfaces show the recorded timetable
context. That provenance is propagated to new feasibility evaluations and their
yearly analyses.

Historical records may lack a complete snapshot or may contain trips from more
than one edition. ELETTRA can display those records, but mixed-edition vehicle
blocks are excluded from new feasibility evaluations. Rebuild them against one
current edition when they must be used in new work.

---

## Find, edit, duplicate, and delete

The list shows the name, bus model, start/end time, distance, and route summary.
It supports sorting, pagination, and these actions:

- **Search** queries the complete server-side result set before pagination, so
  matching blocks are not limited to the visible page.
- **Edit** opens one selected vehicle block and preserves its recorded edition
  until the user explicitly changes it.
- **Duplicate** accepts one or more selected blocks and copies their trips, bus
  model, and recorded GTFS edition into new editable records.
- **Delete** removes the selected records after confirmation.
- **Visualize/Details** shows the ordered movements, depot connections, service
  information, and timeline.

Review dependent evaluations and analyses before changing or deleting a block
that has already been used.

---

## Relationship to feasibility

When a feasibility evaluation is created, one GTFS edition is selected first.
Only compatible vehicle blocks are then available. Multiple blocks can share an
evaluation and compete for common charging resources; their bus-model inputs
must be interpreted together with the evaluation-level model selection and
battery-sizing mode.

---

## Next steps

- [Feasibility Evaluation](feasibility-evaluation.md) — Select compatible blocks and configure the technical gate
- [Fleet Management](fleet-management.md) — Review bus models and custom locations

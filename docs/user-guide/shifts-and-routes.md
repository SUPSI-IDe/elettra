# Vehicle Blocks and Routes

> Last updated: 2026-11-20
> Interface baseline: Frontend v1.2.0-rc.4

A vehicle block is the ordered service assigned to one bus over a day. It joins
scheduled GTFS trips to the movements required before, between, and after them.
Vehicle blocks are the service inputs selected by feasibility evaluations.

---

## Create a vehicle block

Open **Fleet → Vehicle blocks** and select **Add vehicle block**.

### 1. Set up the block

Enter a recognizable name and choose the candidate bus model and GTFS timetable
edition. New blocks initially select the latest edition. Changing edition after
adding trips requires confirmation and clears the selection.

Set departure and return depots and times in this first step. A return earlier
than departure means the following day. GTFS times beyond 24:00 retain their
service-day offset. Allow time for the connecting auxiliary journeys: depot
connections are regenerated when saving and consume energy without passengers.

### 2. Compose the day

Filter by line and day and add compatible scheduled departures in operating
order. Search by stop or time to narrow the list. **Add all** adds the currently
filtered trips; individual trips can also be added or removed. **Undo last
change** restores the preceding selection, including after **Remove all**.

Step buttons let you revisit settings without losing the selected trips.
Editing a saved block opens its existing programme directly, without duplicating
the generated depot connections.

### 3. Review and save

Open **Review and save** to inspect the ordered itinerary, depot times and
timeline. Check connections, gaps, overlaps and the complete daily interval.
ELETTRA checks time boundaries and continuity before review; correct reported
problems before saving. The saved GTFS edition forms part of the provenance.

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

## Visualize a saved vehicle block

Choose **Visualize/Details** from the vehicle-block list to open the complete
saved duty. The information table identifies the vehicle block, bus model,
start and return locations and times, daily distance, and recorded GTFS
timetable.

The visualization offers two views:

- **Space-time** is selected by default. Time runs horizontally and the ordered
  stops run vertically. Each scheduled trip is plotted with its stop times;
  dashed segments identify non-revenue movements. Vehicle blocks that serve
  more than one line use a single diagram with a shared time axis and stop
  axis. A single-line duty uses blue for all scheduled trips. In a multi-line
  duty, each line has a consistent colour, identified in the legend; shared
  stops occupy one row and each branch retains its exclusive stops. Hover a
  trip or stop time to see its line. Route variants and terminal loops retain
  their actual stop sequence. Stop rows are schematic, not a distance scale.
  Short diagrams expand to fill the available area. Longer duties keep their
  readable time and stop spacing and can be scrolled on desktop and mobile.
- **Map** presents one movement at a time. **First**, **Previous**, **Next**, and
  **Last** move through the complete duty, including the initial and final depot
  movements. The side list shows every available stop and time for the selected
  movement. Opening this view loads the configured CARTO basemap tiles.

Some historical duties contain a discontinuity: one recorded movement ends at
one stop and the following movement starts elsewhere without an intermediate
transfer. ELETTRA does not invent the missing path. It shows separate segments
and reports the affected locations and times next to the view selector. Review
the source data before using such a duty operationally.

---

## Find, edit, duplicate, and delete

The list shows the name, bus model, start/end time, distance, and route summary.
It supports sorting, pagination, and these actions:

- **Search** queries the complete server-side result set before pagination, so
  matching blocks are not limited to the visible page.
- Each row ends with **Visualize**, **Edit**, **Duplicate**, and **Delete** icons,
  with an action label available on hover and keyboard focus.
- **Edit** opens that row's vehicle block and preserves its recorded edition
  until the user explicitly changes it.
- **Duplicate** copies that row's trips, bus model, and recorded GTFS edition
  into a new editable record.
- The row **Delete** icon removes one block after confirmation. Select multiple
  checkboxes and use the top **Delete** button to remove several blocks together.
- **Visualize/Details** shows general information, the default space-time
  diagram, and the trip-by-trip map with depot connections.

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

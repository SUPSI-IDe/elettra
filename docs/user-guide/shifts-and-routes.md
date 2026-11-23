# Vehicle Blocks and Routes

> Last updated: 2026-11-23
> Interface baseline: Frontend v1.2.0

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

Set starting and final custom stops and their times in this first step. An
arrival earlier than departure means the following day. GTFS times beyond
24:00 retain their service-day offset. Allow time for connecting auxiliary
journeys: connections to custom stops consume energy without passengers.
Saving reuses unchanged connections and creates those affected by changes.

### 2. Compose the day

Filter by line and day and add compatible scheduled departures in operating
order. Search by stop or time to narrow the list. **Add all** adds the currently
filtered trips; individual trips can also be added or removed. **Undo last
change** restores the preceding selection, including after **Remove all**.

Step buttons let you revisit settings without losing the selected trips.
Editing a saved block opens the whole existing programme directly, without
duplicating generated connections. The stay controls described below apply to
creation; editing uses the dedicated screen described under **Edit a block**.

For an arrival at a custom stop followed by another departure in the same block,
choose the preceding trip under **After this trip** and select **Add
intermediate stay**. Select the custom stop and set arrival and departure
times. A custom stop can be a depot, a charging location or a hub. Select the
day next to each time when the stay crosses midnight. The block remains one
vehicle block, with multiple service periods.

Use the **Period** buttons to choose which period to edit. The selected-trip
table and available departures follow that period's location and time limits.
Each period needs at least one scheduled trip. **Remove stay** merges adjacent
periods; their trips must then connect directly. **Undo last change** also
restores removed stays and their settings. Editing an existing block restores
its intermediate stays at custom stops automatically in a separate editing screen.

Changing a stay recalculates the transfers to and from the custom stop. Widening
the stay removes incompatible scheduled trips and lists them below the stay;
their GTFS times remain fixed. Shortening it makes compatible trips available
in the left-hand list, including trips before the first selected trip of the
next period. Add them individually or with **Add all compatible trips**.
**Undo last change** restores the stay and its excluded trips together.
The available-trip list also includes alternatives to the selected programme.
When insertion requires replacing selected trips, **Replace N** shows their
number and times before you choose it. The replacement keeps GTFS times fixed
and can be undone. **Add all** adds compatible trips without replacing selected
trips; alternatives requiring replacement must be chosen individually.
Requests beyond the feasible interval are limited automatically, with an
explanation, keeping a positive stay and at least one trip in each period.
If transfer calculation fails, the selection is retained and **Retry** repeats
the calculation before review or saving.

### 3. Review and save

Open **Review and save** to inspect the ordered itinerary, custom stops, times and
timeline. Check connections, gaps, overlaps and the complete daily interval.
Intermediate connections and stays appear in the itinerary and timeline.
ELETTRA checks time boundaries and continuity before review; correct reported
problems before saving. The saved GTFS edition forms part of the provenance.

---

## Edit a block

Choose **Edit** on the block's row. Editing opens **Build the day** with every
selected trip in one chronological list. Available trips can be inserted into compatible gaps without choosing a
service period or replacing other trips. This includes work before and after
each intermediate stay. Add or remove trips as needed; **Undo last change**
restores the previous programme.

Return to **Set up** to change the name, bus model, starting/final custom stops
or times. Changing the GTFS edition still requires reviewing the trip selection.

Select **Manage intermediate stays** (or **Add intermediate stay**) to open the
conditional **Intermediate stays** step. Enter the custom stop, arrival and
departure; no preceding-trip selection is needed. Set the explicit day for
stays crossing midnight. The preview keeps existing trips first, then fills
changed service windows with connected GTFS trips from the lines already in
the block and the selected service day. Unaffected service windows stay intact.

Select the service day in **Build the day** before adjusting the stays.
The preview updates once the arrival and departure fields contain complete
times, without requiring a visit to **Review & save**. For example, changing
departure from a custom stop from 16:00 to 15:00 previews the compatible trips
that can fit into the newly available window after the transfer from the
custom stop. The available timetable and connections determine which trips
can be added.

The preview lists added and excluded trips and the complete resulting programme.
It never changes the entered stay times or GTFS times. Impossible intervals and
routing failures disable **Apply to block** and explain the problem. **Retry**
repeats a failed calculation. **Cancel** discards the preview.

**Apply to block** updates the whole working programme in one action.
**Undo last change** restores its previous trips and stays. Review and save
persists the result; previewing and applying alone do not write to the database.

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
  into a new editable record, including intermediate stays. The proposed name
  uses `_copy_1`, `_copy_2`, and so on. Copying a copy continues the original
  name family's numbering across all list pages instead of repeating `_copy`.
  The suffix follows the interface language and the name remains editable.
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

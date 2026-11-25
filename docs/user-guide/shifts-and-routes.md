# Vehicle Blocks and Routes

> Last updated: 2026-11-25
> Interface baseline: Frontend v1.4.4-rc.2

A vehicle block is the ordered service assigned to one bus over a day. It joins
scheduled GTFS trips to the movements required before, between, and after them.
Vehicle blocks are the service inputs selected by feasibility evaluations.

---

## Create a vehicle block

Open **Fleet → Vehicle blocks** and select **Add vehicle block**.

### 1. Set up the block

Select the service day, GTFS timetable edition, starting depot and depot
departure time. The newest available timetable is selected initially. Use
service-day times in HH:MM. For example, 25:10 is 01:10 the next day.

### 2. Compose the day

In **Next activity**, select a line and check where and when the bus is
available. After a scheduled trip, the planner initially shows departures from
the current terminus. Select **Include trips that require driving empty** to
see departures from other stops. Use the timetable preview to compare stop
sequences and times for different variants. A trip marked **Direct connection**
can be added in one click. For a trip that requires a transfer, review the
suggested times, adjust them as needed and select **Add activity**. Published
GTFS departure times are fixed.

Select **Add depot stay** to park at a custom stop and enter its arrival and
departure times. The programme can include several stays and subsequent trips.
Check the estimated driving time when an empty transfer is needed. Every
confirmed activity updates the location and time used to suggest the next one.

### 3. Review and save

Add at least one service trip and use **Plan return to depot** to end the
programme at the starting depot. Check **Your working day**, resolve any
conflicts, and enter the name and bus model in **Review & save**. Select
**Save vehicle block**. The selected service day and GTFS edition are saved
with the programme.

---

## Edit a block

Choose **Edit** on the block’s row. A block created in the sequential planner
reopens its saved programme. Edit an activity in place, choose **Insert
before** to add one before an existing activity, or remove an activity. Use
**Undo last change** to restore the preceding programme, then save.

Older blocks open in their original editor. **Build the day** lists the
existing trips in chronological order so you can add or remove compatible
trips. Use **Manage intermediate stays** to adjust a stay, review the added
and excluded trips, and select **Apply to block**. Finish with **Review &
save** to save the updated block.

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
  dashed segments and their legend entry identify non-revenue movements.
  Vehicle blocks that serve more than one line use a single diagram with a shared time axis and stop
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
  into a new editable record, including intermediate stays. For a sequential
  block, it also copies the service day and complete programme. The proposed name
  uses the first available suffix across all list pages: `_copy`, `_copy_1`,
  `_copy_2`, and so on. Copying a copy uses the original name family.
  The suffix follows the interface language and the name remains editable.
- The row **Delete** icon removes one block after confirmation. Select multiple
  checkboxes and use the top **Delete** button to remove several blocks together.
- **Visualize vehicle block** shows general information, the default space-time
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

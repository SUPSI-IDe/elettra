# Vehicle Blocks and Routes

> Last updated: 2026-11-25
> Interface baseline: Frontend v1.4.4-rc.3

A vehicle block is the ordered service assigned to one bus over a day. It joins
scheduled GTFS trips to the movements required before, between, and after them.
Vehicle blocks are the service inputs selected by feasibility evaluations.

---

## Create a vehicle block

Open **Fleet → Vehicle blocks** and choose **Add** to open the sequential
planner.

### 1. Set up the block

Select the service day, GTFS timetable edition, starting depot and depot
departure time. The newest available timetable is selected initially. Choose
the day and edition before adding the first activity, since both are locked
while the programme contains activities. Use service-day times in HH:MM.
For example, enter 25:10 for 01:10 the next day. The programme displays this
as 01:10 (+1).

### 2. Compose the day

In **Next activity**, select a line and check where and when the bus is
available. After a scheduled trip, the planner initially shows departures from
the current terminus, including platforms grouped in the same GTFS station.
Select **Include trips that require driving empty** to see departures from
other stops. Recheck this filter after changing line or advancing to another
terminus. Choose **Profile** to compare the route map, stop times and
elevation profile when available. This preview leaves the programme unchanged.
A trip marked **Direct connection** can be added in one click. For a trip
that requires a transfer, review the suggested times, adjust them as needed
and select **Add activity**. Published GTFS times are fixed.

Select **Add depot stay** to park at a custom stop and enter its arrival and
departure times. The programme can include several stays and subsequent trips.
Every confirmed activity updates the location and time used to suggest the
next one. A warning can mean that the estimated driving time exceeds the
time available or that the estimate is unavailable. Resolve the timing before
using the block. Conflicts such as arriving after the published departure
prevent confirmation or saving.

### 3. Review and save

Add at least one service trip and use **Plan return to depot** to end the
programme at the starting depot. Check the return times and select **Add
activity** to confirm the return. Check **Your working day**, resolve any
conflicts, and enter the name and bus model in **Review & save**. Select
**Save vehicle block**. The selected service day and GTFS edition are saved
with the programme.

---

## Edit a block

Choose **Edit** on the block’s row. A block created in the sequential planner
reopens its saved programme. Edit a transfer, stay or return in place,
choose **Insert before** to add an activity before an existing one, or remove
an activity. To add a trip after planning the return, insert it before the
return and check the resulting connections. Use **Undo last change** to
restore the preceding programme, then select **Update vehicle block**.

Older blocks open in their original editor. **Build the day** lists the
existing trips in chronological order so you can add or remove compatible
trips. Select a service day under the trip filters before using **Manage
intermediate stays**. Changing a stay can add compatible trips or exclude
existing ones. Review both lists in the preview and choose **Apply to block**
or **Cancel**. The preview keeps the current programme if routing fails.
Correct invalid times or use **Retry** after a loading error. Finish with
**Review & save** to save the updated block.

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

Choose **Visualize vehicle block** from the list to open the saved duty. The information table identifies the vehicle block, bus model,
start and return locations and times, daily distance, and recorded GTFS
timetable.

The visualization offers two views:

- **Space-time** is selected by default. Time runs horizontally and the ordered
  stops run vertically. The diagram plots each scheduled trip using its stop
  times. Dashed segments and their legend entry identify non-revenue movements.
  Vehicle blocks that serve more than one line use one diagram with shared
  axes. A single-line duty uses blue for all scheduled trips. In a multi-line
  duty, each line has a consistent colour, identified in the legend; shared
  stops occupy one row and each branch retains its exclusive stops. Hover a
  trip or stop time to see its line. Route variants and terminal loops retain
  their actual stop sequence. Stop rows show the schematic order of stops.
  Short diagrams expand to fill the available area. Longer duties keep their
  readable time and stop spacing and can be scrolled on desktop and mobile.
- **Map** presents one movement at a time. **First**, **Previous**, **Next**, and
  **Last** move through the complete duty, including the initial and final depot
  movements. The side list shows every available stop and time for the selected
  movement. Opening this view loads the configured CARTO basemap tiles.

Some historical duties contain a discontinuity: one recorded movement ends at
one stop and the following movement starts elsewhere without an intermediate
transfer. The space-time view shows separate segments. Hover over the
warning in the legend to find the affected locations and times. Review the
source data before using the duty operationally.

---

## Find, edit, duplicate, and delete

The list shows the name, bus model, start/end time, distance, and route summary.
It supports sorting, pagination, and these actions:

- **Search** queries the complete server-side result set before pagination, so
  matching blocks are not limited to the visible page.
- Each row ends with **Visualize**, **Edit**, **Duplicate**, and **Delete** icons,
  with an action label available on hover and keyboard focus.
- **Edit** opens the editor for the selected row with its recorded timetable.
- **Duplicate** saves a new copy directly to the list. For a sequential
  block it copies the bus model, GTFS edition, service day and complete
  programme, including stays and transfers. An older block is copied from its
  saved sequence of movements and bus assignment. The new name uses the first
  available suffix across all pages: `_copy`, `_copy_1`, `_copy_2`, and so on.
  Copying a copy uses the original name family. The suffix follows the interface
  language. Use **Edit** on the copy to change its name or programme.
- The row **Delete** icon removes one block after confirmation. Select multiple
  checkboxes and use the top **Delete** button for a batch. A block referenced
  by a protected evaluation can remain in the list. Check the deletion message
  for blocked names and which records were removed.

Review dependent evaluations and analyses before changing or deleting a block
that has already been used.

---

## Relationship to feasibility

When creating a feasibility evaluation, choose one GTFS edition and a
service day. The list then shows compatible blocks for that day. Multiple
blocks can share an evaluation and compete for common charging resources.
Check the evaluation-level model selection and battery-sizing mode to see
which vehicle and battery assumptions apply.

---

## Next steps

- [Feasibility Evaluation](feasibility-evaluation.md) — Select compatible blocks and configure the technical gate
- [Fleet Management](fleet-management.md) — Review bus models and custom locations

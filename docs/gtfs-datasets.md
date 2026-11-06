# Select a GTFS timetable

New vehicle blocks default to the latest available year and, within it, the
latest file. Choose **GTFS timetable** before choosing the route. The displayed
validity describes the loaded calendars; trip selection still uses weekdays.

Changing the timetable while composing an unsaved block asks for confirmation
before clearing its trips. The name and vehicle settings stay in place.
Responses from earlier selections are discarded.

Editing and duplicating an existing block retain its original timetable.
Create a new block to work with another year or file. Blocks containing no GTFS
trips and historical blocks containing multiple editions are labeled explicitly.

The block list, details and analysis selection show the year, file date and
calendar validity. Before selecting blocks for a new feasibility evaluation,
choose one GTFS version (year and file date). The latest version represented in
the user's blocks is selected initially. Search and select-all operate only on
that version; changing it clears selected blocks and charging-stop candidates.
Blocks without GTFS trips have a separate option. Historical mixed blocks are
excluded with an explicit explanation. A copied evaluation opens its original
version; a mixed historical evaluation cannot be copied into a new evaluation.

The server also rejects new feasibility and annual analyses spanning editions.
Feasibility and annual results retain metadata for each block, including older
mixed analyses. New analyses use server-recorded metadata. Historical results
label their fallback information as derived from the current block.

Regression coverage: `tests/gtfs-datasets.test.mjs` and
`tests/e2e/gtfs-datasets.spec.js`, and `tests/e2e/gtfs-analysis-scope.spec.js`
(desktop and mobile).

## Compact presentation

Result headers show the GTFS version in a collapsed, keyboard-accessible
Details disclosure. A shared version is shown once; mixed historical editions
retain the per-block breakdown. Current-block fallback data is identified even
while collapsed, so it cannot be mistaken for execution metadata. Validity and
full provenance remain available on expansion. Vehicle-block lists keep only
year and file date; analysis selection omits repeated per-row GTFS metadata
because the version and validity already appear above the filtered table.
Creation, editing and block details retain the full timetable information.

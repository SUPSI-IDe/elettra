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
calendar validity. Feasibility and annual results display this information for
each block, allowing different years in the same analysis. New analyses use
server-recorded metadata. Historical results label their fallback information
as derived from the current block.

Regression coverage: `tests/gtfs-datasets.test.mjs` and
`tests/e2e/gtfs-datasets.spec.js` (desktop and mobile).

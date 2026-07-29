# Bug: Buses table — Name text overlaps Vehicle-category column

Status: needs-triage
Type: bug

Observed live at 1440×900 (screenshot `shots/buses.png` in the session scratchpad): long model names (`AA_NF_fleet_014e4f3e` etc.) render *underneath/through* the "Articulated electric bus — 18 m" text of the adjacent Vehicle-category column — actual glyph overlap, not just tight spacing.

Layout is technically outside this audit's scope (presentation-only), but it is a visible rendering defect on a primary page, so it's recorded here for triage. Likely a fixed/percentage column width + missing overflow handling on the Name cell in the buses table. Also noted on the same page: Cost and Lifetime columns render empty for every row (data or mapping issue — verify whether expected for the test dataset).

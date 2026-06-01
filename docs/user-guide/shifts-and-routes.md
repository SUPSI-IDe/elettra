# Shifts and Routes

> Last updated: 2026-06-01

Shifts are the central operational unit in ELETTRA — they define what a bus does in a day and are the input for feasibility evaluations.

---

## What is a shift?

A shift represents a complete daily work assignment for a single bus:
- Starts at a depot
- Covers one or more trips (revenue and deadhead)
- Ends at a depot (same or different)

Each shift has a name, is linked to a bus (and thus a bus model), and contains an ordered structure of trips.

---

## Creating a shift

Navigate to **Fleet > Shifts** and click the create button.

### Key fields

| Field | Description |
|-------|-------------|
| Name | Descriptive identifier (e.g., "Line 1 Morning") |
| Bus | The assigned bus (determines bus model for simulation) |
| Start depot | Where the bus begins the shift |
| End depot | Where the bus ends the shift |
| Structure | Ordered list of trips (GTFS + auxiliary) |

---

## GTFS trip binding

Shifts are built by binding GTFS trips:

1. Select a **GTFS route** (e.g., Line 1 Lugano)
2. Choose a **variant** (stop pattern)
3. Pick specific **trips** (scheduled departures)
4. The system retrieves stops, distances, and elevation profiles

### Auxiliary (deadhead) trips

Non-revenue trips are added for:
- Depot → first stop
- Last stop → depot
- Transfer between routes

These are created as auxiliary trips and contribute to energy consumption.

---

## Shift timeline

The shift visualization page shows:
- A timeline of all trips in sequence
- Trip durations and dwell times
- Start/end times
- Depot links

This helps verify that the shift structure is realistic and complete.

---

## Distance computation

ELETTRA computes two distance metrics for each shift:

| Metric | Description |
|--------|-------------|
| **Daily distance** | Total km for one execution of the shift (all trips including deadhead) |
| **Yearly distance** | Daily distance × operating days per year (based on recurrence) |

Distances are computed from GTFS stop sequences and OSRM driving distance when available.

---

## Recurrence

Shifts have a recurrence setting that determines how many days per year they operate:
- Daily
- Weekday-only
- Custom (specific day count)

This affects yearly cost and emissions calculations.

---

## Shift list

The shift list page supports:
- Sorting by name, bus model, daily distance, or yearly distance
- Filtering by name
- Edit and delete actions

---

## Relationship to simulations

When creating a feasibility evaluation, you select one or more shifts. The simulation:
1. Reads the shift structure (trips, stops, distances)
2. Uses the assigned bus model specifications
3. Applies your chosen operational parameters (temperature, occupancy, etc.)
4. Determines feasibility and optimal battery sizing

---

## Next steps

- [Feasibility Evaluation](feasibility-evaluation.md) — Use your shifts to run a simulation
- [Fleet Management](fleet-management.md) — Set up bus models and depots first

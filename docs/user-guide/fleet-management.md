# Fleet Management

> Last updated: 2026-11-09
> Interface baseline: Frontend v0.11.0

The Fleet area contains reusable inputs for analyses: **Bus Models**, **Custom
Stops**, and **Vehicle blocks**. The current interface works with bus models;
it does not require a separate user-facing record for every physical bus.

---

## Bus models

Open **Fleet → Bus Models** and select **Add Bus Model**. A bus model defines
the technical and economic limits used when ELETTRA sizes a battery or evaluates
a fixed configuration.

### Vehicle category and defaults

Choose one of the supported vehicle categories:

- midi electric bus — 9 m;
- standard electric bus — 13 m;
- articulated electric bus — 18 m.

The category supplies representative starting values and an LCA reference. It
does not select a commercial model or manufacturer. Review and replace the
defaults when project-specific data are available.

### Required input groups

| Group | Inputs and interpretation |
|---|---|
| General | Name, vehicle category, optional description |
| Vehicle | Length, vehicle cost without batteries, passenger capacity, empty mass without battery packs or passengers, bus lifetime |
| Battery | Minimum and maximum pack count, capacity per pack, cost per pack, mass per pack, battery lifetime |
| Charging | Maximum charging power accepted by the vehicle |

Minimum and maximum pack counts define the configurations available to the
optimizer. Pack capacity and the configured usable SOC determine available
energy; pack mass also changes the vehicle mass used by the prediction model.

### List actions

The list supports search, pagination, details, edit, and delete. **Details**
opens a read-only dialog. Before editing or deleting a model, check vehicle
blocks and analyses that already depend on it; saved results retain their own
inputs, while future evaluations use the current record.

---

## Custom stops

Custom stops represent operational locations not supplied by the selected GTFS
timetable, for example:

- depots;
- candidate or existing charging locations;
- operational hubs.

Open **Fleet → Custom Stops**, choose **Add Custom Stop**, and provide a name,
type, address, city, and map location. Notes are optional. Use **Search on map**
to locate the address, or position the crosshair by moving the map. Either
method updates the read-only coordinates used by the saved record.

The list supports search, details, edit, and delete. The edit flow also supports
older custom stops whose stored data predate the current form; recovered fields
remain editable and a current stop type can be assigned before saving.

Use names that distinguish depots, chargers, and hubs clearly. A location can
become part of vehicle-block boundaries and charging candidates, so review
dependent work before changing or deleting it.

---

## How fleet records connect

```text
Bus model ───────────────┐
                        ├─ Vehicle block ─ Feasibility evaluation
GTFS timetable + trips ─┤                         │
                        │                         └─ Yearly analysis
Custom operational stops┘
```

A vehicle block selects one bus model, one GTFS timetable edition, scheduled
trips, and start/return locations. A feasibility evaluation may include several
compatible vehicle blocks and may override their bus-model choice with one
stable evaluation-level selection.

---

## Next steps

- [Vehicle Blocks and Routes](shifts-and-routes.md) — Build complete daily duties
- [Feasibility Evaluation](feasibility-evaluation.md) — Evaluate the selected service

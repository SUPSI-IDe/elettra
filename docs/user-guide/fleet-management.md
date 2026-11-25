# Fleet Management

The Fleet area contains reusable inputs for analyses: **Buses**, **Custom
Stops**, and **Vehicle blocks**. The current interface works with bus models;
it does not require a separate user-facing record for every physical bus.

---

## Bus models

Open **Fleet → Buses** and choose **Add** to open **Add Bus Model**. A bus
model defines the technical and economic limits used when ELETTRA sizes a
battery or evaluates a fixed configuration.

### Vehicle length and estimates

Enter the actual vehicle length, from 9 to 13 m or from 17 to 19 m. The VECTO climate
control model has no profile for lengths strictly between 13 and 17 m.
Select the battery chemistry (LFP or NMC). New models start with LFP.
Check the vehicle category assigned from the length, especially when changing
between a standard and an articulated bus.

ELETTRA estimates the vehicle price without batteries by interpolating tender
prices by length, with extrapolation from 18 to 19 m. The estimated price per
battery pack uses its capacity and the reference price in CHF/kWh for the
selected chemistry. Both prices are in CHF excluding VAT. Pack mass is
estimated from its capacity and chemistry and is expressed in kg.

Enter your own values when operator or manufacturer data are available. Once
you enter a price or pack mass manually, changing the length, capacity or
chemistry leaves that override in place. Use **Restore estimate** to resume
automatic estimates for that field. If estimates are unavailable, enter the
values manually before saving.

### Required input groups

| Group | Inputs and interpretation |
|---|---|
| General | Name, optional description |
| Vehicle | Length, vehicle cost without batteries, passenger capacity, empty mass without battery packs or passengers, bus lifetime |
| Battery | Chemistry, minimum and maximum pack count, capacity per pack, cost per pack, mass per pack, battery lifetime |
| Charging | Maximum charging power accepted by the vehicle |

Enter positive whole numbers for the minimum and maximum pack counts. The
minimum can equal the maximum when the bus only accepts one configuration.
The form multiplies these counts by the nominal pack capacity to show the
available range in kWh. It also displays the current pack price divided by
its nominal capacity in CHF/kWh. These figures update
as you edit the model. The feasibility study sets the usable energy from the
state of health and the operating SOC limits. Pack mass also affects the
vehicle mass used to predict consumption.

### List actions

The list supports search, pagination, details, edit, duplicate, and delete.
**Details** opens a read-only dialog. Select multiple rows and use **Delete**
above the table for a batch. Review vehicle blocks and analyses that depend on
the model before editing or deleting it.

---

## Custom stops

Custom stops represent operational locations not supplied by the selected GTFS
timetable, for example:

- depots;
- candidate or existing charging locations;
- operational hubs.

Open **Fleet → Custom Stops** and choose **Add**. Enter a name, choose a
type (Depot, Charging or Hub), and fill in the address and city. Notes are
optional. Use **Search on map** to locate the address, or move the map until
the crosshair marks the location. Check the position and the address that
the lookup returns before saving. If the lookup fails, position the map
manually and fill in the address and city yourself. The map sets the read-only
coordinates.

The list supports search, details, edit, duplicate, and single or batch
delete. **Details** opens a read-only view. Use **Edit** to fill missing
required fields in an older record and assign a current stop type before
saving.

Use names that distinguish depots, chargers, and hubs clearly. Select a
Depot for the starting point of a new vehicle block. Linked Charging and Hub
locations also appear as intermediate stay options. Review dependent blocks
and evaluations before changing or deleting a location.

## Duplicate reusable records

Choose **Duplicate** on a model or custom-stop row to open an editable copy.
The proposed name uses the first available suffix in the original name family,
including when copying a copy. The sequence starts with `Line A_copy`, followed
by `Line A_copy_1`, `Line A_copy_2`, and so on. ELETTRA checks all list pages.
The suffix follows the interface language: `_copy`, `_Kopie`, `_copie` or
`_copia`. The proposed name remains editable.

The same numbering rule applies to feasibility evaluations, yearly analyses
and [vehicle blocks](shifts-and-routes.md#find-edit-duplicate-and-delete).
Duplicating a vehicle block saves the copy directly to the list, where it can
then be edited.

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

---

> Reference versions: Frontend v1.4.4-rc.4 · Backend v1.9.0-rc.2
>
> Last updated: 2026-11-25

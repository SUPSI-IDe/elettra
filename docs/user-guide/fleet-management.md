# Fleet Management

> Last updated: 2026-11-24
> Interface baseline: Frontend v1.4.0

The Fleet area contains reusable inputs for analyses: **Bus Models**, **Custom
Stops**, and **Vehicle blocks**. The current interface works with bus models;
it does not require a separate user-facing record for every physical bus.

---

## Bus models

Open **Fleet → Bus Models** and select **Add Bus Model**. A bus model defines
the technical and economic limits used when ELETTRA sizes a battery or evaluates
a fixed configuration.

### Vehicle length and estimates

Enter the vehicle length from 9 to 13 m or from 17 to 19 m. The VECTO climate
control model has no profile for lengths strictly between 13 and 17 m.
Select the battery chemistry (LFP or NMC).

ELETTRA estimates the vehicle price without batteries by interpolating tender
prices by length, with extrapolation from 18 to 19 m. The estimated price per
battery pack uses its capacity and the reference price in CHF/kWh for the
selected chemistry. Both prices are in CHF excluding VAT. Pack mass is
estimated from its capacity and chemistry and is expressed in kg.

Enter your own values when operator or manufacturer data are available. Use
**Restore estimate** to reapply the current estimate to a field.

### Required input groups

| Group | Inputs and interpretation |
|---|---|
| General | Name, optional description |
| Vehicle | Length, vehicle cost without batteries, passenger capacity, empty mass without battery packs or passengers, bus lifetime |
| Battery | Chemistry, minimum and maximum pack count, capacity per pack, cost per pack, mass per pack, battery lifetime |
| Charging | Maximum charging power accepted by the vehicle |

The form multiplies the minimum and maximum pack counts by the nominal pack
capacity to show the available range in kWh. It also displays the current
pack price divided by its nominal capacity in CHF/kWh. These figures update
as you edit the model. The feasibility study sets the usable energy from the
state of health and the operating SOC limits. Pack mass also affects the
vehicle mass used to predict consumption.

### List actions

The list supports search, pagination, details, edit, duplicate, and delete.
**Details** opens a read-only dialog. Before editing or deleting a model, check vehicle
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

The list supports search, details, edit, duplicate, and delete. The edit flow
also supports older custom stops whose stored data predate the current form; recovered fields
remain editable and a current stop type can be assigned before saving.

Use names that distinguish depots, chargers, and hubs clearly. A location can
become part of vehicle-block boundaries and charging candidates, so review
dependent work before changing or deleting it.

## Duplicate reusable records

Choose **Duplicate** on a model or custom-stop row to open an editable copy.
The proposed name uses the first available suffix in the original name family,
including when copying a copy. The sequence starts with `Line A_copy`, followed
by `Line A_copy_1`, `Line A_copy_2`, and so on. ELETTRA checks all list pages.
The suffix follows the interface language: `_copy`, `_Kopie`, `_copie` or
`_copia`. The proposed name remains editable.

The same numbering rule applies to vehicle blocks, feasibility evaluations and
yearly analyses. Saved names are not renamed automatically.

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

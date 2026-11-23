# Fleet Management

> Last updated: 2026-11-23
> Interface baseline: Frontend v1.3.0-rc.1

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

The economic defaults for new models use INFRAS, *Umwelt- und Kostenbilanz
von Bussen mit H2-Verbrennungsantrieb*, 4 December 2025, table 11, p. 45,
with acquisition assumptions for 2030. The source tooltips beside the vehicle
and battery cost fields explain the assumptions and open the
[INFRAS report](https://www.infras.ch/media/filer_public/86/db/86dbb9ed-9fc1-482e-85ca-a9f36f3da3b8/3954a_umweltbilanz_h2-busse_schlussbericht.pdf#page=45).

| App category | Vehicle cost without batteries | Reference |
|---|---:|---|
| Midi, 9 m | CHF 253’781 | Proportional estimate: 12 m cost × 9/12, rounded; the report has no direct 9 m value |
| Standard, 13 m | CHF 338’375 | The report's 12 m standard bus |
| Articulated, 18 m | CHF 474’032 | The report's 18 m articulated bus |

The initial battery reference is **CHF 257/kWh**, from the slow
battery-development scenario: **CHF 10’280** for the default **40 kWh** pack.
The report distinguishes initial and replacement battery prices. These defaults
are editable starting points; they do not update costs in saved models.
Changing pack capacity does not automatically recalculate the pack price, so
review both fields together. Battery and vehicle lifetimes remain separate
project assumptions.

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
The proposed name uses the next number in the original name family, including
when copying a copy: `Line A_copy_1`, `Line A_copy_2`, and so on. If copy 4
already exists on another list page, the next proposal is `Line A_copy_5`.
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

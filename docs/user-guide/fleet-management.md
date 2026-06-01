# Fleet Management

> Last updated: 2026-06-01

Manage bus models, buses, depots, and custom stops — the foundational data for all ELETTRA simulations.

---

## Bus models

Bus models define the technical specifications of electric buses available for simulation.

### Creating a bus model

Navigate to **Fleet > Buses** and click the add button. Key fields:

| Field | Description | Example |
|-------|-------------|---------|
| Manufacturer | Bus manufacturer name | Hess |
| Model | Model designation | lighTram 12 OPP |
| Bus length | 9m, 12m, or 18m (drives defaults) | 12 |
| Cost (CHF) | Bus body cost excluding batteries | 600,000 |
| Max passengers | Maximum passenger capacity | 85 |
| Empty weight (kg) | Weight without passengers or variable batteries | 14,000 |
| Battery packs (min–max) | Allowed range of battery pack count | 7–11 |
| Battery pack size (kWh) | Energy capacity per pack | 40 |
| Battery pack cost (CHF) | Cost per pack | 6,000 |
| Battery pack weight (kg) | Weight per pack | 275 |
| Max charging power (kW) | Maximum accepted charging power | 450 |
| Bus lifetime (years) | Expected operational lifetime | 12 |
| Battery lifetime (years) | Expected battery replacement cycle | 8 |

### Length-based defaults

Selecting a bus length pre-fills recommended values:

| Length | Cost | Max passengers | Empty weight | Packs (min–max) | Max charging power |
|--------|------|----------------|--------------|------------------|--------------------|
| 9m | 450,000 CHF | 55 | 12,000 kg | 5–8 | 300 kW |
| 12m | 600,000 CHF | 85 | 14,000 kg | 7–11 | 450 kW |
| 18m | 800,000 CHF | 120 | 18,000 kg | 12–16 | 450 kW |

All defaults can be overridden.

---

## Buses

Buses are individual vehicle instances linked to a bus model. They are used when assigning vehicles to shifts.

- Each bus references a bus model (for specifications).
- Buses are user-scoped.

---

## Depots

Depots represent bus garages or parking facilities. They are relevant for:

- Shift start/end locations
- Overnight charging (implicit in simulation)
- Charging station placement

A depot has a name and geographic coordinates.

---

## Custom stops

Custom stops are user-defined geographic points that extend the standard GTFS stop set. They are useful for:

- Defining depot locations not in the GTFS data
- Adding intermediate charging points
- Representing planned infrastructure

### Creating a custom stop

Navigate to **Fleet > Custom Stops** and click add. The map interface (Leaflet) allows:

- Clicking on the map to set coordinates
- Automatic reverse geocoding for address lookup
- Manual coordinate entry

---

## Relationship between entities

```
Bus Model  ←──  Bus  ←──  Shift  ──→  Depot (start/end)
                                   ──→  GTFS Trips
                                   ──→  Custom Stops
```

A shift references a bus (and thus a bus model), a start/end depot, and one or more GTFS trips.

---

## Next steps

- [Shifts and Routes](shifts-and-routes.md) — Define daily work assignments
- [Feasibility Evaluation](feasibility-evaluation.md) — Run a simulation using your fleet data

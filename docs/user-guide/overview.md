# User Guide: Overview

> Last updated: 2026-11-09
> Interface baseline: Frontend v0.10.0

ELETTRA supports preliminary planning for battery-electric bus services. It
connects fleet and timetable data to a technical feasibility gate, then uses a
verified design for yearly energy, cost, and environmental assessment.

The result is decision support, not an operational certificate. Procurement,
depot, charger, civil-work, and grid-connection decisions still require the
corresponding engineering studies.

---

## Application layout

After sign-in, **Home** links directly to the six working sections. The same
sections remain available in the sidebar:

| Sidebar group | Page | Purpose |
|---|---|---|
| **Fleet** | Bus Models | Define vehicle, battery, charging, cost, and lifetime parameters |
| **Fleet** | Custom Stops | Add depots, charging locations, and hubs not present in the timetable |
| **Fleet** | Vehicle blocks | Combine scheduled trips and auxiliary journeys into a complete daily duty |
| **Simulations** | Feasibility evaluation | Test the selected service under battery and charging constraints |
| **Simulations** | Yearly analyses | Apply a verified design to representative annual weather scenarios |
| **Simulations** | Analysis comparison | Compare two saved yearly analyses and export their differences |

The public user guide is linked from the landing page, Home, and the bottom of
the authenticated sidebar. It opens in a separate tab.

---

## Recommended workflow

```text
Bus model and locations
        ↓
Vehicle blocks with recorded GTFS edition
        ↓
Feasibility evaluation (Mean and Q95 designs)
        ↓
Verified feasible design
        ↓
Yearly fleet assessment and vehicle-block efficiency
        ↓
Comparison and export
```

1. Create a bus model and replace representative defaults with operator or
   manufacturer data when available.
2. Add the custom depots, charging locations, or hubs required by the service.
3. Build each vehicle block from one selected GTFS timetable edition, including
   its start, return, and auxiliary movements.
4. Create a feasibility evaluation from vehicle blocks that belong to the same
   GTFS edition. Choose the optimization mode and operating assumptions.
5. Check the technical verdict before interpreting secondary indicators. A
   completed calculation can still be physically infeasible.
6. Create a yearly analysis only from an eligible, completed feasibility
   evaluation. The selected battery and charging design remain fixed.
7. Compare saved yearly analyses whose service scope and assumptions are
   sufficiently consistent.

See the detailed chapters:

- [Fleet Management](fleet-management.md)
- [Vehicle Blocks and Routes](shifts-and-routes.md)
- [Feasibility Evaluation](feasibility-evaluation.md)
- [Feasibility Results](simulation-results.md)
- [Yearly Analysis](yearly-analysis.md)
- [Comparison and Export](comparison-and-export.md)

---

## Planning use cases

The optimization mode should match the planning question:

| Use case | What is already available | Mode | Main decision |
|---|---|---|---|
| Fleet expansion | Charging infrastructure | **Battery only** (`battery_only`) | Required battery capacity |
| Charging-infrastructure expansion | Bus and installed battery | **Charging** (`charging_only`) | Required charging configuration |
| Initial electrification investment | Neither complete bus nor charging design | **Joint** (`joint`) | Battery and charging configuration together |

The modes optimize only within the bus models, charging candidates, costs, and
constraints supplied by the user. They do not select a manufacturer, design a
complete depot, or assess the grid connection.

---

## GTFS provenance

GTFS is part of the analysis boundary, not just a trip-search input:

- a vehicle block records the timetable edition used to build it;
- a new feasibility evaluation accepts vehicle blocks from one selected
  edition;
- feasibility and yearly result pages show the recorded edition in a compact
  disclosure;
- a yearly result preserves the provenance captured by its feasibility
  evaluation instead of silently following later vehicle-block changes.

Historical records that predate complete provenance may be labelled as derived
from current vehicle-block data. Vehicle blocks that mix historical editions
are excluded from new evaluations.

---

## Languages and access

The interface and online guide are available in English, German, French, and
Italian. The language choice is retained in the browser.

The landing page, sign-in, registration, About page, and online user guide are
public. Fleet data and analyses require an authenticated account. Data exposed
in the workspace is scoped by the authenticated backend context.

---

## Interpretation boundary

A result is conditional on the selected service, timetable edition, vehicle,
weather, occupancy, heating, battery, state-of-charge, charging, economic, and
environmental assumptions. Record important sources and dates outside ELETTRA,
compare like with like, and treat missing or partial data as a limitation rather
than as zero impact.

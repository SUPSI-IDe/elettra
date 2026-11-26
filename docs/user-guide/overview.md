# ELETTRA user guide

## Quick start

ELETTRA helps you check whether electric buses can cover a scheduled service and size the batteries and charging needed. To assess a line, select the vehicle blocks that cover it on the chosen service day.
For your first visit, see [Account and access](#account-and-access).

1. Define the bus model, depots and any other custom stops. Build the vehicle blocks, then select the GTFS timetable, day and blocks to evaluate.
2. Choose a feasibility mode. **Battery only** finds the smallest battery for the charging sites you specify. **Charging** finds where plugs are needed for a fixed battery. **Joint** sizes batteries and charging infrastructure together to minimize upfront investment. [Set up the optimization mode](feasibility-evaluation.md#3-optimization-mode).
3. Run the evaluation and compare the Mean and Q95 designs, including pack count, planned charging and lowest SOC for the same block. If a design is infeasible, revise the inputs and run it again. If the result is **Not determined**, open **General** to check the reported cause. Where a vehicle block is identified, open it and follow **How to resolve**. Only verified feasible designs can proceed to yearly analysis and comparison. [Interpret Mean and Q95](simulation-results.md#compare-the-mean-and-q95-designs).

[Follow a battery-only example](feasibility-evaluation.md#from-depot-charging-to-cost-per-kilometer).

## Operating guide

1. [Bus models and custom stops](fleet-management.md)
2. [Building a vehicle block](shifts-and-routes.md)
3. [Feasibility evaluation](feasibility-evaluation.md)
4. [Interpreting feasibility results](simulation-results.md)
5. [Yearly analysis](yearly-analysis.md)
6. [Comparing and exporting analyses](comparison-and-export.md)

## Reference

### Account and access

To create an account, select your operator from the suggestions during registration.
After signing in, open Home to reach your fleet and analyses.

The interface and online guide are available in English, German, French, and
Italian. The globe menu uses the language codes EN, DE, FR and IT. The browser
remembers the selected language. Stop and depot names retain their local names.

The landing page, sign-in, registration, About page, and online user guide are
public. Fleet data and analyses require an authenticated account. Data exposed
in the workspace is scoped by the authenticated backend context.

### Application layout

After sign-in, **Home** links directly to the six working sections. The same
sections remain available in the sidebar:

| Sidebar group | Page | Purpose |
|---|---|---|
| **Fleet** | Buses | Define vehicle, battery, charging, cost, and lifetime parameters |
| **Fleet** | Custom Stops | Add depots, charging locations, and hubs not present in the timetable |
| **Fleet** | Vehicle blocks | Combine scheduled trips and auxiliary journeys into a complete daily duty |
| **Simulations** | Feasibility evaluation | Test the selected service under battery and charging constraints |
| **Simulations** | Yearly analyses | Apply a verified design to representative annual weather scenarios |
| **Simulations** | Analysis comparison | Compare two saved yearly analyses and export their differences |

Each Home card offers two actions. Select the card to open the tool, or **Read the
guide** to open its instructions in a new tab.

The public user guide is linked from the landing page, Home, and the bottom of
the authenticated sidebar. It opens in a separate tab.

### GTFS edition and provenance

The selected GTFS timetable defines the scheduled trips used in the analysis.

- a vehicle block records the timetable edition used to build it;
- a new feasibility evaluation accepts vehicle blocks from one selected
  edition;
- feasibility and yearly result pages show the recorded edition in a compact
  disclosure;
- a yearly result preserves the provenance captured by its feasibility
  evaluation instead of silently following later vehicle-block changes.

### Interpretation boundary

A result is conditional on the selected service, timetable edition, vehicle,
weather, occupancy, heating, battery, state-of-charge, charging, economic, and
environmental assumptions. Record important sources and dates outside ELETTRA,
compare like with like, and treat missing or partial data as a limitation rather
than as zero impact.

Confirm procurement, depot, charger, civil-work and grid-connection decisions through the corresponding engineering studies.

### Public API documentation

Open `/docs` at the root of the ELETTRA server to browse endpoints, request
parameters and responses in Swagger UI. The same server publishes the
machine-readable schema at `/openapi.json`. Both documents are public.
Protected API operations require an authorized account.

[Public ELETTRA Swagger UI](https://elettra.supsi.ch/docs) ·
[OpenAPI schema](https://elettra.supsi.ch/openapi.json)

---

> Reference versions: Frontend v1.4.5-rc.2 · Backend v1.9.0
>
> Last updated: 2026-11-26

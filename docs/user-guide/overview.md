# User Guide: Overview

> Last updated: 2026-06-01

ELETTRA is a web application for planning and evaluating the electrification of public transport bus fleets. This page provides a high-level map of all user-facing features.

---

## Application layout

The interface is a single-page application organized with a top navigation bar. After login, the main navigation sections are:

| Section | Pages | Purpose |
|---------|-------|---------|
| **Fleet** | Buses, Custom Stops, Shifts | Define your fleet data |
| **Simulation** | Feasibility evaluation, Yearly analysis | Run and analyze electrification scenarios |
| **Account** | Settings | Manage your profile and password |
| **About** | About | Project information and partners |

---

## Main workflow

The typical user workflow follows this sequence:

```
Fleet Setup → Shift Definition → Feasibility Evaluation → Results → Yearly Analysis → Comparison
```

1. **Fleet setup** — Create bus models with technical specifications (battery, weight, cost). See [Fleet Management](fleet-management.md).
2. **Shift definition** — Define daily work assignments by binding GTFS trips to buses and depots. See [Shifts and Routes](shifts-and-routes.md).
3. **Feasibility evaluation** — Configure and launch an optimization run to determine if a shift is electrifiable. See [Feasibility Evaluation](feasibility-evaluation.md).
4. **Results interpretation** — Analyze cost breakdowns, efficiency, SOC profiles, and emissions. See [Simulation Results](simulation-results.md).
5. **Yearly analysis** — Extrapolate single-day results across a year of temperature scenarios. See [Yearly Analysis](yearly-analysis.md).
6. **Comparison** — Compare electric vs diesel costs side-by-side. See [Comparison and Export](comparison-and-export.md).

---

## Supported languages

The interface is available in four languages, switchable at any time:

- English (en)
- German (de)
- French (fr)
- Italian (it)

Language preference is stored locally and persists across sessions.

---

## Authentication

- Users must log in to access fleet data and simulations.
- Registration requires a name, email, password, and company ID.
- Sessions are JWT-based and stored in the browser.
- If a session expires, the user is automatically redirected to the login page.

---

## Public pages

The following pages are accessible without login:
- Landing
- Login
- Register
- About

---

## Data ownership

All fleet data (bus models, buses, shifts, depots, custom stops) and simulation runs are scoped to the authenticated user. Agency-level data sharing may be available (*to verify*: whether agency endpoints provide cross-user visibility).

---

## Next steps

- [Fleet Management](fleet-management.md) — Start setting up your bus models and infrastructure
- [Feasibility Evaluation](feasibility-evaluation.md) — Jump straight to running a simulation

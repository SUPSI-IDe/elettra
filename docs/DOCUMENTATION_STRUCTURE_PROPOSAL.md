# ELETTRA Documentation Structure Proposal

> **Status**: Planning draft — not yet implemented.
> **Date**: 2026-06-01
> **Purpose**: Define a documentation architecture before writing full content.

---

## 1. Repository findings

### Overview

ELETTRA (Electric Transport Transition Assessment) is a Vite-based SPA frontend for electric bus fleet planning and simulation. The repository is frontend-only; the backend is a separate service accessed via REST API at `/auth` and `/api`.

### Main modules and features found

| Area | Key components |
|------|---------------|
| **Authentication** | Login, registration, JWT-based session, account settings, password change |
| **Fleet — Bus Models** | CRUD for bus model specifications (9m / 12m / 18m), battery packs, cost parameters |
| **Fleet — Buses** | CRUD for bus instances linked to bus models |
| **Fleet — Shifts** | Shift creation/editing, GTFS trip binding, timeline visualization, distance computation |
| **Fleet — Custom Stops & Depots** | Map-based stop management (Leaflet), depot definition |
| **Simulation — Feasibility Evaluation** | Optimization run creation with shift selection, battery pack sizing, SOC bounds, charging stations, temperature/occupancy/heating parameters |
| **Simulation — Results** | D3 charts: cost breakdown (CAPEX/OPEX), efficiency (kWh/km), SOC profile, emissions (CO₂, NOₓ, PM10), charging infrastructure, battery adequacy |
| **Simulation — Comparison** | Side-by-side economic comparison (electric vs diesel), stacked cost charts, emissions delta |
| **Yearly Analysis** | Multi-scenario analysis across temperature clusters (PVGIS TMY weather data), costs/emissions per year, quantile-based uncertainty (Q05/Q50/Q95) |
| **Environmental / LCA** | Lifecycle assessment integration: vehicle impact, electricity mixes, shift yearly impact |
| **GTFS Integration** | Routes, trips, stops, calendar, variants, elevation profiles, OSRM driving distance |
| **Internationalization** | English, German, French, Italian |
| **Deployment** | Vite dev/build/preview, Docker (dev/local/prod/prod-vite profiles), nginx, GitHub Pages CI |

### API domains (backend, not in this repo)

- `/auth` — Authentication and user management
- `/api/v1/agency` — Agency/company management
- `/api/v1/user` — Fleet: bus models, buses, depots, shifts
- `/api/v1/gtfs` — GTFS data: routes, trips, stops, calendar, variants, elevation
- `/api/v1/simulation` — Prediction runs, optimization runs, trip statistics, PVGIS TMY, weather clusters
- `/api/v1/yearly-analysis` — Yearly analysis CRUD, costs, emissions
- `/api/v1/economic` — Economic defaults and comparison
- `/api/v1/environmental` — LCA vehicles, vehicle impact, electricity mixes, shift yearly impact

### Configuration / defaults in frontend

- `src/config/simulation-defaults.js` — Prediction model, quantiles, greybox physics params
- `src/config/economic-defaults.js` — Diesel/electric maintenance costs, CAPEX, lifetime values
- `src/config/bus-model-defaults.js` — Default specs per bus length (9m/12m/18m)
- `src/config/auxiliary-consumption-defaults.js` — Temperature-dependent auxiliary consumption
- `src/config/company-locations.js` — (to verify: likely depot/company geolocation presets)

---

## 2. Proposed `docs/` tree

```text
docs/
├── README.md                          (existing — evolve into index)
├── DOCUMENTATION_STRUCTURE_PROPOSAL.md (this file — remove after implementation)
├── FEASIBLE_TPL_SIMULATIONS.md        (existing — keep as research reference)
├── getting-started.md
├── user-guide/
│   ├── overview.md
│   ├── fleet-management.md
│   ├── shifts-and-routes.md
│   ├── feasibility-evaluation.md
│   ├── simulation-results.md
│   ├── yearly-analysis.md
│   └── comparison-and-export.md
├── technical/
│   ├── architecture.md
│   ├── frontend-structure.md
│   ├── api-integration.md
│   ├── configuration-defaults.md
│   └── i18n.md
├── deployment/
│   ├── installation.md
│   ├── docker.md
│   ├── environment-variables.md
│   └── ci-cd.md
├── api-reference.md
└── glossary.md
```

**Total files**: 18 markdown files (including 2 existing).

---

## 3. Description of each proposed file

### `docs/README.md` (existing)

| Field | Value |
|-------|-------|
| **Purpose** | Documentation index / landing page |
| **Main sections** | Project overview, quick links to all sections, prerequisites summary |
| **Target reader** | All (entry point) |
| **Source** | Current `docs/README.md` content to be restructured as index |

---

### `docs/getting-started.md`

| Field | Value |
|-------|-------|
| **Purpose** | First-time setup for new users or developers — single page to go from zero to running |
| **Main sections** | Prerequisites, Clone & install, Start dev server, First login, Create your first simulation |
| **Target reader** | Developer / new user |
| **Source** | `INSTALL.md`, `docs/README.md`, `package.json`, `.env.example` |

---

### `docs/user-guide/overview.md`

| Field | Value |
|-------|-------|
| **Purpose** | High-level map of all user-facing features and navigation |
| **Main sections** | Application layout, Navigation structure, Main workflows diagram, Language switching |
| **Target reader** | User / researcher |
| **Source** | `src/navigation.js`, `index.html`, `src/i18n/translations.js` |

---

### `docs/user-guide/fleet-management.md`

| Field | Value |
|-------|-------|
| **Purpose** | How to manage bus models, buses, depots, and custom stops |
| **Main sections** | Bus models (create/edit/delete, length-specific defaults), Buses (assignment to models), Depots, Custom stops (map interface) |
| **Target reader** | User |
| **Source** | `src/pages/Fleet/Buses/`, `src/pages/Fleet/Custom Stops/`, `src/config/bus-model-defaults.js`, `src/api/buses.js`, `src/api/bus-models.js`, `src/api/depots.js` |

---

### `docs/user-guide/shifts-and-routes.md`

| Field | Value |
|-------|-------|
| **Purpose** | Creating/editing shifts, GTFS trip binding, timeline visualization, distance metrics |
| **Main sections** | Shift concept, Creating a shift, Binding GTFS trips, Shift timeline visualization, Distance computation (daily/yearly), Recurrence settings |
| **Target reader** | User |
| **Source** | `src/pages/Fleet/Shifts/`, `src/api/shifts.js`, `src/api/gtfs.js`, `src/utils/shift-distance.js` |

---

### `docs/user-guide/feasibility-evaluation.md`

| Field | Value |
|-------|-------|
| **Purpose** | How to configure and launch a feasibility evaluation (optimization run) |
| **Main sections** | Selecting shifts, Choosing bus model, Optimization modes (battery_only / charging_only / joint), Configuring parameters (temperature, occupancy, heating type, usable SOC), Charging station setup, Battery sizing, Launching and monitoring execution |
| **Target reader** | User / researcher |
| **Source** | `src/pages/Simulation/Runs/add-simulation.js`, `src/api/simulation.js` (createOptimizationRun, createPredictionRunVariants), `src/config/simulation-defaults.js` |

---

### `docs/user-guide/simulation-results.md`

| Field | Value |
|-------|-------|
| **Purpose** | Interpreting feasibility evaluation results |
| **Main sections** | General info card, Bus info card, Feasibility verdict, Cost breakdown (CAPEX/OPEX), Efficiency charts (kWh/km), SOC profile, Emissions assessment (CO₂/NOₓ/PM10), Charging infrastructure summary, Battery adequacy, Sensitivity cards |
| **Target reader** | User / researcher |
| **Source** | `src/pages/Simulation/Runs/simulation-results.js`, `src/pages/Simulation/Runs/simulation-detail.js`, `docs/FEASIBLE_TPL_SIMULATIONS.md` |

---

### `docs/user-guide/yearly-analysis.md`

| Field | Value |
|-------|-------|
| **Purpose** | How to create and interpret yearly analyses |
| **Main sections** | Creating a yearly analysis (from an optimization run), Temperature clustering (PVGIS TMY weather data), Scenario-weighted results, Quantile interpretation (Q05/Q50/Q95), Yearly costs and emissions, Efficiency by temperature chart, Annual contribution breakdown |
| **Target reader** | User / researcher |
| **Source** | `src/pages/Simulation/YearlyAnalysis/`, `src/api/simulation.js` (yearly analysis + weather cluster endpoints), `src/adapters/yearly-analysis.js` |

---

### `docs/user-guide/comparison-and-export.md`

| Field | Value |
|-------|-------|
| **Purpose** | Run-to-run comparison, economic comparison (electric vs diesel), export options |
| **Main sections** | Selecting runs to compare, Economic comparison parameters, Cost stacking (vehicle/energy/maintenance), Emissions delta, CHF/km metric, Environmental LCA comparison, Export/print (to verify) |
| **Target reader** | User / researcher |
| **Source** | `src/pages/Simulation/Runs/simulation-comparison.js`, `src/api/simulation.js` (fetchEconomicComparison), `src/api/environmental.js` |

---

### `docs/technical/architecture.md`

| Field | Value |
|-------|-------|
| **Purpose** | Overall system architecture: frontend ↔ backend boundary, data flow |
| **Main sections** | System overview, Frontend-only repo scope, Backend dependency, API routing (dev proxy / production nginx), Authentication flow (JWT), Session management |
| **Target reader** | Developer |
| **Source** | `src/main.js`, `src/api/client.js`, `src/api/session.js`, `vite.config.js`, `docker/nginx.conf.template` |

---

### `docs/technical/frontend-structure.md`

| Field | Value |
|-------|-------|
| **Purpose** | Frontend code organization, routing model, page lifecycle |
| **Main sections** | Directory layout (`src/`), SPA routing (hash-based, partial loading), Page initialization pattern, Cleanup lifecycle, DOM helpers (`src/dom/`), Store (`src/store.js`), Events (`src/events.js`), UI helpers |
| **Target reader** | Developer |
| **Source** | `src/navigation.js`, `src/main.js`, `src/events.js`, `src/store.js`, `src/ui-helpers.js`, `src/dom/` |

---

### `docs/technical/api-integration.md`

| Field | Value |
|-------|-------|
| **Purpose** | How the frontend talks to the backend: API client, auth headers, pagination, error handling |
| **Main sections** | API client module, Auth header injection, Redirect handler, Pagination helpers, Error normalization pattern, API modules overview (auth, buses, bus-models, depots, shifts, gtfs, simulation, environmental) |
| **Target reader** | Developer |
| **Source** | `src/api/client.js`, `src/api/pagination.js`, `src/api/index.js`, all modules in `src/api/` |

---

### `docs/technical/configuration-defaults.md`

| Field | Value |
|-------|-------|
| **Purpose** | Document all frontend-embedded configuration/defaults and their domain meaning |
| **Main sections** | Simulation defaults (prediction model, greybox params, quantiles), Economic defaults (maintenance costs, fuel efficiency, bus lifetime, CAPEX), Bus model defaults by length, Auxiliary consumption profile, Company locations (to verify) |
| **Target reader** | Developer / researcher |
| **Source** | All files in `src/config/` |

---

### `docs/technical/i18n.md`

| Field | Value |
|-------|-------|
| **Purpose** | How internationalization works, adding/editing translations |
| **Main sections** | Supported languages (en/de/fr/it), Translation key structure, How to add a new key, `applyTranslations` lifecycle, Language change event |
| **Target reader** | Developer |
| **Source** | `src/i18n/index.js`, `src/i18n/translations.js` |

---

### `docs/deployment/installation.md`

| Field | Value |
|-------|-------|
| **Purpose** | Comprehensive installation guide (consolidation of existing INSTALL.md and docs/README.md setup sections) |
| **Main sections** | Prerequisites, npm install, Development server, Production build, Preview mode |
| **Target reader** | Developer / administrator |
| **Source** | `INSTALL.md`, `docs/README.md`, `package.json` |

---

### `docs/deployment/docker.md`

| Field | Value |
|-------|-------|
| **Purpose** | Docker-based deployment for all profiles |
| **Main sections** | Docker folder structure, Profiles overview (dev/local/local-vpn/prod/prod-vite), Building images, Running containers, Health checks, Volumes and networking, Proxy configuration |
| **Target reader** | Administrator / developer |
| **Source** | `docker/Dockerfile`, `docker/Dockerfile.dev`, `docker/Dockerfile.preview`, `docker/docker-compose.yml`, `docker/nginx.conf.template`, `docker/env.example` |

---

### `docs/deployment/environment-variables.md`

| Field | Value |
|-------|-------|
| **Purpose** | Complete reference of all environment variables |
| **Main sections** | Client-side variables (VITE_*), Docker variables, Proxy variables, Production runtime variables (API_BACKEND_URL), Allowed hosts |
| **Target reader** | Administrator / developer |
| **Source** | `.env.example`, `.env.production`, `docker/env.example`, `vite.config.js`, `docker/docker-compose.yml` |

---

### `docs/deployment/ci-cd.md`

| Field | Value |
|-------|-------|
| **Purpose** | CI/CD pipeline documentation |
| **Main sections** | GitHub Pages deployment workflow, Build steps, Trigger conditions, Deployment environments |
| **Target reader** | Developer / administrator |
| **Source** | `.github/workflows/deploy.yml` |

---

### `docs/api-reference.md`

| Field | Value |
|-------|-------|
| **Purpose** | Full API endpoint reference (consolidated from existing API_REFERENCE.md) |
| **Main sections** | Authentication, Agency management, Fleet management (bus models/buses/depots/shifts), GTFS data (routes/trips/stops/calendar/variants/elevation), Simulation (prediction runs/optimization runs/trip statistics/PVGIS/weather clusters), Yearly analysis, Economic, Environmental |
| **Target reader** | Developer / researcher |
| **Source** | `API_REFERENCE.md` (root), backend Swagger at `/docs` |

---

### `docs/glossary.md`

| Field | Value |
|-------|-------|
| **Purpose** | Domain-specific terminology reference |
| **Main sections** | Alphabetical glossary of terms: battery pack, CAPEX, charging station (OPP), COP, depot, feasibility evaluation, GTFS, greybox model, heat pump, LCA, OPEX, optimization run, PVGIS TMY, prediction run, quantile, recurrence, shift, SOC, usable SOC, variant |
| **Target reader** | All |
| **Source** | Extracted from translations, config files, FEASIBLE_TPL_SIMULATIONS.md |

---

## 4. Recommended writing order

### Phase 1 — Essential (immediate value)

1. `docs/README.md` — Restructure as index with links
2. `docs/getting-started.md` — Single onboarding page
3. `docs/deployment/environment-variables.md` — Most-asked reference
4. `docs/glossary.md` — Shared vocabulary for all other docs

### Phase 2 — User-facing (primary audience)

5. `docs/user-guide/overview.md`
6. `docs/user-guide/fleet-management.md`
7. `docs/user-guide/shifts-and-routes.md`
8. `docs/user-guide/feasibility-evaluation.md`
9. `docs/user-guide/simulation-results.md`
10. `docs/user-guide/yearly-analysis.md`
11. `docs/user-guide/comparison-and-export.md`

### Phase 3 — Technical / developer

12. `docs/technical/architecture.md`
13. `docs/technical/frontend-structure.md`
14. `docs/technical/api-integration.md`
15. `docs/technical/configuration-defaults.md`
16. `docs/technical/i18n.md`

### Phase 4 — Deployment / advanced reference

17. `docs/deployment/installation.md`
18. `docs/deployment/docker.md`
19. `docs/deployment/ci-cd.md`
20. `docs/api-reference.md`

---

## 5. Existing `docs/README.md` integration

### Current state

The file currently serves as both installation guide and feature overview. It is comprehensive (220+ lines) and well-written, covering:
- Feature summary
- Technical notes
- Prerequisites
- Direct installation (with env vars)
- Docker installation (all profiles)
- Backend dependency note

### Recommended evolution

1. **Transform into a documentation index**: Replace the current monolithic content with a brief project description and a linked table of contents pointing to all documentation sections.
2. **Move installation content** to `docs/deployment/installation.md` and `docs/deployment/docker.md`.
3. **Move feature summary** to `docs/user-guide/overview.md`.
4. **Keep the file as the entry point** — anyone landing in `docs/` should find clear navigation.

### Proposed new structure for `docs/README.md`

```markdown
# ELETTRA Documentation

> Electric Transport Transition Assessment — web tool for electric bus fleet planning.

## Quick links

- [Getting Started](getting-started.md)
- [User Guide](user-guide/overview.md)
- [Technical Reference](technical/architecture.md)
- [API Reference](api-reference.md)
- [Deployment](deployment/installation.md)
- [Glossary](glossary.md)

## About this project

(2-3 sentences from current description)

## Documentation map

(Table with all sections, target audience, and one-line description)
```

### What NOT to lose

The current `docs/README.md` contains valuable operational details (proxy targets, allowed hosts, docker profile matrix) that must be preserved in the appropriate new files. Nothing should be deleted without first being migrated.

---

## 6. Missing information / questions

| # | Question | Relevant to |
|---|----------|-------------|
| 1 | Is there a backend repository with its own documentation? If so, should `docs/api-reference.md` simply link to it, or fully replicate endpoints? | `api-reference.md` |
| 2 | Does the application support user roles/permissions beyond basic authentication (admin vs regular user, agency-scoped data)? The API has agency endpoints. | `user-guide/overview.md`, `technical/architecture.md` |
| 3 | Is there an export/download feature for simulation results (PDF, CSV, etc.), or is browser print the only option? | `user-guide/comparison-and-export.md` |
| 4 | What does `src/config/company-locations.js` contain? Is it public transit company presets for depot coordinates? | `technical/configuration-defaults.md` |
| 5 | Is the `FEASIBLE_TPL_SIMULATIONS.md` document intended for end-users or as an internal research artifact? Should it be linked from the user guide? | `user-guide/simulation-results.md` |
| 6 | Are there plans for additional optimization modes beyond `battery_only`, `charging_only`, and `joint`? | `user-guide/feasibility-evaluation.md` |
| 7 | Is the GitHub Pages deployment (CI) serving a demo/public instance, or documentation? | `deployment/ci-cd.md` |
| 8 | Should the root-level `INSTALL.md` and `API_REFERENCE.md` be kept as-is (for GitHub visibility), moved into `docs/`, or replaced with symlinks/redirects? | Overall structure |
| 9 | Is the LCA / environmental impact feature fully implemented or partially available? The API module exists but UI coverage is unclear. | `user-guide/simulation-results.md`, `user-guide/yearly-analysis.md` |
| 10 | Are there test suites (unit/integration/e2e) that should be documented? None were found in `package.json` scripts. | `technical/frontend-structure.md` |

---

## 7. Final summary

**ELETTRA documentation architecture — recommended structure:**

The documentation should be organized into 5 pillars plus a glossary:

1. **Getting Started** — single onboarding page for immediate productivity.
2. **User Guide** (7 files) — workflow-oriented documentation for transit planners: fleet setup → shift definition → feasibility evaluation → results interpretation → yearly analysis → comparison.
3. **Technical Reference** (5 files) — architecture, frontend patterns, API integration, configuration, and i18n for developers.
4. **Deployment** (4 files) — installation, Docker, environment variables, CI/CD for administrators.
5. **API Reference** (1 file) — consolidated endpoint catalog.
6. **Glossary** — shared domain vocabulary.

Total: 18 markdown files in a flat-ish hierarchy. The existing `docs/README.md` becomes a navigational index. The root-level `INSTALL.md` and `API_REFERENCE.md` can remain for GitHub discoverability but should reference the canonical `docs/` versions.

Writing priority: start with essential/index files and glossary, then user-facing guides, then technical docs, then deployment reference. This ensures the highest-value documentation is available first.

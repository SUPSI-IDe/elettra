# ELETTRA Documentation

> Last updated: 2026-06-01

**ELETTRA** (Electric Transport Transition Assessment) is a web tool for electric bus fleet planning and simulation, developed within the ELETTRA research project to support public transport companies in transitioning to electric bus fleets.

This repository contains the **frontend only** — a Vite-based single-page application. The backend is a separate service accessed via REST API.

---

## Quick links

| Section | Description | Audience |
|---------|-------------|----------|
| [Getting Started](getting-started.md) | From zero to running in minutes | Developer / new user |
| [User Guide](user-guide/overview.md) | Feature walkthrough and workflows | User / researcher |
| [Technical Reference](technical/architecture.md) | Architecture, code patterns, internals | Developer |
| [Deployment](deployment/installation.md) | Install, Docker, CI/CD | Administrator / developer |
| [API Reference](api-reference.md) | Backend endpoint catalog | Developer / researcher |
| [Glossary](glossary.md) | Domain terminology | All |

---

## Documentation map

### User Guide

- [Overview](user-guide/overview.md) — Application layout, navigation, supported languages
- [Fleet Management](user-guide/fleet-management.md) — Bus models, buses, depots, custom stops
- [Shifts and Routes](user-guide/shifts-and-routes.md) — Shift creation, GTFS trips, timelines
- [Feasibility Evaluation](user-guide/feasibility-evaluation.md) — Configuring and launching optimization runs
- [Simulation Results](user-guide/simulation-results.md) — Interpreting cost, efficiency, SOC, emissions
- [Yearly Analysis](user-guide/yearly-analysis.md) — Multi-scenario temperature-weighted analysis
- [Comparison and Export](user-guide/comparison-and-export.md) — Electric vs diesel comparison

### Technical Reference

- [Architecture](technical/architecture.md) — System overview, frontend ↔ backend boundary
- [Frontend Structure](technical/frontend-structure.md) — Code organization, routing, page lifecycle
- [API Integration](technical/api-integration.md) — API client, auth, pagination, error handling
- [Configuration Defaults](technical/configuration-defaults.md) — Embedded constants and domain defaults
- [Internationalization](technical/i18n.md) — Translation system (en/de/fr/it)

### Deployment

- [Installation](deployment/installation.md) — Prerequisites, npm setup, build commands
- [Docker](deployment/docker.md) — Container profiles, nginx, compose commands
- [Environment Variables](deployment/environment-variables.md) — Complete variable reference
- [CI/CD](deployment/ci-cd.md) — GitHub Pages deployment workflow

### Reference

- [API Reference](api-reference.md) — All backend endpoints consumed by the frontend
- [Glossary](glossary.md) — Domain-specific terms and abbreviations
- [Feasible TPL Simulations](FEASIBLE_TPL_SIMULATIONS.md) — Research analysis of battery-only simulation scenarios

---

## Backend dependency

This repository contains the frontend only. All data persistence, simulation execution, GTFS data, and authentication require a reachable backend implementing the `/auth` and `/api` endpoints. See the [API Reference](api-reference.md) for details.

---

## Contributing to documentation

Documentation source files live in this `docs/` folder. The structure proposal that guided this implementation is preserved in [DOCUMENTATION_STRUCTURE_PROPOSAL.md](DOCUMENTATION_STRUCTURE_PROPOSAL.md) as a planning artifact.

# Elettra Frontend

This document describes the main frontend capabilities of Elettra and how to run the application either directly from source or through Docker.

## What the Frontend Provides

Elettra is a Vite-based single-page frontend for electric bus fleet planning and simulation workflows. The UI is organized around these main areas:

- Authentication and session handling: login, registration, logout, password change, and session-aware navigation.
- Fleet setup: create, edit, list, and delete bus models used in later planning and simulation steps.
- Custom stops and depots: manage user-owned custom stops, including map-based positioning with Leaflet and automatic address lookup.
- Shift management: create and edit shifts, bind them to routes, buses, depots, and GTFS trips, and inspect shift timelines and trip previews.
- Simulation authoring: create optimization runs from selected shifts and configure operational variables such as temperature, occupancy, heating type, optimization mode, usable SOC, battery packs, and charging stations.
- Simulation tracking: list, filter, duplicate, and delete simulation runs and follow their backend execution status.
- Results and comparison views: inspect simulation outputs with D3-based charts for costs, efficiency, state of charge, emissions, charging infrastructure, and run-to-run comparison.
- Multilingual interface: built-in translations for English, German, French, and Italian.

## Technical Notes

- The frontend is built with `vite`.
- It is served under the `/elettra/` base path in both development and production.
- Backend calls target `/auth` and `/api`.
- In development, Vite proxies those paths to a backend server.
- In production Docker mode, nginx serves the static frontend and proxies `/auth` and `/api`.

## Prerequisites

- Node.js `20.19+` or `22.12+`
- npm `10+`
- Docker and Docker Compose only if you want the containerized setup

## Direct Installation

### 1. Install dependencies

From the project root:

```bash
npm ci
```

If you prefer, `npm install` also works, but `npm ci` is the cleaner choice when using the committed lockfile.

### 2. Configure the frontend

The frontend can run with no extra configuration if the default development proxy target is valid for your environment.

Optional client-side variables:

- `VITE_API_ROOT`: absolute backend base URL used by the browser. Leave it empty to use relative `/auth` and `/api` paths.
- `VITE_TEST_EMAIL`: optional test login email.
- `VITE_TEST_PASSWORD`: optional test login password.

Optional development proxy variable:

- `VITE_API_PROXY_TARGET`: backend URL used by the Vite dev server proxy. If unset, the repo currently defaults to `http://isaac-elettra.dacd.supsi.ch:8002`.

Example:

```bash
export VITE_API_PROXY_TARGET=http://localhost:8002
export VITE_API_ROOT=
```

If you want a local `.env` for the test credentials, start from:

```bash
cp .env.example .env
```

### 3. Start the development server

```bash
npm run dev -- --host 0.0.0.0 --port 9010
```

Open:

```text
http://localhost:9010/elettra/
```

### 4. Build the production bundle

```bash
npm run build
```

The static output is generated in `dist/`.

To preview the build locally:

```bash
npm run preview
```

## Docker Installation

All container assets are in `docker/`.

### Docker environment file

Create the Docker env file from the template:

```bash
cd docker
cp env.example .env
```

Main Docker variables:

- `API_BACKEND_URL`: runtime backend URL used by nginx in production mode.
- `VITE_API_ROOT`: optional build-time API root for the frontend bundle.
- `VITE_API_PROXY_TARGET`: backend URL used by the development container.
- `NPM_REGISTRY`: optional npm registry override for Docker builds.
- `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`: optional proxy settings passed into Docker builds.

### Development with Docker

Run Docker commands from `docker/`.

Start the development profile:

```bash
docker compose --profile dev up --build
```

This starts the `elettra-dev` service with:

- source mounted into the container
- live Vite development server on port `9010`
- proxy support for `/auth` and `/api`

Open:

```text
http://localhost:9010/elettra/
```

Available compose profiles:

- `dev`: proxy target defaults to `http://host.docker.internal:8002`
- `local`: proxy target defaults to `http://isaac-elettra.dacd.supsi.ch:8002`
- `local-vpn`: proxy target defaults to `http://10.9.0.5:8002`

Example:

```bash
docker compose --profile local up --build
```

### Production with Docker

Start the production profile:

```bash
docker compose --profile prod up -d --build
```

This flow:

- builds the frontend in a Node `22-alpine` stage
- copies `dist/` into an nginx image
- serves the app on port `80`
- proxies `/auth` and `/api` to `API_BACKEND_URL`
- exposes a health endpoint at `/health`

Open:

```text
http://localhost/elettra/
```

To stop the containers:

```bash
docker compose --profile prod down
```

## Installation Summary

- Use the direct setup when you want the fastest frontend iteration loop on your machine.
- Use Docker development when you want a reproducible containerized dev environment on port `9010`.
- Use Docker production when you want the same `/elettra/` static hosting and nginx proxying model used by the deployment image.

## Backend Dependency

This repository contains the frontend only. Login, fleet data, GTFS data, shift persistence, and simulation execution all require a reachable backend that implements the `/auth` and `/api` endpoints expected by the frontend.

# ELETTRA frontend

Browser application for planning battery-electric bus operations. The frontend
supports fleet and vehicle-block setup, technical feasibility evaluations,
yearly fleet assessment, lifecycle/economic results, and comparison of saved
yearly analyses.

The application is a framework-free Vite SPA. It uses D3 for charts, Leaflet
for maps, and a separate FastAPI backend for authentication, persistence,
GTFS, simulation, economic, and environmental services.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- a reachable ELETTRA backend

## Local development

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:9010/elettra/>. The Vite proxy sends `/auth` and
`/api` to `http://127.0.0.1:9005` by default. Point it elsewhere explicitly
when needed:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:8002 npm run dev
```

The application is built for the `/elettra/` base path. The public, localized
guide is included in the same build at `/elettra/guide/`.

## Vehicle-block visualization

Saved vehicle blocks open with a space-time diagram that plots time against the
ordered stops, separates multi-line work by route, includes depot connections,
and flags discontinuities caused by missing transfer data. The Map view steps
through every recorded movement, including the initial and final depot legs,
and lists its stops and times. The creation and editing form keeps its compact
timeline for checking the sequence before saving; the saved-block visualization
offers only the Space-time and Map toggle options.

## Production build

```bash
npm run build
npm run preview
```

`dist/` contains both the application and the online guide. Container builds
use the nginx runtime proxy configured through `API_BACKEND_URL`; see
[Docker deployment](docs/deployment/docker.md).

## Tests

Run the permanent unit regressions without network access:

```bash
npm test
```

The browser source suite starts its own Vite server on port `9010`. Its proxy
target is fixed to the local staging backend on port `9005`; tests that do not
need a backend mock every API request, including `/api/v1/version`.

```bash
npm run test:e2e
```

The production-bundle suite verifies `dist/` after a build:

```bash
npm run build
npm run test:dist
```

The staging smoke suite checks the complete local chain:

- frontend: `http://127.0.0.1:55558`;
- backend: `http://127.0.0.1:9005`;
- PostgreSQL: `127.0.0.1:9004`.

```bash
npm run test:staging
```

Unexpected unmocked API calls or `ECONNREFUSED` messages in browser-test logs
are regressions to investigate even when assertions pass.

## Documentation

- [Documentation index](docs/README.md)
- [User guide](docs/user-guide/overview.md)
- [Yearly analysis](docs/user-guide/yearly-analysis.md)
- [Analysis comparison and export](docs/user-guide/comparison-and-export.md)
- [Technical architecture](docs/technical/architecture.md)
- [API integration](docs/technical/api-integration.md)

## Release

`.github/workflows/container-release.yml` verifies unit tests, browser tests,
the production build, and the built bundle before publishing a tagged image.
The semantic tag must match the version in `package.json`. Stable pushes to
`main` are also built and deployed to GitHub Pages by
`.github/workflows/deploy.yml` after the configured release-channel check.

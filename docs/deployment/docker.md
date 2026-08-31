# Docker Deployment

> Last updated: 2026-06-01

All Docker-related files are in the `docker/` folder. Run Docker commands from that directory.

---

## Docker folder structure

```
docker/
├── Dockerfile           # Production multi-stage build (Node → nginx)
├── Dockerfile.dev       # Development container with HMR
├── Dockerfile.preview   # Production build served by vite preview
├── docker-compose.yml   # Orchestration with multiple profiles
├── nginx.conf.template  # Nginx configuration template
└── env.example          # Environment variables template
```

---

## Quick start

```bash
cd docker
cp env.example .env

# Development
docker compose --profile dev up --build

# Production (nginx)
docker compose --profile prod up -d --build

# Production (vite preview)
docker compose --profile prod-vite up -d --build
```

Open: <http://localhost:9010/elettra/>

### Local staging from GHCR

The staging profile runs the exact image published by GitHub Actions and
proxies API requests to the backend on this machine:

```bash
cd docker
cp .env.staging.example .env.staging
# Replace ELETTRA_FRONTEND_IMAGE with the candidate digest from Actions.
docker compose --env-file .env.staging --profile staging pull elettra-staging
docker compose --env-file .env.staging --profile staging up -d elettra-staging
```

Open <http://127.0.0.1:55558/elettra/> and check container health at
<http://127.0.0.1:55558/health>. The loopback bind keeps this staging instance
private to the host.

---

## Available profiles

| Profile | Service | Backend proxy target | Use case |
|---------|---------|---------------------|----------|
| `dev` | `elettra-dev` | `http://host.docker.internal:8002` | Local development with HMR |
| `local` | `elettra-local` | `http://isaac-elettra.dacd.supsi.ch:8002` | Development against remote backend |
| `local-vpn` | `elettra-local-vpn` | `http://10.9.0.5:8002` | Development via VPN |
| `prod` | `elettra` | `API_BACKEND_URL` (nginx runtime) | Production with nginx |
| `prod-vite` | `elettra-prod-vite` | `VITE_API_PROXY_TARGET` | Production with vite preview |
| `staging` | `elettra-staging` | `http://host.docker.internal:8002` | Published GHCR candidate on port 55558 |

---

## Development with Docker

```bash
cd docker
docker compose --profile dev up
```

Features:
- Source code mounted into container (live editing)
- Vite development server on port 9010
- Hot Module Replacement
- `/auth` and `/api` proxied to backend

To build and run manually:

```bash
docker build -f Dockerfile.dev -t elettra-dev ..
docker run -it --rm \
  -p 9010:9010 \
  -v $(pwd)/..:/app \
  -v /app/node_modules \
  elettra-dev
```

---

## Production with Docker (nginx)

```bash
cd docker
docker compose --profile prod up -d --build
```

This flow:
- Builds the frontend in a Node 22-alpine stage
- Copies `dist/` into an nginx image
- Serves the app from nginx on container port 80, published externally on 9010
- Proxies `/auth` and `/api` to `API_BACKEND_URL`
- Exposes a health endpoint at `/health`

Manual build:

```bash
docker build -f Dockerfile -t elettra:latest ..
docker run -d \
  --name elettra \
  -p 9010:80 \
  -e API_BACKEND_URL=http://isaac-elettra.dacd.supsi.ch:8002 \
  elettra:latest
```

---

## Production with Vite preview

```bash
cd docker
docker compose --profile prod-vite up -d --build
```

This profile:
- Builds the optimized frontend bundle
- Serves it with `vite preview` on port 9010
- Maintains `/auth` and `/api` proxy behavior from vite.config.js
- Allows `bismuto.supsi.ch` by default

Access: <http://bismuto.supsi.ch:9010/elettra/>

---

## Allowed hosts

The Vite dev server restricts access by hostname. Default allowed hosts:
- `isaac-elettra.dacd.supsi.ch`
- `bismuto.supsi.ch`

To add custom hostnames:

```env
VITE_ALLOWED_HOSTS=your-hostname.example.org
```

---

## Common commands

```bash
cd docker

# Start/stop
docker compose --profile dev up
docker compose --profile dev down
docker compose --profile prod up -d --build
docker compose --profile prod down

# Logs
docker compose logs -f elettra

# Rebuild without cache
docker compose --profile prod build --no-cache
```

---

## Health checks

Both `prod` and `prod-vite` profiles include health checks:
- Interval: 30s
- Timeout: 10s
- Retries: 3
- Start period: 10s

The `prod` profile checks `http://127.0.0.1/health`.

---

## Proxy and registry settings

For environments behind a corporate proxy or using an internal npm mirror, set in `docker/.env`:

```env
HTTP_PROXY=http://proxy.example:3128
HTTPS_PROXY=http://proxy.example:3128
NO_PROXY=localhost,127.0.0.1,host.docker.internal
NPM_REGISTRY=https://your-internal-registry.example.org/
```

These are passed as build args to all Dockerfiles.

---

## Summary

| Setup | Best for |
|-------|----------|
| `dev` | Fastest iteration loop with Docker |
| `local` / `local-vpn` | Reproducible dev environment targeting specific backends |
| `prod` | Production-grade nginx hosting with API proxying |
| `prod-vite` | Vite-served production build (e.g., `bismuto.supsi.ch`) |

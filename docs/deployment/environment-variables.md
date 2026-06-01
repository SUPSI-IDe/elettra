# Environment Variables

> Last updated: 2026-06-01

Complete reference of all environment variables used by ELETTRA.

---

## Client-side variables (build-time)

These variables are embedded into the frontend bundle at build time. They must be prefixed with `VITE_` to be exposed to client-side code.

| Variable | Purpose | Default | Source |
|----------|---------|---------|--------|
| `VITE_API_ROOT` | Absolute backend base URL used by the browser for API calls. Leave empty to use relative `/auth` and `/api` paths (recommended when proxying). | Empty | `.env`, `.env.production` |
| `VITE_TEST_EMAIL` | Pre-filled email on the login form for development convenience. | Empty | `.env.example` |
| `VITE_TEST_PASSWORD` | Pre-filled password on the login form for development convenience. | Empty | `.env.example` |

---

## Development proxy variables

Used by the Vite development server to proxy API requests to the backend.

| Variable | Purpose | Default | Source |
|----------|---------|---------|--------|
| `VITE_API_PROXY_TARGET` | Backend URL used by Vite's dev server proxy. Requests to `/auth` and `/api` are forwarded here. | `http://isaac-elettra.dacd.supsi.ch:8002` | `vite.config.js` |
| `VITE_ALLOWED_HOSTS` | Comma-separated extra hostnames accepted by the Vite dev server. Useful when accessing the dev server through custom DNS. | `isaac-elettra.dacd.supsi.ch,bismuto.supsi.ch` | `vite.config.js` |

---

## Docker / production runtime variables

Used by Docker containers at runtime (not embedded in the bundle).

| Variable | Purpose | Default | Source |
|----------|---------|---------|--------|
| `API_BACKEND_URL` | Backend URL used by the nginx container to proxy `/auth` and `/api` requests at runtime. | `http://isaac-elettra.dacd.supsi.ch:8002` | `docker/env.example`, `docker-compose.yml` |

---

## Docker build args

Passed during `docker build` to configure the build environment inside the container.

| Variable | Purpose | Default | Source |
|----------|---------|---------|--------|
| `NPM_REGISTRY` | npm registry URL used during `npm ci` inside Docker. Override for internal mirrors. | `https://registry.npmjs.org/` | `docker/env.example` |
| `HTTP_PROXY` | HTTP proxy for outbound requests during build. | Empty | `docker/env.example` |
| `HTTPS_PROXY` | HTTPS proxy for outbound requests during build. | Empty | `docker/env.example` |
| `NO_PROXY` | Comma-separated hosts that bypass the proxy. | Empty | `docker/env.example` |

---

## File locations

| File | Purpose |
|------|---------|
| `.env.example` | Template for local development (test credentials) |
| `.env.production` | Production build defaults (sets `VITE_API_ROOT`) |
| `docker/env.example` | Template for Docker deployments (all Docker-related vars) |
| `vite.config.js` | Reads `VITE_API_PROXY_TARGET` and `VITE_ALLOWED_HOSTS` at dev server startup |

---

## Usage patterns

### Local development (no Docker)

```bash
# Option A: Use defaults (proxy to isaac-elettra.dacd.supsi.ch:8002)
npm run dev

# Option B: Point to a local backend
export VITE_API_PROXY_TARGET=http://localhost:8002
npm run dev
```

### Docker development

```bash
cd docker
cp env.example .env
# Edit .env if needed
docker compose --profile dev up
```

### Production build with direct API access

```bash
VITE_API_ROOT=https://your-production-api.example.com npm run build
```

### Production Docker (nginx proxy)

Set `API_BACKEND_URL` in `docker/.env`:

```env
API_BACKEND_URL=http://your-backend-host:8002
```

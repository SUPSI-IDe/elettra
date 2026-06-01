# Architecture

> Last updated: 2026-06-01

System architecture overview for developers working on the ELETTRA frontend.

---

## System overview

```
┌────────────────────┐         ┌──────────────────────┐
│   ELETTRA Frontend │  HTTP   │    Backend API        │
│   (this repo)      │────────▶│    (separate repo)    │
│                    │         │                       │
│   Vite SPA         │  /auth  │   FastAPI + Swagger   │
│   D3.js charts     │  /api   │   PostgreSQL          │
│   Leaflet maps     │         │   Simulation engine   │
└────────────────────┘         └──────────────────────┘
```

- **Frontend**: Vite-based single-page application. Vanilla JS (no framework), D3 for charts, Leaflet for maps.
- **Backend**: Separate service implementing `/auth` and `/api` endpoints. FastAPI with Swagger/OpenAPI documentation.
- **Communication**: REST over HTTP. JWT-based authentication.

---

## Frontend-only scope

This repository contains **only the frontend**. The backend is a separate codebase and deployment.

The frontend:
- Renders the UI
- Manages navigation (hash-based SPA routing)
- Calls backend APIs for all data operations
- Embeds domain configuration defaults (economic parameters, bus model specs)
- Visualizes results with D3.js

The frontend does NOT:
- Store persistent data (all data lives on the backend)
- Execute simulations (dispatched to backend solver)
- Manage GTFS data (fetched from backend)

---

## API routing

### Development (Vite proxy)

In development, Vite proxies `/auth` and `/api` requests to the backend:

```
Browser → localhost:9010/auth/* → Vite proxy → VITE_API_PROXY_TARGET/auth/*
Browser → localhost:9010/api/*  → Vite proxy → VITE_API_PROXY_TARGET/api/*
```

Configured in `vite.config.js`. Default target: `http://isaac-elettra.dacd.supsi.ch:8002`.

### Production (nginx)

In the Docker production build, nginx serves static files and proxies API paths:

```
Browser → :9010/elettra/*  → nginx → static files (dist/)
Browser → :9010/auth/*     → nginx → API_BACKEND_URL/auth/*
Browser → :9010/api/*      → nginx → API_BACKEND_URL/api/*
```

Configured in `docker/nginx.conf.template`.

---

## Authentication flow

1. User submits credentials on the login page
2. Frontend POSTs to `/auth/login`
3. Backend returns a JWT access token
4. Frontend stores token in `localStorage`
5. All subsequent API calls include `Authorization: Bearer <token>` header
6. On 401/403 response, the frontend clears the session and redirects to login

Relevant source: `src/api/client.js`, `src/api/session.js`, `src/api/auth.js`

---

## Session management

- Token is stored in `localStorage` as `access_token`
- `isAuthenticated()` checks for token presence
- A global fetch interceptor (`installAuthRedirectHandler`) monitors all API responses for 401/403
- Protected pages redirect to login if no valid session exists

---

## Base path

The application is served under `/elettra/` in both development and production. This is configured via `base: "/elettra/"` in `vite.config.js`.

---

## Key architectural decisions

| Decision | Rationale |
|----------|-----------|
| No frontend framework | Lightweight, fast loading, minimal dependencies |
| Hash-based routing | Simple SPA navigation without server-side routing rules |
| D3.js for charts | Full control over visualizations, no chart library lock-in |
| Leaflet for maps | Lightweight, well-supported for geographic features |
| JWT in localStorage | Simple session management for a tool-oriented application |
| Vite proxy in dev | Avoids CORS issues without backend configuration changes |

---

## Related documentation

- [Frontend Structure](frontend-structure.md) — Code organization and patterns
- [API Integration](api-integration.md) — How API calls are made
- [Deployment: Docker](../deployment/docker.md) — Production nginx setup

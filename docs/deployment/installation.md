# Installation

> Last updated: 2026-06-01

Detailed instructions for installing and running ELETTRA directly from source (without Docker).

---

## Prerequisites

| Tool | Required Version | Check Command |
|------|------------------|---------------|
| Node.js | **20.19+** or **22.12+** | `node --version` |
| npm | 10.x or higher | `npm --version` |

> Vite 7.x requires Node.js 20.19+ or 22.12+. If you see `crypto.hash is not a function`, upgrade Node.js.

---

## Install dependencies

```bash
npm ci
```

This installs:
- **Vite** — fast build tool and development server
- **D3.js** — data visualization library (charts)
- **Leaflet** — interactive map library (custom stops)

If you prefer, `npm install` also works, but `npm ci` is the cleaner choice when using the committed lockfile.

---

## Start the development server

```bash
npm run dev -- --host 0.0.0.0 --port 9010
```

The development server provides:
- Hot Module Replacement (HMR)
- API proxy to the backend (default: `http://isaac-elettra.dacd.supsi.ch:8002`)
- Source maps for debugging

Open: <http://localhost:9010/elettra/>

---

## Configure the backend proxy

The frontend can run with no extra configuration if the default proxy target is reachable. To override:

```bash
export VITE_API_PROXY_TARGET=http://localhost:8002
```

See [Environment Variables](environment-variables.md) for all available options.

---

## Build for production

```bash
npm run build
```

Output is generated in `dist/`:
- Minified JavaScript bundles
- Optimized CSS
- Copied static assets

The application is configured to run under the `/elettra/` base path.

---

## Preview the production build

```bash
npm run preview
```

Serves the production build locally on port 9010 for testing before deployment.

---

## Deploy to a web server

Copy `dist/` contents to your web server. Example nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /elettra/ {
        alias /var/www/elettra/;
        try_files $uri $uri/ /elettra/index.html;
    }

    location /auth {
        proxy_pass http://your-api-server:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://your-api-server:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Backend dependency

This repository is frontend-only. Login, fleet data, GTFS data, shift persistence, and simulation execution all require a reachable backend implementing the `/auth` and `/api` endpoints.

Backend Swagger documentation: <http://isaac-elettra.dacd.supsi.ch:8002/docs>

---

## Troubleshooting

### Node.js version too old

```
Vite requires Node.js version 20.19+ or 22.12+
```

**Solution** using nvm:

```bash
nvm install 22
nvm use 22
```

### Port already in use

```bash
lsof -i :9010
kill -9 <PID>
```

### Node modules issues

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### API connection issues

1. Verify the backend is accessible: `curl http://isaac-elettra.dacd.supsi.ch:8002/health`
2. Check proxy configuration in `vite.config.js`
3. Ensure `VITE_API_ROOT` is correctly set for production builds

---

## Project structure

```
elettra/
├── public/              # Static assets
│   └── assets/
├── src/
│   ├── api/             # API client modules
│   ├── config/          # Domain defaults and constants
│   ├── dom/             # DOM utilities
│   ├── i18n/            # Internationalization
│   ├── pages/           # Page components
│   │   ├── Fleet/       # Buses, Shifts, Custom Stops
│   │   ├── Simulation/  # Runs, YearlyAnalysis
│   │   ├── Auth/        # Login, Register
│   │   ├── Account/     # Settings
│   │   └── About/
│   ├── utils/           # Utility functions
│   ├── config.js        # Runtime configuration
│   ├── main.js          # Entry point
│   ├── navigation.js    # SPA routing
│   └── style.css        # Global styles
├── docker/              # Docker configuration
├── docs/                # Documentation (this folder)
├── index.html           # HTML entry point
├── package.json         # Dependencies
└── vite.config.js       # Vite configuration
```

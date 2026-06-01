# Getting Started

> Last updated: 2026-06-01

Get ELETTRA running on your machine in under 5 minutes.

---

## Prerequisites

| Tool | Required Version | Check Command |
|------|------------------|---------------|
| Node.js | **20.19+** or **22.12+** | `node --version` |
| npm | 10.x or higher | `npm --version` |
| Docker (optional) | 20.x or higher | `docker --version` |
| Docker Compose (optional) | 2.x or higher | `docker compose version` |

> **Important**: Vite 7.x requires Node.js 20.19+ or 22.12+. Earlier versions are not supported.

---

## Quick start

```bash
# Clone the repository
git clone https://github.com/SUPSI-IDe/elettra.git
cd elettra

# Install dependencies
npm ci

# Start development server
npm run dev
```

Open: <http://localhost:9010/elettra/>

---

## Configuration (optional)

The frontend runs with zero configuration if the default backend proxy target (`http://isaac-elettra.dacd.supsi.ch:8002`) is reachable.

To override the backend target:

```bash
export VITE_API_PROXY_TARGET=http://localhost:8002
```

For test credentials, copy the example env file:

```bash
cp .env.example .env
```

See [Environment Variables](deployment/environment-variables.md) for the full reference.

---

## First-use workflow

1. **Login or register** — The application opens on the login page. Create an account or use provided credentials.
2. **Set up fleet data** — Navigate to **Fleet > Buses** to create bus models with battery and cost specifications.
3. **Define shifts** — Go to **Fleet > Shifts** to create shifts bound to GTFS routes and trips.
4. **Run a feasibility evaluation** — Navigate to **Simulation > Feasibility evaluation**, select shifts, configure parameters, and launch.
5. **View results** — Once complete, inspect cost breakdowns, efficiency charts, and battery adequacy.

See the [User Guide](user-guide/overview.md) for detailed instructions on each step.

---

## Production build

```bash
npm run build     # Output in dist/
npm run preview   # Preview locally before deploying
```

---

## Docker alternative

If you prefer Docker, see [Docker Deployment](deployment/docker.md):

```bash
cd docker
cp env.example .env
docker compose --profile dev up --build
```

---

## Next steps

- [User Guide: Overview](user-guide/overview.md) — Learn the full feature set
- [Deployment: Installation](deployment/installation.md) — Detailed installation instructions
- [Glossary](glossary.md) — Domain terminology reference

# Elettra - Installation & Deployment Guide

Elettra is a modern web-based Electric Shift Planner for bus fleet management. This guide covers installation, development, production builds, and Docker deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Development Setup](#development-setup)
4. [Environment Variables](#environment-variables)
5. [Building for Production](#building-for-production)
6. [Docker Deployment](#docker-deployment)
   - [Development with Docker](#development-with-docker)
   - [Production with Docker](#production-with-docker)
   - [Docker Compose](#docker-compose)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Required Version | Check Command |
|------|------------------|---------------|
| Node.js | **20.19+** or **22.12+** | `node --version` |
| npm | 10.x or higher | `npm --version` |
| Docker (optional) | 20.x or higher | `docker --version` |
| Docker Compose (optional) | 2.x or higher | `docker compose version` |

> **Important**: Vite 7.x requires Node.js 20.19+ or 22.12+. Node.js 18.x and earlier versions are **not supported**.

---

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd elettra

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173/elettra/`

---

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

This installs:
- **Vite** - Fast build tool and development server
- **D3.js** - Data visualization library
- **Leaflet** - Interactive maps library

### 2. Start Development Server

```bash
npm run dev
```

The development server provides:
- Hot Module Replacement (HMR)
- API proxy to backend (`http://isaac-elettra.dacd.supsi.ch:8002`)
- Source maps for debugging

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:5173/elettra/
```

---

## Environment Variables

Elettra uses environment variables for configuration. Create a `.env` file in the project root:

```env
# API Configuration
# Override the default API root URL (optional in development due to proxy)
VITE_API_ROOT=http://your-api-server:8002

# Testing (optional)
# Pre-filled authentication token for development
VITE_TEST_PASSWORD=your-test-token
```

### Variable Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_ROOT` | Backend API base URL | Empty (uses proxy in dev) |
| `VITE_TEST_PASSWORD` | Development auth token | Empty |

> **Note**: All environment variables must be prefixed with `VITE_` to be exposed to the client-side code.

---

## Building for Production

### 1. Create Production Build

```bash
npm run build
```

This generates optimized static files in the `dist/` directory:
- Minified JavaScript bundles
- Optimized CSS
- Copied static assets

### 2. Preview Production Build

```bash
npm run preview
```

This serves the production build locally for testing before deployment.

### 3. Deploy

Copy the contents of the `dist/` directory to your web server. The application is configured to run under the `/elettra/` path.

**Example with nginx:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /elettra/ {
        alias /var/www/elettra/;
        try_files $uri $uri/ /elettra/index.html;
    }

    # Proxy API requests to backend
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

## Docker Deployment

All Docker-related files are located in the `docker/` folder. Navigate to this folder to run Docker commands.

### Docker Folder Structure

```
docker/
├── Dockerfile           # Production multi-stage build
├── Dockerfile.dev       # Development container
├── docker-compose.yml   # Orchestration file
├── nginx.conf.template  # Nginx configuration
└── env.example          # Environment variables template
```

### Quick Start with Docker

```bash
# Navigate to docker folder
cd docker

# Copy environment template
cp env.example .env

# Start development environment
docker compose --profile dev up

# Or start production environment
docker compose --profile prod up -d
```

### Development with Docker

From the `docker/` folder:

```bash
cd docker

# Start development with hot reload
docker compose --profile dev up

# Or build and run manually
docker build -f Dockerfile.dev -t elettra-dev ..
docker run -it --rm \
  -p 5173:5173 \
  -v $(pwd)/..:/app \
  -v /app/node_modules \
  elettra-dev
```

Access the application at `http://localhost:5173/elettra/`

### Production with Docker

From the `docker/` folder:

```bash
cd docker

# Build and start production
docker compose --profile prod up -d --build

# Or build and run manually
docker build -f Dockerfile -t elettra:latest ..
docker run -d \
  --name elettra \
  -p 80:80 \
  -e API_BACKEND_URL=http://isaac-elettra.dacd.supsi.ch:8002 \
  elettra:latest
```

Access the application at `http://localhost/elettra/`

### Docker Compose Commands

All commands should be run from the `docker/` folder:

```bash
cd docker

# Start development environment
docker compose --profile dev up

# Start production environment (detached)
docker compose --profile prod up -d

# Build and start production
docker compose --profile prod up -d --build

# View logs
docker compose logs -f elettra

# Stop development
docker compose --profile dev down

# Stop production
docker compose --profile prod down

# Rebuild without cache
docker compose --profile prod build --no-cache
```

### Environment Configuration

Copy `env.example` to `.env` in the `docker/` folder:

```bash
cd docker
cp env.example .env
```

Available variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `API_BACKEND_URL` | Backend API URL (runtime) | `http://isaac-elettra.dacd.supsi.ch:8002` |
| `VITE_API_ROOT` | API URL for build (build-time) | Empty (uses nginx proxy) |

---

## Troubleshooting

### Common Issues

#### Node.js Version Too Old

If you see errors like:
```
npm WARN EBADENGINE Unsupported engine { required: { node: '^20.19.0 || >=22.12.0' } }
```
or
```
Vite requires Node.js version 20.19+ or 22.12+
TypeError: crypto.hash is not a function
```

**Solution**: Upgrade Node.js to version 20.19+ or 22.12+

Using **nvm** (recommended):
```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Restart terminal or source nvm
source ~/.nvm/nvm.sh

# Install and use Node.js 22
nvm install 22
nvm use 22

# Verify version
node --version  # Should show v22.x.x
```

Using **apt** (Ubuntu/Debian):
```bash
# Add NodeSource repository for Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify version
node --version
```

#### Port Already in Use

```bash
# Find process using port 5173
lsof -i :5173

# Kill the process
kill -9 <PID>
```

#### Node Modules Issues

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### Docker Build Fails

```bash
cd docker

# Clean Docker build cache
docker builder prune

# Rebuild without cache
docker compose --profile prod build --no-cache
```

#### API Connection Issues

1. Verify the backend is accessible:
   ```bash
   curl http://isaac-elettra.dacd.supsi.ch:8002/health
   ```

2. Check proxy configuration in `vite.config.js`

3. Ensure `VITE_API_ROOT` is correctly set for production builds

### Getting Help

- Check the [API Reference](./API_REFERENCE.md) for backend endpoints
- Backend Swagger documentation: http://isaac-elettra.dacd.supsi.ch:8002/docs

---

## Project Structure

```
elettra/
├── public/              # Static assets
│   └── assets/
├── src/
│   ├── api/             # API client modules
│   ├── dom/             # DOM utilities
│   ├── i18n/            # Internationalization
│   ├── pages/           # Page components
│   │   └── Fleet/
│   │       ├── Buses/
│   │       ├── Custom Stops/
│   │       └── Shifts/
│   ├── config.js        # Configuration
│   ├── main.js          # Entry point
│   ├── navigation.js    # Routing
│   └── style.css        # Global styles
├── docker/              # Docker configuration
│   ├── Dockerfile       # Production build
│   ├── Dockerfile.dev   # Development build
│   ├── docker-compose.yml
│   ├── nginx.conf.template
│   └── env.example
├── index.html           # HTML entry point
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── INSTALL.md           # This file
```

---

## License

See [LICENSE](./LICENSE) for details.

# Dockerfile - Production build for Elettra
# Multi-stage build for optimized image size

# Stage 1: Build the application
# Vite 7.x requires Node.js 20.19+ or 22.12+
FROM node:22.22.0-alpine AS builder

WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
ARG NPM_REGISTRY=https://registry.npmjs.org/

# Copy package files for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_MAXSOCKETS=1 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
    HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY} \
    http_proxy=${http_proxy} \
    https_proxy=${https_proxy} \
    no_proxy=${no_proxy}
RUN NODE_OPTIONS=--dns-result-order=ipv4first npm ci || { \
      status="$?"; \
      node -e "require.resolve('vite/package.json'); require.resolve('d3/package.json'); require.resolve('leaflet/package.json')" \
        && echo 'npm ci hit the known npm exit-handler bug after installing dependencies; continuing with validated node_modules.' \
        && exit 0; \
      echo 'npm ci failed before dependencies were usable.'; \
      find /root/.npm/_logs -maxdepth 1 -type f -name '*-debug-0.log' -print -exec cat {} \; 2>/dev/null || true; \
      exit "$status"; \
    }

# Copy source code
COPY . .

# Accept build-time environment variables
ARG VITE_API_ROOT
ENV VITE_API_ROOT=$VITE_API_ROOT

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx configuration template
# Note: $$ in template escapes to $ after envsubst (for nginx variables)
# ${VAR} gets substituted with environment variable values
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html/elettra

# Expose port 80
EXPOSE 80

# Default environment variables
ENV API_BACKEND_URL=http://isaac-elettra.dacd.supsi.ch:8002

# Start nginx (envsubst is handled by nginx docker image automatically)
CMD ["nginx", "-g", "daemon off;"]

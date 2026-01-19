# Dockerfile - Production build for Elettra
# Multi-stage build for optimized image size

# Stage 1: Build the application
# Vite 7.x requires Node.js 20.19+ or 22.12+
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Accept build-time environment variables
ARG VITE_API_ROOT
ENV VITE_API_ROOT=$VITE_API_ROOT

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy custom nginx configuration template
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html/elettra

# Expose port 80
EXPOSE 80

# Default environment variables
ENV API_BACKEND_URL=http://isaac-elettra.dacd.supsi.ch:8002

# Start nginx (envsubst is handled by nginx docker image automatically)
CMD ["nginx", "-g", "daemon off;"]

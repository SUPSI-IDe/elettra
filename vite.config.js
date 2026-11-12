import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

// Local development must never fall through to production. Deployments can
// still provide their explicit target through VITE_API_PROXY_TARGET.
const API_ROOT = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:9005";
const DEFAULT_ALLOWED_HOSTS = ["isaac-elettra.dacd.supsi.ch", "bismuto.supsi.ch"];
const allowedHosts = [
  ...new Set([
    ...DEFAULT_ALLOWED_HOSTS,
    ...(process.env.VITE_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  ]),
];
const proxy = {
  "/auth": {
    target: API_ROOT,
    changeOrigin: true,
    secure: false,
  },
  "/api": {
    target: API_ROOT,
    changeOrigin: true,
    secure: false,
  },
};

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const E2E_VERSION = process.env.ELETTRA_E2E_VERSION;
const deterministicVersionPlugin = E2E_VERSION
  ? {
      name: "elettra-e2e-version",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = new URL(request.url || "/", "http://localhost").pathname;
          if (request.method !== "GET" || pathname !== "/api/v1/version") {
            next();
            return;
          }

          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ version: E2E_VERSION }));
        });
      },
    }
  : null;

export default defineConfig({
  base: "/elettra/",
  plugins: [deterministicVersionPlugin].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version),
  },
  build: {
    // The translation catalogue is intentionally a single shared module and
    // currently minifies to about 612 kB. Keep vendor and translation chunks
    // explicit, while leaving lazy feature boundaries to Rolldown. Forcing
    // overlapping feature groups can create circular chunks whose imports are
    // still undefined when the production bundle is evaluated.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        app: path.resolve(rootDir, "index.html"),
        guide: path.resolve(rootDir, "guide/index.html"),
      },
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name: "vendor-leaflet",
              test: /node_modules[\\/]leaflet/,
              priority: 20,
            },
            {
              name: "vendor-d3",
              test: /node_modules[\\/]d3(?:-|[\\/])/,
              priority: 20,
            },
            { name: "app-i18n", test: /src[\\/]i18n[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 9010,
    strictPort: true,
    proxy,
    allowedHosts,
  },
  preview: {
    host: true,
    port: 9010,
    strictPort: true,
    proxy,
    allowedHosts,
  },

  resolve: {
    alias: {
      "@partials": path.resolve(rootDir, "src/partials"),
    },
  },
});

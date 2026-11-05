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

export default defineConfig({
  base: "/elettra/",
  define: {
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version),
  },
  build: {
    // The translation catalogue is intentionally a single shared module and
    // currently minifies to about 612 kB. Feature and vendor code must stay
    // below that explicit ceiling instead of being folded into one app chunk.
    chunkSizeWarningLimit: 650,
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
            {
              name: "feature-feasibility",
              test: /src[\\/]pages[\\/]Simulation[\\/]Runs[\\/]/,
              priority: 10,
            },
            {
              name: "feature-yearly-analysis",
              test: /src[\\/]pages[\\/]Simulation[\\/]YearlyAnalysis[\\/]/,
              priority: 10,
            },
            {
              name: "feature-analysis-comparison",
              test: /src[\\/]pages[\\/]Simulation[\\/]AnalysisComparison[\\/]/,
              priority: 10,
            },
            {
              name: "feature-fleet",
              test: /src[\\/]pages[\\/]Fleet[\\/]/,
              priority: 10,
            },
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

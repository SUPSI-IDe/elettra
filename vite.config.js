import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API_ROOT = process.env.VITE_API_PROXY_TARGET || "http://isaac-elettra.dacd.supsi.ch:8002";
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

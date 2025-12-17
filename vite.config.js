import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API_ROOT = "http://isaac-elettra.dacd.supsi.ch:8002";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/elettra/",
  server: {
    proxy: {
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
    },
  },

  resolve: {
    alias: {
      "@partials": path.resolve(rootDir, "src/partials"),
    },
  },
});

import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API_ROOT_DEFAULT = "http://isaac-elettra.dacd.supsi.ch:8002";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Use VITE_PROXY_TARGET if set, otherwise fall back to VITE_API_ROOT or default
  const API_ROOT =
    env.VITE_PROXY_TARGET || env.VITE_API_ROOT || API_ROOT_DEFAULT;

  return {
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
  };
});

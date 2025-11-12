import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API_ROOT = 'http://isaac-elettra.dacd.supsi.ch:8002';
const TEST_EMAIL = 'test@supsi.ch';
const TEST_PASSWORD = '>tha0-!UdLb.hZ@aP)*x';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    server: {
        proxy: {
            '/auth': {
                target: API_ROOT,
                changeOrigin: true,
                secure: false,
            },
            '/api': {
                target: API_ROOT,
                changeOrigin: true,
                secure: false,
            },
        },
    },
    define: {
        'import.meta.env.VITE_TEST_EMAIL': JSON.stringify(TEST_EMAIL),
        'import.meta.env.VITE_TEST_PASSWORD': JSON.stringify(TEST_PASSWORD),
    },
    resolve: {
        alias: {
            '@partials': path.resolve(rootDir, 'src/partials'),
        },
    },
});


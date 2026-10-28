import { defineConfig } from 'vite';
import { vitePfPlugin } from '../../packages/infra-engine/src/lib/vite-pf-plugin.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  root: '.',
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'infra-control': resolve(__dirname, 'infra-control.html'),
      },
      output: {
        manualChunks(id) {
          if (
            id.includes('demo-snapshot') ||
            id.includes('weighted-index') ||
            id.includes('permission-engine') ||
            id.includes('bit-index') ||
            id.includes('weighted-ui')
          ) {
            return 'vendor-sdk';
          }
        },
      },
    },
  },
  plugins: [
    vitePfPlugin({
      service: 'platform-demo',
      note: 'Vite dev — RLSC Inspector + platform demo',
    }),
  ],
  server: {
    port: 5176,
    proxy: {
      '/api/diagrams': 'http://localhost:3300',
      '/api/event-catalog': 'http://localhost:3300',
      '/api/services': 'http://localhost:3300',
      '/api/endpoints': 'http://localhost:3300',
      '/v1': 'http://localhost:3200',
      '/api': 'http://localhost:8787',
    },
  },
});

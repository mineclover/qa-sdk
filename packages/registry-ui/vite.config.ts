import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  appType: 'spa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:3300',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

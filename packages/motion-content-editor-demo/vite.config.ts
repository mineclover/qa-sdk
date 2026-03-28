import { resolve } from "node:path";
import { defineConfig } from "vite";

const workspaceServiceTarget = process.env["MOTION_WORKSPACE_SERVICE_ORIGIN"] ?? "http://localhost:3710";

const workspaceProxy = {
  target: workspaceServiceTarget,
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/api\/motion-workspace/, ""),
};

export default defineConfig({
  root: ".",
  appType: "mpa",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        inspector: resolve(__dirname, "inspector.html"),
      },
    },
  },
  server: {
    port: 5179,
    proxy: {
      "/api/motion-workspace": workspaceProxy,
    },
  },
  preview: {
    port: 4179,
    proxy: {
      "/api/motion-workspace": workspaceProxy,
    },
  },
});

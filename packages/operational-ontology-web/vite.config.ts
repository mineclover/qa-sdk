import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  appType: "spa",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5187,
  },
});

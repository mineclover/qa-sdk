import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        pipePreview: new URL("./pipe-preview.html", import.meta.url).pathname,
        pipeDesign: new URL("./pipe-design.html", import.meta.url).pathname,
        scopeNesting: new URL("./scope-nesting.html", import.meta.url).pathname,
        conceptHierarchy: new URL("./concept-hierarchy.html", import.meta.url).pathname,
        dataStructureProfile: new URL("./data-structure-profile.html", import.meta.url).pathname,
      },
    },
  },
  server: {
    port: 5200,
  },
});

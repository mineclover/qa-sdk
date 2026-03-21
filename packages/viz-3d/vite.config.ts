import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        // Three.js 무의존 순수 모듈 (브라우저 직접 사용 가능)
        core: resolve(__dirname, "src/core-bundle.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist",
    rollupOptions: {
      external: ["three", /^three\//],
    },
  },
});

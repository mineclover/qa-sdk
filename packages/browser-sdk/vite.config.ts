import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "QaMonitor",
      formats: ["es", "umd"],
      fileName: (format) =>
        format === "es" ? "qa-browser-sdk.js" : "qa-browser-sdk.umd.cjs",
    },
    // 단일 번들 파일 — chunk splitting 비활성화
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    sourcemap: true,
  },
  resolve: {
    conditions: ["source"],
    alias: {
      // viz-3d 소스 직접 참조 (subpath export 없이 내부 모듈 접근)
      "@qa-sdk/viz-3d/src/": resolve(__dirname, "../viz-3d/src/"),
    },
  },
});

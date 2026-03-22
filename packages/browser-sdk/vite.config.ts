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
    // 단일 번들 파일 — 의존성을 외부화하지 않음
    rollupOptions: {},
    sourcemap: true,
  },
  resolve: {
    // workspace 패키지를 소스에서 직접 참조
    conditions: ["source"],
  },
});

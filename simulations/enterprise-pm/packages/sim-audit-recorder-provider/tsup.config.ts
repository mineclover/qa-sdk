import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/memory-sqlite-fixture.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
  splitting: false,
});

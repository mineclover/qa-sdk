import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  external: ["@qa-sdk/core"],
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
});

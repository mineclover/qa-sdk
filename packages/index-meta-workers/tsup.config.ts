import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "browser",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});

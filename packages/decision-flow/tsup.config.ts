import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  ignoreWatch: ["**/*.test.ts"],
});

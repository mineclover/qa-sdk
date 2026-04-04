import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/primitives.ts",
    "src/shapes.ts",
    "src/pipe-mermaid.ts",
    "src/scope-mermaid.ts",
    "src/scope-d3.ts",
    "src/pipe-svg.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
});

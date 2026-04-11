import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/schema.ts",
    "src/pack.ts",
    "src/governance.ts",
    "src/runtime.ts",
    "src/lineage.ts",
    "src/corridor.ts",
    "src/junction.ts",
    "src/checkpoint.ts",
    "src/topology.ts",
    "src/projectors.ts",
    "src/projectors-event.ts",
    "src/projectors-pipe.ts",
    "src/projectors-path.ts",
    "src/projectors-snapshot.ts",
    "src/persistence.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  ignoreWatch: ["**/*.test.ts"],
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/domain/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2023",
  splitting: false,
  onSuccess:
    "mkdir -p dist/domain/files && cp -R src/domain/files/. dist/domain/files/. && cp src/domain/schema.json dist/domain/schema.json",
});

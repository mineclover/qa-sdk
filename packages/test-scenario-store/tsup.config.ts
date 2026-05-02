import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  onSuccess: "mkdir -p dist/drizzle && cp -r drizzle/. dist/drizzle/ 2>/dev/null || true",
});

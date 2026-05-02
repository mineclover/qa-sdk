import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["server.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "node",
  splitting: false,
  clean: true,
  external: ["@hono/node-server", "hono"],
});

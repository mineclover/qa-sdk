import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "node",
  splitting: false,
  clean: true,
  external: [
    // npm 패키지
    "@hono/node-server",
    "dotenv",
    "hono",
    "zod",
    // workspace 패키지
    "@qa-sdk/core",
    "@qa-sdk/logger",
    "index-meta",
    "pino",
    "weighted-index",
  ],
});

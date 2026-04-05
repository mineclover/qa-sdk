import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "node",
  splitting: false,
  clean: true,
  external: [
    // npm 패키지
    "@hono/node-server",
    "@hono/node-ws",
    "drizzle-orm",
    "hono",
    "zod",
    // workspace 패키지
    "@qa-sdk/core",
    "@qa-sdk/logger",
    "index-meta",
    "motion-workspace",
  ],
  // drizzle 마이그레이션 복사
  onSuccess: "cp -r drizzle dist/ 2>/dev/null || true",
});

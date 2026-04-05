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
    "@nestjs/common",
    "@nestjs/core",
    "@nestjs/graphql",
    "@nestjs/mercurius",
    "@nestjs/platform-fastify",
    "better-sqlite3",
    "drizzle-orm",
    "graphql",
    "mercurius",
    "reflect-metadata",
    "rxjs",
    "zod",
    // workspace 패키지
    "@qa-sdk/core",
    "@qa-sdk/logger",
    "definition-catalog",
    "work-domain",
  ],
  // drizzle 마이그레이션 복사
  onSuccess: "cp -r drizzle dist/ 2>/dev/null || true",
});

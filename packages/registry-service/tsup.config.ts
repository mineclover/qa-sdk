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
    "@nestjs/platform-fastify",
    "@nestjs/platform-ws",
    "@nestjs/websockets",
    "dotenv",
    "drizzle-orm",
    "reflect-metadata",
    "rxjs",
    "ws",
    "zod",
    // workspace 패키지
    "@qa-sdk/core",
    "@qa-sdk/definition-client",
    "@qa-sdk/event-catalog",
    "@qa-sdk/logger",
    "@qa-sdk/otel",
    "definition-catalog",
    "index-meta",
    "pino",
    "pipe-store-sqlite",
    "weighted-index",
    // peerDependencies
    "@qa-sdk/spec-core",
    // devDeps — 테스트에서만 사용
    "@nestjs/testing",
    "@opentelemetry/api",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/sdk-trace-node",
    "demo-snapshot",
  ],
  // drizzle 마이그레이션 복사
  onSuccess: "cp -r drizzle dist/ 2>/dev/null || true",
});

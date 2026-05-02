import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "es2023",
  platform: "node",
  splitting: false,
  clean: true,
  // 외부 모듈은 번들하지 않음 — node_modules에서 resolve
  external: [
    "@grpc/grpc-js",
    "@grpc/proto-loader",
    "@hono/node-server",
    "@hono/node-ws",
    "@msgpack/msgpack",
    "bullmq",
    "dotenv",
    "drizzle-orm",
    "hono",
    "ws",
    "zod",
    // workspace 패키지도 external (node_modules 심링크 유지)
    "@qa-sdk/core",
    "@qa-sdk/codec-proto",
    "@qa-sdk/engine",
    "@qa-sdk/otel",
    "@qa-sdk/registry-client",
    "@qa-sdk/store",
    "index-meta",
    "pino",
    // devDeps — 동적 import로만 사용 (번들 제외)
    "@qa-sdk/spec-core",
    "@qa-sdk/convergence",
    "demo-snapshot",
  ],
  // drizzle 마이그레이션 복사
  onSuccess: "cp -r drizzle dist/ 2>/dev/null || true",
});

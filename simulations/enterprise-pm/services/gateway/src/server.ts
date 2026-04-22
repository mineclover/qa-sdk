// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { BitmapCacheService } from "@qa-sdk/sim-bitmap-cache";
import Redis from "ioredis";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

const SERVICE_NAME = "sim-gateway";
const logger = createLogger(SERVICE_NAME);

const otelShutdown = initTelemetry({
  serviceName: SERVICE_NAME,
  env: otelEnvSchema.parse(process.env),
});

// §5 Invalidation Subscriber — gateway는 Hono 기반(NestJS DI 없음) → 직접 인스턴스화.
// publisher 미활성 — gateway는 pub만 소비.
const bitmapCache = new BitmapCacheService({
  subscriberRedis: new Redis(env.SIM_REDIS_URL),
  publisherName: SERVICE_NAME,
  cache: { max: 10_000 },
  logger: {
    info: (obj, msg) => logger.info(obj as Record<string, unknown>, msg),
    warn: (obj, msg) => logger.warn(obj as Record<string, unknown>, msg),
    error: (obj, msg) => logger.error(obj as Record<string, unknown>, msg),
  },
});

await bitmapCache.start();

const app = createApp({
  authApiUrl: env.AUTH_API_URL,
  jwtSecret: env.JWT_SECRET,
  jwtTtlSeconds: env.JWT_TTL_SECONDS,
  currentBitmapV: env.BITMAP_VERSION, // §2 §6 unified version
  proxyTimeoutMs: env.PROXY_TIMEOUT_MS,
  proxyTargets: {
    "sim-pm-api": env.PM_API_URL,
    "sim-approval-api": env.APPROVAL_API_URL,
    "sim-notification-api": env.NOTIFICATION_API_URL,
    "sim-reporting-api": env.REPORTING_API_URL,
    "sim-document-api": env.DOCUMENT_API_URL,
    "sim-audit-browser-api": env.AUDIT_BROWSER_API_URL,
  },
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      authApi: env.AUTH_API_URL,
      currentBitmapV: env.BITMAP_VERSION,
      jwtTtlSeconds: env.JWT_TTL_SECONDS,
      proxyTimeoutMs: env.PROXY_TIMEOUT_MS,
      redisUrl: env.SIM_REDIS_URL,
    },
    `${SERVICE_NAME} listening (Plan 12a/12b JWT + traceparent + bitmap cache)`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);
});

installSimpleShutdown({ server, logger });

process.on("SIGTERM", async () => {
  await bitmapCache.stop();
  await otelShutdown();
});
process.on("SIGINT", async () => {
  await bitmapCache.stop();
  await otelShutdown();
});

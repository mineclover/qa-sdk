// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

const SERVICE_NAME = "sim-gateway";
const logger = createLogger(SERVICE_NAME);

const otelShutdown = initTelemetry({
  serviceName: SERVICE_NAME,
  env: otelEnvSchema.parse(process.env),
});

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
    },
    `${SERVICE_NAME} listening (Plan 12a JWT + traceparent + reverse proxy)`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);
});

installSimpleShutdown({ server, logger });

process.on("SIGTERM", () => void otelShutdown());
process.on("SIGINT", () => void otelShutdown());

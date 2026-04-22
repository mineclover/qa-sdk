// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

// NOTE: reflect-metadata는 Hono 서비스에서 불필요 — decode-service 패턴과 일치.
// 본 plan 10c Task 4의 초기 snippet은 NestJS 패턴을 실수로 복제. metrics-collector(동일 plan)는 미포함.
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

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      authApi: env.AUTH_API_URL,
      pmApi: env.PM_API_URL,
      approvalApi: env.APPROVAL_API_URL,
      notificationApi: env.NOTIFICATION_API_URL,
      reportingApi: env.REPORTING_API_URL,
      documentApi: env.DOCUMENT_API_URL,
      auditBrowserApi: env.AUDIT_BROWSER_API_URL,
    },
    `${SERVICE_NAME} listening`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);
});

installSimpleShutdown({ server, logger });

process.on("SIGTERM", () => void otelShutdown());
process.on("SIGINT", () => void otelShutdown());

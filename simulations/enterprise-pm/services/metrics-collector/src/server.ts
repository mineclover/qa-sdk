// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createMetricsRegistry } from "./lib/registry.js";

const SERVICE_NAME = "sim-metrics-collector";
const logger = createLogger(SERVICE_NAME);

const otelShutdown = initTelemetry({
  serviceName: SERVICE_NAME,
  env: otelEnvSchema.parse(process.env),
});

const { registry } = createMetricsRegistry({ serviceName: SERVICE_NAME });
const app = createApp({ registry });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, `${SERVICE_NAME} listening`);
  warnPortConflict(SERVICE_NAME, env.PORT, logger);
});

installSimpleShutdown({ server, logger });

process.on("SIGTERM", () => void otelShutdown());
process.on("SIGINT", () => void otelShutdown());

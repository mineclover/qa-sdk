import "dotenv/config";
import { serve } from "@hono/node-server";
import {
  createSqliteDriver,
  SqlAddressStateStore,
} from "index-meta";
import { warnPortConflict, installSimpleShutdown, createServiceBootConfig } from "@qa-sdk/core";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { createGateService } from "./lib/gate-service.js";
import { createLogger } from "./lib/logger.js";

const logger = createLogger("gate-service");

const driver = await createSqliteDriver({
  driver: env.SQLITE_DRIVER,
  path: env.SQLITE_PATH,
});

const addressStateStore = new SqlAddressStateStore(driver);
const gateService = createGateService({ addressStateStore });
const startedAt = Date.now();

const app = createApp({
  gateService,
  logger,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
});

const serviceConfig = createServiceBootConfig("gate-service");
const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({
    port: info.port,
    service: `${serviceConfig.namespace}/${serviceConfig.name}`,
    env: serviceConfig.env,
    region: serviceConfig.region,
  }, "gate-service listening");
  warnPortConflict("gate-service", env.PORT, logger);
});

installSimpleShutdown({ server, logger });

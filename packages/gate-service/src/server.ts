import { serve } from "@hono/node-server";
import {
  createSqliteDriver,
  SqlAddressStateStore,
} from "index-meta";
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

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "gate-service listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "shutdown requested");
  server.close(() => {
    logger.info("shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

import { serve } from "@hono/node-server";
import { installSimpleShutdown } from "@qa-sdk/core";
import { env } from "./config/env.js";
import { createDb, closeClient } from "./db/client.js";
import { createApp } from "./app.js";
import { createLogger } from "./lib/logger.js";
import { createDbHealthChecker } from "./routes/health.js";

const db = createDb(env.DATABASE_URL);
const logger = createLogger("registry-server");
const app = createApp(db, {
  checkDbHealth: createDbHealthChecker(db),
  corsOrigin: env.CORS_ORIGIN,
  logger,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "registry server listening");
});

installSimpleShutdown({
  server,
  logger,
  cleanup: () => closeClient(env.DATABASE_URL),
});

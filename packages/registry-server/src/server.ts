import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { createDb, closeClient } from "./db/client.js";
import { createApp } from "./app.js";
import { createLogger } from "./lib/logger.js";
import { createDbHealthChecker } from "./routes/health.js";

const db = createDb(env.DATABASE_URL);
const logger = createLogger("registry-server");
const app = createApp(db, {
  checkDbHealth: createDbHealthChecker(db),
  logger,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "registry server listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutdown requested");
  server.close(() => {
    closeClient(env.DATABASE_URL)
      .then(() => {
        logger.info("shutdown complete");
        process.exit(0);
      })
      .catch((err) => {
        logger.error({ err }, "error during shutdown");
        process.exit(1);
      });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

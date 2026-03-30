import { serve } from "@hono/node-server";
import { createLogger } from "./lib/logger.js";
import {
  createApp,
  createMotionWorkspaceRepository,
  createMotionWorkspaceServiceInfo,
} from "./index.js";
import { env } from "./config/env.js";

const logger = createLogger("motion-workspace-service");

const repository = createMotionWorkspaceRepository({
  path: env.SQLITE_PATH,
});
const info = createMotionWorkspaceServiceInfo();
const startedAt = Date.now();

const app = createApp({
  repository,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
});

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
}, (serverInfo) => {
  logger.info(
    { serviceId: info.serviceId, persistence: info.defaultPersistence, port: serverInfo.port },
    "서비스 시작",
  );
});
app.injectWebSocket(server);

async function shutdown(): Promise<void> {
  server.close();
  await repository.close();
}

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

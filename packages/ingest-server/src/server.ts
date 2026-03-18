import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { RegistryClient } from "@qa-sdk/registry-client";
import { closeClient, createDb, withTransaction } from "@qa-sdk/store";
import {
  DrizzleGraphStore,
  DrizzleRecordStore,
  DrizzleScenarioSpecStore,
  DrizzleSessionStore,
  DrizzleTraceStore,
  DrizzleTransmissionStore,
  DrizzleVerdictStore,
  DrizzleDlqStore,
} from "@qa-sdk/store";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { createAppLifecycle } from "./lib/app-lifecycle.js";
import { installGracefulShutdown } from "./lib/graceful-shutdown.js";
import { InMemoryDebugStore } from "./lib/in-memory-debug-store.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";
import { createLogger } from "./lib/logger.js";
import { createStreamConnectionRegistry } from "./lib/stream-connection-registry.js";
import { createWsHandler } from "./routes/ws.js";
import { createDbHealthChecker } from "./routes/health.js";
import {
  cleanupExpiredData,
  createDatabaseCleanupStore,
} from "./lib/cleanup.js";
import { installCleanupScheduler } from "./lib/cleanup-scheduler.js";

// ── Composition Root: port → adapter 바인딩 ─────────────

const db = createDb(env.TRACE_DATABASE_URL);
const logger = createLogger("ingest-server");
const appLifecycle = createAppLifecycle();
const recordStreamBroker = new RecordStreamBroker();
const debugStore = new InMemoryDebugStore();
const streamConnectionRegistry = createStreamConnectionRegistry();
const cleanupStore = createDatabaseCleanupStore(env.TRACE_DATABASE_URL);
const registryValidator = env.REGISTRY_URL
  ? new RegistryClient({
      baseUrl: env.REGISTRY_URL,
      logger,
    })
  : undefined;

const app = createApp({
  appLifecycle,
  checkDbHealth: createDbHealthChecker(db),
  recordStore: new DrizzleRecordStore(db),
  traceStore: new DrizzleTraceStore(db),
  graphStore: new DrizzleGraphStore(db),
  transmissionStore: new DrizzleTransmissionStore(db),
  sessionStore: new DrizzleSessionStore(db),
  verdictStore: new DrizzleVerdictStore(db),
  scenarioSpecStore: new DrizzleScenarioSpecStore(db),
  dlqStore: new DrizzleDlqStore(db),
  cleanupStore,
  debugStore,
  recordStreamBroker,
  streamSubscriptionLimit: env.SSE_SUBSCRIPTION_LIMIT,
  dlqMaxRetryAttempts: env.DLQ_MAX_RETRY_ATTEMPTS,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  registryValidationMode: env.REGISTRY_VALIDATION_MODE,
  registryValidator,
  streamConnectionRegistry,
  withTraceTransaction: (fn) =>
    withTransaction(db, async (tx) =>
      fn({
        recordStore: new DrizzleRecordStore(tx),
        traceStore: new DrizzleTraceStore(tx),
        sessionStore: new DrizzleSessionStore(tx),
      }),
    ),
  logger,
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.get("/v1/ws", upgradeWebSocket(createWsHandler({ recordStreamBroker, logger })));

const cleanupScheduler = installCleanupScheduler({
  enabled: env.CLEANUP_CRON_ENABLED,
  logger,
  runCleanup: () =>
    cleanupExpiredData({
      cleanupStore,
      logger,
    }),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "ingest-server listening");
});

injectWebSocket(server);

installGracefulShutdown({
  appLifecycle,
  closeDb: async () => {
    cleanupScheduler?.stop();
    await closeClient(env.TRACE_DATABASE_URL);
  },
  logger,
  recordStreamBroker,
  server,
  streamConnectionRegistry,
});

import { Hono } from "hono";
import type {
  GraphStore,
  RecordStore,
  ScenarioSpecStore,
  SessionStore,
  TraceStore,
  TransmissionStore,
  VerdictStore,
  DlqStore,
} from "@qa-sdk/core";
import {
  createHealthRoutes,
  type DbHealthChecker,
} from "./routes/health.js";
import {
  createIngestRoutes,
  type RegistryEventValidator,
  type RegistryValidationMode,
  type TraceTransactionRunner,
} from "./routes/ingest.js";
import { createQueryRoutes } from "./routes/query.js";
import { createStreamRoutes } from "./routes/streams.js";
import { createScenarioRoutes } from "./routes/scenario.js";
import { createVerdictRoutes } from "./routes/verdict.js";
import { createDlqRoutes } from "./routes/dlq.js";
import { createCleanupRoutes } from "./routes/cleanup.js";
import { createSessionRoutes } from "./routes/session.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import type { RecordStreamBroker } from "./lib/record-stream-broker.js";
import type { Logger } from "pino";
import { createLogger } from "./lib/logger.js";
import { requestId } from "./middleware/request-id.js";
import { createIngestRateLimiter } from "./middleware/rate-limit.js";
import {
  createAppLifecycle,
  type AppLifecycle,
} from "./lib/app-lifecycle.js";
import {
  createStreamConnectionRegistry,
  type StreamConnectionRegistry,
} from "./lib/stream-connection-registry.js";
import { createShutdownMiddleware } from "./middleware/shutdown.js";
import {
  createNoopCleanupStore,
  type CleanupStore,
} from "./lib/cleanup.js";

export interface AppDeps {
  appLifecycle?: AppLifecycle;
  checkDbHealth?: DbHealthChecker;
  recordStore: RecordStore;
  traceStore: TraceStore;
  graphStore: GraphStore;
  transmissionStore: TransmissionStore;
  sessionStore: SessionStore;
  verdictStore: VerdictStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
  cleanupStore?: CleanupStore;
  recordStreamBroker: RecordStreamBroker;
  streamSubscriptionLimit?: number;
  dlqMaxRetryAttempts?: number;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  registryValidationMode?: RegistryValidationMode;
  registryValidator?: RegistryEventValidator;
  withTraceTransaction?: TraceTransactionRunner;
  logger?: Logger;
  streamConnectionRegistry?: StreamConnectionRegistry;
  getUptimeSeconds?: () => number;
  version?: string;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const logger = deps.logger ?? createLogger("ingest-server");
  const appLifecycle = deps.appLifecycle ?? createAppLifecycle();
  const streamConnectionRegistry =
    deps.streamConnectionRegistry ?? createStreamConnectionRegistry();
  const cleanupStore = deps.cleanupStore ?? createNoopCleanupStore();
  const ingestRateLimiter = createIngestRateLimiter({
    windowMs: deps.rateLimitWindowMs,
    maxRequests: deps.rateLimitMaxRequests,
  });

  app.use("*", requestId);
  app.use("*", createShutdownMiddleware(appLifecycle));
  app.use("/v1/ingest", ingestRateLimiter);
  app.onError(createErrorHandler(logger));

  app.route(
    "/",
    createHealthRoutes({
      checkDbHealth:
        deps.checkDbHealth ?? (async () => ({ connected: true, latencyMs: 0 })),
      getUptimeSeconds: deps.getUptimeSeconds,
      version: deps.version,
    }),
  );
  app.route(
    "/",
    createIngestRoutes({
      ...deps,
      logger,
    }),
  );
  app.route("/", createQueryRoutes(deps));
  app.route(
    "/",
    createStreamRoutes({
      recordStreamBroker: deps.recordStreamBroker,
      subscriptionLimit: deps.streamSubscriptionLimit,
      streamConnectionRegistry,
    }),
  );
  app.route("/", createScenarioRoutes(deps));
  app.route("/", createSessionRoutes(deps));
  app.route("/", createVerdictRoutes(deps));
  app.route(
    "/",
    createDlqRoutes({
      ...deps,
      logger,
      maxRetryAttempts: deps.dlqMaxRetryAttempts,
    }),
  );
  app.route(
    "/",
    createCleanupRoutes({
      cleanupStore,
      logger,
    }),
  );

  return app;
}

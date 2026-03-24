import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  GraphStore,
  RecordStore,
  ScenarioSpecStore,
  SessionStore,
  TaskPayload,
  TaskQueue,
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
import { createTraceDiagramRoutes } from "./routes/trace-diagrams.js";
import { createStreamRoutes } from "./routes/streams.js";
import { createScenarioRoutes } from "./routes/scenario.js";
import { createVerdictRoutes } from "./routes/verdict.js";
import { createDlqRoutes } from "./routes/dlq.js";
import { createCleanupRoutes } from "./routes/cleanup.js";
import { createMetricsRoutes } from "./routes/metrics.js";
import { createPatternRoutes, type PatternStatsCache } from "./routes/patterns.js";
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
import type { DebugStore } from "./lib/debug-store.js";
import type { ConvergencePipelinePort } from "./lib/phase-two-worker.js";
import type { MetricsCollector } from "./lib/metrics-collector.js";
import { createInsightsRoutes } from "./routes/insights.js";
import { createLabelsRoutes } from "./routes/labels.js";

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
  debugStore?: DebugStore;
  recordStreamBroker: RecordStreamBroker;
  streamSubscriptionLimit?: number;
  dlqMaxRetryAttempts?: number;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  registryValidationMode?: RegistryValidationMode;
  registryValidator?: RegistryEventValidator;
  taskQueue?: TaskQueue<TaskPayload>;
  convergencePipeline?: ConvergencePipelinePort;
  metricsCollector?: MetricsCollector;
  getPatternStats?: () => PatternStatsCache | null;
  withTraceTransaction?: TraceTransactionRunner;
  logger?: Logger;
  streamConnectionRegistry?: StreamConnectionRegistry;
  getUptimeSeconds?: () => number;
  version?: string;
  corsOrigin?: string;
  /** D1 SqlDriver — insights 집계 쿼리용 (Worker 모드) */
  sqlDriver?: import("index-meta").SqlDriver;
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

  app.use("*", cors({ origin: deps.corsOrigin ?? "*" }));
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
  app.route("/v1/traces", createTraceDiagramRoutes({ recordStore: deps.recordStore, logger }));
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
  app.route("/", createInsightsRoutes({ driver: deps.sqlDriver }));
  app.route("/", createLabelsRoutes({ driver: deps.sqlDriver }));
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
  app.route(
    "/",
    createMetricsRoutes({
      metricsCollector: deps.metricsCollector,
      dlqStore: deps.dlqStore,
      streamConnectionRegistry,
      getUptimeSeconds: deps.getUptimeSeconds,
    }),
  );
  app.route("/", createPatternRoutes({
    getPatternStats: deps.getPatternStats,
    logger,
  }));

  return app;
}

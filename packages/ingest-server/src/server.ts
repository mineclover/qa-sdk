import { initTelemetry, withQueryTracing } from "@qa-sdk/otel";
import "dotenv/config";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import {
  newDlqId,
  createServiceBootConfig,
  type DlqStore,
  type GraphStore,
  type RecordStore,
  type ScenarioSpecStore,
  type SessionStore,
  type TraceStore,
  type TransmissionStore,
  type VerdictStore,
  type Catalog,
} from "@qa-sdk/core";
import { RegistryClient } from "@qa-sdk/registry-client";
import { closeClient, createDb, withTransaction } from "@qa-sdk/store";
import {
  DrizzleDlqStore,
  DrizzleGraphStore,
  DrizzleRecordStore,
  DrizzleScenarioSpecStore,
  DrizzleSessionStore,
  DrizzleTraceStore,
  DrizzleTransmissionStore,
  DrizzleVerdictStore,
} from "@qa-sdk/store";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { createAppLifecycle } from "./lib/app-lifecycle.js";
import { BullMQTaskQueue } from "./lib/bullmq-task-queue.js";
import {
  cleanupExpiredData,
  createDatabaseCleanupStore,
} from "./lib/cleanup.js";
import { installCleanupScheduler } from "./lib/cleanup-scheduler.js";
import { installGracefulShutdown } from "./lib/graceful-shutdown.js";
import { InMemoryDebugStore } from "./lib/in-memory-debug-store.js";
import {
  InMemoryDlqStore, InMemoryGraphStore, InMemoryRecordStore,
  InMemoryScenarioSpecStore, InMemorySessionStore,
  InMemoryTraceStore, InMemoryTransmissionStore, InMemoryVerdictStore,
} from "@qa-sdk/store";
import { createLogger } from "./lib/logger.js";
import { registerTaskQueueWorker } from "./lib/phase-two-worker.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";
import { resolveRuntimeMode } from "./lib/runtime-mode.js";
import { createStreamConnectionRegistry } from "./lib/stream-connection-registry.js";
import { installWorkerShutdown } from "./lib/worker-shutdown.js";
import { createDbHealthChecker } from "./routes/health.js";
import { createWsHandler } from "./routes/ws.js";
import { createDebugWsHandler } from "./routes/debug-ws.js";
import type { ConvergencePipelineRunner, ConvergenceFunctions, ConvergenceGraphPort, PatternFunctions } from "./lib/convergence-pipeline.js";
import type { TransitionFunctions } from "@qa-sdk/spec-core/transition";
import type { TransitionEnginePort } from "./lib/phase-two-worker.js";
import type { ConvergenceSchedulerHandle } from "./lib/convergence-scheduler.js";

const PHASE_TWO_QUEUE_NAME = "ingest-phase-two";

interface RuntimeStores {
  db: ReturnType<typeof createDb> | null;
  dlqStore: DlqStore;
  graphStore: GraphStore;
  recordStore: RecordStore;
  scenarioSpecStore: ScenarioSpecStore;
  sessionStore: SessionStore;
  traceStore: TraceStore;
  transmissionStore: TransmissionStore;
  verdictStore: VerdictStore;
}

async function main(argv = process.argv.slice(2)) {
  const mode = resolveRuntimeMode(argv);

  if (mode === "worker") {
    await startWorker();
    return;
  }

  await startServer();
}

async function startServer() {
  const shutdownTelemetry = initTelemetry({ serviceName: "ingest-server", env });
  const logger = createLogger("ingest-server");
  const stores = createRuntimeStores();
  const appLifecycle = createAppLifecycle();
  const recordStreamBroker = new RecordStreamBroker();
  const debugStore = new InMemoryDebugStore();
  const streamConnectionRegistry = createStreamConnectionRegistry();
  const cleanupStore = env.TRACE_DATABASE_URL ? createDatabaseCleanupStore(env.TRACE_DATABASE_URL) : undefined;
  const cleanupScheduler = installCleanupScheduler({
    enabled: env.CLEANUP_CRON_ENABLED && !!cleanupStore,
    logger,
    runCleanup: () =>
      cleanupExpiredData({
        cleanupStore: cleanupStore!,
        logger,
      }),
  });
  const registryValidator = env.REGISTRY_URL
    ? new RegistryClient({
        baseUrl: env.REGISTRY_URL,
        logger,
      })
    : undefined;
  const taskQueue = createTaskQueue({
    dlqStore: stores.dlqStore,
    logger,
  });

  // ── Convergence Pipeline (optional) ──────────────────
  let convergencePipeline: ConvergencePipelineRunner | undefined;
  let convergenceScheduler: ConvergenceSchedulerHandle | null = null;
  if (env.CONVERGENCE_ENABLED) {
    try {
      const { createGraphProvider } = await import("./lib/convergence-graph-provider.js");
      const { ConvergencePipelineRunner: PipelineCtor } = await import("./lib/convergence-pipeline.js");
      const { installConvergenceScheduler } = await import("./lib/convergence-scheduler.js");

      const graphProvider = await createGraphProvider({
        dkgSqlitePath: env.CONVERGENCE_DKG_SQLITE_PATH,
        registryUrl: env.CONVERGENCE_REGISTRY_URL,
        logger,
      });

      // spec-core convergence 함수 동적 import
      const specConvergence = await import("@qa-sdk/spec-core/convergence");
      const specDkg = await import("@qa-sdk/spec-core/dkg");
      const convergenceFns = {
        aggregateUsageData: specConvergence.aggregateUsageData,
        collectMetrics: specConvergence.collectMetrics,
        metricsToObservations: specConvergence.metricsToObservations,
        traceFlows: specDkg.traceFlows,
      } as unknown as ConvergenceFunctions;

      // 패턴 분류 함수 (optional — 실패해도 convergence 전체는 동작)
      let patternFns: PatternFunctions | undefined;
      try {
        if (env.PATTERN_CLASSIFICATION_ENABLED && specConvergence.classifyPattern) {
          // PatternRules: registry → 코드 상수 fallback
          let patternRules = specConvergence.DEMO_PATTERN_RULES;
          const registryUrl = env.REGISTRY_URL ?? env.CONVERGENCE_REGISTRY_URL;
          if (registryUrl) {
            try {
              const rulesRes = await fetch(`${registryUrl}/catalogs/${env.CATALOG_ID}/pattern-rules`, { signal: AbortSignal.timeout(5_000) });
              if (rulesRes.ok) {
                const rulesBody = await rulesRes.json() as { data: string };
                patternRules = JSON.parse(rulesBody.data);
                logger.info({ source: "registry", count: patternRules.length }, "pattern rules loaded from registry");
              }
            } catch { /* registry 실패 → 코드 상수 fallback */ }
          }

          if (patternRules) {
            patternFns = {
              classifyPattern: specConvergence.classifyPattern,
              aggregatePatternStats: specConvergence.aggregatePatternStats,
              detectAnomalies: specConvergence.detectAnomalies,
              buildPatternHealthReport: specConvergence.buildPatternHealthReport,
              patternRules,
            };
            logger.info("pattern classification enabled");
          }
        }
      } catch (patternErr) {
        logger.warn({ err: patternErr }, "pattern classification not available — skipped");
      }

      convergencePipeline = new PipelineCtor(
        {
          recordStore: stores.recordStore,
          convergenceFns,
          patternFns,
          graphProvider: () => (graphProvider.getGraph() ?? { getAllNodes: () => [], getNodesByKind: () => [] }) as unknown as ConvergenceGraphPort,
          catalogProvider: () => graphProvider.getCatalog() as Catalog,
          dkgStore: graphProvider.getDkgStore() ?? undefined,
          logger,
        },
        {
          recordThreshold: env.CONVERGENCE_RECORD_THRESHOLD,
          flushIntervalMs: env.CONVERGENCE_FLUSH_INTERVAL_MS,
        },
      );

      convergenceScheduler = installConvergenceScheduler({
        enabled: true,
        convergencePipeline,
        logger,
        intervalMs: env.CONVERGENCE_SCHEDULE_INTERVAL_MS,
      });

      logger.info("convergence pipeline enabled");
    } catch (error) {
      logger.error({ err: error }, "convergence pipeline initialization failed — disabled");
    }
  }

  // ── Transition Engine (Phase 2.5, optional) ─────────
  let transitionFns: TransitionFunctions | undefined;
  let transitionCatalog: unknown;
  if (env.TRANSITION_ENGINE_ENABLED) {
    try {
      const { createTransitionFunctions, DEMO_TRANSITION_SPECS } = await import("@qa-sdk/spec-core/transition");
      const { DEMO_CATALOG } = await import("demo-snapshot");
      transitionFns = createTransitionFunctions(DEMO_TRANSITION_SPECS);
      transitionCatalog = DEMO_CATALOG;
      logger.info(`transition engine enabled (${DEMO_TRANSITION_SPECS.length} specs)`);
    } catch (error) {
      logger.error({ err: error }, "transition engine initialization failed — disabled");
    }
  }

  // ── DEMO_SCENARIOS 등록 (ScenarioSpecStore) ──────────
  try {
    const { DEMO_SCENARIOS } = await import("demo-snapshot");
    if (DEMO_SCENARIOS && stores.scenarioSpecStore) {
      let registered = 0;
      for (const spec of DEMO_SCENARIOS) {
        await stores.scenarioSpecStore.upsert(spec);
        registered++;
      }
      if (registered > 0) {
        logger.info(`demo scenarios registered: ${registered}`);
      }
    }
  } catch {
    // demo-snapshot 미사용 환경에서는 무시
  }

  const { createMetricsCollector } = await import("./lib/metrics-collector.js");
  const metricsCollector = createMetricsCollector();

  const app = createApp({
    appLifecycle,
    checkDbHealth: stores.db ? createDbHealthChecker(stores.db) : undefined,
    cleanupStore,
    debugStore,
    dlqStore: stores.dlqStore,
    graphStore: stores.graphStore,
    logger,
    metricsCollector,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    recordStore: stores.recordStore,
    recordStreamBroker,
    registryValidationMode: env.REGISTRY_VALIDATION_MODE,
    registryValidator,
    scenarioSpecStore: stores.scenarioSpecStore,
    sessionStore: stores.sessionStore,
    streamConnectionRegistry,
    streamSubscriptionLimit: env.SSE_SUBSCRIPTION_LIMIT,
    taskQueue,
    traceStore: stores.traceStore,
    transmissionStore: stores.transmissionStore,
    verdictStore: stores.verdictStore,
    withTraceTransaction: stores.db
      ? (fn) =>
          withTransaction(stores.db!, async (tx) =>
            fn({
              recordStore: new DrizzleRecordStore(tx),
              traceStore: new DrizzleTraceStore(tx),
              sessionStore: new DrizzleSessionStore(tx),
            }),
          )
      : (fn) => fn({ recordStore: stores.recordStore, traceStore: stores.traceStore, sessionStore: stores.sessionStore }),
    dlqMaxRetryAttempts: env.DLQ_MAX_RETRY_ATTEMPTS,
    convergencePipeline,
    corsOrigin: env.CORS_ORIGIN,
  });

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  app.get("/v1/ws", upgradeWebSocket(createWsHandler({ recordStreamBroker, logger })));
  app.get("/v1/debug-ws", upgradeWebSocket(createDebugWsHandler({
    recordStreamBroker,
    traceStore: stores.traceStore,
    recordStore: stores.recordStore,
    logger,
  })));

  const serviceConfig = createServiceBootConfig("ingest-server");
  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({
      port: info.port,
      service: `${serviceConfig.namespace}/${serviceConfig.name}`,
      env: serviceConfig.env,
      region: serviceConfig.region,
    }, "ingest-server listening");
  });

  injectWebSocket(server);

  // gRPC Debug Server (GRPC_PORT 설정 시 활성화)
  const grpcPort = process.env["GRPC_PORT"];
  if (grpcPort) {
    import("./grpc/debug-server.js").then(({ startGrpcDebugServer }) => {
      startGrpcDebugServer({
        recordStreamBroker,
        traceStore: stores.traceStore,
        logger,
        port: parseInt(grpcPort),
      }).catch(err => logger.warn({ err }, "gRPC server failed to start"));
    }).catch(() => { /* @grpc/grpc-js not available */ });
  }

  installGracefulShutdown({
    appLifecycle,
    closeDb: async () => {
      convergenceScheduler?.stop();
      await convergencePipeline?.close();
      cleanupScheduler?.stop();
      await taskQueue?.close();
      if (env.TRACE_DATABASE_URL) await closeClient(env.TRACE_DATABASE_URL);
      await shutdownTelemetry();
    },
    logger,
    recordStreamBroker,
    server,
    streamConnectionRegistry,
  });
}

async function startWorker() {
  const shutdownTelemetry = initTelemetry({ serviceName: "ingest-worker", env });
  const logger = createLogger("ingest-worker");
  const stores = createRuntimeStores();
  const taskQueue = createTaskQueue({
    dlqStore: stores.dlqStore,
    logger,
  });

  if (!taskQueue) {
    throw new Error(
      "Worker mode requires TASK_QUEUE_ENABLED=true and REDIS_URL to be set.",
    );
  }

  // Transition Engine (worker mode)
  let workerTransitionEngine: TransitionEnginePort | undefined;
  let workerTransitionCatalog: unknown;
  if (env.TRANSITION_ENGINE_ENABLED) {
    try {
      const { createTransitionFunctions, DEMO_TRANSITION_SPECS } = await import("@qa-sdk/spec-core/transition");
      const { DEMO_CATALOG } = await import("demo-snapshot");
      workerTransitionEngine = createTransitionFunctions(DEMO_TRANSITION_SPECS);
      workerTransitionCatalog = DEMO_CATALOG;
      logger.info(`transition engine enabled in worker (${DEMO_TRANSITION_SPECS.length} specs)`);
    } catch (error) {
      logger.warn({ err: error }, "transition engine not available in worker — skipped");
    }
  }

  await registerTaskQueueWorker(taskQueue, {
    dlqStore: stores.dlqStore,
    graphStore: stores.graphStore,
    logger,
    recordStore: stores.recordStore,
    scenarioSpecStore: stores.scenarioSpecStore,
    sessionStore: stores.sessionStore,
    traceStore: stores.traceStore,
    verdictStore: stores.verdictStore,
    transitionEngine: workerTransitionEngine,
    transitionCatalog: workerTransitionCatalog,
    decodeServiceUrl: env.DECODE_SERVICE_URL,
  });

  logger.info(
    {
      queueName: PHASE_TWO_QUEUE_NAME,
      workerConcurrency: env.WORKER_CONCURRENCY,
    },
    "ingest-worker listening",
  );

  installWorkerShutdown({
    close: async () => {
      await taskQueue.close();
      if (env.TRACE_DATABASE_URL) await closeClient(env.TRACE_DATABASE_URL);
      await shutdownTelemetry();
    },
    logger,
  });
}

function createRuntimeStores(): RuntimeStores {
  if (!env.TRACE_DATABASE_URL) {
    // in-memory store (개발/데모용 — DB 없이 동작)
    return {
      db: null,
      dlqStore: new InMemoryDlqStore(),
      graphStore: new InMemoryGraphStore(),
      recordStore: new InMemoryRecordStore(),
      scenarioSpecStore: new InMemoryScenarioSpecStore(),
      sessionStore: new InMemorySessionStore(),
      traceStore: new InMemoryTraceStore(),
      transmissionStore: new InMemoryTransmissionStore(),
      verdictStore: new InMemoryVerdictStore(),
    };
  }

  const rawDb = createDb(env.TRACE_DATABASE_URL);
  // OTel span 자동 생성을 위한 계측 래퍼
  const db = withQueryTracing(rawDb);

  return {
    db,
    dlqStore: new DrizzleDlqStore(db),
    graphStore: new DrizzleGraphStore(db),
    recordStore: new DrizzleRecordStore(db),
    scenarioSpecStore: new DrizzleScenarioSpecStore(db),
    sessionStore: new DrizzleSessionStore(db),
    traceStore: new DrizzleTraceStore(db),
    transmissionStore: new DrizzleTransmissionStore(db),
    verdictStore: new DrizzleVerdictStore(db),
  };
}

function createTaskQueue({
  dlqStore,
  logger,
}: {
  dlqStore: DlqStore;
  logger: ReturnType<typeof createLogger>;
}) {
  if (!env.TASK_QUEUE_ENABLED || !env.REDIS_URL) {
    return undefined;
  }

  return new BullMQTaskQueue({
    logger,
    onFinalFailure: async (task, error) => {
      await dlqStore.insert({
        id: newDlqId(),
        traceId: task.traceId,
        phase: task.phase,
        errorMessage: toErrorMessage(error),
      });
      logger.error(
        {
          err: error,
          phase: task.phase,
          traceId: task.traceId,
        },
        "recorded failed phase-two job in dlq",
      );
    },
    queueName: PHASE_TWO_QUEUE_NAME,
    redisUrl: env.REDIS_URL,
    workerConcurrency: env.WORKER_CONCURRENCY,
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

void main().catch((error) => {
  const logger = createLogger("ingest-runtime");
  logger.fatal({ err: error }, "failed to start ingest runtime");
  process.exit(1);
});

import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { newDlqId } from "@qa-sdk/core";
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
import { createLogger } from "./lib/logger.js";
import { registerTaskQueueWorker } from "./lib/phase-two-worker.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";
import { resolveRuntimeMode } from "./lib/runtime-mode.js";
import { createStreamConnectionRegistry } from "./lib/stream-connection-registry.js";
import { installWorkerShutdown } from "./lib/worker-shutdown.js";
import { createDbHealthChecker } from "./routes/health.js";
import { createWsHandler } from "./routes/ws.js";
import type { ConvergencePipelineRunner, PatternFunctions } from "./lib/convergence-pipeline.js";
import type { TransitionFunctions } from "@qa-sdk/spec-core/transition";
import type { TransitionEnginePort } from "./lib/phase-two-worker.js";
import type { ConvergenceSchedulerHandle } from "./lib/convergence-scheduler.js";

const PHASE_TWO_QUEUE_NAME = "ingest-phase-two";

interface RuntimeStores {
  db: ReturnType<typeof createDb>;
  dlqStore: DrizzleDlqStore;
  graphStore: DrizzleGraphStore;
  recordStore: DrizzleRecordStore;
  scenarioSpecStore: DrizzleScenarioSpecStore;
  sessionStore: DrizzleSessionStore;
  traceStore: DrizzleTraceStore;
  transmissionStore: DrizzleTransmissionStore;
  verdictStore: DrizzleVerdictStore;
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
  const logger = createLogger("ingest-server");
  const stores = createRuntimeStores();
  const appLifecycle = createAppLifecycle();
  const recordStreamBroker = new RecordStreamBroker();
  const debugStore = new InMemoryDebugStore();
  const streamConnectionRegistry = createStreamConnectionRegistry();
  const cleanupStore = createDatabaseCleanupStore(env.TRACE_DATABASE_URL);
  const cleanupScheduler = installCleanupScheduler({
    enabled: env.CLEANUP_CRON_ENABLED,
    logger,
    runCleanup: () =>
      cleanupExpiredData({
        cleanupStore,
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
      const specAnalysis = await import("@qa-sdk/spec-core/analysis");
      const convergenceFns = {
        aggregateUsageData: (specAnalysis as any).aggregateUsageData,
        collectMetrics: (specAnalysis as any).collectMetrics,
        metricsToObservations: (specAnalysis as any).metricsToObservations,
      };

      // 패턴 분류 함수 (optional — 실패해도 convergence 전체는 동작)
      let patternFns: PatternFunctions | undefined;
      try {
        const sa = specAnalysis as any;
        if (env.PATTERN_CLASSIFICATION_ENABLED && sa.classifyPattern && sa.DEMO_PATTERN_RULES) {
          patternFns = {
            classifyPattern: sa.classifyPattern,
            aggregatePatternStats: sa.aggregatePatternStats,
            detectAnomalies: sa.detectAnomalies,
            buildPatternHealthReport: sa.buildPatternHealthReport,
            patternRules: sa.DEMO_PATTERN_RULES,
          };
          logger.info("pattern classification enabled");
        }
      } catch (patternErr) {
        logger.warn({ err: patternErr }, "pattern classification not available — skipped");
      }

      convergencePipeline = new PipelineCtor(
        {
          recordStore: stores.recordStore,
          convergenceFns,
          patternFns,
          graphProvider: () => graphProvider.getGraph() ?? { getAllNodes: () => [], getNodesByKind: () => [] } as any,
          catalogProvider: () => graphProvider.getCatalog(),
          dkgStore: graphProvider.getDkgStore() as any,
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

  const app = createApp({
    appLifecycle,
    checkDbHealth: createDbHealthChecker(stores.db),
    cleanupStore,
    debugStore,
    dlqStore: stores.dlqStore,
    graphStore: stores.graphStore,
    logger,
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
    withTraceTransaction: (fn) =>
      withTransaction(stores.db, async (tx) =>
        fn({
          recordStore: new DrizzleRecordStore(tx),
          traceStore: new DrizzleTraceStore(tx),
          sessionStore: new DrizzleSessionStore(tx),
        }),
      ),
    dlqMaxRetryAttempts: env.DLQ_MAX_RETRY_ATTEMPTS,
    convergencePipeline,
  });

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  app.get("/v1/ws", upgradeWebSocket(createWsHandler({ recordStreamBroker, logger })));

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port }, "ingest-server listening");
  });

  injectWebSocket(server);

  installGracefulShutdown({
    appLifecycle,
    closeDb: async () => {
      convergenceScheduler?.stop();
      await convergencePipeline?.close();
      cleanupScheduler?.stop();
      await taskQueue?.close();
      await closeClient(env.TRACE_DATABASE_URL);
    },
    logger,
    recordStreamBroker,
    server,
    streamConnectionRegistry,
  });
}

async function startWorker() {
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
      workerTransitionEngine = createTransitionFunctions(DEMO_TRANSITION_SPECS) as any;
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
      await closeClient(env.TRACE_DATABASE_URL);
    },
    logger,
  });
}

function createRuntimeStores(): RuntimeStores {
  const db = createDb(env.TRACE_DATABASE_URL);

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
  dlqStore: DrizzleDlqStore;
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

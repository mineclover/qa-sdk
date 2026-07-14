// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * E2E용 인메모리 ingest-server (DB 불필요).
 * playwright.config.ts의 webServer에서 사용.
 */
import { serve } from '@hono/node-server';
import type { Catalog } from '@qa-sdk/core';
import { createLogger } from './lib/logger.js';
import type { ConvergenceGraphPort, DkgStorePort } from './lib/convergence-pipeline.js';

const logger = createLogger('e2e-test-server');
import { createNodeWebSocket } from '@hono/node-ws';
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from '@qa-sdk/store';
import { createApp } from './app.js';
import { InMemoryDebugStore } from './lib/in-memory-debug-store.js';
import { RecordStreamBroker } from './lib/record-stream-broker.js';
import { createWsHandler } from './routes/ws.js';

const PORT = parseInt(process.env['PORT'] ?? '3101', 10);

const broker = new RecordStreamBroker();
const recordStore = new InMemoryRecordStore();

const app = createApp({
  recordStore,
  traceStore: new InMemoryTraceStore(),
  graphStore: new InMemoryGraphStore(),
  transmissionStore: new InMemoryTransmissionStore(),
  sessionStore: new InMemorySessionStore(),
  verdictStore: new InMemoryVerdictStore(),
  scenarioSpecStore: new InMemoryScenarioSpecStore(),
  dlqStore: new InMemoryDlqStore(),
  debugStore: new InMemoryDebugStore(),
  recordStreamBroker: broker,
  registryValidationMode: 'off',
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.get('/v1/ws', upgradeWebSocket(createWsHandler({ recordStreamBroker: broker })));

// ── Convergence Pipeline (CONVERGENCE_ENABLED=true로 활성화) ──
async function setupConvergence() {
  if (process.env['CONVERGENCE_ENABLED'] !== 'true') return;
  try {
    const { ConvergencePipelineRunner } = await import('./lib/convergence-pipeline.js');
    const { createGraphProvider } = await import('./lib/convergence-graph-provider.js');
    const dkgSqlitePath = process.env['CONVERGENCE_DKG_SQLITE_PATH'] ?? ':memory:';
    const provider = await createGraphProvider({ dkgSqlitePath });
    const specConvergence = await import('@qa-sdk/convergence');
    const specDkg = await import('@qa-sdk/spec-core/dkg');

    const graph = provider.getGraph();
    const dkgStore = provider.getDkgStore();
    const pipeline = new ConvergencePipelineRunner(
      {
        recordStore,
        convergenceFns: {
          aggregateUsageData: specConvergence.aggregateUsageData,
          collectMetrics: (catalog, g, usage) =>
            specConvergence.collectMetrics(
              catalog,
              g as Parameters<typeof specConvergence.collectMetrics>[1],
              usage,
            ),
          metricsToObservations: specConvergence.metricsToObservations,
          traceFlows: (g, records, opts) =>
            specDkg.traceFlows(g as Parameters<typeof specDkg.traceFlows>[0], records, opts),
        },
        graphProvider: () => (graph ?? { getNodesByKind: () => [] }) as ConvergenceGraphPort,
        catalogProvider: () => provider.getCatalog() as Catalog,
        dkgStore: dkgStore as DkgStorePort | undefined,
        logger,
      },
      { recordThreshold: 5, flushIntervalMs: 5_000 },
    );

    // ingest 완료 시 convergence pipeline에 traceId 알림
    // InMemoryRecordStore.getTraceIds()로 새 traceId를 주기적으로 수집
    const seenTraces = new Set<string>();
    setInterval(() => {
      try {
        const allTraceIds = recordStore.getTraceIds();
        const newTraceIds = allTraceIds.filter((tid) => !seenTraces.has(tid));
        for (const tid of newTraceIds) seenTraces.add(tid);
        if (newTraceIds.length > 0) {
          pipeline.notifyCompletion(newTraceIds);
          logger.info({ count: newTraceIds.length }, 'convergence: notified new traces');
        }
      } catch {
        /* 무시 */
      }
    }, 3_000);

    // ── Transition Engine (Phase 2.5, optional) ──
    if (process.env['TRANSITION_ENGINE_ENABLED'] === 'true') {
      try {
        const { createTransitionFunctions, DEMO_TRANSITION_SPECS } =
          await import('@qa-sdk/spec-core/transition');
        const transitionEngine = createTransitionFunctions(DEMO_TRANSITION_SPECS);
        const transitionCatalog = provider.getCatalog();

        // 새 trace 감지 시 transition processing
        const processedCounts = new Map<string, number>();
        setInterval(async () => {
          try {
            const allTraceIds = recordStore.getTraceIds();
            for (const traceId of allTraceIds) {
              const records = await recordStore.findByTraceId(traceId);
              if (records.length === 0) continue;
              // 이전 처리 시 레코드 수와 같으면 스킵 (새 이벤트 없음)
              if (processedCounts.get(traceId) === records.length) continue;
              processedCounts.set(traceId, records.length);

              // address_context 디코딩 → TransitionEvent 생성
              const events = records.map((r) => {
                let decoded: Record<string, string> = {};
                if (r.addressContext) {
                  try {
                    decoded = transitionEngine.decodeCtx(
                      transitionCatalog as Catalog,
                      r.addressContext,
                    );
                  } catch (err) {
                    logger.warn({ err, logId: r.logId }, 'transition decode 실패');
                  }
                }
                return {
                  log_id: r.logId,
                  timestamp:
                    r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
                  address_context: decoded,
                  context_id: r.qaSessionId ?? traceId,
                  actor_id: (r as unknown as Record<string, unknown>).actorId as string | undefined,
                };
              });
              if (events.length > 0) {
                logger.debug(
                  { addressContext: events[0].address_context },
                  'transition decoded sample',
                );
                logger.debug({ event: events[0] }, 'transition full event[0]');
              }

              const result = transitionEngine.processSession({ sessionId: traceId, events });
              logger.info(
                {
                  traceId,
                  events: events.length,
                  instances: result.instances.length,
                  violations: result.violations.length,
                  unmatched: result.unmatchedCount,
                },
                'transition 처리 완료',
              );
            }
          } catch (err) {
            logger.warn({ err }, 'transition polling error');
          }
        }, 5_000);

        logger.info({ specCount: DEMO_TRANSITION_SPECS.length }, 'transition engine enabled');
      } catch (err) {
        logger.warn({ err }, 'transition engine setup 실패');
      }
    }

    process.on('SIGTERM', () => void pipeline.close());
    process.on('SIGINT', () => void pipeline.close());
    logger.info({ threshold: 5, intervalMs: 5_000 }, 'convergence pipeline enabled');
  } catch (err) {
    logger.warn({ err }, 'convergence setup 실패');
  }
}

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  logger.info({ port: info.port }, '서비스 시작');
});

injectWebSocket(server);
void setupConvergence();

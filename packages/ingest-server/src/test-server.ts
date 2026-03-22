/**
 * E2E용 인메모리 ingest-server (DB 불필요).
 * playwright.config.ts의 webServer에서 사용.
 */
import { serve } from "@hono/node-server";
import type { Catalog } from "@qa-sdk/core";
import type { ConvergenceGraphPort, DkgStorePort } from "./lib/convergence-pipeline.js";
import { createNodeWebSocket } from "@hono/node-ws";
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from "@qa-sdk/store";
import { createApp } from "./app.js";
import { InMemoryDebugStore } from "./lib/in-memory-debug-store.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";
import { createWsHandler } from "./routes/ws.js";

const PORT = parseInt(process.env["PORT"] ?? "3101", 10);

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
  registryValidationMode: "off",
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.get("/v1/ws", upgradeWebSocket(createWsHandler({ recordStreamBroker: broker })));

// ── Convergence Pipeline (CONVERGENCE_ENABLED=true로 활성화) ──
async function setupConvergence() {
  if (process.env["CONVERGENCE_ENABLED"] !== "true") return;
  try {
    const { ConvergencePipelineRunner } = await import("./lib/convergence-pipeline.js");
    const { createGraphProvider } = await import("./lib/convergence-graph-provider.js");
    const dkgSqlitePath = process.env["CONVERGENCE_DKG_SQLITE_PATH"] ?? ":memory:";
    const provider = await createGraphProvider({ dkgSqlitePath });
    const specConvergence = await import("@qa-sdk/spec-core/convergence");
    const specDkg = await import("@qa-sdk/spec-core/dkg");

    const graph = provider.getGraph();
    const dkgStore = provider.getDkgStore();
    const pipeline = new ConvergencePipelineRunner({
      recordStore,
      convergenceFns: {
        aggregateUsageData: specConvergence.aggregateUsageData,
        collectMetrics: specConvergence.collectMetrics,
        metricsToObservations: specConvergence.metricsToObservations,
        traceFlows: specDkg.traceFlows,
      },
      graphProvider: () => (graph ?? { getNodesByKind: () => [] }) as ConvergenceGraphPort,
      catalogProvider: () => provider.getCatalog() as Catalog,
      dkgStore: dkgStore as DkgStorePort | undefined,
      logger: { info: console.log, warn: console.warn, error: console.error, debug: () => {} } as any,
    }, { recordThreshold: 5, flushIntervalMs: 5_000 });

    // ingest 완료 시 convergence pipeline에 traceId 알림
    // InMemoryRecordStore.getTraceIds()로 새 traceId를 주기적으로 수집
    const seenTraces = new Set<string>();
    setInterval(() => {
      try {
        const allTraceIds = recordStore.getTraceIds();
        const newTraceIds = allTraceIds.filter(tid => !seenTraces.has(tid));
        for (const tid of newTraceIds) seenTraces.add(tid);
        if (newTraceIds.length > 0) {
          pipeline.notifyCompletion(newTraceIds);
          console.log(`[convergence] notified ${newTraceIds.length} new traces`);
        }
      } catch { /* 무시 */ }
    }, 3_000);

    process.on("SIGTERM", () => void pipeline.close());
    process.on("SIGINT", () => void pipeline.close());
    console.log(`[e2e:test-server] convergence pipeline enabled (threshold=5, interval=5s)`);
  } catch (err) {
    console.warn("[e2e:test-server] convergence setup failed:", err);
  }
}

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[e2e:test-server] http://localhost:${info.port}`);
});

injectWebSocket(server);
void setupConvergence();

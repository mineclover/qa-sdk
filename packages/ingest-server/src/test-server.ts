/**
 * E2E용 인메모리 ingest-server (DB 불필요).
 * playwright.config.ts의 webServer에서 사용.
 */
import { serve } from "@hono/node-server";
import type { Catalog } from "@qa-sdk/core";
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

    const pipeline = new ConvergencePipelineRunner({
      recordStore: recordStore as any,
      convergenceFns: {
        aggregateUsageData: specConvergence.aggregateUsageData as any,
        collectMetrics: specConvergence.collectMetrics as any,
        metricsToObservations: specConvergence.metricsToObservations as any,
        traceFlows: specDkg.traceFlows as any,
      },
      graphProvider: () => provider.getGraph() as any,
      catalogProvider: () => provider.getCatalog() as Catalog,
      dkgStore: provider.getDkgStore() as any,
    }, { recordThreshold: 5, flushIntervalMs: 5_000 });

    // ingest 완료 시 convergence pipeline에 traceId 알림
    // recordStore에서 직접 최근 traceId를 주기적으로 수집
    const seenTraces = new Set<string>();
    setInterval(async () => {
      try {
        // InMemoryRecordStore의 내부 records Map에서 traceId 추출
        const allRecords = await recordStore.findBySessionId("*").catch(() => []);
        // findBySessionId("*")가 작동하지 않으면 빈 배열
        // 대안: 전체 record를 순회하여 새 traceId 발견
        const store = recordStore as any;
        if (store.records instanceof Map) {
          const newTraceIds: string[] = [];
          for (const [, record] of store.records as Map<string, any>) {
            const tid = record.traceId;
            if (tid && !seenTraces.has(tid)) {
              seenTraces.add(tid);
              newTraceIds.push(tid);
            }
          }
          if (newTraceIds.length > 0) {
            pipeline.notifyCompletion(newTraceIds);
          }
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

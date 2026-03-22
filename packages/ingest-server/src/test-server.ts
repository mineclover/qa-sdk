/**
 * E2E용 인메모리 ingest-server (DB 불필요).
 * playwright.config.ts의 webServer에서 사용.
 */
import { serve } from "@hono/node-server";
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

const app = createApp({
  recordStore: new InMemoryRecordStore(),
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

    new ConvergencePipelineRunner({
      recordStore: app.fetch as any, // placeholder — InMemory에서는 flush 시 레코드 접근 불가
      convergenceFns: {
        aggregateUsageData: specConvergence.aggregateUsageData as any,
        collectMetrics: specConvergence.collectMetrics as any,
        metricsToObservations: specConvergence.metricsToObservations as any,
        traceFlows: specDkg.traceFlows as any,
      },
      graphProvider: () => provider.getGraph() as any,
      catalogProvider: () => provider.getCatalog(),
      dkgStore: provider.getDkgStore() as any,
    }, { recordThreshold: 10, flushIntervalMs: 5_000 });
    console.log(`[e2e:test-server] convergence pipeline enabled`);
  } catch (err) {
    console.warn("[e2e:test-server] convergence setup failed:", err);
  }
}

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[e2e:test-server] http://localhost:${info.port}`);
});

injectWebSocket(server);
void setupConvergence();

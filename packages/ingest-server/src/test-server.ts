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

    // InMemory 모드: convergence pipeline 대신 직접 address_context 수집
    // ingest POST body에서 records의 address_context를 직접 추출
    const addressBuffer: unknown[] = [];
    const catalog = provider.getCatalog();
    const dkgStore = provider.getDkgStore();

    // Middleware: /v1/ingest POST body에서 address_context 추출
    app.use("/v1/ingest", async (c, next) => {
      await next();
      // 응답 후 비동기로 address_context 수집 (요청 처리에 영향 없음)
      try {
        const body = await c.req.raw.clone().json() as { records?: Array<{ address_context?: Record<string, string>; timestamp?: string; qa_session_id?: string; event_key?: string }> };
        for (const r of body.records ?? []) {
          if (r.address_context && Object.keys(r.address_context).length > 0) {
            addressBuffer.push({
              address_context: r.address_context,
              timestamp: r.timestamp ?? new Date().toISOString(),
              session_id: r.qa_session_id,
              event_key: r.event_key,
            });
          }
        }
      } catch { /* 파싱 실패 무시 */ }
    });

    // 주기적 flush — 버퍼에 축적된 address_context를 집계
    const flushInterval = setInterval(() => {
      if (addressBuffer.length === 0) return;
      const records = addressBuffer.splice(0);
      try {
        const usage = specConvergence.aggregateUsageData(catalog as any, records as any);
        const graph = provider.getGraph();
        if (graph && dkgStore) {
          const metrics = specConvergence.collectMetrics(catalog as any, graph as any, usage);
          const observations = specConvergence.metricsToObservations(metrics);
          (dkgStore as any).saveUsageSnapshotWithObservations(usage, observations);
          console.log(`[convergence] flush: ${records.length} records, ${metrics.length} metrics, ${observations.length} obs`);
        }
      } catch (err) {
        console.warn("[convergence] flush failed:", err);
      }
    }, 5_000);

    process.on("SIGTERM", () => clearInterval(flushInterval));
    process.on("SIGINT", () => clearInterval(flushInterval));
    console.log(`[e2e:test-server] convergence pipeline enabled (direct mode, 5s flush)`);
  } catch (err) {
    console.warn("[e2e:test-server] convergence setup failed:", err);
  }
}

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[e2e:test-server] http://localhost:${info.port}`);
});

injectWebSocket(server);
void setupConvergence();

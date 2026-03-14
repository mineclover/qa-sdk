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
  recordStreamBroker: broker,
  registryValidationMode: "off",
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.get("/v1/ws", upgradeWebSocket(createWsHandler({ recordStreamBroker: broker })));

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[e2e:test-server] http://localhost:${info.port}`);
});

injectWebSocket(server);

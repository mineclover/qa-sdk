/**
 * worker.ts — ingest-server Cloudflare Workers 진입점.
 *
 * STORE_DRIVER=d1. D1SqlDriver → D1 stores.
 * Phase 2 (verdict, transition, convergence)는 비활성 (CF Workers 제약).
 * 이벤트 수집 + 저장만 담당.
 */
import { D1SqlDriver } from "index-meta";
import { createApp } from "./app.js";
import { INGEST_D1_SCHEMA_DDL } from "./stores/d1-schema.sql.js";
import { D1RecordStore } from "./stores/d1-record-store.js";
import { D1TraceStore } from "./stores/d1-trace-store.js";
import { D1SessionStore } from "./stores/d1-session-store.js";
import { D1VerdictStore } from "./stores/d1-verdict-store.js";
import {
  InMemoryTransmissionStore,
  InMemoryGraphStore,
  InMemoryScenarioSpecStore,
  InMemoryDlqStore,
} from "@qa-sdk/store";
import { InMemoryDebugStore } from "./lib/in-memory-debug-store.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";

interface Env {
  DB: any;
  CORS_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const driver = new D1SqlDriver(env.DB);

    // DDL 초기화
    for (const stmt of INGEST_D1_SCHEMA_DDL.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
      try { await env.DB.exec(stmt + ";"); } catch { /* 이미 존재 */ }
    }

    const app = createApp({
      recordStore: new D1RecordStore(driver),
      traceStore: new D1TraceStore(driver),
      sessionStore: new D1SessionStore(driver),
      verdictStore: new D1VerdictStore(driver),
      transmissionStore: new InMemoryTransmissionStore(),
      graphStore: new InMemoryGraphStore(),
      scenarioSpecStore: new InMemoryScenarioSpecStore(),
      dlqStore: new InMemoryDlqStore(),
      debugStore: new InMemoryDebugStore(),
      recordStreamBroker: new RecordStreamBroker(),
      corsOrigin: env.CORS_ORIGIN ?? "*",
    });

    return app.fetch(request);
  },
};

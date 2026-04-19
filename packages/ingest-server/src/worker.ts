// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * worker.ts — ingest-server Cloudflare Workers 진입점.
 *
 * STORE_DRIVER=d1. D1SqlDriver → D1 stores.
 * Phase 2 (verdict, transition, convergence)는 비활성 (CF Workers 제약).
 * 이벤트 수집 + 저장 + WebSocket 실시간 스트림.
 */
import { D1SqlDriver } from "index-meta";
import { drizzle } from "drizzle-orm/d1";
import { createApp } from "./app.js";
import { INGEST_D1_SCHEMA_DDL } from "./stores/d1-schema.sql.js";
import * as schema from "./db/schema.js";
import { D1RecordStore } from "./stores/d1-record-store.js";
import { D1TraceStore } from "./stores/d1-trace-store.js";
import { D1SessionStore } from "./stores/d1-session-store.js";
import { D1VerdictStore } from "./stores/d1-verdict-store.js";
import type { D1Db } from "./stores/d1-db-type.js";
import {
  InMemoryTransmissionStore,
  InMemoryGraphStore,
  InMemoryScenarioSpecStore,
  InMemoryDlqStore,
} from "@qa-sdk/store";
import { InMemoryDebugStore } from "./lib/in-memory-debug-store.js";
import { RecordStreamBroker } from "./lib/record-stream-broker.js";

// ── CF Workers WebSocket 타입 (런타임에서 제공) ──
declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};
/** CF Workers WebSocket 이벤트 */
interface CFWebSocketEvent {
  data: string | ArrayBuffer;
}

declare interface WebSocket {
  accept(): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, handler: (evt: CFWebSocketEvent) => void): void;
}

/** CF Workers D1 Database 바인딩 */
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  exec(sql: string): Promise<unknown>;
  prepare(sql: string): D1PreparedStatement;
}

interface Env {
  DB: D1Database;
  CORS_ORIGIN?: string;
}

// ── Worker 인스턴스 수명 동안 유지 ──
const broker = new RecordStreamBroker();
let ddlInitialized = false;

/**
 * CF Workers WebSocket 핸들러.
 * /v1/ws 요청 시 WebSocketPair로 upgrade.
 * subscribe/unsubscribe 메시지로 시나리오별 실시간 이벤트 수신.
 */
function handleWebSocketUpgrade(): Response {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  const unsubscribers = new Map<string, () => void>();

  server.addEventListener("message", (evt: CFWebSocketEvent) => {
    let msg: { type: string; scenarioId: string };
    try {
      msg = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data));
    } catch {
      server.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
      return;
    }

    if (msg.type === "subscribe" && msg.scenarioId) {
      if (unsubscribers.has(msg.scenarioId)) return;
      const unsubscribe = broker.subscribeToScenario(msg.scenarioId, (record) => {
        try {
          server.send(JSON.stringify({ type: "record", scenarioId: msg.scenarioId, data: record }));
        } catch { /* client disconnected */ }
      });
      unsubscribers.set(msg.scenarioId, unsubscribe);
      server.send(JSON.stringify({ type: "subscribed", scenarioId: msg.scenarioId }));
    } else if (msg.type === "unsubscribe" && msg.scenarioId) {
      unsubscribers.get(msg.scenarioId)?.();
      unsubscribers.delete(msg.scenarioId);
      server.send(JSON.stringify({ type: "unsubscribed", scenarioId: msg.scenarioId }));
    }
  });

  server.addEventListener("close", () => {
    for (const unsub of unsubscribers.values()) unsub();
    unsubscribers.clear();
  });

  server.addEventListener("error", () => {
    for (const unsub of unsubscribers.values()) unsub();
    unsubscribers.clear();
  });

  return new Response(null, { status: 101, webSocket: client } as unknown as ResponseInit);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade — /v1/ws
    if (url.pathname === "/v1/ws") {
      const upgrade = request.headers.get("Upgrade");
      if (upgrade?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      return handleWebSocketUpgrade();
    }

    const driver = new D1SqlDriver(env.DB);
    const db = drizzle(env.DB, { schema }) as unknown as D1Db;

    // DDL 초기화 — IF NOT EXISTS이므로 매 요청 안전 실행
    for (const stmt of INGEST_D1_SCHEMA_DDL.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
      try { await env.DB.exec(stmt + ";"); } catch { /* 이미 존재 */ }
    }

    const app = createApp({
      recordStore: new D1RecordStore(db),
      traceStore: new D1TraceStore(db),
      sessionStore: new D1SessionStore(db),
      verdictStore: new D1VerdictStore(db),
      transmissionStore: new InMemoryTransmissionStore(),
      graphStore: new InMemoryGraphStore(),
      scenarioSpecStore: new InMemoryScenarioSpecStore(),
      dlqStore: new InMemoryDlqStore(),
      debugStore: new InMemoryDebugStore(),
      recordStreamBroker: broker,
      sqlDriver: driver,
      corsOrigin: env.CORS_ORIGIN ?? "*",
    });

    return app.fetch(request);
  },

  /** Cron Trigger — 5분마다 실행하여 Worker warm 상태 유지 + DDL 초기화 */
  async scheduled(_event: unknown, env: Env, _ctx: unknown): Promise<void> {
    if (!ddlInitialized) {
      for (const stmt of INGEST_D1_SCHEMA_DDL.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
        try { await env.DB.exec(stmt + ";"); } catch { /* 이미 존재 */ }
      }
      ddlInitialized = true;
    }
    // warm up 완료 — 다음 fetch 요청에서 cold start 없음
  },
};

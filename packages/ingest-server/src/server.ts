import { serve } from "@hono/node-server";
import { createDb } from "@qa-sdk/store";
import {
  DrizzleRecordStore,
  DrizzleTraceStore,
  DrizzleTransmissionStore,
  DrizzleSessionStore,
} from "@qa-sdk/store";
import { env } from "./config/env.js";
import { createApp } from "./app.js";

// ── Composition Root: port → adapter 바인딩 ─────────────

const db = createDb(env.TRACE_DATABASE_URL);

const app = createApp({
  recordStore: new DrizzleRecordStore(db),
  traceStore: new DrizzleTraceStore(db),
  transmissionStore: new DrizzleTransmissionStore(db),
  sessionStore: new DrizzleSessionStore(db),
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`ingest-server listening on :${info.port}`);
});

import "dotenv/config";
import {
  InMemoryPrefixRegistry,
  MetaRegistry,
  createSqliteDriver,
} from "index-meta";
import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown, createServiceBootConfig } from "@qa-sdk/core";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { HttpGateStateClient } from "./lib/gate-client.js";
import { createLogger } from "./lib/logger.js";
import { SqlPolicyRuleStore } from "./stores/sql-policy-rule-store.js";

const logger = createLogger("query-service");

const driver = await createSqliteDriver({
  driver: env.SQLITE_DRIVER,
  path: env.SQLITE_PATH,
  schema: null,
});

const policyRuleStore = new SqlPolicyRuleStore<unknown>(driver);
const prefixRegistry = new InMemoryPrefixRegistry();
const metaRegistry = new MetaRegistry({ dims: {}, indices: {} });
const gateClient = env.GATE_SERVICE_URL
  ? new HttpGateStateClient({ baseUrl: env.GATE_SERVICE_URL })
  : undefined;
const startedAt = Date.now();

// ── Transition State Store (optional) ───────────────
import type { StateRouteDeps } from "./routes/state.js";

const stateRoutesDeps: StateRouteDeps = {};
try {
  const mod = await (Function('return import("@qa-sdk/spec-core/transition")')() as Promise<Record<string, unknown>>);
  const StoreCtor = mod?.InMemoryStateStore as (new () => { snapshot(ctx: string, res: string): Record<string, string> }) | undefined;
  if (StoreCtor) {
    stateRoutesDeps.stateStore = new StoreCtor();
    logger.info("transition state store initialized (in-memory)");
  }
} catch {
  // spec-core/transition 미설치 환경에서는 무시
}

// ── RecordStore for replay (optional) ───────────────
try {
  const recordPath = env.RECORD_STORE_PATH ?? env.SQLITE_PATH;
  const { createReplayRecordStore } = await import("./lib/replay-record-store.js");
  const recordDriver = await createSqliteDriver({ driver: env.SQLITE_DRIVER, path: recordPath, schema: null });
  stateRoutesDeps.recordStore = createReplayRecordStore(recordDriver);
  logger.info({ path: recordPath }, "record store initialized for replay");
} catch {
  logger.warn("record store 미초기화 — replay는 fallback 모드");
}

const app = createApp({
  policyRuleStore,
  prefixRegistry,
  metaRegistry,
  defaultStrategy: env.QUERY_DEFAULT_STRATEGY,
  gateClient,
  gateFailureMode: env.QUERY_GATE_FAILURE_MODE,
  logger,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
  stateRoutes: stateRoutesDeps,
});

const serviceConfig = createServiceBootConfig("query-service");
const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({
    port: info.port,
    service: `${serviceConfig.namespace}/${serviceConfig.name}`,
    env: serviceConfig.env,
    region: serviceConfig.region,
  }, "query-service listening");
  warnPortConflict("query-service", env.PORT, logger);
});

installSimpleShutdown({ server, logger });

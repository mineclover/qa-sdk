import {
  InMemoryPrefixRegistry,
  MetaRegistry,
  createSqliteDriver,
} from "index-meta";
import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
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

const app = createApp({
  policyRuleStore,
  prefixRegistry,
  metaRegistry,
  defaultStrategy: env.QUERY_DEFAULT_STRATEGY,
  gateClient,
  gateFailureMode: env.QUERY_GATE_FAILURE_MODE,
  logger,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "query-service listening");
  warnPortConflict("query-service", env.PORT, logger);
});

installSimpleShutdown({ server, logger });

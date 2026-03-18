import { Hono } from "hono";
import {
  InMemoryPrefixRegistry,
  MetaRegistry,
  type ConflictStrategy,
  type PrefixRegistry,
} from "index-meta";
import type { Logger } from "pino";
import { createLogger } from "./lib/logger.js";
import {
  NoopGateStateClient,
  type GateStateClient,
} from "./lib/gate-client.js";
import {
  createQueryService,
  type GateFailureMode,
  type QueryLookupService,
} from "./lib/query-service.js";
import { createRuleService } from "./lib/rule-service.js";
import { requestId } from "./middleware/request-id.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { createHealthRoutes } from "./routes/health.js";
import { createQueryRoutes } from "./routes/query.js";
import { createRuleRoutes } from "./routes/rules.js";
import {
  InMemoryPolicyRuleStore,
} from "./stores/in-memory-policy-rule-store.js";
import type { PolicyRuleStore } from "./stores/policy-rule-store.js";

export interface AppDeps {
  policyRuleStore?: PolicyRuleStore<unknown>;
  prefixRegistry?: PrefixRegistry;
  queryService?: QueryLookupService;
  metaRegistry?: MetaRegistry;
  defaultStrategy?: ConflictStrategy;
  gateClient?: GateStateClient;
  gateFailureMode?: GateFailureMode;
  logger?: Logger;
  version?: string;
  getUptimeSeconds?: () => number;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const logger = deps.logger ?? createLogger("query-service");
  const policyRuleStore =
    deps.policyRuleStore ?? new InMemoryPolicyRuleStore<unknown>();
  const queryService =
    deps.queryService ??
    createQueryService({
      metaRegistry: deps.metaRegistry,
      defaultStrategy: deps.defaultStrategy,
      gateClient: deps.gateClient ?? new NoopGateStateClient(),
      gateFailureMode: deps.gateFailureMode,
      logger,
    });
  const ruleService = createRuleService({
    policyRuleStore,
    prefixRegistry: deps.prefixRegistry ?? new InMemoryPrefixRegistry(),
  });

  app.use("*", requestId);

  app.route(
    "/",
    createHealthRoutes({
      storeKind: policyRuleStore.constructor.name,
      getUptimeSeconds: deps.getUptimeSeconds,
      version: deps.version,
    }),
  );
  app.route("/", createRuleRoutes({ ruleService }));
  app.route("/", createQueryRoutes({ queryService }));

  app.onError(createErrorHandler(logger));

  return app;
}

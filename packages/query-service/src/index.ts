export { createApp, type AppDeps } from "./app.js";
export {
  createQueryService,
  QueryService,
  type GateFailureMode,
  type QueryGateMode,
  type QueryLookupService,
  type QueryRelationTypeRule,
  type QueryResolveOptions,
  type QueryResolveResult,
} from "./lib/query-service.js";
export {
  GateServiceClientError,
  HttpGateStateClient,
  NoopGateStateClient,
} from "./lib/gate-client.js";
export type { GateStateClient } from "./lib/gate-client.js";
export {
  InMemoryPolicyRuleStore,
} from "./stores/in-memory-policy-rule-store.js";
export { NodeSqliteDriver, BetterSqliteDriver } from "index-meta";
export { SqlPolicyRuleStore } from "./stores/sql-policy-rule-store.js";
export {
  RuleMigrationService,
  createRuleMigrationService,
} from "./lib/rule-migration-service.js";
export type { RuleMigrationResult } from "./lib/rule-migration-service.js";
export {
  PolicyRuleNotFoundError,
  PolicyRuleAlreadyExistsError,
} from "./stores/policy-rule-store.js";
export type {
  StoredPolicyRule,
  PolicyRuleStore,
} from "./stores/policy-rule-store.js";

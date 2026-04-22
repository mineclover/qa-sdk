// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

// SQLite 어댑터 (기존 경로)
export { SqliteResourcePolicyRegistry } from "./sqlite/adapter.js";
export { resourcePolicies, RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";

// Backward-compat alias — 기존 외부 호출자 영향 회피.
// Plan 05c(factory) 도입 후 deprecation 마킹.
export { SqliteResourcePolicyRegistry as DrizzleResourcePolicyRegistry } from "./sqlite/adapter.js";

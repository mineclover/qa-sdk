// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

// SQLite 어댑터 (기존 경로)
export { SqliteResourcePolicyRegistry } from "./sqlite/adapter.js";
export { resourcePolicies, RESOURCE_POLICIES_DDL } from "./sqlite/schema.js";

/**
 * @deprecated Plan 05d 이후 호출자는 `createResourcePolicyRegistry({ dialect: "sqlite", db })`
 * 를 사용한다. 본 alias는 외부 호환성 유예만 위해 유지되며, 후속 plan에서 제거된다.
 *
 * 마이그레이션 가이드:
 * ```ts
 * // Before
 * import { DrizzleResourcePolicyRegistry } from "resource-policy-store";
 * const reg = new DrizzleResourcePolicyRegistry(db);
 *
 * // After
 * import { createResourcePolicyRegistry } from "resource-policy-store";
 * const reg = await createResourcePolicyRegistry({ dialect: "sqlite", db });
 * ```
 */
export { SqliteResourcePolicyRegistry as DrizzleResourcePolicyRegistry } from "./sqlite/adapter.js";

// PG 어댑터 (Plan 05b)
export { PgResourcePolicyRegistry } from "./pg/adapter.js";
export { resourcePolicies as resourcePoliciesPg, RESOURCE_POLICIES_PG_DDL } from "./pg/schema.js";

// Factory + port (Plan 05c)
export {
  createResourcePolicyRegistry,
  type CreateRegistryOptions,
  type ResourcePolicyDialect,
} from "./factory.js";

export {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
  type ResourcePolicyCreateArgs,
  type ResourcePolicyRegisterArgs,
  type ResourcePolicyDelegateArgs,
} from "./port.js";

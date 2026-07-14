// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

export {
  DuplicatePolicyError,
  InMemoryResourcePolicyRegistry,
  InvalidTransitionError,
  PolicyNotFoundError,
  canAccessUnregistered,
  canTransition,
  createUnregistered,
  delegate as delegateResourcePolicy,
  register as registerResourcePolicy,
  type CreateArgs as ResourcePolicyCreateArgs,
  type DelegateArgs as ResourcePolicyDelegateArgs,
  type RegisterArgs as ResourcePolicyRegisterArgs,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
} from './resource-policy/index.js';

export {
  issueBitmap,
  verifyBitmap,
  type IssueArgs,
  type VerifyArgs,
  type VerifyFailureReason,
  type VerifyResult,
  type VersionedBitmap,
} from './versioned-bitmap/index.js';

export {
  EntryNotFoundError,
  InMemoryAuditRecorder,
  OtelAuditRecorder,
  ParentNotFoundError,
  type AuditEntry,
  type AuditKind,
  type AuditOutcome,
  type AuditRecorder,
  type CheckEntry,
  type CheckPass,
  type ExecutionEntry,
  type OtelRecordCheckArgs,
  type OtelRecordExecutionArgs,
  type RecordCheckArgs,
  type RecordExecutionArgs,
} from './audit/index.js';

export {
  AccessChecker,
  type AccessCheckerDeps,
  type AccessContext,
  type AccessResult,
  type ApiCall,
  type InstancePolicyDecision,
  type InstancePolicyEvaluation,
  type InstancePolicyEvaluator,
  type InstancePolicyResolver,
} from './access-checker/index.js';

export {
  PermissionSet,
  type DimDef,
  type PermissionSetOptions,
  type PermissionSetSnapshot,
} from './permission-set.js';

export { ScopedEngine, type ScopedEngineSnapshot } from './scoped-engine.js';

export { migratePermissions, type CoordMapper } from './migration.js';

export {
  validateResource,
  canonicalizeResource,
  isValidResource,
  parseResource,
  validateResourceForType,
  DEFAULT_PATTERNS,
  type ResourceType,
  type ResourceError,
  type ValidateOptions,
  type ParsedResource,
  type ResourcePattern,
} from './resource.js';

export {
  formatServiceRef,
  parseServiceRef,
  createServiceContext,
  validateServiceIdentity,
  type ServiceIdentity,
  type DeployContext,
  type ServiceRef,
  type ServiceRefFormatOptions,
  type ServiceContext,
} from './service-ref.js';

export {
  formatPermCode,
  parsePermCode,
  createPermCodeFactory,
  type PermissionCode,
  type PermCodeFactory,
} from './permission-code.js';

export {
  PermissionCodec,
  PermissionView,
  type CodecDims,
  type DecodedPerm,
  type CodecSnapshot,
} from './permission-codec.js';

export {
  PermissionViewCache,
  type ViewCacheOptions,
  type CacheStats,
} from './permission-view-cache.js';

export {
  TernaryMask,
  ALLOW,
  DENY,
  UNSET,
  type TriState,
  type DefaultPolicy,
} from './ternary-mask.js';

export {
  RoleRegistry,
  type DomainRoleDef,
  type RoleRegistryValidationError,
} from './role-registry.js';

export {
  OrgRoleRegistry,
  type DomainAssignment,
  type OrgRoleDef,
  type OrgRoleValidationError,
} from './org-role-registry.js';

export {
  RoleResolver,
  type ResolutionContext,
  type DirectAssignment,
  type DomainMaskResult,
  type ExplainEntry,
} from './role-resolver.js';

export { UserOverrideStore, type UserOverrideSnapshot } from './user-override.js';

export {
  UserPermissionEngine,
  type FinalMaskResult,
  type AuditResult,
  type GrantSource,
  type DenialReason,
} from './user-permission-engine.js';

export {
  type PermissionVersionStore,
  InMemoryPermissionVersionStore,
} from './permission-version.js';

export {
  type AuthProvider,
  ZitadelProvider,
  KeycloakProvider,
  NoopAuthProvider,
  type ZitadelProviderOptions,
  type KeycloakProviderOptions,
} from './auth-provider.js';

export {
  PermissionChangeNotifier,
  type NotifyOptions,
  type NotifyResult,
} from './permission-change-notifier.js';

export {
  TokenEnrichmentHandler,
  computeSchemaHash,
  base64ToUint8,
  type PermissionClaims,
  type ContextLoader,
} from './token-enrichment.js';

export {
  PermissionMiddleware,
  type MiddlewareErrorKind,
  type MiddlewareError,
  type CheckResult,
} from './permission-middleware.js';

// re-export from weighted-index (partial-binder는 weighted-index에 위치)
export { createBinder, type PartialBinder } from 'weighted-index';

export {
  PermissionSet,
  type DimDef,
  type PermissionSetOptions,
  type PermissionSetSnapshot,
} from "./permission-set.js";

export {
  ScopedEngine,
  type ScopedEngineSnapshot,
} from "./scoped-engine.js";

export {
  migratePermissions,
  type CoordMapper,
} from "./migration.js";

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
} from "./resource.js";

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
} from "./service-ref.js";

export {
  formatPermCode,
  parsePermCode,
  createPermCodeFactory,
  type PermissionCode,
  type PermCodeFactory,
} from "./permission-code.js";

export {
  PermissionCodec,
  type CodecDims,
  type DecodedPerm,
  type CodecSnapshot,
} from "./permission-codec.js";

export {
  TernaryMask,
  ALLOW,
  DENY,
  UNSET,
  type TriState,
  type DefaultPolicy,
} from "./ternary-mask.js";

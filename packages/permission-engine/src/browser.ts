// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

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

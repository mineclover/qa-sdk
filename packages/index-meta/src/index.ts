export { MetaRegistry } from "./meta-registry.js";

export type {
  EntityId,
  EntryStatus,
  EntryFlag,
  EntryIndexRef,
  DimSnapshotMigration,
  DimSnapshotInput,
  DimInput,
  IndexVersionInput,
  IndexInput,
  MetaRegistryInput,
  DimDef,
  DimSnapshot,
  IndexDef,
  IndexVersion,
  VersionedValue,
  DimActiveSet,
  IndexActiveManifest,
} from "./types.js";

export {
  IndexMetaError,
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  EntryNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
} from "./errors.js";

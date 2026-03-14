export { MetaRegistry } from "./meta-registry.js";
export { MetaResolver } from "./meta-resolver.js";

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
  AddressConfig,
  DimDef,
  DimSnapshot,
  IndexDef,
  IndexVersion,
  VersionedValue,
  DimActiveSet,
  IndexActiveManifest,
  DecodeMap,
  DimRange,
  IndexRange,
  MetaDataset,
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

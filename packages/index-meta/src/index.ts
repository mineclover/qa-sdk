export { MetaRegistry } from "./meta-registry.js";
export { MetaCodec } from "./meta-codec.js";
export { MetaResolver } from "./meta-resolver.js";
export { defineTable } from "./table-def.js";
export { compileSchema } from "./compile-schema.js";
export { InMemoryIndexMetaStore } from "./adapters/memory-store.js";
export { InMemoryPrefixRegistry } from "./adapters/memory-prefix-registry.js";
export { InMemoryPrefixRouter } from "./adapters/memory-prefix-router.js";
export { SqlIndexMetaStore } from "./adapters/sql-store.js";
export type { SqlDriver } from "./adapters/sql-store.js";
export { BetterSqliteDriver } from "./adapters/node-sqlite-driver.js";
export { DistributedStoreClient } from "./distributed-client.js";
export { syncSchemaToRegistry } from "./schema-sync.js";
export {
  computeStateRanges,
  classifyAddress,
  isActive,
  isAccessible,
  activeRanges,
  inactiveOnlyRanges,
  positionsToConstraint,
} from "./invalid-ranges.js";
export { InMemoryAddressStateStore } from "./adapters/memory-invalid-range-store.js";
export { migrateAddress, migrateValue, migrateBatch } from "./migrate-address.js";
export { exportVersion, importVersion } from "./backup.js";
export { validateEntryBatchPayload, applyEntryBatch } from "./api-payload.js";

export type {
  IndexMetaStore,
  SchemaVersionRecord,
  EntryRecord,
} from "./index-meta-store.js";

export type {
  PrefixRegistry,
  PrefixRegistryRecord,
} from "./prefix-registry.js";

export type { PrefixRouter } from "./prefix-router.js";
export type { DimRef, ResolvedAddress } from "./prefix-registry.js";
export type { DimStateSpec, AddressState } from "./invalid-ranges.js";
export type { AddressStateStore, AddressStateCacheRecord } from "./invalid-range-store.js";
export type { MigrateResult } from "./migrate-address.js";
export type { VersionBackup } from "./backup.js";
export type { EntryBatchPayload } from "./api-payload.js";

export type {
  AddressRef,
  LeafVersion,
  CompositeVersion,
  TableVersion,
  TableDef,
} from "./table-def.js";

export type {
  LeafVersionSpec,
  CompositeVersionSpec,
  CompositeVersionDim,
  LeafTableSpec,
  CompositeTableSpec,
  TableSpec,
  SchemaDiff,
  TableVersionChange,
  VersionCapacityChange,
  CompiledSchema,
} from "./compile-schema.js";

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

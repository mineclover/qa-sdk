// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * index-meta/workers — Cloudflare Workers / Edge 런타임 전용 진입점
 *
 * Node.js 전용 의존성(node:fs, node:path, node:sqlite, better-sqlite3, bun:sqlite)을
 * 포함하지 않는다. D1SqlDriver + 모든 순수 로직을 제공한다.
 *
 * 제외 항목:
 * - NodeSqliteDriver (node:fs, node:path, node:module, node:sqlite)
 * - BetterSqliteDriver (better-sqlite3 native binding)
 * - BunSqliteDriver (bun:sqlite)
 * - createSqliteDriver (위 드라이버 오케스트레이션)
 * - getDatabaseSync (node:module createRequire)
 */

// ── SDK ───────────────────────────────────────────────────────────────────────
export { createIndexSDK, RESERVED_TOKENS } from "./index-sdk.js";
export type { IndexSDK, IndexClient, IndexSDKOptions, DimCapacityInfo, DimEntryView, DimFullView } from "./index-sdk.js";

// ── Core ──────────────────────────────────────────────────────────────────────
export { MetaRegistry, computeActiveIndices, snapshotCapacity, computeShapeProductBig, fitsNumber } from "./meta-registry.js";
export { AddressProtocolManager, type FallbackStats } from "./address-protocol-manager.js";
export { MetaCodec, validateDecodeMap } from "./meta-codec.js";
export { MetaCodecBig } from "./meta-codec-big.js";
export { MetaResolver } from "./meta-resolver.js";
export { defineTable } from "./table-def.js";
export { compileSchema } from "./compile-schema.js";

// ── Workers 호환 어댑터 (D1 + InMemory + SQL 범용) ───────────────────────────
export { InMemoryIndexMetaStore } from "./adapters/memory-store.js";
export { InMemoryPrefixRegistry } from "./adapters/memory-prefix-registry.js";
export { SqlPrefixRegistry } from "./adapters/sql-prefix-registry.js";
export { InMemoryPrefixRouter } from "./adapters/memory-prefix-router.js";
export { SqlPrefixRouter } from "./adapters/sql-prefix-router.js";
export { SqlIndexMetaStore } from "./adapters/sql-store.js";
export type { SqlDriver, SqlDialect, ExecuteResult } from "./adapters/sql-store.js";
export { D1SqlDriver } from "./adapters/d1-driver.js";
export { D1IndexMetaStore, type D1Database } from "./adapters/d1-store.js";

// ── Gate / Address State ──────────────────────────────────────────────────────
export {
  ADDRESS_GATE,
  computeStateRanges,
  checkGate,
  classifyAddress,
  encodableRanges,
  decodableRanges,
  activeRanges,
  positionsToConstraint,
} from "./invalid-ranges.js";
export { InMemoryAddressStateStore } from "./adapters/memory-invalid-range-store.js";
export { SqlAddressStateStore } from "./adapters/sql-address-state-store.js";
export { InMemoryAddressRangeCache } from "./adapters/memory-address-range-cache.js";
export { SqlAddressRangeCache } from "./adapters/sql-address-range-cache.js";
export { GateEngine, GateAwareVersionLifecycleStore, GateAwareEntryFlagStore } from "./gate-engine.js";
export type { GateEngineDeps } from "./gate-engine.js";

// ── Distributed / Sync ────────────────────────────────────────────────────────
export { DistributedStoreClient } from "./distributed-client.js";
export { syncSchemaToRegistry, applySchemaDiff } from "./schema-sync.js";
export type { ApplySchemaDiffResult } from "./schema-sync.js";

// ── Cross-Version ─────────────────────────────────────────────────────────────
export { CrossVersionEntrySync } from "./cross-version-entry-sync.js";
export type { CrossVersionAddResult } from "./cross-version-entry-sync.js";

// ── Cache ─────────────────────────────────────────────────────────────────────
export { CoalescingCache } from "./coalescing-cache.js";
export type { CoalescingCacheOptions } from "./coalescing-cache.js";
export { EntryCache } from "./entry-cache.js";
export { MigrationCache } from "./migration-cache.js";
export { MetadataCache } from "./metadata-cache.js";
export type { MetadataCacheOptions } from "./metadata-cache.js";

// ── Lifecycle / Migration / Metadata ──────────────────────────────────────────
export { InMemoryVersionLifecycleStore } from "./adapters/memory-version-lifecycle.js";
export { SqlVersionLifecycleStore } from "./adapters/sql-version-lifecycle-store.js";
export { InMemoryMigrationStore } from "./adapters/memory-migration-store.js";
export { SqlMigrationStore } from "./adapters/sql-migration-store.js";
export { InMemoryEntryMetadataStore } from "./adapters/memory-entry-metadata-store.js";
export { InMemoryEntryFlagStore } from "./adapters/memory-entry-flag-store.js";
export { SqlEntryFlagStore } from "./adapters/sql-entry-flag-store.js";

// ── Migration ─────────────────────────────────────────────────────────────────
export {
  migrateAddress,
  migrateValue,
  migrateBatch,
  migrateCrossIndex,
  completeCrossIndex,
} from "./migrate-address.js";

// ── Relational / Policy ───────────────────────────────────────────────────────
export { RelationalEngine } from "./relational-engine.js";
export type { RelationTypeRule, RelationResolveResult } from "./relational-engine.js";
export {
  matchRules,
  resolvePolicy as resolvePatternPolicy,
  detectConflicts as detectPatternConflicts,
} from "./policy-resolver.js";
export type {
  PatternRule,
  ConflictStrategy,
  ResolveResult,
  ConflictReport,
} from "./policy-resolver.js";
export {
  WILDCARD,
  matchToConstraints,
  entitiesToCoord,
  ruleToPattern,
  resolvePolicy,
  detectConflicts,
} from "./named-policy.js";
export type { MatchSpec, PolicyRule } from "./named-policy.js";

// ── Query ─────────────────────────────────────────────────────────────────────
export { composeQuery, deepDecode } from "./cross-index-query.js";
export { gateFilterRanges, gateAwareResolve, buildDenialSpecs } from "./gate-aware-query.js";
export type { GateAwareResult } from "./gate-aware-query.js";
export type { DeepDecodeResult } from "./cross-index-query.js";
export {
  queryAcrossVersions,
  entityVersionSpan,
  translateConstraint,
} from "./version-query.js";
export type { CoordConstraint } from "weighted-index";

// ── Prefix Decoder ────────────────────────────────────────────────────────────
export { PrefixDecoder } from "./prefix-decoder.js";
export type { PrefixDecoderConfig, PrefixDeepDecodeResult, PrefixDeepDecodeDetailedResult } from "./prefix-decoder.js";
export { PrefixDecoderBig } from "./prefix-decoder-big.js";
export type { PrefixDecoderBigConfig, PrefixDeepDecodeResultBig, PrefixDeepDecodeDetailedResultBig } from "./prefix-decoder-big.js";

// ── Backup / API / Codegen ────────────────────────────────────────────────────
export { exportVersion, importVersion } from "./backup.js";
export { validateEntryBatchPayload, applyEntryBatch } from "./api-payload.js";
export { generateTypes, lintSchema, formatSchemaDiff } from "./codegen.js";
export type { GenerateTypesOptions, LintDiagnostic } from "./codegen.js";

// ── Store 인터페이스 타입 ─────────────────────────────────────────────────────
export type { IndexMetaStore, SchemaVersionRecord, EntryRecord } from "./index-meta-store.js";
export type { PrefixRegistry, PrefixRegistryRecord } from "./prefix-registry.js";
export type { PrefixRouter } from "./prefix-router.js";
export type { DimRef, ResolvedAddress } from "./prefix-registry.js";
export type { DimStateSpec, AddressState, GateResult } from "./invalid-ranges.js";
export type { AddressStateStore, AddressStateCacheRecord } from "./invalid-range-store.js";
export type { AddressRangeCache, RangeCacheRecord } from "./address-range-cache.js";
export type { EntryFlagStore, EntryFlagRecord } from "./entry-flag-store.js";
export type { VersionLifecycleStore, VersionRecord, VersionStatus, DeactivationMode } from "./version-lifecycle.js";
export type { MigrationStore, MigrationMapping, MigrationChangeType, MigrationResolveResult } from "./migration-store.js";
export type { EntryMetadataStore, MetadataEntry } from "./entry-metadata-store.js";
export type { MigrateResult, CrossIndexPartialResult, CrossIndexMigrateResult } from "./migrate-address.js";
export type { VersionBackup } from "./backup.js";
export type { EntryBatchPayload } from "./api-payload.js";

// ── Table / Schema 타입 ───────────────────────────────────────────────────────
export type { AddressRef, LeafVersion, CompositeVersion, TableVersion, TableDef } from "./table-def.js";
export type {
  LeafVersionSpec, CompositeVersionSpec, CompositeVersionDim,
  LeafTableSpec, CompositeTableSpec, TableSpec,
  SchemaDiff, TableVersionChange, VersionCapacityChange, CompiledSchema,
} from "./compile-schema.js";

// ── 기본 타입 ─────────────────────────────────────────────────────────────────
export type {
  EntityId, EntryStatus, EntryFlag, EntryIndexRef,
  DimSnapshotMigration, DimSnapshotInput, DimInput,
  IndexVersionInput, IndexInput, MetaRegistryInput, AddressConfig,
  DimDef, DimSnapshot, IndexDef, IndexVersion,
  VersionedValue, DimActiveSet, IndexActiveManifest, DecodeMap,
  DimRange, IndexRange, MetaDataset, SnapshotDiff, VersionDiff,
  NumberType, VersionCapacityInfo, VersionedValueBig, DimKind,
} from "./types.js";

// ── 에러 ──────────────────────────────────────────────────────────────────────
export {
  IndexMetaError, DimNotFoundError, SnapshotNotFoundError,
  IndexNotFoundError, IndexVersionNotFoundError, EntryNotFoundError,
  MigrationNotFoundError, ValidationError, ParseError,
  NegotiationError, CapacityOverflowError,
} from "./errors.js";

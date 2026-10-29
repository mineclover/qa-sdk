// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * Persistence adapters for index-meta.
 *
 * The pure index-meta package owns codecs, manifests, contracts, and memory
 * implementations. This package owns SQL/native/D1 persistence and drivers.
 */
export * from 'index-meta';

export { SqlPrefixRegistry } from './adapters/sql-prefix-registry.js';
export { SqlPrefixRouter } from './adapters/sql-prefix-router.js';
export { SqlIndexMetaStore } from './adapters/sql-store.js';
export type { SqlDriver, SqlDialect, ExecuteResult } from './adapters/sql-store.js';
export {
  getDatabaseSync,
  type DatabaseSyncCtor,
  type DatabaseSyncInstance,
} from './adapters/database-sync-loader.js';
export { NodeSqliteDriver } from './adapters/node-sqlite-driver.js';
export { BetterSqliteDriver } from './adapters/better-sqlite-driver.js';
export { createSqliteDriver } from './adapters/create-sqlite-driver.js';
export type {
  SqliteDriverType,
  CreateSqliteDriverOptions,
} from './adapters/create-sqlite-driver.js';
export { D1SqlDriver } from './adapters/d1-driver.js';
export { D1IndexMetaStore, type D1Database } from './adapters/d1-store.js';
export { BunSqliteDriver, type BunDatabase } from './adapters/bun-sqlite-driver.js';
export { SqlAddressStateStore } from './adapters/sql-address-state-store.js';
export { SqlAddressRangeCache } from './adapters/sql-address-range-cache.js';
export { SqlVersionLifecycleStore } from './adapters/sql-version-lifecycle-store.js';
export { SqlMigrationStore } from './adapters/sql-migration-store.js';
export { SqlEntryFlagStore } from './adapters/sql-entry-flag-store.js';

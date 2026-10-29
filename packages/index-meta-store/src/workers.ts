// @def.boundary index-meta-system
// @def.doc index-meta-system

export * from 'index-meta';
export { SqlPrefixRegistry } from './adapters/sql-prefix-registry.js';
export { SqlPrefixRouter } from './adapters/sql-prefix-router.js';
export { SqlIndexMetaStore } from './adapters/sql-store.js';
export type { SqlDriver, SqlDialect, ExecuteResult } from './adapters/sql-store.js';
export { D1SqlDriver } from './adapters/d1-driver.js';
export { D1IndexMetaStore, type D1Database } from './adapters/d1-store.js';
export { SqlAddressStateStore } from './adapters/sql-address-state-store.js';
export { SqlAddressRangeCache } from './adapters/sql-address-range-cache.js';
export { SqlVersionLifecycleStore } from './adapters/sql-version-lifecycle-store.js';
export { SqlMigrationStore } from './adapters/sql-migration-store.js';
export { SqlEntryFlagStore } from './adapters/sql-entry-flag-store.js';

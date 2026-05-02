// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * node:sqlite DatabaseSync의 lazy-loader.
 *
 * node:sqlite는 런타임에만 존재하므로 동적 require로 로드.
 * NodeSqliteDriver와 DkgSqliteStore가 공유한다.
 */
import { createRequire } from "node:module";

export type DatabaseSyncCtor = typeof import("node:sqlite").DatabaseSync;
export type DatabaseSyncInstance = InstanceType<DatabaseSyncCtor>;

let _DatabaseSync: DatabaseSyncCtor | null = null;

export function getDatabaseSync(): DatabaseSyncCtor {
  if (!_DatabaseSync) {
    const require = createRequire(import.meta.url);
    _DatabaseSync = (require("node:sqlite") as { DatabaseSync: DatabaseSyncCtor }).DatabaseSync;
  }
  return _DatabaseSync;
}

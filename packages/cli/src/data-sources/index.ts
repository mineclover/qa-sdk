// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * Legacy compatibility surface.
 *
 * The implementation lives in the workspace-owned `definition-data-source`
 * package. Keep this path as a thin re-export until downstream references are
 * migrated, so the CLI does not maintain a second DataSource implementation.
 */
export {
  createDataSource,
  LocalDataSource,
  ScanDataSource,
  ServerDataSource,
  syncDocsToLocalDb,
} from 'definition-data-source';
export type {
  DataSourceOptions,
  SyncLocalDbOptions,
  SyncLocalDbResult,
} from 'definition-data-source';

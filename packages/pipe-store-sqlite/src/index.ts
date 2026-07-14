// @def.boundary persistence-system-root
// @def.doc persistence-system-root

export { createDb } from './db/connection.js';
export { createStores, SqlitePipeGraphStore, SqlitePipeSpecStore } from './store.js';
export { SqliteBindingStore, SqliteLineageValidationStore } from './data-object-store.js';
export type {
  StoredDataObjectBinding,
  DataObjectBindingInput,
  LineageValidationStatus,
  LineageValidationDetail,
  LineageValidationRecord,
  LineageValidationInput,
} from './data-object-store.js';
export { SqliteFacetCodeStore } from './facet-code-store.js';
export { SqliteManifestRegistry } from './manifest-store.js';
export type {
  PrefixVersionRecord,
  PrefixLifecycleState,
  ServiceVersionManifest,
  ManifestLifecycleState,
  RuntimeAddressSnapshot,
  ServiceManifestOptions,
  GuardResult,
} from './manifest-store.js';

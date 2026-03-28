// ── Runtime ─────────────────────────────────────────────
export { AppModule } from "./app.module.js";
export { RuntimeModule } from "./runtime.module.js";
export { bootstrapNestApp } from "./main.js";
export {
  createRegistryDatabaseDriver,
  createRegistryStores,
} from "./bootstrap/stores.js";

// ── Service ─────────────────────────────────────────────
export { RegistryService, type RegistryServiceDeps } from "./lib/registry-service.js";
export { simulate, analyze } from "./lib/draft-workspace.js";

// ── Stores ──────────────────────────────────────────────
export type { PrefixOwnerStore } from "./stores/prefix-owner-store.js";
export { InMemoryPrefixOwnerStore } from "./stores/in-memory-prefix-owner-store.js";
export { SqlPrefixOwnerStore } from "./stores/sql-prefix-owner-store.js";
export type { DraftLockStore } from "./stores/draft-lock-store.js";
export { InMemoryDraftLockStore } from "./stores/in-memory-draft-lock-store.js";
export { SqlDraftLockStore } from "./stores/sql-draft-lock-store.js";

// ── Schemas ─────────────────────────────────────────────
export type { SchemaSnapshot } from "./schemas/schema-snapshot.js";
export { schemaSnapshotSchema } from "./schemas/schema-snapshot.js";

// ── Types ───────────────────────────────────────────────
export type {
  PrefixOwnerRecord,
  DraftLock,
  DiagnosticLevel,
  DiagnosticEntry,
  ImpactEntry,
  SimulateResult,
  DraftInfo,
  AnalyzeResult,
  ExtendedVersionStatus,
  ExtendedVersionRecord,
} from "./types/index.js";

// ── Errors ──────────────────────────────────────────────
export {
  AppError,
  type ErrorCode,
  badRequest,
  prefixNotFound,
  versionNotFound,
  invalidTransition,
  draftLocked,
  refNotFound,
  circularRef,
  notReady,
  overflow,
  duplicatePrefix,
} from "./lib/errors.js";

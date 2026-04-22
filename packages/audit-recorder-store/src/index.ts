// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

// SQLite 어댑터 (기존 경로)
export { SqliteAuditRecorder } from "./sqlite/adapter.js";
export { auditEntries, AUDIT_ENTRIES_DDL } from "./sqlite/schema.js";

// Backward-compat alias — 기존 외부 호출자 영향 회피.
// Plan 06c(factory) 도입 후 deprecation 마킹.
export { SqliteAuditRecorder as DrizzleAuditRecorder } from "./sqlite/adapter.js";

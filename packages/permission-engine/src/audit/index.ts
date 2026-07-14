// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

export {
  EntryNotFoundError,
  InMemoryAuditRecorder,
  ParentNotFoundError,
  type AuditRecorder,
} from './recorder.js';

export {
  OtelAuditRecorder,
  type OtelRecordCheckArgs,
  type OtelRecordExecutionArgs,
} from './otel-wrapper.js';

export {
  type AuditEntry,
  type AuditKind,
  type AuditOutcome,
  type CheckEntry,
  type CheckPass,
  type ExecutionEntry,
  type RecordCheckArgs,
  type RecordExecutionArgs,
} from './types.js';

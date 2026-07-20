// @def.doc federated-connection-runtime

export {
  FederatedConnectionRuntime,
  FederatedRuntimeError,
  PlanStateError,
  StalePlanError,
  compareExecutionSource,
  type ApprovalInput,
} from './runtime.js';

export { createImpactPlan, validatePropagationPolicy } from './planner.js';

export {
  InMemoryConnectionStateStore,
  SqliteConnectionStateStore,
  sourceIdentityForObservation,
  sourceRevisionForObservation,
} from './store.js';

export {
  PLAN_STATUSES,
  PROPAGATION_MODES,
  toStoredObservation,
  type ApprovalRecord,
  type CandidateDisposition,
  type ConnectionAuditEvent,
  type ConnectionEvidence,
  type ConnectionEvidenceSink,
  type ConnectionStateStore,
  type ExecutionReceipt,
  type ImpactCandidate,
  type ImpactKind,
  type ImpactPlan,
  type ImpactRisk,
  type PlanExecution,
  type PlanStatus,
  type PropagationAction,
  type PropagationMode,
  type PropagationPolicy,
  type RuntimeOptions,
  type SourceExecutionAdapter,
  type SourceExecutionContext,
  type SourceIdentityLookup,
  type StoredSourceObservation,
} from './runtime-contract.js';

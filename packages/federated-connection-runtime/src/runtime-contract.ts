// @def.doc federated-connection-runtime

import type {
  ConnectionEndpoint,
  ConnectionMapping,
  ConnectionRef,
  ConnectionSnapshot,
  SourceChange,
  SourceIdentifierRule,
  SourceRef,
  SourceSnapshot,
  TypedRelation,
} from 'federated-connection';

export const PROPAGATION_MODES = [
  'automatic',
  'auto_with_review',
  'review_required',
  'notify_only',
  'validate_only',
  'blocked',
] as const;

export type PropagationMode = (typeof PROPAGATION_MODES)[number];

export const PLAN_STATUSES = [
  'proposed',
  'approved',
  'rejected',
  'stale',
  'executing',
  'applied',
  'verified',
  'failed',
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type ImpactKind = 'direct' | 'indirect';
export type ImpactRisk = 'low' | 'medium' | 'high' | 'critical';
export type CandidateDisposition = 'proposed' | 'blocked' | 'notify_only';

export type PropagationPolicy = Readonly<{
  version: string;
  mode: PropagationMode;
  maxDepth?: number;
  requireApproval?: boolean;
}>;

export type StoredSourceObservation = Readonly<{
  runId: string;
  source: SourceRef;
  status: SourceSnapshot<unknown>['status'];
  observedAt: string;
  payloadHash: string;
  change: SourceChange;
  recordedAt: string;
  identifierRule?: Readonly<Pick<SourceIdentifierRule, 'id' | 'version'>>;
}>;

export type ImpactCandidate = Readonly<{
  id: string;
  kind: ImpactKind;
  depth: number;
  target: ConnectionEndpoint;
  relationIds: readonly string[];
  risk: ImpactRisk;
  disposition: CandidateDisposition;
  reason: string;
}>;

export type PropagationAction = Readonly<{
  id: string;
  kind: 'reconcile_target';
  target: ConnectionEndpoint;
  sourcePrecondition: SourceRef;
  relationIds: readonly string[];
  reason: string;
}>;

export type ImpactPlan = Readonly<{
  id: string;
  source: SourceRef;
  observation: StoredSourceObservation;
  policy: PropagationPolicy;
  graphSnapshot: ConnectionSnapshot;
  candidates: readonly ImpactCandidate[];
  actions: readonly PropagationAction[];
  approvalRequired: boolean;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  approval?: ApprovalRecord;
}>;

export type ApprovalRecord = Readonly<{
  decision: 'approved' | 'rejected';
  actor: string;
  decidedAt: string;
  reason?: string;
}>;

export type ExecutionReceipt = Readonly<{
  actionId: string;
  status: 'applied' | 'failed';
  executedAt: string;
  expectedSource?: SourceRef;
  expectedPayloadHash?: string;
  message?: string;
}>;

export type PlanExecution = Readonly<{
  planId: string;
  status: 'stale' | 'applied' | 'verified' | 'failed';
  receipts: readonly ExecutionReceipt[];
  observedAfter?: StoredSourceObservation;
  error?: string;
  completedAt: string;
}>;

export type ConnectionAuditEvent = Readonly<{
  id: string;
  kind:
    | 'observation.recorded'
    | 'plan.created'
    | 'plan.approved'
    | 'plan.rejected'
    | 'execution.started'
    | 'execution.completed'
    | 'plan.stale'
    | 'evidence.failed';
  occurredAt: string;
  actor?: string;
  runId?: string;
  planId?: string;
  actionId?: string;
  source?: SourceRef;
  relationIds: readonly string[];
  policyVersion?: string;
  status?: string;
  metadata?: Readonly<Record<string, string>>;
}>;

export type ConnectionEvidence = Readonly<{
  id: string;
  planId: string;
  source: SourceRef;
  relationIds: readonly string[];
  changeKind: SourceChange['kind'];
  executionStatus: PlanExecution['status'];
  verified: boolean;
  observedAfter?: StoredSourceObservation;
  recordedAt: string;
}>;

export interface ConnectionEvidenceSink {
  record(evidence: ConnectionEvidence): void | Promise<void>;
}

export type SourceIdentityLookup = Pick<SourceRef, 'sourceSystem' | 'entityType' | 'localId'>;

export type SourceExecutionContext = Readonly<{
  plan: ImpactPlan;
  action: PropagationAction;
  currentSource: SourceRef;
}>;

export interface SourceExecutionAdapter {
  apply(context: SourceExecutionContext): Promise<ExecutionReceipt>;
}

export type RuntimeOptions = Readonly<{
  now?: () => string;
  createId?: (prefix: string) => string;
  evidenceSink?: ConnectionEvidenceSink;
  identifierRegistry?: import('federated-connection').SourceIdentifierRegistry;
}>;

export type ConnectionStateStore = {
  registerMapping(mapping: ConnectionMapping): void;
  registerRelation(relation: TypedRelation): void;
  getMapping(source: SourceRef, target: ConnectionRef): ConnectionMapping | undefined;
  mappingsForSource(source: SourceRef, status?: ConnectionMapping['status']): ConnectionMapping[];
  resolve(
    source: SourceRef,
  ): ReturnType<import('federated-connection').ConnectionRegistry['resolve']>;
  snapshot(): ConnectionSnapshot;
  recordObservation(observation: StoredSourceObservation): void;
  latestObservation(source: SourceIdentityLookup): StoredSourceObservation | null;
  savePlan(plan: ImpactPlan): void;
  getPlan(planId: string): ImpactPlan | null;
  listPlans(status?: PlanStatus): ImpactPlan[];
  recordExecution(execution: PlanExecution): void;
  getExecution(planId: string): PlanExecution | null;
  recordAudit(event: ConnectionAuditEvent): void;
  listAudit(planId?: string): ConnectionAuditEvent[];
  close(): void;
};

export function toStoredObservation(
  runId: string,
  observation: { snapshot: SourceSnapshot<unknown>; change: SourceChange },
  recordedAt: string,
  identifierRule?: Readonly<Pick<SourceIdentifierRule, 'id' | 'version'>>,
): StoredSourceObservation {
  return {
    runId,
    source: { ...observation.snapshot.source },
    status: observation.snapshot.status,
    observedAt: observation.snapshot.observedAt,
    payloadHash: observation.snapshot.payloadHash,
    change: {
      ...observation.change,
      source: { ...observation.change.source },
      ...(observation.change.previous ? { previous: { ...observation.change.previous } } : {}),
    },
    recordedAt,
    ...(identifierRule?.id && identifierRule.version
      ? { identifierRule: { id: identifierRule.id, version: identifierRule.version } }
      : {}),
  };
}

// @def.doc federated-connection-runtime

import { randomUUID } from 'node:crypto';
import {
  compareSourceSnapshots,
  observeSource,
  sourceRefKey,
  type SourceIdentifierRegistry,
  type SourceAdapter,
  type SourceLookup,
  type SourceSnapshot,
} from 'federated-connection';
import { createImpactPlan } from './planner.js';
import {
  type ApprovalRecord,
  type ConnectionAuditEvent,
  type ConnectionEvidence,
  type ConnectionEvidenceSink,
  type ConnectionStateStore,
  type ExecutionReceipt,
  type ImpactPlan,
  type PlanExecution,
  type PropagationPolicy,
  type RuntimeOptions,
  type SourceExecutionAdapter,
  type SourceIdentityLookup,
  type StoredSourceObservation,
  toStoredObservation,
} from './runtime-contract.js';

export class FederatedRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FederatedRuntimeError';
  }
}

export class PlanStateError extends FederatedRuntimeError {
  constructor(planId: string, expected: string, actual: string) {
    super(`Plan ${planId} must be ${expected}; current status is ${actual}`);
    this.name = 'PlanStateError';
  }
}

export class StalePlanError extends FederatedRuntimeError {
  constructor(
    planId: string,
    expectedRevision: string,
    actualRevision: string,
    expectedPayloadHash?: string,
    actualPayloadHash?: string,
  ) {
    const payloadDetail =
      expectedPayloadHash !== undefined && actualPayloadHash !== undefined
        ? `, expected payload hash ${expectedPayloadHash}, got ${actualPayloadHash}`
        : '';
    super(
      `Plan ${planId} is stale: expected source revision ${expectedRevision}, got ${actualRevision}${payloadDetail}`,
    );
    this.name = 'StalePlanError';
  }
}

export type ApprovalInput = Readonly<{
  actor: string;
  reason?: string;
}>;

function snapshotFromStored(observation: StoredSourceObservation): SourceSnapshot<unknown> {
  return {
    source: { ...observation.source },
    status: observation.status,
    observedAt: observation.observedAt,
    payloadHash: observation.payloadHash,
  };
}

function sourceLookup(source: SourceIdentityLookup): SourceLookup {
  return {
    sourceSystem: source.sourceSystem,
    entityType: source.entityType,
    localId: source.localId,
  };
}

export class FederatedConnectionRuntime {
  readonly store: ConnectionStateStore;
  private readonly now: () => string;
  private readonly createId: (prefix: string) => string;
  private readonly evidenceSink?: ConnectionEvidenceSink;
  private readonly identifierRegistry?: SourceIdentifierRegistry;

  constructor(store: ConnectionStateStore, options: RuntimeOptions = {}) {
    this.store = store;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? ((prefix) => `${prefix}-${randomUUID()}`);
    this.evidenceSink = options.evidenceSink;
    this.identifierRegistry = options.identifierRegistry;
  }

  registerMapping(...args: Parameters<ConnectionStateStore['registerMapping']>): void {
    this.store.registerMapping(...args);
  }

  registerRelation(...args: Parameters<ConnectionStateStore['registerRelation']>): void {
    this.store.registerRelation(...args);
  }

  async observe<TPayload>(
    adapter: SourceAdapter<TPayload>,
    lookup: SourceLookup,
  ): Promise<StoredSourceObservation> {
    const identifierRule = this.identifierRegistry?.validateLookup(
      lookup,
      adapter.identifierRuleVersion,
    );
    const previousRecord = this.store.latestObservation(lookup);
    const previous = previousRecord ? snapshotFromStored(previousRecord) : undefined;
    const rawObservation = await observeSource(adapter, lookup, previous);
    const resolvedIdentifierRule = this.identifierRegistry?.validate(
      rawObservation.snapshot.source,
      identifierRule?.version ?? adapter.identifierRuleVersion,
    );
    const recordedIdentifierRule = resolvedIdentifierRule ?? identifierRule;
    const record = toStoredObservation(
      this.createId('observation'),
      rawObservation,
      this.now(),
      recordedIdentifierRule
        ? { id: recordedIdentifierRule.id, version: recordedIdentifierRule.version }
        : undefined,
    );
    this.store.recordObservation(record);
    this.audit({
      kind: 'observation.recorded',
      runId: record.runId,
      source: record.source,
      relationIds: [],
      status: record.change.kind,
    });
    return record;
  }

  createPlan(observation: StoredSourceObservation, policy: PropagationPolicy): ImpactPlan {
    if (this.identifierRegistry) {
      const rule = this.identifierRegistry.validate(
        observation.source,
        observation.identifierRule?.version,
      );
      if (
        observation.identifierRule &&
        (rule.id !== observation.identifierRule.id ||
          rule.version !== observation.identifierRule.version)
      ) {
        throw new FederatedRuntimeError(
          `Observation ${observation.runId} identifier rule changed: expected ${observation.identifierRule.id}, got ${rule.id}`,
        );
      }
    }
    const now = this.now();
    let plan = createImpactPlan(
      observation,
      this.store.snapshot(),
      policy,
      now,
      this.createId('plan'),
    );

    if (!plan.approvalRequired && plan.actions.length > 0) {
      const approval: ApprovalRecord = {
        decision: 'approved',
        actor: `policy:${policy.version}`,
        decidedAt: now,
        reason: 'automatic mode with no high-risk candidate',
      };
      plan = { ...plan, status: 'approved', approval, updatedAt: now };
    }

    this.store.savePlan(plan);
    this.audit({
      kind: 'plan.created',
      planId: plan.id,
      source: plan.source,
      relationIds: plan.candidates.flatMap((candidate) => candidate.relationIds),
      policyVersion: plan.policy.version,
      status: plan.status,
    });
    return plan;
  }

  approve(planId: string, input: ApprovalInput): ImpactPlan {
    const plan = this.requirePlan(planId);
    if (plan.status !== 'proposed') {
      throw new PlanStateError(planId, 'proposed', plan.status);
    }
    if (plan.candidates.some((candidate) => candidate.disposition === 'blocked')) {
      throw new FederatedRuntimeError(`Plan ${planId} contains blocked impact candidates`);
    }

    const now = this.now();
    const approval: ApprovalRecord = {
      decision: 'approved',
      actor: input.actor,
      ...(input.reason ? { reason: input.reason } : {}),
      decidedAt: now,
    };
    const approved = { ...plan, status: 'approved' as const, approval, updatedAt: now };
    this.store.savePlan(approved);
    this.audit({
      kind: 'plan.approved',
      planId,
      actor: input.actor,
      source: approved.source,
      relationIds: approved.candidates.flatMap((candidate) => candidate.relationIds),
      policyVersion: approved.policy.version,
      status: approved.status,
    });
    return approved;
  }

  reject(planId: string, input: ApprovalInput): ImpactPlan {
    const plan = this.requirePlan(planId);
    if (plan.status !== 'proposed') {
      throw new PlanStateError(planId, 'proposed', plan.status);
    }
    const now = this.now();
    const approval: ApprovalRecord = {
      decision: 'rejected',
      actor: input.actor,
      ...(input.reason ? { reason: input.reason } : {}),
      decidedAt: now,
    };
    const rejected = { ...plan, status: 'rejected' as const, approval, updatedAt: now };
    this.store.savePlan(rejected);
    this.audit({
      kind: 'plan.rejected',
      planId,
      actor: input.actor,
      source: rejected.source,
      relationIds: rejected.candidates.flatMap((candidate) => candidate.relationIds),
      policyVersion: rejected.policy.version,
      status: rejected.status,
    });
    return rejected;
  }

  async execute<TPayload>(
    planId: string,
    adapter: SourceAdapter<TPayload>,
    executor: SourceExecutionAdapter,
  ): Promise<PlanExecution> {
    const plan = this.requirePlan(planId);
    if (plan.status !== 'approved') {
      throw new PlanStateError(planId, 'approved', plan.status);
    }
    if (plan.actions.length === 0) {
      throw new FederatedRuntimeError(`Plan ${planId} has no executable actions`);
    }

    const identifierRuleVersion = plan.observation.identifierRule?.version;
    if (this.identifierRegistry) {
      const rule = this.identifierRegistry.validate(
        plan.source,
        identifierRuleVersion ?? adapter.identifierRuleVersion,
      );
      if (
        plan.observation.identifierRule &&
        (rule.id !== plan.observation.identifierRule.id ||
          rule.version !== plan.observation.identifierRule.version)
      ) {
        throw new FederatedRuntimeError(
          `Plan ${planId} identifier rule changed: expected ${plan.observation.identifierRule.id}, got ${rule.id}`,
        );
      }
    }

    const currentObservation = await observeSource(
      adapter,
      sourceLookup(plan.source),
      snapshotFromStored(plan.observation),
    );
    if (this.identifierRegistry) {
      this.identifierRegistry.validate(
        currentObservation.snapshot.source,
        identifierRuleVersion ?? adapter.identifierRuleVersion,
      );
    }
    if (
      sourceRefKey(currentObservation.snapshot.source) !== sourceRefKey(plan.source) ||
      currentObservation.snapshot.status !== plan.observation.status ||
      currentObservation.snapshot.payloadHash !== plan.observation.payloadHash
    ) {
      return await this.recordStale(
        plan,
        currentObservation.snapshot.source.revision,
        currentObservation.snapshot.payloadHash,
      );
    }

    const executing = { ...plan, status: 'executing' as const, updatedAt: this.now() };
    this.store.savePlan(executing);
    this.audit({
      kind: 'execution.started',
      planId,
      source: executing.source,
      relationIds: executing.actions.flatMap((action) => action.relationIds),
      policyVersion: executing.policy.version,
      status: executing.status,
    });
    const receipts: ExecutionReceipt[] = [];

    for (const action of executing.actions) {
      try {
        const receipt = await executor.apply({
          plan: executing,
          action,
          currentSource: { ...currentObservation.snapshot.source },
        });
        if (receipt.actionId !== action.id) {
          throw new FederatedRuntimeError(
            `Executor receipt ${receipt.actionId} does not match action ${action.id}`,
          );
        }
        receipts.push(receipt);
      } catch (error) {
        receipts.push({
          actionId: action.id,
          status: 'failed',
          executedAt: this.now(),
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const failed = receipts.find((receipt) => receipt.status === 'failed');
    let afterObservation;
    try {
      afterObservation = await observeSource(
        adapter,
        sourceLookup(plan.source),
        currentObservation.snapshot,
      );
      if (this.identifierRegistry) {
        this.identifierRegistry.validate(
          afterObservation.snapshot.source,
          identifierRuleVersion ?? adapter.identifierRuleVersion,
        );
      }
    } catch (error) {
      const execution: PlanExecution = {
        planId,
        status: failed ? 'failed' : 'applied',
        receipts,
        error: `re-fetch failed: ${error instanceof Error ? error.message : String(error)}`,
        completedAt: this.now(),
      };
      await this.persistExecution(executing, execution);
      return execution;
    }
    const after = toStoredObservation(
      this.createId('verification'),
      afterObservation,
      this.now(),
      plan.observation.identifierRule,
    );
    this.store.recordObservation(after);
    const verificationPossible = receipts.every(
      (receipt) =>
        receipt.expectedSource !== undefined || receipt.expectedPayloadHash !== undefined,
    );
    const verified =
      !failed &&
      verificationPossible &&
      receipts.every(
        (receipt) =>
          (receipt.expectedSource === undefined ||
            sourceRefKey(receipt.expectedSource) === sourceRefKey(after.source)) &&
          (receipt.expectedPayloadHash === undefined ||
            receipt.expectedPayloadHash === after.payloadHash),
      );
    const status: PlanExecution['status'] = failed ? 'failed' : verified ? 'verified' : 'applied';
    const execution: PlanExecution = {
      planId,
      status,
      receipts,
      observedAfter: after,
      ...(failed ? { error: failed.message ?? 'executor failed' } : {}),
      completedAt: this.now(),
    };
    await this.persistExecution(executing, execution);
    return execution;
  }

  getPlan(planId: string): ImpactPlan | null {
    return this.store.getPlan(planId);
  }

  getExecution(planId: string): PlanExecution | null {
    return this.store.getExecution(planId);
  }

  private requirePlan(planId: string): ImpactPlan {
    const plan = this.store.getPlan(planId);
    if (!plan) throw new FederatedRuntimeError(`Plan not found: ${planId}`);
    return plan;
  }

  private async recordStale(
    plan: ImpactPlan,
    actualRevision: string,
    actualPayloadHash?: string,
  ): Promise<PlanExecution> {
    const completedAt = this.now();
    const execution: PlanExecution = {
      planId: plan.id,
      status: 'stale',
      receipts: [],
      error: new StalePlanError(
        plan.id,
        plan.source.revision,
        actualRevision,
        plan.observation.payloadHash,
        actualPayloadHash,
      ).message,
      completedAt,
    };
    this.store.recordExecution(execution);
    this.store.savePlan({ ...plan, status: 'stale', updatedAt: completedAt });
    this.audit({
      kind: 'plan.stale',
      planId: plan.id,
      source: plan.source,
      relationIds: plan.actions.flatMap((action) => action.relationIds),
      policyVersion: plan.policy.version,
      status: execution.status,
      metadata: {
        actualRevision,
        ...(actualPayloadHash ? { actualPayloadHash } : {}),
      },
    });
    await this.emitEvidence(plan, execution);
    return execution;
  }

  private async persistExecution(plan: ImpactPlan, execution: PlanExecution): Promise<void> {
    this.store.recordExecution(execution);
    this.store.savePlan({
      ...plan,
      status:
        execution.status === 'verified'
          ? 'verified'
          : execution.status === 'failed'
            ? 'failed'
            : execution.status === 'stale'
              ? 'stale'
              : 'applied',
      updatedAt: execution.completedAt,
    });
    this.audit({
      kind: 'execution.completed',
      planId: plan.id,
      source: plan.source,
      relationIds: plan.actions.flatMap((action) => action.relationIds),
      policyVersion: plan.policy.version,
      status: execution.status,
    });
    await this.emitEvidence(plan, execution);
  }

  private audit(input: Omit<ConnectionAuditEvent, 'id' | 'occurredAt'>): void {
    this.store.recordAudit({
      ...input,
      id: this.createId('audit'),
      occurredAt: this.now(),
    });
  }

  private async emitEvidence(plan: ImpactPlan, execution: PlanExecution): Promise<void> {
    if (!this.evidenceSink) return;
    const evidence: ConnectionEvidence = {
      id: this.createId('evidence'),
      planId: plan.id,
      source: plan.source,
      relationIds: plan.actions.flatMap((action) => action.relationIds),
      changeKind: plan.observation.change.kind,
      executionStatus: execution.status,
      verified: execution.status === 'verified',
      ...(execution.observedAfter ? { observedAfter: execution.observedAfter } : {}),
      recordedAt: execution.completedAt,
    };
    try {
      await this.evidenceSink.record(evidence);
    } catch (error) {
      this.audit({
        kind: 'evidence.failed',
        planId: plan.id,
        source: plan.source,
        relationIds: evidence.relationIds,
        policyVersion: plan.policy.version,
        status: execution.status,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
}

export function compareExecutionSource(
  previous: StoredSourceObservation,
  current: SourceSnapshot<unknown>,
) {
  return compareSourceSnapshots(snapshotFromStored(previous), current);
}

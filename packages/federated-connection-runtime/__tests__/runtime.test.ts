import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ConnectionRegistry,
  SourceIdentifierRegistry,
  type SourceAdapter,
  type SourceRef,
  type TypedRelation,
} from 'federated-connection';
import {
  FederatedConnectionRuntime,
  InMemoryConnectionStateStore,
  SqliteConnectionStateStore,
  createImpactPlan,
  type StoredSourceObservation,
} from '../src/index.js';

const erpRev1: SourceRef = {
  sourceSystem: 'erp',
  entityType: 'customer',
  localId: 'cust-7',
  revision: 'rev-1',
};
const erpRev2: SourceRef = { ...erpRev1, revision: 'rev-2' };
const crmRev1: SourceRef = {
  sourceSystem: 'crm',
  entityType: 'account',
  localId: 'acct-42',
  revision: 'rev-1',
};
const party: SourceRef = {
  sourceSystem: 'connection',
  entityType: 'party',
  localId: 'party-7',
  revision: 'v1',
};

function observation(
  source: SourceRef,
  kind: StoredSourceObservation['change']['kind'],
): StoredSourceObservation {
  return {
    runId: `run-${source.sourceSystem}-${source.revision}`,
    source,
    status: kind === 'deleted' ? 'deleted' : 'present',
    observedAt: '2026-07-20T00:00:00.000Z',
    payloadHash: `hash-${source.revision}`,
    change: {
      kind,
      source,
      revisionChanged: kind !== 'unchanged',
      payloadChanged: kind !== 'unchanged',
    },
    recordedAt: '2026-07-20T00:00:01.000Z',
  };
}

function mapping(id: string, source: SourceRef) {
  return {
    id,
    source,
    target: { namespace: 'qa', connectionId: 'party-7', version: 1 },
    status: 'active' as const,
    provenance: { kind: 'manual' as const, ref: 'review-1' },
  };
}

describe('federated connection runtime', () => {
  it('builds direct and indirect candidates without merging source identities', () => {
    const store = new InMemoryConnectionStateStore();
    store.registerMapping(mapping('map-erp-1', erpRev1));
    store.registerMapping(mapping('map-crm-1', crmRev1));
    const relation: TypedRelation = {
      id: 'rel-party-account',
      relationType: 'represents',
      source: { kind: 'connection', ref: { namespace: 'qa', connectionId: 'party-7', version: 1 } },
      target: { kind: 'source', ref: crmRev1 },
      provenance: { kind: 'derived', ref: 'cross-source-rule-1' },
    };
    store.registerRelation(relation);

    const plan = createImpactPlan(
      observation(erpRev1, 'updated'),
      store.snapshot(),
      { version: 'policy-1', mode: 'review_required', maxDepth: 3 },
      '2026-07-20T00:00:02.000Z',
      'plan-1',
    );

    expect(plan.candidates.map((candidate) => candidate.kind)).toEqual(['direct', 'indirect']);
    expect(plan.candidates.some((candidate) => candidate.target.kind === 'source')).toBe(true);
    expect(plan.actions).toHaveLength(2);
    expect(plan.approvalRequired).toBe(true);
    expect(plan.source).not.toEqual(crmRev1);
  });

  it('blocks a source revision without an active mapping', () => {
    const store = new InMemoryConnectionStateStore();
    store.registerMapping(mapping('map-erp-1', erpRev1));

    const plan = createImpactPlan(
      observation(erpRev2, 'updated'),
      store.snapshot(),
      { version: 'policy-1', mode: 'automatic' },
      '2026-07-20T00:00:02.000Z',
      'plan-2',
    );

    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0].disposition).toBe('blocked');
    expect(plan.actions).toHaveLength(0);
  });

  it('persists mapping, observation, and plan state in SQLite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'federated-connection-'));
    const path = join(directory, 'runtime.sqlite');
    const first = new SqliteConnectionStateStore(path);
    first.registerMapping(mapping('map-erp-1', erpRev1));
    first.recordObservation(observation(erpRev1, 'created'));
    const plan = createImpactPlan(
      observation(erpRev1, 'updated'),
      first.snapshot(),
      { version: 'policy-1', mode: 'review_required' },
      '2026-07-20T00:00:02.000Z',
      'plan-sqlite',
    );
    first.savePlan(plan);
    first.recordAudit({
      id: 'audit-sqlite',
      kind: 'plan.created',
      occurredAt: '2026-07-20T00:00:03.000Z',
      planId: plan.id,
      relationIds: [],
      status: plan.status,
    });
    first.close();

    const second = new SqliteConnectionStateStore(path);
    expect(second.resolve(erpRev1).status).toBe('resolved');
    expect(second.latestObservation(erpRev1)?.source).toEqual(erpRev1);
    expect(second.getPlan('plan-sqlite')?.id).toBe('plan-sqlite');
    expect(second.listAudit('plan-sqlite')).toHaveLength(1);
    second.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('returns no mapping for an unknown source-target pair', () => {
    const store = new InMemoryConnectionStateStore();
    expect(
      store.getMapping(erpRev1, { namespace: 'qa', connectionId: 'missing', version: 1 }),
    ).toBeUndefined();
  });

  it('runs observe -> plan -> approve -> execute -> re-fetch -> verify', async () => {
    const store = new InMemoryConnectionStateStore();
    let revision = 'rev-1';
    let payloadHash = 'hash-1';
    let clock = 0;
    const evidence: unknown[] = [];
    const adapter: SourceAdapter = {
      sourceSystem: 'erp',
      entityType: 'customer',
      identifierRuleVersion: 1,
      fetch: async (lookup) => ({
        source: { ...lookup, revision },
        status: 'present',
        observedAt: `2026-07-20T00:00:0${clock++}.000Z`,
        payloadHash,
      }),
    };
    const identifierRegistry = new SourceIdentifierRegistry();
    identifierRegistry.register({
      id: 'erp-customer-identifiers-v1',
      sourceSystem: 'erp',
      entityType: 'customer',
      version: 1,
      localIdPattern: 'cust-[0-9]+',
      revisionPattern: 'rev-[0-9]+',
      revisionStrategy: 'opaque',
      status: 'active',
      provenance: { kind: 'manual', ref: 'identifier-review-1' },
    });
    const runtime = new FederatedConnectionRuntime(store, {
      createId: (prefix) => `${prefix}-${clock}`,
      now: () => `2026-07-20T00:01:0${clock}.000Z`,
      evidenceSink: { record: (entry) => evidence.push(entry) },
      identifierRegistry,
    });

    const first = await runtime.observe(adapter, {
      sourceSystem: 'erp',
      entityType: 'customer',
      localId: 'cust-7',
    });
    expect(first.change.kind).toBe('created');
    expect(first.identifierRule).toEqual({ id: 'erp-customer-identifiers-v1', version: 1 });
    store.registerMapping(mapping('map-erp-1', first.source));
    const plan = runtime.createPlan(first, {
      version: 'policy-review-1',
      mode: 'review_required',
    });
    expect(plan.status).toBe('proposed');

    const approved = runtime.approve(plan.id, { actor: 'operator-1' });
    expect(approved.status).toBe('approved');

    const executor = {
      apply: async ({ action }: { action: (typeof approved.actions)[number] }) => {
        revision = 'rev-2';
        payloadHash = 'hash-2';
        return {
          actionId: action.id,
          status: 'applied' as const,
          executedAt: '2026-07-20T00:02:00.000Z',
          expectedSource: { ...first.source, revision: 'rev-2' },
          expectedPayloadHash: 'hash-2',
        };
      },
    };
    const execution = await runtime.execute(plan.id, adapter, executor);
    expect(execution.status).toBe('verified');
    expect(runtime.getPlan(plan.id)?.status).toBe('verified');
    expect(runtime.getExecution(plan.id)?.observedAfter?.source.revision).toBe('rev-2');
    expect(runtime.store.latestObservation(erpRev1)?.source.revision).toBe('rev-2');
    expect(evidence).toHaveLength(1);
    expect(runtime.store.listAudit(plan.id).map((event) => event.kind)).toEqual([
      'plan.created',
      'plan.approved',
      'execution.started',
      'execution.completed',
    ]);
  });

  it('rejects a lookup before source fetch when its local ID belongs to another profile', async () => {
    const identifierRegistry = new SourceIdentifierRegistry();
    identifierRegistry.register({
      id: 'erp-customer-identifiers-v1',
      sourceSystem: 'erp',
      entityType: 'customer',
      version: 1,
      localIdPattern: 'cust-[0-9]+',
      revisionPattern: 'rev-[0-9]+',
      revisionStrategy: 'opaque',
      status: 'active',
      provenance: { kind: 'manual', ref: 'identifier-review-1' },
    });
    let fetchCalls = 0;
    const runtime = new FederatedConnectionRuntime(new InMemoryConnectionStateStore(), {
      identifierRegistry,
    });
    const adapter: SourceAdapter = {
      sourceSystem: 'erp',
      entityType: 'customer',
      fetch: async (lookup) => {
        fetchCalls++;
        return {
          source: { ...lookup, revision: 'rev-1' },
          status: 'present',
          observedAt: '2026-07-20T00:00:00.000Z',
          payloadHash: 'hash-1',
        };
      },
    };

    await expect(
      runtime.observe(adapter, {
        sourceSystem: 'erp',
        entityType: 'customer',
        localId: 'acct-42',
      }),
    ).rejects.toThrow('does not match');
    expect(fetchCalls).toBe(0);
  });

  it('marks an approved plan stale when the source revision changed before execution', async () => {
    const store = new InMemoryConnectionStateStore();
    store.registerMapping(mapping('map-erp-1', erpRev1));
    const runtime = new FederatedConnectionRuntime(store, {
      createId: (prefix) => `${prefix}-stale`,
      now: () => '2026-07-20T00:00:00.000Z',
    });
    const plan = runtime.createPlan(observation(erpRev1, 'updated'), {
      version: 'policy-review-1',
      mode: 'review_required',
    });
    runtime.approve(plan.id, { actor: 'operator-1' });

    const adapter: SourceAdapter = {
      sourceSystem: 'erp',
      entityType: 'customer',
      fetch: async (lookup) => ({
        source: { ...lookup, revision: 'rev-2' },
        status: 'present',
        observedAt: '2026-07-20T00:03:00.000Z',
        payloadHash: 'hash-2',
      }),
    };
    const execution = await runtime.execute(plan.id, adapter, {
      apply: async () => {
        throw new Error('must not execute stale plan');
      },
    });
    expect(execution.status).toBe('stale');
    expect(runtime.getPlan(plan.id)?.status).toBe('stale');
  });

  it('marks an approved plan stale when the payload hash changes at the same revision', async () => {
    const store = new InMemoryConnectionStateStore();
    store.registerMapping(mapping('map-erp-1', erpRev1));
    const runtime = new FederatedConnectionRuntime(store, {
      createId: (prefix) => `${prefix}-payload-stale`,
      now: () => '2026-07-20T00:00:00.000Z',
    });
    const plan = runtime.createPlan(observation(erpRev1, 'updated'), {
      version: 'policy-review-1',
      mode: 'review_required',
    });
    runtime.approve(plan.id, { actor: 'operator-1' });

    let applyCalls = 0;
    const adapter: SourceAdapter = {
      sourceSystem: 'erp',
      entityType: 'customer',
      fetch: async (lookup) => ({
        source: { ...lookup, revision: erpRev1.revision },
        status: 'present',
        observedAt: '2026-07-20T00:03:00.000Z',
        payloadHash: 'hash-changed-without-revision',
      }),
    };
    const execution = await runtime.execute(plan.id, adapter, {
      apply: async () => {
        applyCalls++;
        throw new Error('must not execute stale payload');
      },
    });

    expect(execution.status).toBe('stale');
    expect(execution.error).toContain('payload hash');
    expect(applyCalls).toBe(0);
  });

  it('keeps an applied plan unverified when post-execution re-fetch fails', async () => {
    const store = new InMemoryConnectionStateStore();
    store.registerMapping(mapping('map-erp-1', erpRev1));
    const evidence: Array<{ verified: boolean; executionStatus: string }> = [];
    const runtime = new FederatedConnectionRuntime(store, {
      createId: (prefix) => `${prefix}-refetch-failure`,
      now: () => '2026-07-20T00:04:00.000Z',
      evidenceSink: {
        record: (entry) => evidence.push(entry),
      },
    });
    const plan = runtime.createPlan(observation(erpRev1, 'updated'), {
      version: 'policy-review-1',
      mode: 'review_required',
    });
    runtime.approve(plan.id, { actor: 'operator-1' });

    let calls = 0;
    const adapter: SourceAdapter = {
      sourceSystem: 'erp',
      entityType: 'customer',
      fetch: async (lookup) => {
        calls++;
        if (calls === 2) throw new Error('source temporarily unavailable');
        return {
          source: { ...lookup, revision: 'rev-1' },
          status: 'present',
          observedAt: '2026-07-20T00:04:01.000Z',
          payloadHash: 'hash-rev-1',
        };
      },
    };
    const execution = await runtime.execute(plan.id, adapter, {
      apply: async ({ action }) => ({
        actionId: action.id,
        status: 'applied' as const,
        executedAt: '2026-07-20T00:04:02.000Z',
        expectedSource: erpRev1,
        expectedPayloadHash: 'hash-rev-1',
      }),
    });

    expect(execution.status).toBe('applied');
    expect(execution.error).toContain('re-fetch failed');
    expect(runtime.getPlan(plan.id)?.status).toBe('applied');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ verified: false, executionStatus: 'applied' });
  });
});

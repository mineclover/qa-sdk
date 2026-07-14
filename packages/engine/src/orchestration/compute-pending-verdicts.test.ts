// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

import { describe, expect, it, vi } from 'vitest';
import type {
  DlqInsert,
  DlqStore,
  GraphStore,
  RuntimeGraph,
  ScenarioSpec,
  ScenarioSpecStore,
  SessionStore,
  StoredSession,
  StoredTrace,
  StoredVerdict,
  TraceStore,
  VerdictInsert,
  VerdictStore,
} from '@qa-sdk/core';
import { computePendingVerdicts, computeTraceVerdict } from './compute-pending-verdicts.js';
import { reconstruct } from '../reconstruction/reconstruct.js';

const SCENARIO: ScenarioSpec = {
  scenario_id: 'checkout-flow',
  version: '1.0.0',
  domain: 'checkout',
  steps: [{ id: 's1', event_key: 'page_view', required: true, kind: 'sequence' }],
};

function makeTrace(traceId: string, sessionId?: string): StoredTrace {
  return {
    traceId,
    sessionId: sessionId ?? null,
    serviceName: null,
    actorId: null,
    userId: null,
    userAttributes: null,
    recordCount: 1,
    firstTimestamp: new Date('2026-03-13T00:00:00.000Z'),
    lastTimestamp: new Date('2026-03-13T00:00:01.000Z'),
    reconstructed: true,
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T00:00:00.000Z'),
  };
}

function makeSession(sessionId: string, scenarioId?: string): StoredSession {
  return {
    sessionId,
    scenarioId: scenarioId ?? null,
    labels: null,
    actorId: null,
    userId: null,
    userAttributes: null,
    startedAt: new Date('2026-03-13T00:00:00.000Z'),
    closedAt: null,
  };
}

function makeReport(
  overrides: Partial<import('@qa-sdk/core').VerdictReport> = {},
): import('@qa-sdk/core').VerdictReport {
  return {
    scenario_id: 'checkout-flow',
    trace_id: 'trc_001',
    overall_verdict: 'pass',
    step_matches: [],
    missing_steps: [],
    unexpected_nodes: [],
    latency_violations: [],
    ordering_violations: [],
    summary: 'verdict=pass',
    computed_at: '2026-03-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeGraph(traceId: string): RuntimeGraph {
  return reconstruct(traceId, [
    {
      log_id: `log_${traceId}`,
      timestamp: '2026-03-13T00:00:00.000Z',
      record_kind: 'log',
      trace_id: traceId,
      span_id: `spn_${traceId}`,
      event_key: 'page_view',
      event_version: '1',
      payload_format: 'json',
      payload_encoding: 'raw',
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: {},
    },
  ]);
}

function buildDeps({
  trace,
  session,
  graph,
  scenario,
  existingVerdict,
}: {
  trace?: StoredTrace;
  session?: StoredSession;
  graph?: RuntimeGraph;
  scenario?: ScenarioSpec;
  existingVerdict?: StoredVerdict;
} = {}) {
  const verdicts = new Map<string, StoredVerdict>();
  if (existingVerdict) {
    verdicts.set(existingVerdict.id, existingVerdict);
  }
  const dlqItems: DlqInsert[] = [];
  const insertedVerdicts: VerdictInsert[] = [];

  const traceStore: Pick<TraceStore, 'findById'> = {
    findById: vi.fn().mockResolvedValue(trace ?? null),
  };

  const sessionStore: Pick<SessionStore, 'findById'> = {
    findById: vi.fn().mockResolvedValue(session ?? null),
  };

  const graphStore: Pick<GraphStore, 'findByTraceId'> = {
    findByTraceId: vi.fn().mockResolvedValue(graph ?? null),
  };

  const scenarioSpecStore: Pick<ScenarioSpecStore, 'findById'> = {
    findById: vi.fn().mockResolvedValue(scenario ?? null),
  };

  const verdictStore: Pick<
    VerdictStore,
    'insert' | 'findByScenarioAndTrace' | 'removeByScenarioAndTrace'
  > = {
    insert: vi.fn().mockImplementation(async (v: VerdictInsert) => {
      insertedVerdicts.push(v);
    }),
    findByScenarioAndTrace: vi
      .fn()
      .mockImplementation(async (scenarioId: string, traceId: string) => {
        return (
          Array.from(verdicts.values()).find(
            (v) => v.scenarioId === scenarioId && v.traceId === traceId,
          ) ?? null
        );
      }),
    removeByScenarioAndTrace: vi
      .fn()
      .mockImplementation(async (scenarioId: string, traceId: string) => {
        for (const [id, v] of verdicts) {
          if (v.scenarioId === scenarioId && v.traceId === traceId) {
            verdicts.delete(id);
          }
        }
      }),
  };

  const dlqStore: Pick<DlqStore, 'insert'> = {
    insert: vi.fn().mockImplementation(async (item: DlqInsert) => {
      dlqItems.push(item);
    }),
  };

  return {
    traceStore,
    sessionStore,
    graphStore,
    scenarioSpecStore,
    verdictStore,
    dlqStore,
    insertedVerdicts,
    dlqItems,
  };
}

describe('computePendingVerdicts', () => {
  it('returns empty results when no trace IDs provided', async () => {
    const deps = buildDeps();
    const result = await computePendingVerdicts(deps, []);
    expect(result.computed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('skips a trace with no session', async () => {
    const deps = buildDeps({ trace: makeTrace('trc_001') });
    const result = await computePendingVerdicts(deps, ['trc_001']);
    expect(result.skipped).toContain('trc_001');
  });

  it('skips a trace whose session has no scenarioId', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001'),
    });
    const result = await computePendingVerdicts(deps, ['trc_001']);
    expect(result.skipped).toContain('trc_001');
  });

  it('skips when scenario spec is not found', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
    });
    const result = await computePendingVerdicts(deps, ['trc_001']);
    expect(result.skipped).toContain('trc_001');
  });

  it('computes and stores a verdict for a fully set-up trace', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
    });

    const result = await computePendingVerdicts(deps, ['trc_001']);

    expect(result.computed).toHaveLength(1);
    expect(result.computed[0]).toEqual({ traceId: 'trc_001', scenarioId: SCENARIO.scenario_id });
    expect(deps.insertedVerdicts).toHaveLength(1);
    expect(deps.insertedVerdicts[0]?.overallVerdict).toBeDefined();
  });

  it('skips a trace that already has a verdict (force=false)', async () => {
    const existingVerdict: StoredVerdict = {
      id: 'vrd_existing',
      scenarioId: SCENARIO.scenario_id,
      traceId: 'trc_001',
      qaSessionId: 'qas_001',
      overallVerdict: 'pass',
      report: makeReport(),
      computedAt: new Date(),
    };
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
      existingVerdict,
    });

    const result = await computePendingVerdicts(deps, ['trc_001']);
    expect(result.skipped).toContain('trc_001');
    expect(deps.insertedVerdicts).toHaveLength(0);
  });

  it('recomputes a verdict when force=true', async () => {
    const existingVerdict: StoredVerdict = {
      id: 'vrd_existing',
      scenarioId: SCENARIO.scenario_id,
      traceId: 'trc_001',
      qaSessionId: 'qas_001',
      overallVerdict: 'pass',
      report: makeReport(),
      computedAt: new Date(),
    };
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
      existingVerdict,
    });

    const result = await computePendingVerdicts(deps, ['trc_001'], { force: true });
    expect(result.computed).toHaveLength(1);
    expect(deps.insertedVerdicts).toHaveLength(1);
  });

  it('adds to DLQ and calls onError when verdict computation throws', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
    });
    (deps.verdictStore.insert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db error'));

    const onError = vi.fn();
    const result = await computePendingVerdicts(deps, ['trc_001'], { onError });

    expect(result.failed).toContain('trc_001');
    expect(onError).toHaveBeenCalledWith('trc_001', expect.any(Error));
    expect(deps.dlqItems).toHaveLength(1);
    expect(deps.dlqItems[0]?.phase).toBe('verdict');
  });

  it('skips when graph is not found', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      scenario: SCENARIO,
      // no graph
    });

    const result = await computePendingVerdicts(deps, ['trc_001']);

    expect(result.skipped).toContain('trc_001');
    expect(deps.insertedVerdicts).toHaveLength(0);
  });

  it('handles partial failure: reports both computed and failed trace IDs', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
    });
    (deps.verdictStore.insert as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('db error'));

    const result = await computePendingVerdicts(deps, ['trc_001', 'trc_002']);

    expect(result.computed).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it('does not throw when no onError callback is provided and computation fails', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
    });
    (deps.verdictStore.insert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db error'));

    const result = await computePendingVerdicts(deps, ['trc_001']);

    expect(result.failed).toContain('trc_001');
    expect(deps.dlqItems).toHaveLength(1);
  });

  it('can suppress DLQ writes when a queue worker owns terminal failure handling', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
    });
    (deps.verdictStore.insert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db error'));

    const result = await computePendingVerdicts(deps, ['trc_001'], {
      captureFailuresInDlq: false,
    });

    expect(result.failed).toEqual(['trc_001']);
    expect(deps.dlqItems).toEqual([]);
  });
});

describe('computeTraceVerdict', () => {
  it('returns skipped when trace is not found', async () => {
    const deps = buildDeps();
    const result = await computeTraceVerdict(deps, 'trc_001');
    expect(result.status).toBe('skipped');
  });

  it('returns skipped when trace has no sessionId', async () => {
    const deps = buildDeps({ trace: makeTrace('trc_001') });
    const result = await computeTraceVerdict(deps, 'trc_001');
    expect(result.status).toBe('skipped');
  });

  it('returns computed when all prerequisites are satisfied', async () => {
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', SCENARIO.scenario_id),
      graph: makeGraph('trc_001'),
      scenario: SCENARIO,
    });

    const result = await computeTraceVerdict(deps, 'trc_001');
    expect(result.status).toBe('computed');
    if (result.status === 'computed') {
      expect(result.scenarioId).toBe(SCENARIO.scenario_id);
    }
  });

  it('inserts skipped verdict when entry_conditions are not met', async () => {
    const scenarioWithConditions: ScenarioSpec = {
      ...SCENARIO,
      entry_conditions: [{ field: 'payload.environment', op: 'eq', value: 'production' }],
    };
    const deps = buildDeps({
      trace: makeTrace('trc_001', 'qas_001'),
      session: makeSession('qas_001', scenarioWithConditions.scenario_id),
      graph: makeGraph('trc_001'), // payload doesn't have environment=production
      scenario: scenarioWithConditions,
    });

    const result = await computeTraceVerdict(deps, 'trc_001');

    expect(result.status).toBe('computed');
    expect(deps.insertedVerdicts).toHaveLength(1);
    expect(deps.insertedVerdicts[0]?.overallVerdict).toBe('skipped');
    expect(deps.insertedVerdicts[0]?.report.overall_verdict).toBe('skipped');
  });

  it('proceeds with normal verdict when entry_conditions are met', async () => {
    const scenarioWithConditions: ScenarioSpec = {
      ...SCENARIO,
      entry_conditions: [{ field: 'payload.environment', op: 'exists' }],
    };
    // makeGraph returns a node with payload={} → "exists" on payload.environment → false
    // Use a custom graph where the first node has the required field
    const graph: RuntimeGraph = reconstruct('trc_cond', [
      {
        log_id: 'log_cond',
        timestamp: '2026-03-13T00:00:00.000Z',
        record_kind: 'log',
        trace_id: 'trc_cond',
        span_id: 'spn_cond',
        event_key: 'page_view',
        event_version: '1',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { environment: 'staging' },
      },
    ]);
    const deps = buildDeps({
      trace: makeTrace('trc_cond', 'qas_001'),
      session: makeSession('qas_001', scenarioWithConditions.scenario_id),
      graph,
      scenario: scenarioWithConditions,
    });

    const result = await computeTraceVerdict(deps, 'trc_cond');

    expect(result.status).toBe('computed');
    expect(deps.insertedVerdicts).toHaveLength(1);
    expect(deps.insertedVerdicts[0]?.overallVerdict).not.toBe('skipped');
  });
});

// @def.boundary ingest-system
// @def.doc ingest-system

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConvergencePipelineRunner,
  type ConvergencePipelineDeps,
  type ConvergenceFunctions,
  type PatternFunctions,
  type DkgStorePort,
} from './convergence-pipeline.js';

// ── Mock Factories ──────────────────────────────────

function createMockRecordStore() {
  return {
    findByTraceId: vi.fn().mockResolvedValue([
      {
        id: 'rec-1',
        addressContext: { cart_event: 'cart_event:v1:3' },
        createdAt: '2026-03-21T10:00:00Z',
        sessionId: 'sess-1',
      },
      {
        id: 'rec-2',
        addressContext: { auth_event: 'auth_event:v1:1' },
        createdAt: '2026-03-21T10:00:01Z',
        sessionId: 'sess-1',
      },
    ]),
  } as any;
}

function createMockConvergenceFns(): ConvergenceFunctions {
  return {
    aggregateUsageData: vi.fn().mockReturnValue({
      collectionPeriod: { from: '2026-03-21', to: '2026-03-21' },
      entryUsages: [],
      addressUsages: [],
      coOccurrences: [],
      versionUsages: [],
    }),
    collectMetrics: vi.fn().mockReturnValue([
      {
        id: 'metric:headroom:status',
        name: '축 여유 공간',
        value: 0,
        status: 'critical',
        target: 'status',
      },
    ]),
    metricsToObservations: vi
      .fn()
      .mockReturnValue([{ kind: 'observation', id: 'OBS-TEST-1', subjects: ['status'] }]),
  };
}

function createMockDkgStore(): DkgStorePort {
  return {
    saveUsageSnapshotWithObservations: vi.fn().mockReturnValue({
      snapshotId: 42,
      observationsWritten: 1,
    }),
  };
}

function createMockPatternFns(): PatternFunctions {
  return {
    classifyPattern: vi.fn().mockReturnValue({
      pattern: 'purchase_complete',
      identificationMode: 'identified',
      confidence: 'exact',
      matchedRuleId: 'rule-identified-purchase',
      eventCount: 4,
      durationMs: 5000,
      classifiedAt: '2026-03-21T10:00:05Z',
    }),
    aggregatePatternStats: vi.fn().mockReturnValue([
      {
        pattern: 'purchase_complete',
        identificationMode: 'identified',
        count: 1,
        percentage: 1,
        avgEventCount: 4,
        avgDurationMs: 5000,
        lastSeen: '2026-03-21T10:00:05Z',
      },
    ]),
    detectAnomalies: vi.fn().mockReturnValue([]),
    buildPatternHealthReport: vi.fn().mockReturnValue({
      totalSessions: 1,
      stats: [
        {
          pattern: 'purchase_complete',
          identificationMode: 'identified',
          count: 1,
          percentage: 1,
          avgEventCount: 4,
          avgDurationMs: 5000,
          lastSeen: '2026-03-21T10:00:05Z',
        },
      ],
      classificationRate: 1,
      identifiedRate: 1,
      anomalyCount: 0,
      generatedAt: '2026-03-21T10:00:05Z',
    }),
    patternRules: [
      {
        id: 'rule-test',
        identificationMode: 'any' as const,
        behaviorPattern: 'purchase_complete' as const,
        defaultConfidence: 'exact' as const,
        match: { requiredKeys: ['auth.*', 'cart.*'] },
      },
    ],
  };
}

function createPatternRecordStore() {
  return {
    findByTraceId: vi.fn().mockResolvedValue([
      {
        id: 'rec-1',
        addressContext: { cart_event: 'cart_event:v1:3' },
        eventKey: 'auth.login',
        createdAt: '2026-03-21T10:00:00Z',
        sessionId: 'sess-1',
        actorId: 'user-1',
        userId: 'user-1',
      },
      {
        id: 'rec-2',
        addressContext: { auth_event: 'auth_event:v1:1' },
        eventKey: 'cart.add_item',
        createdAt: '2026-03-21T10:00:01Z',
        sessionId: 'sess-1',
        actorId: 'user-1',
        userId: 'user-1',
      },
      {
        id: 'rec-3',
        addressContext: { order_event: 'order_event:v1:1' },
        eventKey: 'checkout.start',
        createdAt: '2026-03-21T10:00:02Z',
        sessionId: 'sess-1',
        actorId: 'user-1',
        userId: 'user-1',
      },
      {
        id: 'rec-4',
        addressContext: { order_event: 'order_event:v1:2' },
        eventKey: 'payment.success',
        createdAt: '2026-03-21T10:00:03Z',
        sessionId: 'sess-1',
        actorId: 'user-1',
        userId: 'user-1',
      },
    ]),
  } as any;
}

function createDeps(overrides?: Partial<ConvergencePipelineDeps>): ConvergencePipelineDeps {
  return {
    recordStore: createMockRecordStore(),
    convergenceFns: createMockConvergenceFns(),
    graphProvider: () => ({ getAllNodes: () => [], getNodesByKind: () => [] }) as any,
    catalogProvider: () => ({ id: 'test', name: 'test', axes: {}, prefixes: {} }),
    dkgStore: createMockDkgStore(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────

describe('ConvergencePipelineRunner', () => {
  let pipeline: ConvergencePipelineRunner;

  afterEach(async () => {
    await pipeline?.close();
  });

  it('threshold 도달 시 자동 flush', async () => {
    const deps = createDeps();
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 3,
      flushIntervalMs: 999_999, // 타이머 트리거 방지
    });

    pipeline.notifyCompletion(['t1', 't2', 't3']);

    // flush는 비동기 — 잠시 대기
    await new Promise((r) => setTimeout(r, 50));

    expect(deps.convergenceFns.aggregateUsageData).toHaveBeenCalled();
    expect(deps.convergenceFns.collectMetrics).toHaveBeenCalled();
    expect(deps.convergenceFns.metricsToObservations).toHaveBeenCalled();
    expect((deps.dkgStore as any).saveUsageSnapshotWithObservations).toHaveBeenCalled();
  });

  it('명시적 flush 호출', async () => {
    const deps = createDeps();
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(result).not.toBeNull();
    expect(result!.recordsProcessed).toBe(2); // 2 records per trace
    expect(result!.metricsCollected).toBe(1);
    expect(result!.observationsGenerated).toBe(1);
    expect(result!.snapshotId).toBe(42);
  });

  it('빈 버퍼에서 flush는 null 반환', async () => {
    const deps = createDeps();
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    const result = await pipeline.flush();
    expect(result).toBeNull();
  });

  it('address_context 없는 레코드는 건너뜀', async () => {
    const recordStore = {
      findByTraceId: vi.fn().mockResolvedValue([
        { id: 'rec-1', createdAt: '2026-03-21T10:00:00Z' }, // no addressContext
      ]),
    } as any;

    const deps = createDeps({ recordStore });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(result!.recordsProcessed).toBe(0);
    expect(deps.convergenceFns.aggregateUsageData).not.toHaveBeenCalled();
  });

  it('에러 격리 — pipeline 실패 시 null 반환, 후속 flush 가능', async () => {
    const convergenceFns = createMockConvergenceFns();
    (convergenceFns.aggregateUsageData as any)
      .mockImplementationOnce(() => {
        throw new Error('test error');
      })
      .mockReturnValue({
        collectionPeriod: { from: '2026-03-21', to: '2026-03-21' },
        entryUsages: [],
        addressUsages: [],
        coOccurrences: [],
        versionUsages: [],
      });

    const deps = createDeps({ convergenceFns });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    // 첫 번째: 실패
    pipeline.notifyCompletion(['t1']);
    const result1 = await pipeline.flush();
    expect(result1).toBeNull();

    // 두 번째: 성공
    pipeline.notifyCompletion(['t2']);
    const result2 = await pipeline.flush();
    expect(result2).not.toBeNull();
  });

  it('maxBufferSize 초과 시 강제 flush', async () => {
    const deps = createDeps();
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
      maxBufferSize: 5,
    });

    // 6개 traceId → maxBufferSize(5) 초과
    pipeline.notifyCompletion(['t1', 't2', 't3', 't4', 't5', 't6']);

    // 강제 flush 비동기 실행 대기
    await new Promise((r) => setTimeout(r, 50));

    expect(deps.convergenceFns.aggregateUsageData).toHaveBeenCalled();
  });

  it('close 시 잔여 버퍼 flush', async () => {
    const deps = createDeps();
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    expect(pipeline.pendingCount).toBe(1);

    await pipeline.close();

    expect(deps.convergenceFns.aggregateUsageData).toHaveBeenCalled();
    expect(pipeline.pendingCount).toBe(0);
  });

  it('dkgStore 없이도 동작 (snapshot 저장 건너뜀)', async () => {
    const deps = createDeps({ dkgStore: undefined });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(result!.snapshotId).toBeUndefined();
    expect(result!.metricsCollected).toBe(1);
  });

  // ── 패턴 분류 통합 테스트 ──────────────────────────────

  it('패턴 분류 — 세션 이벤트가 분류되고 결과에 포함', async () => {
    const patternFns = createMockPatternFns();
    const deps = createDeps({
      recordStore: createPatternRecordStore(),
      patternFns,
    });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(result).not.toBeNull();
    expect(result!.pattern).toBeDefined();
    expect(result!.pattern!.sessionsClassified).toBe(1);
    expect(result!.pattern!.classificationRate).toBe(1);
    expect(patternFns.classifyPattern).toHaveBeenCalledTimes(1);
    expect(patternFns.detectAnomalies).toHaveBeenCalledTimes(1);
    expect(patternFns.buildPatternHealthReport).toHaveBeenCalledTimes(1);
  });

  it('패턴 에러 격리 — 분류 실패해도 metric 결과는 유지', async () => {
    const patternFns = createMockPatternFns();
    (patternFns.classifyPattern as any).mockImplementation(() => {
      throw new Error('pattern crash');
    });

    const deps = createDeps({
      recordStore: createPatternRecordStore(),
      patternFns,
    });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    // metric pipeline은 정상 동작
    expect(result).not.toBeNull();
    expect(result!.metricsCollected).toBe(1);
    expect(result!.observationsGenerated).toBe(1);
    // 패턴 결과는 없음
    expect(result!.pattern).toBeUndefined();
  });

  it('패턴 이상 감지 — anomaly가 observation으로 변환', async () => {
    const patternFns = createMockPatternFns();
    (patternFns.detectAnomalies as any).mockReturnValue([
      {
        kind: 'unclassified',
        sessionId: 'aggregate:5',
        eventSequence: [],
        description: '미분류 패턴 5건 감지',
        severity: 'warning',
        detectedAt: '2026-03-21T10:00:05Z',
      },
    ]);
    (patternFns.buildPatternHealthReport as any).mockReturnValue({
      totalSessions: 1,
      stats: [],
      classificationRate: 0.5,
      identifiedRate: 1,
      anomalyCount: 1,
      generatedAt: '2026-03-21T10:00:05Z',
    });

    const dkgStore = createMockDkgStore();
    const deps = createDeps({
      recordStore: createPatternRecordStore(),
      patternFns,
      dkgStore,
    });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(result!.pattern!.anomaliesDetected).toBe(1);

    // observation에 패턴 anomaly가 포함되어 DKG store에 저장됨
    const savedObs = (dkgStore.saveUsageSnapshotWithObservations as any).mock.calls[0][1];
    const patternObs = savedObs.filter((o: any) => o.id?.startsWith('OBS-PATTERN-'));
    expect(patternObs.length).toBe(1);
    expect(patternObs[0].subjects).toContain('pattern_anomaly');
  });

  it('패턴 없이도 기존 pipeline 정상 동작 (patternFns 미제공)', async () => {
    const deps = createDeps(); // patternFns 없음
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(result).not.toBeNull();
    expect(result!.pattern).toBeUndefined();
    expect(result!.metricsCollected).toBe(1);
  });

  it('IntentLink flow-trace observation이 metric observation과 함께 저장됨', async () => {
    const convergenceFns = {
      ...createMockConvergenceFns(),
      traceFlows: vi.fn().mockReturnValue({
        violations: [
          {
            intentLinkId: 'IL-checkout-flow',
            invariant: 'checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨',
            presentPrefixes: ['flow_point'],
            missingPrefixes: ['page_view'],
            count: 1,
          },
        ],
        observations: [
          {
            kind: 'observation',
            id: 'OBS-FLOW-IL-checkout-flow-page_view',
            date: '2026-03-21',
            source: 'runtime',
            subjects: ['IL-checkout-flow', 'flow_point', 'page_view'],
            finding: 'IL-checkout-flow invariant 위반 1건: page_view 누락',
          },
        ],
        summary: '1종 흐름 위반 (1건)',
      }),
    };
    const dkgStore = createMockDkgStore();
    const deps = createDeps({ convergenceFns, dkgStore });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(result!.flowViolations).toBe(1);
    expect(convergenceFns.traceFlows).toHaveBeenCalledTimes(1);
    const savedObs = (dkgStore.saveUsageSnapshotWithObservations as any).mock.calls[0][1];
    expect(savedObs.map((o: any) => o.id)).toContain('OBS-FLOW-IL-checkout-flow-page_view');
  });

  it('현재 runtime flow evidence 회복을 metric 계산보다 먼저 반영함', async () => {
    const order: string[] = [];
    const prior = {
      kind: 'observation',
      id: 'OBS-FLOW-IL-checkout-flow-page_view',
      date: '2026-03-21',
      source: 'runtime',
      subjects: ['IL-checkout-flow', 'flow_point', 'page_view'],
      finding: '이전 flow 위반',
    };
    const recovered = {
      ...prior,
      resolution: {
        decisionId: 'AUTO-RESOLVE',
        outcome: 'accepted',
        note: 'runtime evidence 회복',
      },
    };
    let observations: readonly Record<string, unknown>[] = [prior];
    const graph = {
      getAllNodes: () => [],
      getNodesByKind: (kind: string) => (kind === 'observation' ? observations : []),
      replaceNode: vi.fn((node: Record<string, unknown>) => {
        observations = [node];
        order.push('replace');
      }),
    };
    const updateNode = vi.fn(() => order.push('persist-resolution'));
    const convergenceFns = {
      ...createMockConvergenceFns(),
      traceFlows: vi.fn(() => {
        order.push('flow');
        return { violations: [], observations: [], summary: '흐름 위반 없음' };
      }),
      resolveRecoveredFlowObservations: vi.fn(() => {
        order.push('flow-recovery');
        return [recovered];
      }),
      collectMetrics: vi.fn(() => {
        order.push('metrics');
        expect(observations[0]?.resolution).toBeDefined();
        return [];
      }),
    };
    const dkgStore = createMockDkgStore();
    dkgStore.updateNode = updateNode;
    const deps = createDeps({
      convergenceFns,
      graphProvider: () => graph as any,
      dkgStore,
    });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    pipeline.notifyCompletion(['t1']);
    const result = await pipeline.flush();

    expect(order.slice(0, 4)).toEqual(['flow', 'flow-recovery', 'replace', 'persist-resolution']);
    expect(order).toContain('metrics');
    expect(result!.flowObservationsResolved).toBe(1);
    expect(convergenceFns.resolveRecoveredFlowObservations).toHaveBeenCalledTimes(1);
  });

  it('이전 윈도우 통계 비교 — 두 번째 flush에서 previous 전달', async () => {
    const patternFns = createMockPatternFns();
    const deps = createDeps({
      recordStore: createPatternRecordStore(),
      patternFns,
    });
    pipeline = new ConvergencePipelineRunner(deps, {
      recordThreshold: 999,
      flushIntervalMs: 999_999,
    });

    // 첫 번째 flush — previous 없음
    pipeline.notifyCompletion(['t1']);
    await pipeline.flush();

    const firstCall = (patternFns.detectAnomalies as any).mock.calls[0][0];
    expect(firstCall.previous).toBeUndefined();

    // 두 번째 flush — 이전 통계 전달
    pipeline.notifyCompletion(['t2']);
    await pipeline.flush();

    const secondCall = (patternFns.detectAnomalies as any).mock.calls[1][0];
    expect(secondCall.previous).toBeDefined();
    expect(secondCall.previous.length).toBeGreaterThan(0);
    expect(secondCall.previous[0].pattern).toBe('purchase_complete');
  });
});

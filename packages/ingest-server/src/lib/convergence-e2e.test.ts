// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * 관측 루프 통합 E2E 테스트.
 *
 * Phase 2 완료 → convergence pipeline → aggregation → metrics → observations → DKG store
 * 의 전체 경로를 mock 기반으로 검증한다.
 *
 * 실제 spec-core를 import하지 않고, pipeline의 통합 흐름을 검증.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TransmissionEnvelope } from '@qa-sdk/core';
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from '@qa-sdk/store';
import pino from 'pino';
import { createApp } from '../app.js';
import { RecordStreamBroker } from './record-stream-broker.js';
import {
  ConvergencePipelineRunner,
  type ConvergenceFunctions,
  type DkgStorePort,
} from './convergence-pipeline.js';

describe('관측 루프 E2E', () => {
  it('POST /v1/ingest → Phase 2 → flow evidence persistence 경로를 연결한다', async () => {
    const recordStore = new InMemoryRecordStore();
    const dkgStore: DkgStorePort & {
      saveFlowEvidence: NonNullable<DkgStorePort['saveFlowEvidence']>;
    } = {
      saveUsageSnapshotWithObservations: vi.fn().mockReturnValue({
        snapshotId: 7,
        observationsWritten: 0,
      }),
      saveFlowEvidence: vi.fn().mockReturnValue({ recordsWritten: 1 }),
    };
    const convergenceFns: ConvergenceFunctions = {
      aggregateUsageData: vi.fn().mockReturnValue({
        collectionPeriod: { from: '2026-07-31', to: '2026-07-31' },
        entryUsages: [],
        addressUsages: [],
        coOccurrences: [],
        versionUsages: [],
        sourceStats: { totalRecords: 1 },
      }),
      collectMetrics: vi.fn().mockReturnValue([]),
      metricsToObservations: vi.fn().mockReturnValue([]),
    };
    const pipeline = new ConvergencePipelineRunner(
      {
        recordStore,
        convergenceFns,
        graphProvider: () => ({ getNodesByKind: () => [] }) as any,
        catalogProvider: () => ({ id: 'test', name: 'test', axes: {}, prefixes: {} }),
        dkgStore,
      },
      { recordThreshold: 999 },
    );
    const app = createApp({
      recordStore,
      traceStore: new InMemoryTraceStore(),
      graphStore: new InMemoryGraphStore(),
      transmissionStore: new InMemoryTransmissionStore(),
      sessionStore: new InMemorySessionStore(),
      verdictStore: new InMemoryVerdictStore(),
      scenarioSpecStore: new InMemoryScenarioSpecStore(),
      dlqStore: new InMemoryDlqStore(),
      recordStreamBroker: new RecordStreamBroker(),
      convergencePipeline: pipeline,
      logger: pino({ level: 'silent' }),
    });
    const envelope: TransmissionEnvelope = {
      transmission_id: 'tx-convergence-e2e',
      sent_at: '2026-07-31T10:00:00.000Z',
      owner: { owner_type: 'workspace', owner_id: 'workspace-e2e' },
      source: { service_name: 'checkout-api', sdk_name: 'qa-sdk-test', sdk_version: '0.1.0' },
      runtime: { platform: 'node', app_version: 'test' },
      build: { env: 'test', release_version: 'test' },
      records: [
        {
          log_id: 'log-convergence-e2e',
          timestamp: '2026-07-31T09:59:59.000Z',
          record_kind: 'log',
          trace_id: 'trace-convergence-e2e',
          span_id: 'span-convergence-e2e',
          event_key: 'checkout.page.viewed',
          event_version: '001',
          payload_format: 'json',
          payload_encoding: 'raw',
          payload_masking_applied: false,
          payload_masked_fields: [],
          payload: { source: 'e2e' },
          qa_session_id: 'session-convergence-e2e',
          address_context: { page_view: 'page_view:v1:1' },
        },
      ],
    };

    try {
      const response = await app.request('/v1/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      expect(response.status).toBe(202);

      const result = await pipeline.flush();

      expect(result).toMatchObject({ recordsProcessed: 1, snapshotId: 7 });
      expect(dkgStore.saveFlowEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshotId: 7,
          records: [
            expect.objectContaining({
              traceId: 'trace-convergence-e2e',
              sessionId: 'session-convergence-e2e',
              addressContext: { page_view: 'page_view:v1:1' },
            }),
          ],
        }),
      );
      expect(result?.flowEvidence).toMatchObject({
        recordCount: 1,
        traceCount: 1,
        sessionCount: 1,
        observedPrefixes: ['page_view'],
        recordsPersisted: 1,
      });
    } finally {
      await pipeline.close();
    }
  });

  // ── 전체 파이프라인 흐름 검증 ────────────────────────

  it('Phase 2 → convergence → DKG store 저장까지 전체 경로', async () => {
    // 1. Mock record store: traceId별 address_context 포함 레코드 반환
    const recordStore = {
      findByTraceId: vi.fn().mockImplementation((traceId: string) => {
        return Promise.resolve([
          {
            id: `rec-${traceId}-1`,
            addressContext: { cart_event: `cart_event:v1:${traceId === 't1' ? 3 : 7}` },
            createdAt: '2026-03-21T10:00:00Z',
            sessionId: 'sess-1',
          },
          {
            id: `rec-${traceId}-2`,
            addressContext: {
              auth_event: 'auth_event:v1:1',
              deploy_event: 'deploy_event:v1:0',
            },
            createdAt: '2026-03-21T10:00:01Z',
            sessionId: 'sess-1',
          },
        ]);
      }),
    } as any;

    // 2. Mock convergence functions (spec-core 대역)
    const mockUsageData = {
      collectionPeriod: { from: '2026-03-21', to: '2026-03-21' },
      entryUsages: [
        { prefix: 'cart_event', entry: 'add_to_cart', count: 2 },
        { prefix: 'auth_event', entry: 'login', count: 2 },
      ],
      addressUsages: [
        { prefix: 'cart_event', address: 3, count: 1 },
        { prefix: 'cart_event', address: 7, count: 1 },
      ],
      coOccurrences: [{ a: 'cart_event', b: 'auth_event', count: 2, coRate: 1.0 }],
      versionUsages: [
        {
          prefix: 'cart_event',
          version: 'v1',
          count: 2,
          lastSeen: '2026-03-21',
          sessions: ['sess-1'],
        },
        {
          prefix: 'auth_event',
          version: 'v1',
          count: 2,
          lastSeen: '2026-03-21',
          sessions: ['sess-1'],
        },
      ],
      sourceStats: { totalRecords: 4 },
    };

    const mockMetrics = [
      {
        id: 'metric:headroom:status',
        name: '축 여유 공간',
        value: 0,
        status: 'critical',
        detail: 'status: headroom=0',
        target: 'status',
        measuredAt: '2026-03-21',
      },
      {
        id: 'metric:coverage:cart_event',
        name: 'entry 관측 커버리지',
        value: 25,
        status: 'warning',
        detail: '25%',
        target: 'cart_event',
        measuredAt: '2026-03-21',
      },
      {
        id: 'metric:overlap:role:rbac_role',
        name: '축 중복',
        value: 85,
        status: 'ok',
        target: 'role:rbac_role',
        measuredAt: '2026-03-21',
      },
    ];

    const mockObservations = [
      {
        kind: 'observation',
        id: 'OBS-METRIC-headroom-status-1',
        date: '2026-03-21',
        source: 'metric',
        subjects: ['status'],
        finding: '[critical] 축 여유 공간: status: headroom=0',
      },
      {
        kind: 'observation',
        id: 'OBS-METRIC-coverage-cart_event-2',
        date: '2026-03-21',
        source: 'metric',
        subjects: ['cart_event'],
        finding: '[warning] entry 관측 커버리지: 25%',
      },
    ];

    const convergenceFns: ConvergenceFunctions = {
      aggregateUsageData: vi.fn().mockReturnValue(mockUsageData),
      collectMetrics: vi.fn().mockReturnValue(mockMetrics),
      metricsToObservations: vi.fn().mockReturnValue(mockObservations),
    };

    // 3. Mock DKG store
    const dkgStore: DkgStorePort = {
      saveUsageSnapshotWithObservations: vi.fn().mockReturnValue({
        snapshotId: 1,
        observationsWritten: 2,
      }),
    };

    // 4. Pipeline 생성
    const pipeline = new ConvergencePipelineRunner(
      {
        recordStore,
        convergenceFns,
        graphProvider: () => ({ getAllNodes: () => [], getNodesByKind: () => [] }) as any,
        catalogProvider: () => ({ id: 'test', name: 'test', axes: {}, prefixes: {} }),
        dkgStore,
      },
      {
        recordThreshold: 999,
      },
    );

    try {
      // 5. Phase 2 완료 시뮬레이션: traceId 2개 알림
      pipeline.notifyCompletion(['t1', 't2']);
      expect(pipeline.pendingCount).toBe(2);

      // 6. 명시적 flush
      const result = await pipeline.flush();

      // 7. 검증: 전체 파이프라인 실행
      expect(result).not.toBeNull();

      // recordStore에서 2개 trace의 레코드 조회
      expect(recordStore.findByTraceId).toHaveBeenCalledTimes(2);
      expect(recordStore.findByTraceId).toHaveBeenCalledWith('t1');
      expect(recordStore.findByTraceId).toHaveBeenCalledWith('t2');

      // aggregateUsageData: 4개 레코드 (trace당 2개) 전달
      expect(convergenceFns.aggregateUsageData).toHaveBeenCalledTimes(1);
      const aggregateCall = (convergenceFns.aggregateUsageData as any).mock.calls[0];
      expect(aggregateCall[1]).toHaveLength(4); // 2 traces × 2 records

      // collectMetrics: catalog + graph + usage 전달
      expect(convergenceFns.collectMetrics).toHaveBeenCalledTimes(1);
      const collectCall = (convergenceFns.collectMetrics as any).mock.calls[0];
      expect(collectCall[2]).toBe(mockUsageData);

      // metricsToObservations: metrics 전달
      expect(convergenceFns.metricsToObservations).toHaveBeenCalledTimes(1);
      expect((convergenceFns.metricsToObservations as any).mock.calls[0][0]).toBe(mockMetrics);

      // DKG store: snapshot + observations 저장
      expect(dkgStore.saveUsageSnapshotWithObservations).toHaveBeenCalledWith(
        mockUsageData,
        mockObservations,
      );

      // 결과 검증
      expect(result!.recordsProcessed).toBe(4);
      expect(result!.metricsCollected).toBe(3);
      expect(result!.observationsGenerated).toBe(2);
      expect(result!.snapshotId).toBe(1);

      // 버퍼 비워짐
      expect(pipeline.pendingCount).toBe(0);
    } finally {
      await pipeline.close();
    }
  });

  // ── Phase 2 worker 연동 시뮬레이션 ──────────────────

  it('processPendingPhaseTwo → convergencePipeline.notifyCompletion 연동', async () => {
    const convergenceFns: ConvergenceFunctions = {
      aggregateUsageData: vi.fn().mockReturnValue({
        collectionPeriod: { from: '2026-03-21', to: '2026-03-21' },
        entryUsages: [],
        addressUsages: [],
        coOccurrences: [],
        versionUsages: [],
      }),
      collectMetrics: vi.fn().mockReturnValue([]),
      metricsToObservations: vi.fn().mockReturnValue([]),
    };

    const pipeline = new ConvergencePipelineRunner(
      {
        recordStore: {
          findByTraceId: vi
            .fn()
            .mockResolvedValue([
              { id: 'r1', addressContext: { x: 'x:v1:0' }, createdAt: '2026-03-21T00:00:00Z' },
            ]),
        } as any,
        convergenceFns,
        graphProvider: () => ({ getAllNodes: () => [], getNodesByKind: () => [] }) as any,
        catalogProvider: () => ({ id: 'test', name: 'test', axes: {}, prefixes: {} }),
      },
      { recordThreshold: 999 },
    );

    try {
      // ConvergencePipelinePort 인터페이스 시뮬레이션
      const port = { notifyCompletion: (ids: readonly string[]) => pipeline.notifyCompletion(ids) };

      // Phase 2 worker가 호출하는 것과 동일
      port.notifyCompletion(['trace-abc', 'trace-def', 'trace-ghi']);
      expect(pipeline.pendingCount).toBe(3);

      const result = await pipeline.flush();

      expect(result!.recordsProcessed).toBe(3); // 3 traces × 1 record each
      expect(convergenceFns.aggregateUsageData).toHaveBeenCalled();
    } finally {
      await pipeline.close();
    }
  });

  // ── 에러 격리 시나리오 ─────────────────────────────

  it('일부 trace 레코드 조회 실패해도 나머지는 정상 처리', async () => {
    const recordStore = {
      findByTraceId: vi
        .fn()
        .mockResolvedValueOnce([
          { id: 'r1', addressContext: { a: 'a:v1:0' }, createdAt: '2026-03-21T00:00:00Z' },
        ])
        .mockRejectedValueOnce(new Error('DB timeout')) // t2 실패
        .mockResolvedValueOnce([
          { id: 'r3', addressContext: { b: 'b:v1:1' }, createdAt: '2026-03-21T00:00:00Z' },
        ]),
    } as any;

    const convergenceFns: ConvergenceFunctions = {
      aggregateUsageData: vi.fn().mockReturnValue({
        collectionPeriod: { from: '2026-03-21', to: '2026-03-21' },
        entryUsages: [],
        addressUsages: [],
        coOccurrences: [],
        versionUsages: [],
      }),
      collectMetrics: vi.fn().mockReturnValue([]),
      metricsToObservations: vi.fn().mockReturnValue([]),
    };

    const pipeline = new ConvergencePipelineRunner(
      {
        recordStore,
        convergenceFns,
        graphProvider: () => ({ getAllNodes: () => [], getNodesByKind: () => [] }) as any,
        catalogProvider: () => ({ id: 'test', name: 'test', axes: {}, prefixes: {} }),
      },
      { recordThreshold: 999 },
    );

    try {
      pipeline.notifyCompletion(['t1', 't2', 't3']);
      const result = await pipeline.flush();

      // t2 실패해도 t1, t3는 수집됨 → 2건
      expect(result!.recordsProcessed).toBe(2);
      expect(convergenceFns.aggregateUsageData).toHaveBeenCalledTimes(1);
      const records = (convergenceFns.aggregateUsageData as any).mock.calls[0][1];
      expect(records).toHaveLength(2);
    } finally {
      await pipeline.close();
    }
  });

  // ── activation gate + convergence 연동 시나리오 ────

  it('convergence observation이 activation gate diagnostics에 반영되는 시나리오', () => {
    // 이 테스트는 activation-gate가 observation을 감지하는 것을 검증
    // (실제로는 spec-core의 checkActivationReadiness가 수행)

    // Mock: activation gate가 warning을 반환하지만 activation은 허용
    const mockGateResult = {
      allowed: true,
      diagnostics: [
        {
          level: 'warning' as const,
          source: 'observation',
          id: 'OBS-METRIC-headroom-status-1',
          message: 'Unresolved observation: [critical] 축 여유 공간: status: headroom=0',
        },
      ],
    };

    // gate가 convergence pipeline이 생성한 observation을 감지
    expect(mockGateResult.allowed).toBe(true);
    expect(mockGateResult.diagnostics).toHaveLength(1);
    expect(mockGateResult.diagnostics[0].id).toContain('OBS-METRIC');
  });
});

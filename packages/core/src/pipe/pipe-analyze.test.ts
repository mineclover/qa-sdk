// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import {
  analyzePipeComplexity,
  findBottlenecks,
  analyzeCoverage,
  collectGraphEvents,
} from './pipe-analyze.js';
import type { PipeGraph } from '../types/pipe-spec.js';
import { step, simplePipe, branchPipe, simpleGraph } from './__fixtures__/pipe-fixtures.js';

// ── 복잡도 분석 ──────────────────────────────────────────

describe('analyzePipeComplexity', () => {
  it('기본 그래프 복잡도 분석', () => {
    const result = analyzePipeComplexity(simpleGraph);
    expect(result.pipeCount).toBe(2);
    expect(result.connectionCount).toBe(1);
    expect(result.pathsPerPipe['p1']).toBe(1);
    expect(result.pathsPerPipe['p2']).toBe(2);
    expect(result.mostComplexPipe!.pipeId).toBe('p2');
    expect(result.mostComplexPipe!.paths).toBe(2);
    expect(result.usedFlowKinds).toContain('step');
    expect(result.usedFlowKinds).toContain('branch');
    expect(result.usedConnectionKinds).toContain('next');
  });
});

// ── 병목 감지 ────────────────────────────────────────────

describe('findBottlenecks', () => {
  it('retry/fallback 파이프를 실패 지점으로 감지', () => {
    const graph: PipeGraph = {
      graphId: 'g',
      version: 'v1',
      pipes: [
        {
          pipeId: 'risky',
          version: 'v1',
          trigger: { eventKey: 'e' },
          flow: {
            kind: 'retry',
            maxAttempts: 3,
            step: { kind: 'fallback', try: step(), catch: step() },
          },
        },
      ],
      connections: [],
      entryPipeId: 'risky',
    };
    const report = findBottlenecks(graph);
    expect(report.failurePoints).toHaveLength(1);
    expect(report.failurePoints[0].kinds).toContain('retry');
    expect(report.failurePoints[0].kinds).toContain('fallback');
  });

  it('timeout 파이프를 지연 지점으로 감지', () => {
    const graph: PipeGraph = {
      graphId: 'g',
      version: 'v1',
      pipes: [
        {
          pipeId: 'slow',
          version: 'v1',
          trigger: { eventKey: 'e' },
          flow: { kind: 'timeout', body: step(), duration: 5000 },
        },
      ],
      connections: [],
      entryPipeId: 'slow',
    };
    const report = findBottlenecks(graph);
    expect(report.latencyPoints).toHaveLength(1);
    expect(report.latencyPoints[0].totalTimeout).toBe(5000);
  });
});

// ── 커버리지 분석 ────────────────────────────────────────

describe('analyzeCoverage', () => {
  it('전체 커버리지', () => {
    const report = analyzeCoverage(simpleGraph, new Set(['p1', 'p2']));
    expect(report.pipeCoverage).toBe(100);
    expect(report.uncoveredPipes).toHaveLength(0);
  });

  it('부분 커버리지', () => {
    const report = analyzeCoverage(simpleGraph, new Set(['p1']));
    expect(report.pipeCoverage).toBe(50);
    expect(report.uncoveredPipes).toEqual(['p2']);
  });

  it('미실행 커버리지', () => {
    const report = analyzeCoverage(simpleGraph, new Set());
    expect(report.pipeCoverage).toBe(0);
    expect(report.uncoveredPipes).toHaveLength(2);
  });
});

// ── 이벤트 카탈로그 수집 ─────────────────────────────────

describe('collectGraphEvents', () => {
  it('trigger + produces + emit 이벤트 수집', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [
        {
          pipeId: 'order',
          version: 'v1',
          trigger: { eventKey: 'order_submitted' },
          flow: {
            kind: 'sequence',
            steps: [step('검증'), { kind: 'emit', eventKey: 'order_validated' }],
          },
          produces: ['order_completed'],
        },
        {
          pipeId: 'payment',
          version: 'v1',
          trigger: { eventKey: 'order_completed' },
          flow: step('결제'),
        },
      ],
      connections: [{ from: 'order', to: 'payment', kind: 'next' }],
      entryPipeId: 'order',
    };

    const events = collectGraphEvents(graph);
    expect(events.filter((e) => e.role === 'trigger')).toHaveLength(2);
    expect(events.filter((e) => e.role === 'produces')).toHaveLength(1);
    expect(events.filter((e) => e.role === 'emit')).toHaveLength(1);
    expect(
      events.find((e) => e.eventKey === 'order_completed' && e.role === 'produces')?.pipeId,
    ).toBe('order');
    expect(events.find((e) => e.eventKey === 'order_validated' && e.role === 'emit')?.pipeId).toBe(
      'order',
    );
  });

  it('emit 없는 단순 그래프 — trigger만 수집', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [{ pipeId: 'p1', version: 'v1', trigger: { eventKey: 'start' }, flow: step() }],
      connections: [],
      entryPipeId: 'p1',
    };
    const events = collectGraphEvents(graph);
    expect(events).toHaveLength(1);
    expect(events[0]!.role).toBe('trigger');
  });

  it('중첩 emit — branch 내부 sequence 안의 emit', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [
        {
          pipeId: 'p1',
          version: 'v1',
          trigger: { eventKey: 'start' },
          flow: {
            kind: 'branch',
            condition: 'type',
            paths: [
              { kind: 'sequence', steps: [step(), { kind: 'emit', eventKey: 'path_a' }] },
              { kind: 'emit', eventKey: 'path_b' },
            ],
          },
        },
      ],
      connections: [],
      entryPipeId: 'p1',
    };
    const emits = collectGraphEvents(graph).filter((e) => e.role === 'emit');
    expect(emits).toHaveLength(2);
    expect(emits.map((e) => e.eventKey).toSorted()).toEqual(['path_a', 'path_b']);
  });

  it('finally 내부 emit', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [
        {
          pipeId: 'p1',
          version: 'v1',
          trigger: { eventKey: 'start' },
          flow: {
            kind: 'finally',
            body: step(),
            cleanup: { kind: 'emit', eventKey: 'cleanup_done' },
          },
        },
      ],
      connections: [],
      entryPipeId: 'p1',
    };
    const emits = collectGraphEvents(graph).filter((e) => e.role === 'emit');
    expect(emits).toHaveLength(1);
    expect(emits[0]!.eventKey).toBe('cleanup_done');
  });

  it('compensate 내부 emit', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [
        {
          pipeId: 'p1',
          version: 'v1',
          trigger: { eventKey: 'start' },
          flow: {
            kind: 'compensate',
            forward: { kind: 'emit', eventKey: 'forward_ok' },
            compensate: { kind: 'emit', eventKey: 'rollback' },
          },
        },
      ],
      connections: [],
      entryPipeId: 'p1',
    };
    const emits = collectGraphEvents(graph).filter((e) => e.role === 'emit');
    expect(emits).toHaveLength(2);
    expect(emits.map((e) => e.eventKey).toSorted()).toEqual(['forward_ok', 'rollback']);
  });

  it('transition-scope 내부 emit 수집', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [
        {
          pipeId: 'p1',
          version: 'v1',
          trigger: { eventKey: 'start' },
          flow: {
            kind: 'transition-scope',
            transitionId: 'transfer',
            body: {
              kind: 'sequence',
              steps: [
                { kind: 'emit', eventKey: 'account.debit' },
                { kind: 'emit', eventKey: 'account.credit' },
              ],
            },
            events: ['account.debit', 'account.credit'],
          },
        },
      ],
      connections: [],
      entryPipeId: 'p1',
    };
    const emits = collectGraphEvents(graph).filter((e) => e.role === 'emit');
    expect(emits).toHaveLength(2);
    expect(emits.map((e) => e.eventKey).toSorted()).toEqual(['account.credit', 'account.debit']);
  });

  it('중복 emit — 같은 eventKey가 여러 경로에 존재하면 모두 수집', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [
        {
          pipeId: 'p1',
          version: 'v1',
          trigger: { eventKey: 'start' },
          flow: {
            kind: 'branch',
            condition: 'type',
            paths: [
              { kind: 'emit', eventKey: 'notify' },
              { kind: 'emit', eventKey: 'notify' },
            ],
          },
        },
      ],
      connections: [],
      entryPipeId: 'p1',
    };
    const emits = collectGraphEvents(graph).filter((e) => e.role === 'emit');
    expect(emits).toHaveLength(2);
  });

  it('여러 파이프에서 이벤트 수집', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [
        {
          pipeId: 'p1',
          version: 'v1',
          trigger: { eventKey: 'e1' },
          flow: step(),
          produces: ['e2'],
        },
        {
          pipeId: 'p2',
          version: 'v1',
          trigger: { eventKey: 'e2' },
          flow: { kind: 'emit', eventKey: 'e3' },
        },
        { pipeId: 'p3', version: 'v1', trigger: { eventKey: 'e3' }, flow: step() },
      ],
      connections: [
        { from: 'p1', to: 'p2', kind: 'next' },
        { from: 'p2', to: 'p3', kind: 'next' },
      ],
      entryPipeId: 'p1',
    };
    const events = collectGraphEvents(graph);
    expect(events.filter((e) => e.role === 'trigger')).toHaveLength(3);
    expect(events.filter((e) => e.role === 'produces')).toHaveLength(1);
    expect(events.filter((e) => e.role === 'emit')).toHaveLength(1);
  });

  it('빈 그래프 — 파이프 없음', () => {
    const graph: PipeGraph = {
      graphId: 'g1',
      version: 'v1',
      pipes: [],
      connections: [],
      entryPipeId: '',
    };
    expect(collectGraphEvents(graph)).toHaveLength(0);
  });
});

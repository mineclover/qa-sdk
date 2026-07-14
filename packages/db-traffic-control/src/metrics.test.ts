import { describe, expect, it } from 'vitest';
import {
  InMemoryMetricsCollector,
  CallbackMetricsCollector,
  FanOutMetricsCollector,
} from './metrics.js';
import type { QueryMetricEvent } from './types.js';

function makeEvent(overrides?: Partial<QueryMetricEvent>): QueryMetricEvent {
  return {
    timestamp: new Date().toISOString(),
    fingerprint: 'SELECT * FROM users WHERE id = ?',
    operation: 'select',
    table: 'users',
    budgetId: 'test-budget',
    verdict: 'allow',
    durationMs: 10,
    waitedMs: 0,
    tags: {},
    ...overrides,
  };
}

describe('InMemoryMetricsCollector', () => {
  it('record + getRecent', () => {
    const collector = new InMemoryMetricsCollector();
    collector.record(makeEvent({ durationMs: 5 }));
    collector.record(makeEvent({ durationMs: 15 }));
    collector.record(makeEvent({ durationMs: 25 }));

    expect(collector.size).toBe(3);
    expect(collector.getRecent(2).length).toBe(2);
    expect(collector.getRecent(2)[0]!.durationMs).toBe(15);
  });

  it('maxEvents 초과 시 오래된 이벤트 제거', () => {
    const collector = new InMemoryMetricsCollector({ maxEvents: 3 });
    for (let i = 0; i < 5; i++) {
      collector.record(makeEvent({ durationMs: i }));
    }

    expect(collector.size).toBe(3);
    expect(collector.getRecent()[0]!.durationMs).toBe(2);
  });

  it('aggregateByFingerprint', () => {
    const collector = new InMemoryMetricsCollector();
    collector.record(makeEvent({ fingerprint: 'a', durationMs: 10, verdict: 'allow' }));
    collector.record(makeEvent({ fingerprint: 'a', durationMs: 20, verdict: 'throttled' }));
    collector.record(makeEvent({ fingerprint: 'b', durationMs: 5, verdict: 'allow' }));

    const agg = collector.aggregateByFingerprint();
    expect(agg.length).toBe(2);

    const fpA = agg.find((a) => a.fingerprint === 'a')!;
    expect(fpA.count).toBe(2);
    expect(fpA.avgDurationMs).toBe(15);
    expect(fpA.verdicts.allow).toBe(1);
    expect(fpA.verdicts.throttled).toBe(1);
  });

  it('aggregateByBudget', () => {
    const collector = new InMemoryMetricsCollector();
    collector.record(makeEvent({ budgetId: 'x', verdict: 'allow', durationMs: 10 }));
    collector.record(makeEvent({ budgetId: 'x', verdict: 'rejected', durationMs: 0 }));
    collector.record(makeEvent({ budgetId: 'y', verdict: 'allow', durationMs: 20 }));

    const agg = collector.aggregateByBudget();
    const budgetX = agg.find((a) => a.budgetId === 'x')!;
    expect(budgetX.totalQueries).toBe(2);
    expect(budgetX.allowedQueries).toBe(1);
    expect(budgetX.rejectedQueries).toBe(1);
  });

  it('reset', () => {
    const collector = new InMemoryMetricsCollector();
    collector.record(makeEvent());
    collector.reset();
    expect(collector.size).toBe(0);
  });
});

describe('CallbackMetricsCollector', () => {
  it('콜백 호출', () => {
    const received: QueryMetricEvent[] = [];
    const collector = new CallbackMetricsCollector((e) => received.push(e));
    collector.record(makeEvent());
    expect(received.length).toBe(1);
  });
});

describe('FanOutMetricsCollector', () => {
  it('여러 수집기에 동시 전달', () => {
    const a = new InMemoryMetricsCollector();
    const b = new InMemoryMetricsCollector();
    const fanout = new FanOutMetricsCollector([a, b]);

    fanout.record(makeEvent());
    expect(a.size).toBe(1);
    expect(b.size).toBe(1);
  });
});

// ── event_key / transition 수집 ─────────────────────

describe('InMemoryMetricsCollector — event_key 수집', () => {
  it('event_key 없는 쿼리 → 빈 배열', () => {
    const collector = new InMemoryMetricsCollector();
    collector.record(makeEvent());
    expect(collector.collectEventKeys()).toEqual([]);
  });

  it('event_key 수집 + 중복 제거', () => {
    const collector = new InMemoryMetricsCollector();
    collector.record(makeEvent({ tags: { event_key: 'order.create' } }));
    collector.record(makeEvent({ tags: { event_key: 'order.create' } }));
    collector.record(makeEvent({ tags: { event_key: 'order.read' } }));
    expect(collector.collectEventKeys().toSorted()).toEqual(['order.create', 'order.read']);
  });

  it('transition 그룹 수집', () => {
    const collector = new InMemoryMetricsCollector();
    collector.record(makeEvent({ tags: { event_key: 'account.debit', transition: 'transfer' } }));
    collector.record(makeEvent({ tags: { event_key: 'account.credit', transition: 'transfer' } }));
    collector.record(makeEvent({ tags: { event_key: 'fee.record', transition: 'transfer' } }));
    collector.record(makeEvent({ tags: { event_key: 'log.write' } }));

    const groups = collector.collectTransitionGroups();
    expect(groups.size).toBe(1);
    expect(groups.get('transfer')!.toSorted()).toEqual([
      'account.credit',
      'account.debit',
      'fee.record',
    ]);
  });
});

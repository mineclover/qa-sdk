import { describe, expect, it } from 'vitest';
import { TrafficController } from './controller.js';
import { InMemoryMetricsCollector } from './metrics.js';
import type { BudgetDef, QueryAttributes } from './types.js';

const budgets: BudgetDef[] = [
  {
    id: 'heavy-reads',
    name: '무거운 조회',
    match: { operations: ['select'], tags: { priority: 'low' } },
    limits: { maxConcurrency: 2, maxQps: 10 },
    mode: 'enforce',
    priority: 1,
  },
  {
    id: 'writes',
    name: '쓰기',
    match: { operations: ['insert', 'update', 'delete'] },
    limits: { maxConcurrency: 5 },
    mode: 'warn',
    priority: 5,
  },
];

function makeAttrs(overrides?: Partial<QueryAttributes>): QueryAttributes {
  return {
    fingerprint: 'SELECT * FROM test',
    operation: 'select',
    tags: {},
    ...overrides,
  };
}

describe('TrafficController', () => {
  it('budget 미매칭 쿼리는 allow', async () => {
    const controller = new TrafficController({ budgets });
    const { decision, release } = await controller.beforeQuery(
      makeAttrs({ operation: 'select', tags: { priority: 'high' } }),
    );

    expect(decision.verdict).toBe('allow');
    expect(decision.budgetId).toBeNull();
    release();
  });

  it('budget 매칭 + 제한 미초과 → allow', async () => {
    const controller = new TrafficController({ budgets });
    const { decision, release } = await controller.beforeQuery(
      makeAttrs({ operation: 'select', tags: { priority: 'low' } }),
    );

    expect(decision.verdict).toBe('allow');
    expect(decision.budgetId).toBe('heavy-reads');
    release();
  });

  it('동시성 초과 → enforce 모드에서 rejected + enforced', async () => {
    const controller = new TrafficController({ budgets });
    const attrs = makeAttrs({ operation: 'select', tags: { priority: 'low' } });

    // 2개 슬롯 점유
    const r1 = await controller.beforeQuery(attrs);
    const r2 = await controller.beforeQuery(attrs);
    expect(r1.decision.verdict).toBe('allow');
    expect(r2.decision.verdict).toBe('allow');

    // 3번째 → rejected
    const r3 = await controller.beforeQuery(attrs);
    expect(r3.decision.verdict).toBe('rejected');
    expect(r3.decision.enforced).toBe(true);
    expect(r3.decision.reason).toContain('동시성');

    r1.release();
    r2.release();
  });

  it('warn 모드에서는 제한 초과해도 enforced=false', async () => {
    const controller = new TrafficController({ budgets });
    const attrs = makeAttrs({ operation: 'insert' });

    // writes budget (maxConcurrency: 5, mode: warn)
    const releases: Array<() => void> = [];
    for (let i = 0; i < 5; i++) {
      const { release } = await controller.beforeQuery(attrs);
      releases.push(release);
    }

    // 6번째 → rejected but not enforced
    const { decision } = await controller.beforeQuery(attrs);
    expect(decision.verdict).toBe('rejected');
    expect(decision.enforced).toBe(false); // warn 모드

    for (const r of releases) r();
  });

  it('afterQuery로 메트릭 수집', async () => {
    const collector = new InMemoryMetricsCollector();
    const controller = new TrafficController({ budgets, collector });
    const attrs = makeAttrs({ operation: 'select', tags: { priority: 'low' } });

    const { decision, release } = await controller.beforeQuery(attrs);
    controller.afterQuery(attrs, decision, 42.5);
    release();

    const events = collector.getRecent();
    expect(events.length).toBe(1);
    expect(events[0]!.budgetId).toBe('heavy-reads');
    expect(events[0]!.durationMs).toBe(42.5);
    expect(events[0]!.verdict).toBe('allow');
  });

  it('addBudget으로 동적 추가', async () => {
    const controller = new TrafficController({ budgets: [] });

    // 처음엔 매칭 없음
    const r1 = await controller.beforeQuery(makeAttrs({ table: 'orders' }));
    expect(r1.decision.budgetId).toBeNull();
    r1.release();

    // budget 추가
    controller.addBudget({
      id: 'orders',
      name: '주문 테이블',
      match: { tables: ['orders'] },
      limits: { maxConcurrency: 1 },
      mode: 'enforce',
      priority: 1,
    });

    const r2 = await controller.beforeQuery(makeAttrs({ table: 'orders' }));
    expect(r2.decision.budgetId).toBe('orders');
    r2.release();
  });

  it('removeBudget으로 동적 제거', async () => {
    const controller = new TrafficController({ budgets });

    controller.removeBudget('heavy-reads');

    const { decision, release } = await controller.beforeQuery(
      makeAttrs({ operation: 'select', tags: { priority: 'low' } }),
    );
    expect(decision.budgetId).not.toBe('heavy-reads');
    release();
  });

  it('setBudgetMode로 모드 전환', async () => {
    const controller = new TrafficController({ budgets });

    // writes를 enforce로 전환
    controller.setBudgetMode('writes', 'enforce');

    const attrs = makeAttrs({ operation: 'insert' });
    const releases: Array<() => void> = [];
    for (let i = 0; i < 5; i++) {
      const { release } = await controller.beforeQuery(attrs);
      releases.push(release);
    }

    // 이제 enforced=true
    const { decision } = await controller.beforeQuery(attrs);
    expect(decision.enforced).toBe(true);

    for (const r of releases) r();
  });

  it('snapshot으로 전체 상태 조회', () => {
    const controller = new TrafficController({ budgets, globalMaxConcurrency: 100 });
    const snap = controller.snapshot();

    expect(snap.budgets.length).toBe(2);
    expect(snap.globalConcurrency).toBeDefined();
    expect(snap.globalConcurrency!.max).toBe(100);
  });
});

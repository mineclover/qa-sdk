import { describe, expect, it } from 'vitest';
import { matchBudget, matchAllBudgets, matchGlob } from './budget.js';
import type { BudgetDef, QueryAttributes } from './types.js';

const budgets: BudgetDef[] = [
  {
    id: 'analytics-reads',
    name: '분석 조회',
    match: { operations: ['select'], tags: { feature: 'analytics' } },
    limits: { maxConcurrency: 5 },
    mode: 'warn',
    priority: 10,
  },
  {
    id: 'ingest-writes',
    name: '수집 쓰기',
    match: { services: ['ingest-server'], operations: ['insert'] },
    limits: { maxQps: 5000 },
    mode: 'enforce',
    priority: 1,
  },
  {
    id: 'user-table',
    name: '사용자 테이블',
    match: { tables: ['users'] },
    limits: { maxConcurrency: 10 },
    mode: 'warn',
    priority: 5,
  },
];

function makeAttrs(overrides: Partial<QueryAttributes>): QueryAttributes {
  return {
    fingerprint: 'SELECT * FROM test',
    operation: 'select',
    tags: {},
    ...overrides,
  };
}

describe('matchBudget', () => {
  it('operation + tags로 매칭', () => {
    const result = matchBudget(
      makeAttrs({ operation: 'select', tags: { feature: 'analytics' } }),
      budgets,
    );
    expect(result?.id).toBe('analytics-reads');
  });

  it('service + operation으로 매칭', () => {
    const result = matchBudget(
      makeAttrs({ service: 'ingest-server', operation: 'insert' }),
      budgets,
    );
    expect(result?.id).toBe('ingest-writes');
  });

  it('table로 매칭', () => {
    const result = matchBudget(makeAttrs({ table: 'users' }), budgets);
    expect(result?.id).toBe('user-table');
  });

  it('여러 budget 매칭 시 priority가 낮은 것 우선', () => {
    // ingest-server에서 users 테이블에 insert → ingest-writes(1) vs user-table(5)
    const result = matchBudget(
      makeAttrs({ service: 'ingest-server', operation: 'insert', table: 'users' }),
      budgets,
    );
    expect(result?.id).toBe('ingest-writes');
  });

  it('매칭 없으면 null', () => {
    const result = matchBudget(makeAttrs({ operation: 'delete', service: 'unknown' }), budgets);
    expect(result).toBeNull();
  });

  it('태그 조건 부분 일치는 실패', () => {
    const result = matchBudget(
      makeAttrs({ operation: 'select', tags: { feature: 'dashboard' } }),
      budgets,
    );
    // analytics-reads는 feature=analytics 필요하므로 매칭 안 됨
    expect(result?.id).not.toBe('analytics-reads');
  });
});

describe('matchAllBudgets', () => {
  it('매칭되는 모든 budget을 priority 순으로 반환', () => {
    const result = matchAllBudgets(
      makeAttrs({ service: 'ingest-server', operation: 'insert', table: 'users' }),
      budgets,
    );
    expect(result.length).toBe(2);
    expect(result[0]!.id).toBe('ingest-writes'); // priority 1
    expect(result[1]!.id).toBe('user-table'); // priority 5
  });
});

describe('matchGlob', () => {
  it('정확 일치', () => {
    expect(matchGlob('hello', 'hello')).toBe(true);
    expect(matchGlob('hello', 'world')).toBe(false);
  });

  it('* 와일드카드', () => {
    expect(matchGlob('SELECT * FROM users WHERE id = ?', 'SELECT * FROM users*')).toBe(true);
    expect(matchGlob('SELECT * FROM orders WHERE id = ?', 'SELECT * FROM users*')).toBe(false);
  });

  it('중간 와일드카드', () => {
    expect(matchGlob('abc-123-xyz', 'abc-*-xyz')).toBe(true);
    expect(matchGlob('abc-123-zzz', 'abc-*-xyz')).toBe(false);
  });

  it('다중 와일드카드', () => {
    expect(matchGlob('a/b/c', 'a/*/c')).toBe(true);
    expect(matchGlob('a/b/c/d', '*/*/*/*')).toBe(true);
  });
});

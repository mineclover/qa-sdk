// @def.boundary sim-approval-api
// @def.doc server-side-admin-endpoints

// Stage 4 §4.1 — OutboxAdminInsertService 단위 테스트.
// 단일 트랜잭션 + grammar #12 idempotencyKey + aggregateId 정규화 + 빈 배열 + grammar #5 거부.

import { describe, it, expect, beforeEach } from 'vitest';
import { parseIdempotencyKey } from 'sim-identifier-grammar';
import { toGrammarSafeAggregateId } from '../approval/shared/outbox/idempotency-key-source.js';
import { OUTBOX_ADMIN_REPO, type OutboxAdminRepo } from './outbox-admin.tokens.js';
import { OutboxAdminInsertService } from './outbox-admin-insert.service.js';

class FakeRepo implements OutboxAdminRepo {
  rows: Array<Record<string, unknown>> = [];
  txCount = 0;
  async transaction<T>(cb: (tx: FakeRepo) => Promise<T>): Promise<T> {
    this.txCount++;
    return cb(this);
  }
  async insertMany(rows: Array<Record<string, unknown>>): Promise<string[]> {
    this.rows.push(...rows);
    return rows.map((r) => r.id as string);
  }
}

describe('OutboxAdminInsertService', () => {
  let repo: FakeRepo;
  let svc: OutboxAdminInsertService;

  beforeEach(() => {
    repo = new FakeRepo();
    svc = new OutboxAdminInsertService(repo);
  });

  it('N=5 INSERT — 단일 트랜잭션 + idempotencyKey grammar #12', async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      aggregateId: `proj-${String(i + 1).padStart(3, '0')}`,
      eventName: 'approval.budget.submitted',
      payload: { idx: i },
      occurredAt: 1714250400000,
    }));
    const r = await svc.insertEvents(events);
    expect(r.inserted).toBe(5);
    expect(new Set(r.ids).size).toBe(5);
    for (const k of r.idempotencyKeys) {
      expect(() => parseIdempotencyKey(k)).not.toThrow();
    }
    expect(repo.txCount).toBe(1);
    expect(repo.rows.every((x) => x.status === 'pending' && x.retry_count === 0)).toBe(true);
  });

  it('aggregateId 정규화 — toGrammarSafeAggregateId 적용 후 INSERT', async () => {
    const dirty = 'Proj With Spaces!';
    const safe = toGrammarSafeAggregateId(dirty);
    const r = await svc.insertEvents([
      {
        aggregateId: dirty,
        eventName: 'approval.budget.submitted',
        payload: {},
        occurredAt: 1714250400000,
      },
    ]);
    expect(parseIdempotencyKey(r.idempotencyKeys[0]).aggregateId).toBe(safe);
    expect(repo.rows[0].aggregate_id).toBe(safe);
  });

  it('빈 배열 → inserted=0 + 트랜잭션 미실행', async () => {
    const r = await svc.insertEvents([]);
    expect(r.inserted).toBe(0);
    expect(r.idempotencyKeys).toEqual([]);
    expect(r.ids).toEqual([]);
    expect(typeof r.insertedAtMs).toBe('number');
    expect(repo.txCount).toBe(0);
  });

  it('eventName grammar #5 위반 → throw + 트랜잭션 미실행 (rows 0건 확인)', async () => {
    await expect(
      svc.insertEvents([
        {
          aggregateId: 'proj-001',
          eventName: 'INVALID NAME',
          payload: {},
          occurredAt: 1714250400000,
        },
      ]),
    ).rejects.toThrow(/eventName/);
    expect(repo.rows).toHaveLength(0);
    expect(repo.txCount).toBe(0);
  });
});

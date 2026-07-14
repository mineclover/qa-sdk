// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * grammar #12 — slice publisher 의 idempotencyKey 강제 검증.
 *
 * (a) OutboxRecord.idempotencyKey 누락/빈 값 → createDrizzleOutboxPort.append 즉시 throw.
 * (b) buildIdempotencyKey 결과만 통과 + row.idempotency_key 컬럼에 그대로 전달.
 * (c) raw 보간 형식은 parseIdempotencyKey 가 throw — consumer 측 가드.
 * (d) toGrammarSafeAggregateId — entity id 정규화 규칙.
 */
import { describe, expect, it } from 'vitest';
import { buildIdempotencyKey, parseIdempotencyKey } from 'sim-identifier-grammar';
import { createDrizzleOutboxPort, type DrizzleInsertable } from '@qa-sdk/sim-domain-slice-kit';
import type { OutboxRecord, TransactionScope } from '@qa-sdk/sim-domain-slice-kit';

import { toGrammarSafeAggregateId } from './idempotency-key-source.js';

class FakeBuilder implements DrizzleInsertable {
  rows: Record<string, unknown>[] = [];
  insert(_t: unknown) {
    return {
      values: (row: Record<string, unknown>) => {
        this.rows.push(row);
        return Promise.resolve(undefined);
      },
    };
  }
}

const scope: TransactionScope = {
  id: 'tx-1',
  startedAt: new Date(0),
};

describe('slice outbox publisher idempotency_key 강제', () => {
  it('idempotencyKey 누락 → throw', async () => {
    const port = createDrizzleOutboxPort({ db: new FakeBuilder(), table: {} });
    const bad = {
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      eventVersion: 1,
      payload: {},
      occurredAt: new Date(1714250400000),
    } as unknown as OutboxRecord;
    await expect(port.append(bad, scope)).rejects.toThrow(/idempotencyKey/);
  });

  it('idempotencyKey 빈 문자열 → throw', async () => {
    const port = createDrizzleOutboxPort({ db: new FakeBuilder(), table: {} });
    await expect(
      port.append(
        {
          aggregateId: 'proj-001',
          eventName: 'approval.budget.submitted',
          eventVersion: 1,
          payload: {},
          occurredAt: new Date(1714250400000),
          idempotencyKey: '',
        },
        scope,
      ),
    ).rejects.toThrow(/idempotencyKey/);
  });

  it('buildIdempotencyKey 결과만 통과 + row.idempotency_key 컬럼에 그대로 전달', async () => {
    const fake = new FakeBuilder();
    const port = createDrizzleOutboxPort({ db: fake, table: {} });
    const idemp = buildIdempotencyKey({
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      occurredAt: 1714250400000,
    });
    await port.append(
      {
        aggregateId: 'proj-001',
        eventName: 'approval.budget.submitted',
        eventVersion: 1,
        payload: {},
        occurredAt: new Date(1714250400000),
        idempotencyKey: idemp,
      },
      scope,
    );
    expect(fake.rows[0].idempotency_key).toBe(idemp);
    expect(parseIdempotencyKey(fake.rows[0].idempotency_key as string)).toEqual({
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      occurredAt: 1714250400000,
    });
  });

  it('raw 보간 문자열은 grammar #12 형식이 아니면 parseIdempotencyKey 가 throw — consumer 측 가드', () => {
    expect(() => parseIdempotencyKey('proj-001-1714250400000')).toThrow();
    expect(() => parseIdempotencyKey('proj-001:approval.submit:1714250400000')).toThrow();
  });
});

describe('toGrammarSafeAggregateId — entity id 정규화', () => {
  it('underscore → hyphen', () => {
    expect(toGrammarSafeAggregateId('br_001')).toBe('br-001');
  });

  it('대문자 → 소문자', () => {
    expect(toGrammarSafeAggregateId('BR-001')).toBe('br-001');
  });

  it('기타 특수문자 → hyphen + 연속 hyphen 정리', () => {
    expect(toGrammarSafeAggregateId('br$$001')).toBe('br-001');
  });

  it("숫자로 시작하면 'x-' prefix", () => {
    expect(toGrammarSafeAggregateId('001-budget')).toBe('x-001-budget');
  });

  it('정규화 결과는 grammar #12 aggregateId regex 통과', () => {
    const out = toGrammarSafeAggregateId('br_001');
    // 통과해야 buildIdempotencyKey 에서 throw 하지 않는다.
    expect(() =>
      buildIdempotencyKey({
        aggregateId: out,
        eventName: 'approval.budget.submitted',
        occurredAt: 1714250400000,
      }),
    ).not.toThrow();
  });

  it('빈 문자열 → throw', () => {
    expect(() => toGrammarSafeAggregateId('')).toThrow();
  });
});

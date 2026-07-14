// @def.boundary ingest-system
// @def.doc ingest-system

import type { DlqStore, DlqInsert } from '@qa-sdk/core';
import { expect, it, beforeEach, afterEach } from 'vitest';

function makeDlqInsert(overrides: Partial<DlqInsert> = {}): DlqInsert {
  return {
    id: 'dlq-1',
    traceId: 't1',
    phase: 'reconstruction',
    errorMessage: '테스트 에러',
    ...overrides,
  };
}

export function dlqStoreTests(
  factory: () => Promise<{ store: DlqStore; cleanup: () => Promise<void> }>,
) {
  let store: DlqStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it('insert + findPending', async () => {
    await store.insert(makeDlqInsert());
    const pending = await store.findPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].traceId).toBe('t1');
    expect(pending[0].phase).toBe('reconstruction');
    expect(pending[0].attemptCount).toBe(0);
  });

  it('markAttempted → attemptCount 증가', async () => {
    await store.insert(makeDlqInsert({ id: 'dlq-attempt' }));
    await store.markAttempted('dlq-attempt');
    await store.markAttempted('dlq-attempt');

    const pending = await store.findPending();
    const item = pending.find((p) => p.id === 'dlq-attempt');
    expect(item).not.toBeUndefined();
    expect(item!.attemptCount).toBe(2);
    expect(item!.lastAttemptedAt).not.toBeNull();
  });

  it('markResolved → findPending에서 제외됨', async () => {
    await store.insert(makeDlqInsert({ id: 'dlq-resolve' }));
    await store.markResolved('dlq-resolve');

    const pending = await store.findPending();
    const resolved = pending.find((p) => p.id === 'dlq-resolve');
    expect(resolved).toBeUndefined();
  });

  it('findPending limit 적용', async () => {
    await store.insert(
      makeDlqInsert({ id: 'd1', traceId: 't1', phase: 'reconstruction', errorMessage: 'err1' }),
    );
    await store.insert(
      makeDlqInsert({ id: 'd2', traceId: 't1', phase: 'reconstruction', errorMessage: 'err2' }),
    );
    await store.insert(
      makeDlqInsert({ id: 'd3', traceId: 't1', phase: 'verdict', errorMessage: 'err3' }),
    );
    const results = await store.findPending(2);
    expect(results).toHaveLength(2);
  });

  it('findPending 빈 상태 → 빈 배열', async () => {
    const results = await store.findPending();
    expect(results).toEqual([]);
  });
}

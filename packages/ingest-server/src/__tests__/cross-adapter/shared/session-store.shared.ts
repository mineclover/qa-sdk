// @def.boundary ingest-system
// @def.doc ingest-system

import type { SessionStore, SessionUpsert } from '@qa-sdk/core';
import { expect, it, beforeEach, afterEach } from 'vitest';

export function makeSessionUpsert(overrides: Partial<SessionUpsert> = {}): SessionUpsert {
  return {
    sessionId: 'sess-1',
    scenarioId: 'sc-1',
    labels: { env: 'test' },
    actorId: 'actor-1',
    userId: 'user-1',
    userAttributes: { role: 'tester' },
    ...overrides,
  };
}

export function sessionStoreTests(
  factory: () => Promise<{ store: SessionStore; cleanup: () => Promise<void> }>,
) {
  let store: SessionStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it('upsert + findById', async () => {
    await store.upsert(makeSessionUpsert());
    const session = await store.findById('sess-1');
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe('sess-1');
    expect(session!.scenarioId).toBe('sc-1');
    expect(session!.actorId).toBe('actor-1');
  });

  it('upsert 멱등성 (같은 sessionId 두번)', async () => {
    await store.upsert(makeSessionUpsert({ sessionId: 'sess-dup' }));
    await store.upsert(makeSessionUpsert({ sessionId: 'sess-dup', actorId: 'actor-2' }));
    const session = await store.findById('sess-dup');
    expect(session).not.toBeNull();
    // 첫 번째 upsert 값이 유지됨 (ON CONFLICT DO NOTHING)
    expect(session!.actorId).toBe('actor-1');
  });

  it('close 후 closedAt 설정됨', async () => {
    await store.upsert(makeSessionUpsert({ sessionId: 'sess-close' }));
    await store.close('sess-close');
    const session = await store.findById('sess-close');
    expect(session).not.toBeNull();
    expect(session!.closedAt).not.toBeNull();
  });

  it('findById 미존재 → null', async () => {
    const session = await store.findById('nonexistent');
    expect(session).toBeNull();
  });
}

// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTraceStore } from './trace.adapter.js';

describe('InMemoryTraceStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T01:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('upserts traces by accumulating counts and widening the timestamp window', async () => {
    const store = new InMemoryTraceStore();

    await store.upsert({
      traceId: 'trace_1',
      sessionId: 'session_1',
      serviceName: 'mobile-app',
      recordCount: 2,
      firstTimestamp: new Date('2026-03-12T00:00:02.000Z'),
      lastTimestamp: new Date('2026-03-12T00:00:04.000Z'),
    });

    const created = await store.findById('trace_1');

    vi.setSystemTime(new Date('2026-03-12T02:00:00.000Z'));

    await store.upsert({
      traceId: 'trace_1',
      sessionId: 'session_2',
      serviceName: 'changed-service',
      recordCount: 3,
      firstTimestamp: new Date('2026-03-12T00:00:01.000Z'),
      lastTimestamp: new Date('2026-03-12T00:00:05.000Z'),
    });

    const updated = await store.findById('trace_1');

    expect(created).toEqual({
      traceId: 'trace_1',
      sessionId: 'session_1',
      serviceName: 'mobile-app',
      actorId: null,
      userId: null,
      userAttributes: null,
      recordCount: 2,
      firstTimestamp: new Date('2026-03-12T00:00:02.000Z'),
      lastTimestamp: new Date('2026-03-12T00:00:04.000Z'),
      reconstructed: false,
      createdAt: new Date('2026-03-12T01:00:00.000Z'),
      updatedAt: new Date('2026-03-12T01:00:00.000Z'),
    });

    expect(updated).toEqual({
      traceId: 'trace_1',
      sessionId: 'session_1',
      serviceName: 'mobile-app',
      actorId: null,
      userId: null,
      userAttributes: null,
      recordCount: 5,
      firstTimestamp: new Date('2026-03-12T00:00:01.000Z'),
      lastTimestamp: new Date('2026-03-12T00:00:05.000Z'),
      reconstructed: false,
      createdAt: new Date('2026-03-12T01:00:00.000Z'),
      updatedAt: new Date('2026-03-12T02:00:00.000Z'),
    });
  });

  it('returns unreconstructed traces and removes them after markReconstructed', async () => {
    const store = new InMemoryTraceStore();

    await store.upsert({
      traceId: 'trace_1',
      recordCount: 1,
      firstTimestamp: new Date('2026-03-12T00:00:01.000Z'),
      lastTimestamp: new Date('2026-03-12T00:00:01.000Z'),
    });
    await store.upsert({
      traceId: 'trace_2',
      recordCount: 1,
      firstTimestamp: new Date('2026-03-12T00:00:02.000Z'),
      lastTimestamp: new Date('2026-03-12T00:00:02.000Z'),
    });

    expect(await store.findUnreconstructed(1)).toHaveLength(1);

    vi.setSystemTime(new Date('2026-03-12T03:00:00.000Z'));
    await store.markReconstructed('trace_1');

    await expect(store.findUnreconstructed()).resolves.toEqual([
      expect.objectContaining({ traceId: 'trace_2', reconstructed: false }),
    ]);

    await expect(store.findById('trace_1')).resolves.toEqual(
      expect.objectContaining({
        traceId: 'trace_1',
        reconstructed: true,
        updatedAt: new Date('2026-03-12T03:00:00.000Z'),
      }),
    );
  });
});

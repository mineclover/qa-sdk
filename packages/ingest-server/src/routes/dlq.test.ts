// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from 'hono';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryVerdictStore,
} from '@qa-sdk/store';
import { createErrorHandler } from '../middleware/error-handler.js';
import { createDlqRoutes } from './dlq.js';

function buildDeps() {
  return {
    dlqStore: new InMemoryDlqStore(),
    recordStore: new InMemoryRecordStore(),
    traceStore: new InMemoryTraceStore(),
    graphStore: new InMemoryGraphStore(),
    sessionStore: new InMemorySessionStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    verdictStore: new InMemoryVerdictStore(),
  };
}

function buildApp(
  overrides: Partial<ReturnType<typeof buildDeps>> & { maxRetryAttempts?: number } = {},
) {
  const { maxRetryAttempts, ...depOverrides } = overrides;
  const deps = { ...buildDeps(), ...depOverrides };
  const app = new Hono();
  app.onError(createErrorHandler(pino({ level: 'silent' })));
  app.route('/', createDlqRoutes({ ...deps, maxRetryAttempts }));
  return { app, deps };
}

async function seedDlqItem(
  dlqStore: InMemoryDlqStore,
  overrides: {
    id?: string;
    traceId?: string;
    phase?: 'reconstruction' | 'verdict';
    attemptCount?: number;
  } = {},
) {
  const item = {
    id: overrides.id ?? 'dlq_001',
    traceId: overrides.traceId ?? 'trc_001',
    phase: overrides.phase ?? ('reconstruction' as const),
    errorMessage: 'test error',
    attemptCount: overrides.attemptCount ?? 0,
  };
  await dlqStore.insert(item);
  return item;
}

describe('GET /v1/admin/dlq', () => {
  it('returns 200 with empty items when DLQ is empty', async () => {
    const { app } = buildApp();
    const res = await app.request('/v1/admin/dlq');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('returns pending DLQ items', async () => {
    const { app, deps } = buildApp();
    await seedDlqItem(deps.dlqStore);

    const res = await app.request('/v1/admin/dlq');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('dlq_001');
    expect(body.items[0].phase).toBe('reconstruction');
  });

  it('does not return resolved items', async () => {
    const { app, deps } = buildApp();
    await seedDlqItem(deps.dlqStore);
    await deps.dlqStore.markResolved('dlq_001');

    const res = await app.request('/v1/admin/dlq');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });
});

describe('GET /v1/admin/dlq — query validation', () => {
  it('returns 400 for limit=0', async () => {
    const { app } = buildApp();
    const res = await app.request('/v1/admin/dlq?limit=0');
    expect(res.status).toBe(400);
  });
});

describe('POST /v1/admin/dlq/retry', () => {
  it('returns 200 with empty results when DLQ is empty', async () => {
    const { app } = buildApp();
    const res = await app.request('/v1/admin/dlq/retry', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.resolved).toEqual([]);
    expect(body.failed).toEqual([]);
    expect(body.skipped).toEqual([]);
  });

  it('skips items that have reached maxRetryAttempts', async () => {
    const { app, deps } = buildApp({ maxRetryAttempts: 3 });
    await seedDlqItem(deps.dlqStore, { id: 'dlq_001' });
    // reach the limit by marking attempted 3 times
    await deps.dlqStore.markAttempted('dlq_001');
    await deps.dlqStore.markAttempted('dlq_001');
    await deps.dlqStore.markAttempted('dlq_001');

    const res = await app.request('/v1/admin/dlq/retry', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toContain('dlq_001');
    expect(body.resolved).toEqual([]);
  });

  it('resolves a reconstruction item when reconstructTrace succeeds', async () => {
    const { app, deps } = buildApp();

    // seed trace with a record so reconstruction can succeed
    await deps.traceStore.upsert({
      traceId: 'trc_001',
      recordCount: 1,
      firstTimestamp: new Date('2026-03-13T00:00:00.000Z'),
      lastTimestamp: new Date('2026-03-13T00:00:01.000Z'),
    });
    await deps.recordStore.insertBatch([
      {
        logId: 'log_001',
        traceId: 'trc_001',
        spanId: 'spn_001',
        timestamp: new Date('2026-03-13T00:00:00.000Z'),
        recordKind: 'log',
        eventKey: 'page_view',
        eventVersion: '1',
        payloadFormat: 'json',
        payloadEncoding: 'raw',
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        payload: {},
      },
    ]);
    await seedDlqItem(deps.dlqStore, { phase: 'reconstruction' });

    const res = await app.request('/v1/admin/dlq/retry', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resolved).toContain('dlq_001');

    const remainingItems = await deps.dlqStore.findPending(10);
    expect(remainingItems).toHaveLength(0);
  });

  it('resolves a verdict phase item when computeTraceVerdict does not throw', async () => {
    const { app, deps } = buildApp();
    await seedDlqItem(deps.dlqStore, { phase: 'verdict' });

    const res = await app.request('/v1/admin/dlq/retry', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resolved).toContain('dlq_001');

    const remainingItems = await deps.dlqStore.findPending(10);
    expect(remainingItems).toHaveLength(0);
  });

  it('adds to failed list when retry throws', async () => {
    const throwingTraceStore = {
      ...new InMemoryTraceStore(),
      findUnreconstructed: vi.fn().mockResolvedValue([]),
      markReconstructed: vi.fn().mockRejectedValue(new Error('db error')),
      findById: vi.fn().mockResolvedValue(null),
    };
    const throwingRecordStore = {
      ...new InMemoryRecordStore(),
      findByTraceId: vi.fn().mockRejectedValue(new Error('db error')),
    };
    const { app, deps } = buildApp({
      traceStore: throwingTraceStore as never,
      recordStore: throwingRecordStore as never,
    });
    await seedDlqItem(deps.dlqStore, { phase: 'reconstruction' });

    const res = await app.request('/v1/admin/dlq/retry', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.failed).toContain('dlq_001');
  });
});

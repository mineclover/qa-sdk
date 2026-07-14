// @def.boundary ingest-system
// @def.doc ingest-system

import { performance } from 'node:perf_hooks';
import {
  newDlqId,
  type GraphStore,
  type ScenarioSpec,
  type TaskPayload,
  type TaskQueue,
  type TransmissionEnvelope,
  type VerdictStore,
} from '@qa-sdk/core';
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryRecordStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryTransmissionStore,
  InMemoryVerdictStore,
} from '@qa-sdk/store';
import pino from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { BullMQTaskQueue, type BullMQModule } from './lib/bullmq-task-queue.js';
import { InMemoryTaskQueue } from './lib/in-memory-task-queue.js';
import { registerTaskQueueWorker } from './lib/phase-two-worker.js';
import { RecordStreamBroker } from './lib/record-stream-broker.js';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

interface FakeEnqueuedJob<T> {
  data: T;
  name: string;
  opts?: {
    attempts?: number;
    backoff?: {
      delay: number;
      type: 'exponential';
    };
    jobId?: string;
  };
}

function createFakeBullMQ<T>(): BullMQModule {
  const pendingJobs: FakeEnqueuedJob<T>[] = [];
  let activeWorker: FakeWorker<T> | null = null;

  class FakeQueue {
    async add(name: string, data: T, opts?: FakeEnqueuedJob<T>['opts']) {
      pendingJobs.push({
        data: structuredClone(data),
        name,
        opts,
      });
      activeWorker?.drain();
    }

    async close() {}

    async waitUntilReady() {}
  }

  class FakeWorker<TJob> {
    private errorListener: ((error: Error) => void) | null = null;
    private failedListener:
      | ((
          job:
            | {
                data: TJob;
                attemptsMade?: number;
                opts?: FakeEnqueuedJob<TJob>['opts'];
              }
            | undefined,
          error: Error,
        ) => void)
      | null = null;

    constructor(
      _name: string,
      private readonly processor: (job: {
        data: TJob;
        attemptsMade?: number;
        opts?: FakeEnqueuedJob<TJob>['opts'];
      }) => Promise<unknown>,
      _options: {
        concurrency: number;
        connection: unknown;
      },
    ) {
      activeWorker = this as unknown as FakeWorker<T>;
      this.drain();
    }

    drain() {
      for (const job of pendingJobs.splice(0)) {
        void this.run(job as unknown as FakeEnqueuedJob<TJob>);
      }
    }

    on(
      event: 'error' | 'failed',
      listener:
        | ((error: Error) => void)
        | ((
            job:
              | {
                  data: TJob;
                  attemptsMade?: number;
                  opts?: FakeEnqueuedJob<TJob>['opts'];
                }
              | undefined,
            error: Error,
          ) => void),
    ) {
      if (event === 'error') {
        this.errorListener = listener as (error: Error) => void;
        return this;
      }

      this.failedListener = listener as (
        job:
          | {
              data: TJob;
              attemptsMade?: number;
              opts?: FakeEnqueuedJob<TJob>['opts'];
            }
          | undefined,
        error: Error,
      ) => void;
      return this;
    }

    async close() {
      if ((activeWorker as unknown) === this) {
        activeWorker = null;
      }
    }

    async waitUntilReady() {}

    private async run(job: FakeEnqueuedJob<TJob>) {
      let attemptsRemaining = job.opts?.attempts ?? 1;
      let attemptsMade = 0;

      while (attemptsRemaining > 0) {
        try {
          await this.processor({
            data: structuredClone(job.data),
            attemptsMade,
            opts: job.opts ? { ...job.opts } : undefined,
          });
          return;
        } catch (error) {
          attemptsRemaining -= 1;
          attemptsMade += 1;
          const normalized = error instanceof Error ? error : new Error(String(error));

          this.failedListener?.(
            {
              data: structuredClone(job.data),
              attemptsMade,
              opts: job.opts ? { ...job.opts } : undefined,
            },
            normalized,
          );

          if (attemptsRemaining === 0) {
            this.errorListener?.(normalized);
            return;
          }
        }
      }
    }
  }

  return {
    Queue: FakeQueue as unknown as BullMQModule['Queue'],
    Worker: FakeWorker as unknown as BullMQModule['Worker'],
  };
}

function createSilentLogger() {
  return pino({ level: 'silent' });
}

function buildScenarioSpec(scenarioId: string): ScenarioSpec {
  return {
    scenario_id: scenarioId,
    version: '1.0.0',
    domain: 'checkout',
    steps: [
      {
        id: 'step_form',
        event_key: 'checkout.form.updated',
        required: true,
        kind: 'sequence',
      },
      {
        id: 'step_save',
        event_key: 'checkout.save',
        required: true,
        kind: 'sequence',
      },
    ],
  };
}

function buildEnvelope({
  sessionId,
  traceId,
}: {
  sessionId: string;
  traceId: string;
}): TransmissionEnvelope {
  return {
    transmission_id: `tx_${traceId}`,
    sent_at: '2026-03-18T10:00:05.000Z',
    owner: {
      owner_type: 'workspace',
      owner_id: 'workspace_async_worker',
    },
    source: {
      service_name: 'checkout-api',
      sdk_name: 'qa-sdk-js',
      sdk_version: '0.1.0',
    },
    runtime: {
      platform: 'node',
      app_version: process.version,
    },
    build: {
      env: 'dev',
      release_version: '2026.03.18',
    },
    records: [
      {
        log_id: `log_form_${traceId}`,
        timestamp: '2026-03-18T10:00:01.000Z',
        record_kind: 'log',
        trace_id: traceId,
        span_id: 'span_form',
        event_key: 'checkout.form.updated',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { field: 'email' },
        qa_session_id: sessionId,
      },
      {
        log_id: `log_save_${traceId}`,
        timestamp: '2026-03-18T10:00:02.000Z',
        record_kind: 'span',
        trace_id: traceId,
        span_id: 'span_save',
        parent_span_id: 'span_form',
        event_key: 'checkout.save',
        event_version: '001',
        span_name: 'persist_order',
        start_time: '2026-03-18T10:00:01.500Z',
        end_time: '2026-03-18T10:00:02.000Z',
        status_code: 'ok',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: { orderId: 'order_1' },
        qa_session_id: sessionId,
      },
    ],
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createTestHarness(
  overrides: {
    dlqStore?: InMemoryDlqStore;
    graphStore?: GraphStore;
    recordStore?: InMemoryRecordStore;
    scenarioSpecStore?: InMemoryScenarioSpecStore;
    sessionStore?: InMemorySessionStore;
    taskQueue?: TaskQueue<TaskPayload>;
    traceStore?: InMemoryTraceStore;
    transmissionStore?: InMemoryTransmissionStore;
    verdictStore?: VerdictStore;
  } = {},
) {
  const dlqStore = overrides.dlqStore ?? new InMemoryDlqStore();
  const graphStore = overrides.graphStore ?? new InMemoryGraphStore();
  const recordStore = overrides.recordStore ?? new InMemoryRecordStore();
  const scenarioSpecStore = overrides.scenarioSpecStore ?? new InMemoryScenarioSpecStore();
  const sessionStore = overrides.sessionStore ?? new InMemorySessionStore();
  const traceStore = overrides.traceStore ?? new InMemoryTraceStore();
  const transmissionStore = overrides.transmissionStore ?? new InMemoryTransmissionStore();
  const verdictStore = overrides.verdictStore ?? new InMemoryVerdictStore();

  const app = createApp({
    dlqStore,
    graphStore,
    logger: createSilentLogger(),
    recordStore,
    recordStreamBroker: new RecordStreamBroker(),
    scenarioSpecStore,
    sessionStore,
    taskQueue: overrides.taskQueue,
    traceStore,
    transmissionStore,
    verdictStore,
  });

  return {
    app,
    dlqStore,
    graphStore,
    recordStore,
    scenarioSpecStore,
    sessionStore,
    traceStore,
    verdictStore,
  };
}

async function seedScenarioContext(
  harness: ReturnType<typeof createTestHarness>,
  {
    scenarioId,
    sessionId,
  }: {
    scenarioId: string;
    sessionId: string;
  },
) {
  await harness.scenarioSpecStore.upsert(buildScenarioSpec(scenarioId));
  await harness.sessionStore.upsert({
    sessionId,
    scenarioId,
  });
}

async function postIngest(app: ReturnType<typeof createApp>, envelope: TransmissionEnvelope) {
  return app.request('/v1/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
}

async function measureIngestMs(app: ReturnType<typeof createApp>, envelope: TransmissionEnvelope) {
  const startedAt = performance.now();
  const response = await postIngest(app, envelope);
  const durationMs = performance.now() - startedAt;

  expect(response.status).toBe(202);

  return durationMs;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('async worker acceptance', () => {
  it('returns 202 before phase two completes, then exposes verdicts after the worker finishes', async () => {
    const taskQueue = new InMemoryTaskQueue<TaskPayload>();
    const harness = createTestHarness({ taskQueue });
    const traceId = 'trace_async_acceptance';
    const sessionId = 'session_async_acceptance';
    const scenarioId = 'scenario_async_acceptance';

    try {
      await seedScenarioContext(harness, { scenarioId, sessionId });

      const ingestResponse = await postIngest(harness.app, buildEnvelope({ traceId, sessionId }));

      expect(ingestResponse.status).toBe(202);

      const verdictsBeforeWorker = await harness.app.request(`/v1/traces/${traceId}/verdicts`);
      expect(verdictsBeforeWorker.status).toBe(200);
      await expect(verdictsBeforeWorker.json()).resolves.toEqual({ items: [] });

      await registerTaskQueueWorker(taskQueue, {
        dlqStore: harness.dlqStore,
        graphStore: harness.graphStore,
        logger: createSilentLogger(),
        recordStore: harness.recordStore,
        scenarioSpecStore: harness.scenarioSpecStore,
        sessionStore: harness.sessionStore,
        traceStore: harness.traceStore,
        verdictStore: harness.verdictStore,
      });
      await taskQueue.close();

      const verdictsAfterWorker = await harness.app.request(`/v1/traces/${traceId}/verdicts`);
      expect(verdictsAfterWorker.status).toBe(200);
      await expect(verdictsAfterWorker.json()).resolves.toEqual({
        items: [
          expect.objectContaining({
            overallVerdict: 'pass',
            scenarioId,
          }),
        ],
      });
    } finally {
      await taskQueue.close();
    }
  });

  it('logs before/after ingest timings and shows the async queue path is faster than inline phase two', async () => {
    const phaseTwoDelayMs = 80;

    const syncHarness = createTestHarness();
    await seedScenarioContext(syncHarness, {
      scenarioId: 'scenario_sync_latency',
      sessionId: 'session_sync_latency',
    });

    const syncGraphUpsert = syncHarness.graphStore.upsert.bind(syncHarness.graphStore);
    vi.spyOn(syncHarness.graphStore, 'upsert').mockImplementation(async (...args) => {
      await delay(phaseTwoDelayMs);
      return syncGraphUpsert(...args);
    });

    const syncVerdictInsert = syncHarness.verdictStore.insert.bind(syncHarness.verdictStore);
    vi.spyOn(syncHarness.verdictStore, 'insert').mockImplementation(async (...args) => {
      await delay(phaseTwoDelayMs);
      return syncVerdictInsert(...args);
    });

    const asyncTaskQueue = new InMemoryTaskQueue<TaskPayload>();
    const asyncHarness = createTestHarness({ taskQueue: asyncTaskQueue });
    await seedScenarioContext(asyncHarness, {
      scenarioId: 'scenario_async_latency',
      sessionId: 'session_async_latency',
    });

    const asyncGraphUpsert = asyncHarness.graphStore.upsert.bind(asyncHarness.graphStore);
    vi.spyOn(asyncHarness.graphStore, 'upsert').mockImplementation(async (...args) => {
      await delay(phaseTwoDelayMs);
      return asyncGraphUpsert(...args);
    });

    const asyncVerdictInsert = asyncHarness.verdictStore.insert.bind(asyncHarness.verdictStore);
    vi.spyOn(asyncHarness.verdictStore, 'insert').mockImplementation(async (...args) => {
      await delay(phaseTwoDelayMs);
      return asyncVerdictInsert(...args);
    });

    try {
      const syncDurationMs = await measureIngestMs(
        syncHarness.app,
        buildEnvelope({
          traceId: 'trace_sync_latency',
          sessionId: 'session_sync_latency',
        }),
      );
      const asyncDurationMs = await measureIngestMs(
        asyncHarness.app,
        buildEnvelope({
          traceId: 'trace_async_latency',
          sessionId: 'session_async_latency',
        }),
      );

      console.info(
        `[US-006] ingest latency before=${syncDurationMs.toFixed(1)}ms after=${asyncDurationMs.toFixed(1)}ms`,
      );

      expect(syncDurationMs).toBeGreaterThanOrEqual(phaseTwoDelayMs * 1.75);
      expect(syncDurationMs - asyncDurationMs).toBeGreaterThan(phaseTwoDelayMs);
    } finally {
      await asyncTaskQueue.close();
    }
  });

  it('keeps DLQ retry working after a worker final failure', async () => {
    const dlqRecorded = createDeferred<void>();
    const graphStore = new InMemoryGraphStore();
    const dlqStore = new InMemoryDlqStore();
    const recordStore = new InMemoryRecordStore();
    const scenarioSpecStore = new InMemoryScenarioSpecStore();
    const sessionStore = new InMemorySessionStore();
    const traceId = 'trace_async_dlq';
    const traceStore = new InMemoryTraceStore();
    const sessionId = 'session_async_dlq';
    const scenarioId = 'scenario_async_dlq';
    const transmissionStore = new InMemoryTransmissionStore();
    const verdictStore = new InMemoryVerdictStore();
    let shouldFail = true;

    const graphUpsert = graphStore.upsert.bind(graphStore);
    vi.spyOn(graphStore, 'upsert').mockImplementation(async (...args) => {
      if (args[0] === traceId && shouldFail) {
        throw new Error('reconstruction boom');
      }

      return graphUpsert(...args);
    });

    const taskQueue = new BullMQTaskQueue<TaskPayload>({
      bullmq: createFakeBullMQ<TaskPayload>(),
      logger: createSilentLogger(),
      onFinalFailure: async (task, error) => {
        await dlqStore.insert({
          id: newDlqId(),
          traceId: task.traceId,
          phase: task.phase,
          errorMessage: error.message,
        });
        dlqRecorded.resolve();
      },
      queueName: 'ingest-phase-two',
      redisUrl: 'redis://localhost:6379/0',
    });
    const harness = createTestHarness({
      dlqStore,
      graphStore,
      recordStore,
      scenarioSpecStore,
      sessionStore,
      taskQueue,
      traceStore,
      transmissionStore,
      verdictStore,
    });

    try {
      await seedScenarioContext(harness, { scenarioId, sessionId });

      await registerTaskQueueWorker(taskQueue, {
        dlqStore,
        graphStore,
        logger: createSilentLogger(),
        recordStore,
        scenarioSpecStore,
        sessionStore,
        traceStore,
        verdictStore,
      });

      const ingestResponse = await postIngest(harness.app, buildEnvelope({ traceId, sessionId }));

      expect(ingestResponse.status).toBe(202);
      await dlqRecorded.promise;

      const listedPendingResponse = await harness.app.request(
        '/v1/admin/dlq?status=pending&limit=10',
      );

      expect(listedPendingResponse.status).toBe(200);
      await expect(listedPendingResponse.json()).resolves.toEqual({
        items: [
          expect.objectContaining({
            attemptCount: 0,
            errorMessage: 'reconstruction boom',
            phase: 'reconstruction',
            traceId,
          }),
        ],
      });

      shouldFail = false;

      const retryResponse = await harness.app.request('/v1/admin/dlq/retry', {
        method: 'POST',
      });

      expect(retryResponse.status).toBe(200);
      await expect(retryResponse.json()).resolves.toEqual({
        total: 1,
        resolved: [expect.any(String)],
        failed: [],
        skipped: [],
      });

      const verdictsResponse = await harness.app.request(`/v1/traces/${traceId}/verdicts`);

      expect(verdictsResponse.status).toBe(200);
      await expect(verdictsResponse.json()).resolves.toEqual({
        items: [
          expect.objectContaining({
            overallVerdict: 'pass',
            scenarioId,
          }),
        ],
      });

      await expect(dlqStore.findPending()).resolves.toEqual([]);
    } finally {
      await taskQueue.close();
    }
  });
});

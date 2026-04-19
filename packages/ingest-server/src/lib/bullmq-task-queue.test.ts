// @def.boundary ingest-system
// @def.doc ingest-system

import type { TaskPayload } from "@qa-sdk/core";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import {
  BullMQTaskQueue,
  type BullMQModule,
} from "./bullmq-task-queue.js";

function buildTask(overrides: Partial<TaskPayload> = {}): TaskPayload {
  return {
    enqueuedAt: "2026-03-18T00:00:00.000Z",
    phase: "reconstruction",
    traceId: "trace_123",
    ...overrides,
  };
}

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
      type: "exponential";
    };
    jobId?: string;
  };
}

interface FakeBullMQState<T> {
  enqueuedJobs: FakeEnqueuedJob<T>[];
  queueClosed: boolean;
  queueReadyError?: Error;
  workerClosed: boolean;
  workerConcurrency?: number;
  workerReadyError?: Error;
}

function createFakeBullMQ<T>(
  state: FakeBullMQState<T>,
): BullMQModule {
  const pendingJobs: FakeEnqueuedJob<T>[] = [];
  let activeWorker: FakeWorker<T> | null = null;

  class FakeQueue {
    async add(
      name: string,
      data: T,
      opts?: FakeEnqueuedJob<T>["opts"],
    ) {
      const job = {
        data: structuredClone(data),
        name,
        opts,
      };

      state.enqueuedJobs.push(job);
      pendingJobs.push(job);
      activeWorker?.drain();
    }

    async close() {
      state.queueClosed = true;
    }

    async waitUntilReady() {
      if (state.queueReadyError) {
        throw state.queueReadyError;
      }
    }
  }

  class FakeWorker<TJob> {
    private errorListener: ((error: Error) => void) | null = null;
    private failedListener:
      | ((job: { data: TJob; attemptsMade?: number; opts?: FakeEnqueuedJob<TJob>["opts"] }, error: Error) => void)
      | null = null;

    constructor(
      _name: string,
      private readonly processor: (
        job: {
          data: TJob;
          attemptsMade?: number;
          opts?: FakeEnqueuedJob<TJob>["opts"];
        },
      ) => Promise<unknown>,
      options: {
        concurrency: number;
        connection: unknown;
      },
    ) {
      state.workerConcurrency = options.concurrency;
      activeWorker = this as unknown as FakeWorker<T>;
      this.drain();
    }

    drain() {
      for (const job of pendingJobs.splice(0)) {
        void this.run(job as unknown as FakeEnqueuedJob<TJob>);
      }
    }

    on(
      event: "error" | "failed",
      listener:
        | ((error: Error) => void)
        | ((job: { data: TJob; attemptsMade?: number; opts?: FakeEnqueuedJob<TJob>["opts"] } | undefined, error: Error) => void),
    ) {
      if (event === "error") {
        this.errorListener = listener as (error: Error) => void;
        return this;
      }

      this.failedListener = listener as (
        job: {
          data: TJob;
          attemptsMade?: number;
          opts?: FakeEnqueuedJob<TJob>["opts"];
        } | undefined,
        error: Error,
      ) => void;
      return this;
    }

    async close() {
      state.workerClosed = true;

      if ((activeWorker as unknown) === this) {
        activeWorker = null;
      }
    }

    async waitUntilReady() {
      if (state.workerReadyError) {
        this.errorListener?.(state.workerReadyError);
        throw state.workerReadyError;
      }
    }

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
          const normalized =
            error instanceof Error ? error : new Error(String(error));

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
    Queue: FakeQueue as unknown as BullMQModule["Queue"],
    Worker: FakeWorker as unknown as BullMQModule["Worker"],
  };
}

function createLoggerMock() {
  return {
    error: vi.fn(),
  } as unknown as Logger;
}

describe("BullMQTaskQueue", () => {
  it("enqueues jobs with phase-scoped dedupe and BullMQ retry options", async () => {
    const state: FakeBullMQState<TaskPayload> = {
      enqueuedJobs: [],
      queueClosed: false,
      workerClosed: false,
    };
    const handled = createDeferred<TaskPayload>();
    const queue = new BullMQTaskQueue<TaskPayload>({
      bullmq: createFakeBullMQ(state),
      queueName: "ingest-tasks",
      redisUrl: "redis://localhost:6379/0",
      workerConcurrency: 7,
    });

    await queue.process(async (task) => {
      handled.resolve(task);
    });

    await queue.enqueue(buildTask(), {
      retryAttempts: 2,
      retryDelayMs: 250,
    });

    await expect(handled.promise).resolves.toEqual(buildTask());
    expect(state.enqueuedJobs).toHaveLength(1);
    expect(state.enqueuedJobs[0]?.opts).toEqual({
      attempts: 3,
      backoff: {
        delay: 250,
        type: "exponential",
      },
      jobId: "reconstruction:trace_123",
    });
    expect(state.workerConcurrency).toBe(7);
  });

  it("drains jobs enqueued before process registration", async () => {
    const state: FakeBullMQState<TaskPayload> = {
      enqueuedJobs: [],
      queueClosed: false,
      workerClosed: false,
    };
    const handled = createDeferred<TaskPayload>();
    const queue = new BullMQTaskQueue<TaskPayload>({
      bullmq: createFakeBullMQ(state),
      queueName: "ingest-tasks",
      redisUrl: "redis://localhost:6379/0",
    });

    await queue.enqueue(buildTask());
    await queue.process(async (task) => {
      handled.resolve(task);
    });

    await expect(handled.promise).resolves.toEqual(buildTask());
  });

  it("gracefully closes the queue and worker and rejects new jobs after close", async () => {
    const state: FakeBullMQState<TaskPayload> = {
      enqueuedJobs: [],
      queueClosed: false,
      workerClosed: false,
    };
    const queue = new BullMQTaskQueue<TaskPayload>({
      bullmq: createFakeBullMQ(state),
      queueName: "ingest-tasks",
      redisUrl: "redis://localhost:6379/0",
    });

    await queue.process(async () => {});
    await queue.close();

    expect(state.queueClosed).toBe(true);
    expect(state.workerClosed).toBe(true);
    await expect(queue.enqueue(buildTask())).rejects.toThrow("TaskQueue is closed");
  });

  it("logs and throws a clear error when Redis connection fails", async () => {
    const state: FakeBullMQState<TaskPayload> = {
      enqueuedJobs: [],
      queueClosed: false,
      queueReadyError: new Error("ECONNREFUSED"),
      workerClosed: false,
    };
    const logger = createLoggerMock();
    const queue = new BullMQTaskQueue<TaskPayload>({
      bullmq: createFakeBullMQ(state),
      logger,
      queueName: "ingest-tasks",
      redisUrl: "redis://default:secret@localhost:6379/0",
    });

    await expect(queue.enqueue(buildTask())).rejects.toThrow(
      'Failed to connect to Redis for BullMQ queue "ingest-tasks"',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        component: "queue",
        queueName: "ingest-tasks",
        redisUrl: "redis://default:***@localhost:6379/0",
      }),
      "failed to connect to Redis for BullMQ",
    );
  });

  it("calls the final failure hook once after retries are exhausted", async () => {
    const state: FakeBullMQState<TaskPayload> = {
      enqueuedJobs: [],
      queueClosed: false,
      workerClosed: false,
    };
    const failed = createDeferred<{
      error: Error;
      task: TaskPayload;
    }>();
    const logger = createLoggerMock();
    const queue = new BullMQTaskQueue<TaskPayload>({
      bullmq: createFakeBullMQ(state),
      logger,
      onFinalFailure: (task, error) => {
        failed.resolve({ error, task });
      },
      queueName: "ingest-tasks",
      redisUrl: "redis://localhost:6379/0",
    });

    await queue.process(async () => {
      throw new Error("boom");
    });

    await queue.enqueue(buildTask({ phase: "verdict" }), {
      retryAttempts: 2,
    });

    await expect(failed.promise).resolves.toEqual({
      error: expect.any(Error),
      task: buildTask({ phase: "verdict" }),
    });
  });
});

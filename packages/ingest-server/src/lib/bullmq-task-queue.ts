// @def.boundary ingest-system
// @def.doc ingest-system

import type { TaskHandler, TaskPayload, TaskQueue, TaskQueueOptions } from '@qa-sdk/core';
import type { Logger } from 'pino';
import { createLogger } from './logger.js';

const DEFAULT_JOB_NAME = 'task';
export const DEFAULT_WORKER_CONCURRENCY = 5;

interface BullConnectionOptions {
  db?: number;
  host: string;
  password?: string;
  port: number;
  tls?: Record<string, never>;
  username?: string;
}

interface BullQueueJobOptions {
  attempts?: number;
  backoff?: {
    delay: number;
    type: 'exponential';
  };
  jobId?: string;
}

interface BullJob<T> {
  data: T;
  attemptsMade?: number;
  opts?: BullQueueJobOptions;
}

interface BullQueue<T> {
  add(name: string, data: T, opts?: BullQueueJobOptions): Promise<unknown>;
  close(): Promise<void>;
  waitUntilReady?(): Promise<unknown>;
}

interface BullWorker<T> {
  close(force?: boolean): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'failed', listener: (job: BullJob<T> | undefined, error: Error) => void): this;
  waitUntilReady?(): Promise<unknown>;
}

interface BullQueueConstructor {
  new <T>(
    name: string,
    opts: {
      connection: BullConnectionOptions;
    },
  ): BullQueue<T>;
}

interface BullWorkerConstructor {
  new <T>(
    name: string,
    processor: (job: BullJob<T>) => Promise<unknown>,
    opts: {
      concurrency: number;
      connection: BullConnectionOptions;
    },
  ): BullWorker<T>;
}

export interface BullMQModule {
  Queue: BullQueueConstructor;
  Worker: BullWorkerConstructor;
}

export interface BullMQTaskQueueConfig<T extends TaskPayload = TaskPayload> {
  bullmq?: BullMQModule;
  jobName?: string;
  logger?: Logger;
  onFinalFailure?: (task: T, error: Error) => Promise<void> | void;
  queueName: string;
  redisUrl: string;
  workerConcurrency?: number;
}

export class BullMQTaskQueue<T extends TaskPayload = TaskPayload> implements TaskQueue<T> {
  private readonly bullmqModule: BullMQModule | undefined;
  private readonly connection: BullConnectionOptions;
  private readonly jobName: string;
  private readonly logger: Logger;
  private readonly onFinalFailure: ((task: T, error: Error) => Promise<void> | void) | undefined;
  private readonly queueName: string;
  private readonly redisUrl: string;
  private readonly workerConcurrency: number;

  private closed = false;
  private queuePromise: Promise<BullQueue<T>> | null = null;
  private worker: BullWorker<T> | null = null;

  constructor(config: BullMQTaskQueueConfig<T>) {
    if (config.queueName.trim().length === 0) {
      throw new Error('queueName is required for BullMQTaskQueue');
    }

    if (config.redisUrl.trim().length === 0) {
      throw new Error('REDIS_URL is required for BullMQTaskQueue');
    }

    this.logger = config.logger ?? createLogger('bullmq-task-queue');
    this.queueName = config.queueName;
    this.redisUrl = config.redisUrl;
    this.onFinalFailure = config.onFinalFailure;
    this.connection = parseRedisConnection(config.redisUrl);
    this.workerConcurrency = parseWorkerConcurrency(config.workerConcurrency);
    this.jobName = config.jobName ?? DEFAULT_JOB_NAME;
    this.bullmqModule = config.bullmq;
  }

  async enqueue(task: T, opts?: TaskQueueOptions): Promise<void> {
    this.assertOpen();

    const queue = await this.getQueue();

    await queue.add(this.jobName, structuredClone(task), {
      attempts: toBullAttempts(opts?.retryAttempts),
      backoff: toBullBackoff(opts?.retryDelayMs),
      jobId: buildJobId(task),
    });
  }

  async process(handler: TaskHandler<T>): Promise<void> {
    this.assertOpen();

    if (this.worker) {
      throw new Error('BullMQ worker is already registered');
    }

    await this.getQueue();

    const bullmq = await this.getBullMQModule();
    const worker = new bullmq.Worker<T>(
      this.queueName,
      async (job) => {
        await handler(structuredClone(job.data));
      },
      {
        concurrency: this.workerConcurrency,
        connection: this.connection,
      },
    );

    worker.on('error', (error) => {
      this.logger.error(
        {
          err: error,
          queueName: this.queueName,
          redisUrl: redactRedisUrl(this.redisUrl),
        },
        'BullMQ worker error',
      );
    });

    worker.on('failed', (job, error) => {
      if (!job || !isFinalFailure(job) || !this.onFinalFailure) {
        return;
      }

      void Promise.resolve(this.onFinalFailure(structuredClone(job.data), error)).catch(
        (callbackError) => {
          this.logger.error(
            {
              err: callbackError,
              queueName: this.queueName,
              redisUrl: redactRedisUrl(this.redisUrl),
            },
            'BullMQ final failure hook failed',
          );
        },
      );
    });

    try {
      await worker.waitUntilReady?.();
    } catch (error) {
      await safeClose(worker);
      throw this.createRedisConnectionError('worker', error);
    }

    this.worker = worker;
  }

  async close(): Promise<void> {
    this.closed = true;

    const worker = this.worker;
    this.worker = null;

    const closeResults = await Promise.allSettled([
      worker ? worker.close() : Promise.resolve(),
      this.queuePromise
        ? this.queuePromise.then((queue) => queue.close()).catch(() => undefined)
        : Promise.resolve(),
    ]);

    const rejected = closeResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (rejected) {
      throw rejected.reason;
    }
  }

  private assertOpen() {
    if (this.closed) {
      throw new Error('TaskQueue is closed');
    }
  }

  private createRedisConnectionError(component: 'queue' | 'worker', error: unknown) {
    const wrapped = new Error(
      `Failed to connect to Redis for BullMQ ${component} "${this.queueName}" using ${redactRedisUrl(
        this.redisUrl,
      )}. Check REDIS_URL and Redis availability.`,
      {
        cause: error instanceof Error ? error : undefined,
      },
    );

    this.logger.error(
      {
        component,
        err: error,
        queueName: this.queueName,
        redisUrl: redactRedisUrl(this.redisUrl),
      },
      'failed to connect to Redis for BullMQ',
    );

    return wrapped;
  }

  private async createQueue(): Promise<BullQueue<T>> {
    const bullmq = await this.getBullMQModule();
    const queue = new bullmq.Queue<T>(this.queueName, {
      connection: this.connection,
    });

    try {
      await queue.waitUntilReady?.();
      return queue;
    } catch (error) {
      await safeClose(queue);
      throw this.createRedisConnectionError('queue', error);
    }
  }

  private async getBullMQModule(): Promise<BullMQModule> {
    if (this.bullmqModule) {
      return this.bullmqModule;
    }

    return (await importBullMQRuntime()) as BullMQModule;
  }

  private getQueue() {
    if (!this.queuePromise) {
      this.queuePromise = this.createQueue();
    }

    return this.queuePromise;
  }
}

function buildJobId(task: TaskPayload): string {
  return `${task.phase}:${task.traceId}`;
}

function isFinalFailure(job: BullJob<unknown>): boolean {
  const attempts = job.opts?.attempts;
  if (attempts === undefined) {
    return true;
  }

  const attemptsMade = job.attemptsMade ?? attempts;
  return attemptsMade >= attempts;
}

function parseRedisConnection(redisUrl: string): BullConnectionOptions {
  let parsed: URL;

  try {
    parsed = new URL(redisUrl);
  } catch (error) {
    throw new Error(`REDIS_URL must be a valid URL: ${redisUrl}`, {
      cause: error,
    });
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(`REDIS_URL must use redis:// or rediss://, received ${parsed.protocol}`);
  }

  const dbSegment = parsed.pathname.replace(/^\/+/, '');
  const db = dbSegment.length > 0 ? Number.parseInt(dbSegment, 10) : undefined;

  if (dbSegment.length > 0 && (!Number.isInteger(db) || db === undefined || db < 0)) {
    throw new Error(
      `REDIS_URL database index must be a non-negative integer, received "${dbSegment}"`,
    );
  }

  return {
    db,
    host: parsed.hostname,
    password: parsed.password || undefined,
    port:
      parsed.port.length > 0
        ? Number.parseInt(parsed.port, 10)
        : parsed.protocol === 'rediss:'
          ? 6380
          : 6379,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    username: parsed.username || undefined,
  };
}

function parseWorkerConcurrency(workerConcurrency: number | undefined) {
  const concurrency = workerConcurrency ?? DEFAULT_WORKER_CONCURRENCY;

  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error(`WORKER_CONCURRENCY must be a positive integer, received ${concurrency}`);
  }

  return concurrency;
}

function toBullAttempts(retryAttempts: number | undefined) {
  const retries = retryAttempts ?? 0;
  return retries + 1;
}

function toBullBackoff(retryDelayMs: number | undefined) {
  if (retryDelayMs === undefined || retryDelayMs <= 0) {
    return undefined;
  }

  return {
    delay: retryDelayMs,
    type: 'exponential' as const,
  };
}

function redactRedisUrl(redisUrl: string) {
  try {
    const parsed = new URL(redisUrl);

    if (parsed.password) {
      parsed.password = '***';
    }

    return parsed.toString();
  } catch {
    return redisUrl;
  }
}

async function safeClose(resource: { close: () => Promise<void> }) {
  await resource.close().catch(() => undefined);
}

async function importBullMQRuntime() {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string,
  ) => Promise<unknown>;

  return dynamicImport('bullmq');
}

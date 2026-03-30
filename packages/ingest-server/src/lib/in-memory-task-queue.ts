import type {
  TaskHandler,
  TaskPayload,
  TaskQueue,
  TaskQueueOptions,
} from "@qa-sdk/core";

interface PendingTask<T> {
  task: T;
  opts?: TaskQueueOptions;
}

/** 테스트용 즉시 실행 TaskQueue 구현 */
export class InMemoryTaskQueue<T extends TaskPayload = TaskPayload>
  implements TaskQueue<T>
{
  private activeHandlerDepth = 0;
  private handler: TaskHandler<T> | null = null;
  private closed = false;
  private readonly pending: PendingTask<T>[] = [];
  private executionChain: Promise<void> = Promise.resolve();

  async enqueue(task: T, opts?: TaskQueueOptions): Promise<void> {
    if (this.closed) {
      throw new Error("TaskQueue is closed");
    }

    const pendingTask: PendingTask<T> = {
      task: structuredClone(task),
      opts: opts ? { ...opts } : undefined,
    };

    if (!this.handler) {
      this.pending.push(pendingTask);
      return;
    }

    if (this.activeHandlerDepth > 0) {
      void this.schedule(pendingTask);
      return;
    }

    return this.schedule(pendingTask);
  }

  async process(handler: TaskHandler<T>): Promise<void> {
    if (this.closed) {
      throw new Error("TaskQueue is closed");
    }

    this.handler = handler;

    while (this.pending.length > 0) {
      const pendingTask = this.pending.shift();

      if (!pendingTask) {
        continue;
      }

      await this.schedule(pendingTask);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.pending.length = 0;

    await this.executionChain;
  }

  private schedule(pendingTask: PendingTask<T>): Promise<void> {
    const next = this.executionChain.then(async () => {
      const handler = this.handler;

      if (!handler) {
        this.pending.push(pendingTask);
        return undefined;
      }

      await this.runWithRetry(handler, pendingTask);
      return undefined;
    });

    this.executionChain = next.catch(() => undefined);

    return next;
  }

  private async runWithRetry(
    handler: TaskHandler<T>,
    pendingTask: PendingTask<T>,
  ): Promise<void> {
    const retryAttempts = pendingTask.opts?.retryAttempts ?? 0;
    const retryDelayMs = pendingTask.opts?.retryDelayMs ?? 0;

    let attempt = 0;

    while (true) {
      let completed = false;

      try {
        this.activeHandlerDepth += 1;
        await handler(structuredClone(pendingTask.task));
        completed = true;
      } catch (error) {
        if (attempt >= retryAttempts) {
          throw error;
        }

        attempt += 1;

        if (retryDelayMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, retryDelayMs);
          });
        }
      } finally {
        if (this.activeHandlerDepth > 0) {
          this.activeHandlerDepth -= 1;
        }
      }

      if (completed) {
        return;
      }
    }
  }
}

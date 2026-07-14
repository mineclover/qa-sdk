// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

export type TaskPhase = 'reconstruction' | 'verdict';

export interface TaskPayload {
  traceId: string;
  phase: TaskPhase;
  enqueuedAt: string;
}

export interface TaskQueueOptions {
  concurrency?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export type TaskHandler<T> = (task: T) => Promise<void>;

/**
 * Point-to-point task dispatch contract.
 * Fan-out and subscribe semantics are intentionally reserved for a separate EventBus port.
 */
export interface TaskQueue<T extends TaskPayload = TaskPayload> {
  enqueue(task: T, opts?: TaskQueueOptions): Promise<void>;
  process(handler: TaskHandler<T>): Promise<void>;
  close(): Promise<void>;
}

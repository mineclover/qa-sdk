import type { StoredRecord } from "@qa-sdk/core";

type RecordListener = (record: StoredRecord) => void | Promise<void>;
type SubscriberMap = Map<string, Set<RecordListener>>;

export class RecordStreamBrokerShutdownError extends Error {
  constructor() {
    super("record stream broker is shutting down");
    this.name = "RecordStreamBrokerShutdownError";
  }
}

export class RecordStreamBroker {
  private readonly traceSubscribers = new Map<string, Set<RecordListener>>();
  private readonly sessionSubscribers = new Map<string, Set<RecordListener>>();
  private shuttingDown = false;

  subscribeToTrace(traceId: string, listener: RecordListener): () => void {
    return this.subscribe(this.traceSubscribers, traceId, listener);
  }

  subscribeToSession(sessionId: string, listener: RecordListener): () => void {
    return this.subscribe(this.sessionSubscribers, sessionId, listener);
  }

  publish(record: StoredRecord): void {
    if (this.shuttingDown) {
      return;
    }

    this.publishToSubscribers(this.traceSubscribers, record.traceId, record);

    if (record.qaSessionId) {
      this.publishToSubscribers(
        this.sessionSubscribers,
        record.qaSessionId,
        record,
      );
    }
  }

  getTraceSubscriberCount(traceId: string): number {
    return this.traceSubscribers.get(traceId)?.size ?? 0;
  }

  getSessionSubscriberCount(sessionId: string): number {
    return this.sessionSubscribers.get(sessionId)?.size ?? 0;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  shutdown(): void {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.traceSubscribers.clear();
    this.sessionSubscribers.clear();
  }

  private subscribe(
    subscribers: SubscriberMap,
    key: string,
    listener: RecordListener,
  ): () => void {
    if (this.shuttingDown) {
      throw new RecordStreamBrokerShutdownError();
    }

    const listeners = subscribers.get(key) ?? new Set<RecordListener>();

    listeners.add(listener);
    subscribers.set(key, listeners);

    return () => {
      const currentListeners = subscribers.get(key);

      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);

      if (currentListeners.size === 0) {
        subscribers.delete(key);
      }
    };
  }

  private publishToSubscribers(
    subscribers: SubscriberMap,
    key: string,
    record: StoredRecord,
  ) {
    const listeners = subscribers.get(key);

    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of Array.from(listeners)) {
      const snapshot = structuredClone(record);

      try {
        const result = listener(snapshot);
        void Promise.resolve(result).catch(() => {});
      } catch {}
    }
  }
}

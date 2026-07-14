// @def.boundary gate-system
// @def.doc gate-system

// @facet
/**
 * InMemory EventBus 어댑터.
 *
 * 단일 프로세스 내에서 동기적 fan-out을 수행한다.
 * 구독자 핸들러가 Promise를 반환하면 fire-and-forget으로 처리한다.
 * 개별 핸들러 에러는 격리되어 다른 핸들러에 전파되지 않는다.
 */

import type { EventBus, EventHandler, GateEvent, GateEventType } from '../ports/event-bus.port.js';

export interface MemoryEventBusOptions {
  /** 핸들러 에러 시 호출되는 콜백. 미설정 시 에러를 삼킨다 (fail-open). */
  onError?: (error: unknown, event: GateEvent) => void;
}

export class MemoryEventBus implements EventBus {
  private readonly handlers = new Map<GateEventType, Set<EventHandler<any>>>();
  private readonly onError: ((error: unknown, event: GateEvent) => void) | undefined;
  private closed = false;

  constructor(opts?: MemoryEventBusOptions) {
    this.onError = opts?.onError;
  }

  publish(event: GateEvent): void {
    if (this.closed) return;

    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        const result = handler(event);
        // async 핸들러 — fire-and-forget + 에러 격리
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            this.onError?.(err, event);
          });
        }
      } catch (err) {
        // sync 핸들러 에러 격리
        this.onError?.(err, event);
      }
    }
  }

  subscribe<T extends GateEventType>(
    type: T,
    handler: EventHandler<Extract<GateEvent, { type: T }>>,
  ): () => void {
    if (this.closed) {
      return () => {};
    }

    let handlers = this.handlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(type, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  close(): void {
    this.closed = true;
    this.handlers.clear();
  }
}

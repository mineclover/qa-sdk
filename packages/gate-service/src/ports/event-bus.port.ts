// @facet
/**
 * EventBus 포트 — fan-out publish/subscribe 패턴.
 *
 * TaskQueue(point-to-point)와 구별되는 1:N 이벤트 전파 계약.
 * gate-service 내부에서 release/flagChange 등의 이벤트를 발행하면
 * 여러 구독자가 동시에 수신하여 recompute/cache invalidation 등을 트리거한다.
 */

// ── 이벤트 타입 ──────────────────────────────────────────

/** entry flag 변경 이벤트 (inactive/open/active 전이) */
export interface FlagChangeEvent {
  readonly type: "flag-change";
  readonly prefix: string;
  readonly versionId: string;
  readonly position: number;
  /** 변경 후 상태 */
  readonly status: "active" | "inactive" | "open" | "reserved";
  readonly timestamp: string;
}

/** prefix version release 이벤트 */
export interface ReleaseEvent {
  readonly type: "release";
  readonly prefix: string;
  readonly versionId: string;
  readonly timestamp: string;
}

/** recompute 완료 이벤트 — 캐시 갱신 후 발행 */
export interface RecomputeCompleteEvent {
  readonly type: "recompute-complete";
  readonly prefix: string;
  readonly versionId: string;
  /** cascade에 의한 recompute인 경우 원본 prefix */
  readonly triggeredBy?: string;
  readonly timestamp: string;
}

export type GateEvent = FlagChangeEvent | ReleaseEvent | RecomputeCompleteEvent;

export type GateEventType = GateEvent["type"];

// ── 구독자 타입 ──────────────────────────────────────────

export type EventHandler<T extends GateEvent = GateEvent> = (event: T) => void | Promise<void>;

// ── EventBus 포트 ────────────────────────────────────────

export interface EventBus {
  /**
   * 이벤트를 발행한다. 모든 구독자에게 fan-out 전달.
   * 구독자 핸들러의 에러는 다른 구독자에게 전파되지 않는다 (격리).
   */
  publish(event: GateEvent): void;

  /**
   * 특정 이벤트 타입에 대한 구독을 등록한다.
   * @returns 구독 해제 함수
   */
  subscribe<T extends GateEventType>(
    type: T,
    handler: EventHandler<Extract<GateEvent, { type: T }>>,
  ): () => void;

  /**
   * 모든 구독을 해제하고 리소스를 정리한다.
   */
  close(): void;
}

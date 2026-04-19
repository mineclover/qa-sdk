// @def.boundary gate-system
// @def.doc gate-system

/**
 * CacheInvalidation 서비스 — E-3.
 *
 * gate 상태 변경 이벤트를 구독하여:
 * 1. flag-change → recompute 트리거 (EventBus에 recompute-complete 발행)
 * 2. release → recompute 트리거
 * 3. recompute-complete → 외부 서비스 통지 (broadcast)
 *
 * fail-open: 브로드캐스트 실패가 recompute 자체를 차단하지 않는다.
 */

import type { EventBus, RecomputeCompleteEvent } from "../ports/event-bus.port.js";
import type { GateLookupService } from "../lib/gate-service.js";

/** 외부 서비스 통지 대상 */
export interface BroadcastTarget {
  readonly name: string;
  readonly endpoint: string;
}

export interface CacheInvalidationDeps {
  eventBus: EventBus;
  gateService: GateLookupService;
  /** 외부 broadcast 대상 목록 */
  targets?: readonly BroadcastTarget[];
  /** broadcast HTTP 호출 (테스트에서 mock 가능) */
  fetch?: typeof globalThis.fetch;
  /** 에러 로그 콜백 */
  onError?: (error: unknown, context: string) => void;
}

export interface CacheInvalidationService {
  /** 현재 대기 중인 broadcast 수 (테스트용) */
  readonly pendingBroadcasts: number;
  /** 완료된 broadcast 수 */
  readonly completedBroadcasts: number;
  /** 구독 해제 및 리소스 정리 */
  close(): void;
}

export function createCacheInvalidation(
  deps: CacheInvalidationDeps,
): CacheInvalidationService {
  const { eventBus, gateService, onError } = deps;
  const targets = deps.targets ?? [];
  const fetchFn = deps.fetch ?? globalThis.fetch;
  const unsubscribes: (() => void)[] = [];

  let pendingBroadcasts = 0;
  let completedBroadcasts = 0;

  // ── flag-change → recompute 트리거 ───────────────────
  unsubscribes.push(
    eventBus.subscribe("flag-change", async (event) => {
      try {
        await gateService.cascadeRecompute(event.prefix, event.versionId);
        eventBus.publish({
          type: "recompute-complete",
          prefix: event.prefix,
          versionId: event.versionId,
          triggeredBy: `flag-change:${event.position}`,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        // fail-open: recompute 실패가 서비스를 중단시키지 않는다
        onError?.(err, `recompute after flag-change: ${event.prefix}/${event.versionId}`);
      }
    }),
  );

  // ── release → recompute 트리거 ───────────────────────
  unsubscribes.push(
    eventBus.subscribe("release", async (event) => {
      try {
        await gateService.cascadeRecompute(event.prefix, event.versionId);
        eventBus.publish({
          type: "recompute-complete",
          prefix: event.prefix,
          versionId: event.versionId,
          triggeredBy: "release",
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        onError?.(err, `recompute after release: ${event.prefix}/${event.versionId}`);
      }
    }),
  );

  // ── recompute-complete → 외부 서비스 broadcast ───────
  unsubscribes.push(
    eventBus.subscribe("recompute-complete", async (event) => {
      if (targets.length === 0) return;

      pendingBroadcasts++;
      try {
        await broadcastToTargets(event, targets, fetchFn, onError);
        completedBroadcasts++;
      } finally {
        pendingBroadcasts--;
      }
    }),
  );

  return {
    get pendingBroadcasts() {
      return pendingBroadcasts;
    },
    get completedBroadcasts() {
      return completedBroadcasts;
    },
    close() {
      for (const unsub of unsubscribes) unsub();
      unsubscribes.length = 0;
    },
  };
}

// ── 내부 함수 ────────────────────────────────────────────

async function broadcastToTargets(
  event: RecomputeCompleteEvent,
  targets: readonly BroadcastTarget[],
  fetchFn: typeof globalThis.fetch,
  onError?: (error: unknown, context: string) => void,
): Promise<void> {
  const payload = JSON.stringify({
    type: event.type,
    prefix: event.prefix,
    versionId: event.versionId,
    triggeredBy: event.triggeredBy,
    timestamp: event.timestamp,
  });

  // 병렬 전송, 개별 실패 격리
  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const res = await fetchFn(target.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        throw new Error(`broadcast to ${target.name} failed: ${res.status}`);
      }
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      onError?.(result.reason, "broadcast");
    }
  }
}

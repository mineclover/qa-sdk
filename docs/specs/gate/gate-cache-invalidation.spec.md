---
def:
  id: gate-cache-invalidation
  tier: layout
  scope: flow
  aspect: gate_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: gate-service
  links:
    - target: gate-event-bus
      type: depends_on
    - target: gate-cache-invalidation-test
      type: refs
contains:
  - gate-cache-invalidation-test
sources:
  - packages/gate-service/src/services/cache-invalidation.ts
  - packages/gate-service/src/services/cache-invalidation.test.ts
  - packages/gate-service/src/ports/event-bus.port.ts
  - packages/gate-service/src/lib/gate-service.ts
---
# CacheInvalidation 서비스

## 목적 ^purpose

gate 상태 변경 이벤트를 구독하여 캐시 무효화를 자동 수행한다.
flag-change/release 이벤트 → cascadeRecompute 트리거 + recompute-complete 발행,
recompute-complete 이벤트 → 외부 서비스(query-service, decode-service 등)에 HTTP broadcast.
broadcast 실패가 recompute 자체를 차단하지 않는다 (fail-open).

## ^defines

**함수**

- `createCacheInvalidation(deps: CacheInvalidationDeps): CacheInvalidationService`
  - EventBus에 3개 이벤트 구독을 등록하고 서비스 객체를 반환한다

**인터페이스**

- `CacheInvalidationService`
  - `pendingBroadcasts: number` — 현재 대기 중인 broadcast 수 (테스트용)
  - `completedBroadcasts: number` — 완료된 broadcast 수
  - `close(): void` — 구독 해제 및 리소스 정리

- `BroadcastTarget` — 외부 서비스 통지 대상
  - `name: string` — 서비스 식별자 (로그용)
  - `endpoint: string` — HTTP POST 엔드포인트

- `CacheInvalidationDeps`
  - `eventBus: EventBus`
  - `gateService: GateLookupService`
  - `targets?: readonly BroadcastTarget[]` — broadcast 대상 목록
  - `fetch?: typeof globalThis.fetch` — HTTP 호출 (테스트에서 mock 가능)
  - `onError?: (error: unknown, context: string) => void`

**이벤트 처리 흐름**

```
flag-change → cascadeRecompute(prefix, versionId)
              → publish(recompute-complete, triggeredBy: "flag-change:{position}")

release     → cascadeRecompute(prefix, versionId)
              → publish(recompute-complete, triggeredBy: "release")

recompute-complete → broadcastToTargets(event, targets, fetch)
                     → POST JSON to each target endpoint
                     → AbortSignal.timeout(5_000)
                     → Promise.allSettled (개별 실패 격리)
```

## ^consumes

- `packages/gate-service/src/services/cache-invalidation.ts` — createCacheInvalidation, BroadcastTarget
- `packages/gate-service/src/ports/event-bus.port.ts` — EventBus, RecomputeCompleteEvent
- `packages/gate-service/src/lib/gate-service.ts` — GateLookupService

## 설계 결정

- **fail-open**: cascadeRecompute 실패 → onError 콜백 호출, 서비스 중단 없음
- **fail-open broadcast**: 개별 대상 broadcast 실패가 다른 대상 전송을 차단하지 않는다 (Promise.allSettled)
- **timeout**: broadcast HTTP 호출에 AbortSignal.timeout(5_000) 적용
- **targets 미설정**: broadcast 대상이 없으면 HTTP 호출 없이 완료
- **triggeredBy 추적**: recompute-complete 이벤트에 원인을 기록하여 디버깅 지원

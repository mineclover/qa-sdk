---
def:
  id: gate-event-bus
  level: module
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: gate-service
  links:
    - target: gate-api
      type: refines
    - target: gate-event-bus-test
      type: contains
contains:
  - gate-event-bus-test
---
# EventBus 이벤트 전파 계약

## 목적 ^purpose

fan-out publish/subscribe 패턴으로 gate 상태 변경 이벤트를 1:N 전파하는 계약을 정의한다.
TaskQueue(point-to-point)와 구별되는 브로드캐스트 방식으로, release/flagChange 등의 이벤트를
여러 구독자가 동시에 수신하여 recompute/cache invalidation 등을 트리거한다.

## ^defines

**인터페이스**

- `EventBus` — fan-out publish/subscribe 포트
  - `publish(event: GateEvent): void` — 모든 구독자에게 fan-out 전달. 구독자 핸들러의 에러는 다른 구독자에게 전파되지 않는다 (격리)
  - `subscribe<T>(type: T, handler): () => void` — 특정 이벤트 타입에 대한 구독 등록, 구독 해제 함수 반환
  - `close(): void` — 모든 구독 해제 및 리소스 정리

**이벤트 3종 (GateEvent)**

| 이벤트 | 필드 | 발행 시점 |
|--------|------|----------|
| `FlagChangeEvent` | prefix, versionId, position, status, timestamp | entry flag 변경 (inactive/open/active 전이) |
| `ReleaseEvent` | prefix, versionId, timestamp | prefix version release |
| `RecomputeCompleteEvent` | prefix, versionId, triggeredBy?, timestamp | recompute 완료 후 캐시 갱신 |

- `GateEventType` — `GateEvent["type"]` 유니온: `"flag-change" | "release" | "recompute-complete"`
- `EventHandler<T>` — `(event: T) => void | Promise<void>` 핸들러 타입

**어댑터**

- `MemoryEventBus` — 단일 프로세스 내 동기적 fan-out 구현
  - `MemoryEventBusOptions.onError` — 핸들러 에러 시 콜백, 미설정 시 에러를 삼킨다 (fail-open)
  - sync 핸들러 에러: try-catch로 격리, 다른 핸들러 계속 실행
  - async 핸들러: fire-and-forget, Promise.catch로 에러 격리
  - `close()` 후 publish는 무시, subscribe는 no-op 반환

## ^consumes

- `packages/gate-service/src/ports/event-bus.port.ts` — EventBus 인터페이스, GateEvent 3종, EventHandler
- `packages/gate-service/src/adapters/memory-event-bus.ts` — MemoryEventBus 어댑터

## 설계 결정

- **에러 격리**: 개별 핸들러 에러가 다른 핸들러에 전파되지 않는다. sync/async 모두 격리
- **fire-and-forget**: async 핸들러의 Promise는 await하지 않는다. 에러만 catch
- **fail-open**: onError 미설정 시 에러를 삼킨다. 핸들러 에러가 publish 자체를 실패시키지 않는다
- **close 안전성**: close 후 모든 동작은 no-op. 에러를 발생시키지 않는다

---
def:
  id: gate-event-bus-test
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: gate-service
  links:
    - target: gate-event-bus
      type: verifies
source: packages/gate-service/src/adapters/memory-event-bus.test.ts
---

## 목적 ^purpose

`MemoryEventBus`의 fan-out 전달, 타입별 라우팅, 에러 격리, 생명주기(close) 동작을 검증한다.

소스: `packages/gate-service/src/adapters/memory-event-bus.test.ts`

## 사전조건 ^preconditions

- `MemoryEventBus` 인스턴스 생성
- 테스트용 이벤트 팩토리: `makeFlagChange()`, `makeRelease()`, `makeRecomputeComplete()`

## 기본 전달 ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| flag-change 구독 후 publish | 구독자가 이벤트를 수신한다 |
| 같은 타입에 2개 구독자 등록 후 publish | 두 구독자 모두 수신한다 (fan-out) |
| flag-change / release 각각 구독 후 양쪽 publish | 각 구독자는 자기 타입만 수신한다 |
| recompute-complete 이벤트 publish | triggeredBy 필드가 정확히 전달된다 |

## 구독 해제 ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| subscribe 반환값 호출 후 publish | 해제된 구독자는 수신하지 않는다 |

## 에러 격리 ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| sync 핸들러가 throw + 다른 핸들러 존재 | 첫 번째 에러에도 두 번째 핸들러가 실행된다. onError 콜백 호출 |
| async 핸들러가 reject | onError 콜백이 호출된다 (마이크로태스크 대기 후) |

## 생명주기 ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| close() 후 publish | 이벤트가 전달되지 않는다 |
| close() 후 subscribe | no-op unsubscribe 함수가 반환된다 (에러 없음) |
| 구독자 없는 이벤트 타입에 publish | 조용히 무시된다 (에러 없음) |

## 검증 항목 ^assertions

- 10 tests: 기본 전달(1), fan-out(1), 타입 라우팅(1), 구독 해제(1), close+publish(1), close+subscribe(1), sync 에러 격리(1), async 에러 격리(1), 구독자 없는 publish(1), recompute-complete 전달(1)

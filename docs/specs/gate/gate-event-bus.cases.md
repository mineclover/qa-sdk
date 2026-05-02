---
def:
  id: gate-event-bus-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: gate-service
  tags: [scenario, gate, event-bus]
  links:
    - target: gate-event-bus
      type: refines
    - target: gate-system
      type: depends_on
---

# Gate Event Bus — 소비자 기대 시나리오

## 목적 ^purpose

`gate-event-bus`(fan-out publish/subscribe)가 `gate-system`에 의존할 때 기대하는 계약. event bus는 gate-system이 정의한 상태 변경 이벤트(FlagChange, Release, RecomputeComplete)를 구독자에게 전파하며, 이벤트 타입/payload의 안정성이 구독자 동작의 전제조건이다.

## 시나리오 1: 3종 이벤트 타입 호환 ^overview

**전제**: `gate-system`이 `FlagChangeEvent`, `ReleaseEvent`, `RecomputeCompleteEvent` 3종을 정의한다.

**동작**: 구독자가 `subscribe("flag-change", handler)` 등으로 특정 타입을 구독.

**기대**:
- 타입 문자열이 discriminated union 값 (컴파일 타임 타입 안전)
- payload 필드 제거 = breaking change (major version)
- payload 필드 추가는 non-breaking (optional 필드 허용)

**실패 시 수정 대상**: `gate-system`의 `gate-event-bus` ^defines 절. 이벤트 필드 변경 정책(backward-compat vs major bump)이 명시되어야 구독자가 안전하게 업그레이드 가능.

## 시나리오 2: 핸들러 에러 격리 ^overview

**전제**: 여러 구독자가 같은 이벤트 타입을 구독한다.

**동작**: 한 구독자 핸들러가 throw한다.

**기대**:
- 다른 구독자는 정상 호출 (격리)
- `onError` 콜백이 설정되어 있으면 호출, 미설정이면 에러 삼킴 (fail-open, `gate-system` 설계 결정)
- async 핸들러의 rejected Promise도 동일 격리 (fire-and-forget + `.catch`)

**실패 시 수정 대상**: `gate-system`의 `gate-event-bus` 설계 결정. 에러 격리 정책이 명확하지 않으면 한 버그가 전체 시스템 장애로 번질 수 있음.

## 시나리오 3: close 안전성 ^overview

**전제**: `gate-system`이 event bus `close()` 후 동작을 정의한다.

**동작**: `close()` 호출 이후 `publish()`, `subscribe()` 호출.

**기대**:
- close 후 publish → no-op (에러 없음)
- close 후 subscribe → no-op 함수 반환 (unsubscribe가 안전)
- close는 idempotent (여러 번 호출 안전)

**실패 시 수정 대상**: `gate-system`의 `gate-event-bus` ^defines 절 close 안전성. 명시되지 않으면 shutdown 중 race condition으로 unhandled error 발생.

## 시나리오 4: flag change 전파 ^overview

**전제**: `gate-system`의 `gate-flow`가 entry flag 변경(inactive/open/active 전이) 시 `FlagChangeEvent` emit을 규정한다.

**동작**: admin이 flag 변경 → EventBus 로 FlagChangeEvent 발행.

**기대**:
- payload: `{ prefix, versionId, position, status, timestamp }` (gate-system 정의와 일치)
- 전이가 실제 성공한 경우에만 emit (트랜잭션 commit 후)
- rollback 시 emit되지 않음 (phantom event 방지)

**실패 시 수정 대상**: `gate-system`의 `gate-flow`. 이벤트 emit 시점이 트랜잭션 경계와 일치하지 않으면 구독자가 잘못된 상태로 recompute 시도.

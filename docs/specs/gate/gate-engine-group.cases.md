---
def:
  id: gate-engine-group-cases
  type: spec
  tier: component
  scope: feature
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [scenario, gate, engine]
  links:
    - target: gate-engine-group
      type: refines
    - target: gate-system
      type: depends_on
---

# Gate Engine Group — 소비자 기대 시나리오

## 목적 ^purpose

`gate-engine-group`(GateEngine core / decorator / aware-query)이 `gate-system`에 의존할 때 기대하는 계약. engine은 gate-system의 상태 전이 규칙, constraint, flow 계약을 코드로 구현하며, 이들 상위 스펙의 안정성이 engine 동작의 전제조건이다.

## 시나리오 1: cascade recompute 경계 ^overview

**전제**: `gate-system`의 `gate-flow`가 상태 변경이 관련 prefix로 cascade 전파됨을 정의한다.

**동작**: `engine.cascadeRecompute(prefix, versionId)` 호출 → 의존 prefix 목록을 resolve하여 순차 recompute.

**기대**:
- 의존 그래프가 순환이면 감지 + 에러 (infinite recompute 방지)
- cascade 깊이가 `gate-constraint`의 한계 (기본 4) 이내
- cascade 실패 시 이미 완료된 recompute는 rollback 하지 않음 (부분 성공 허용, 로그 기록)

**실패 시 수정 대상**: `gate-system`의 `gate-flow` + `gate-constraint`. cascade 깊이 한계와 실패 처리 정책이 명시되지 않으면 engine 동작이 예측 불가능해진다.

## 시나리오 3: DimStateSpec 외부 주입 (Decorator) ^overview

**전제**: `gate-engine-decorator`가 외부 DimStateSpec을 주입 받아 gate 상태 계산을 확장한다.

**동작**: 사용자 정의 DimStateSpec을 decorator로 래핑된 engine에 주입.

**기대**:
- 주입된 spec이 기본 spec을 덮어쓰지 않고 추가 규칙으로 작동
- 규칙 충돌(같은 dim에 상충하는 상태 반환) 시 명시적 에러 또는 우선순위 규칙 적용
- decorator 스택이 O(N) 이내에 resolve (성능 회귀 방지)

**실패 시 수정 대상**: `gate-system`의 `gate-state-model`. 다중 state 제공자 병합 규칙이 명시되어야 decorator가 예측 가능해진다.

## 시나리오 4: aware-query gate 상태 합성 ^overview

**전제**: `gate-engine-aware-query`가 정책 해소 결과에 gate 상태를 합성하여 최종 허용 범위를 반환한다.

**동작**: policy가 허용한 주소 집합에 대해 gate 상태 필터 적용.

**기대**:
- policy 결과 × gate 상태(active만 허용) → 최종 결과
- gate 상태 조회가 fail → 보수적 기본값(active, CON-006 fail-open) 적용
- 결과는 deterministic — 같은 입력에 대해 같은 출력 (캐시/타이밍 영향 없음)

**실패 시 수정 대상**: `gate-system`의 `gate-engine-func` + `gate-state-model`. fail-open 기본값 규칙이 명확하지 않으면 aware-query 결과에 보안 허점 발생 가능.

## 시나리오 5: recompute 완료 이벤트 ^overview

**전제**: `gate-engine-core`가 recompute 완료 후 `RecomputeCompleteEvent`를 emit한다 (→ `gate-event-bus`).

**동작**: recompute 성공 시 event bus로 이벤트 전송.

**기대**:
- 이벤트 payload: `{ prefix, versionId, triggeredBy?, timestamp }` (gate-system 정의와 일치)
- 이벤트 emit 실패 → engine 동작 계속 (fail-open, 로그만 기록)
- 캐시 갱신이 이벤트 emit 전에 완료되어야 함 (구독자가 구조적으로 최신 상태를 볼 수 있음)

**실패 시 수정 대상**: `gate-system`의 `gate-flow`. recompute → cache update → event emit 순서가 스펙에 명시되어야 한다. 순서 역전 시 구독자가 stale 상태를 읽을 수 있음.

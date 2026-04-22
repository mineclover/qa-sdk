---
def:
  id: event-intent-definition-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: event-catalog
  tags: [observability, event, testing]
  links:
    - target: event-intent-definition-rule
      type: refines
---

# Event Intent Definition — Use Cases

## 목적 ^purpose

requester-aware data-effect event 규칙이 실제 event key 설계에서 어떻게 적용되는지 검증 시나리오를 정의한다.

## 시나리오 1: 같은 data mutation이 다른 intent를 가진다 ^overview

**전제**: backend 함수는 내부적으로 `status: 1 -> 2`만 수행한다.

**동작**:
- `POST /items` 요청자가 호출한다.
- `PATCH /items/:id/disable` 요청자가 호출한다.
- retention job이 같은 mutation 함수를 호출한다.

**기대**:
- event key는 각각 `item.created`, `item.disabled`, `item.expired`처럼 request path와 requester 맥락에 맞게 달라진다.
- alert rule은 raw `1 -> 2`가 아니라 semantic event key와 requester payload를 본다.

**실패 시 수정 대상**: `event-intent-definition-rule`, mapping pack, backend event emission.

## 시나리오 2: frontend behavior와 backend data effect가 분리된다

**전제**: frontend가 `policy.rule.disable.requested` behavior unit을 정의한다.

**동작**: 사용자가 disable 버튼을 누르고 backend가 soft-delete 또는 disabled state를 저장한다.

**기대**:
- frontend event는 행동 요청을 기록한다.
- backend event는 requester, route, subject, effect_kind, outcome을 기록한다.
- persistence 실패 시 frontend behavior event만으로 성공 alert를 만들지 않는다.

**실패 시 수정 대상**: BDD contract, frontend event naming, backend data-effect event payload.

## 시나리오 3: system requester와 human requester를 구분한다

**전제**: 같은 데이터 row가 human action과 batch job 양쪽에서 변경될 수 있다.

**동작**:
- user가 직접 삭제한다.
- scheduled retention job이 만료 처리한다.

**기대**:
- payload의 `requester_type`이 `user`와 `job`으로 구분된다.
- 필요하면 event key도 `item.deleted`와 `item.expired`로 분리된다.
- alert rule은 requester type을 기준으로 다른 severity/routing을 적용할 수 있다.

**실패 시 수정 대상**: backend requester injection, event payload guide, alert mapping.


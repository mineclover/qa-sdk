---
def:
  tier: component
  id: gate-constraint
  address: def_document:v2:273552
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security]
  links:
    - target: gate-api
      type: constrains
    - target: gate-engine-func
      type: constrains
---
# Gate 기술적 제약

## 목적 ^purpose

gate 시스템에 부과되는 기술적 불변 조건과 보안/성능 제약을 정의한다.
이 제약을 위반하는 구현은 허용되지 않는다.

## 구성 ^overview

4개 불변조건: fail-open, 읽기전용캐시, composite AND, inactive∩open→reserved.
보안: 내부 호출 전용, flag 변경은 관리자 API만. 성능: checkGate < 5ms, recompute 비동기.

## 불변 조건 ^constraint

1. **Fail-open**: gate check 실패 시 허용 + warning diagnostic. 차단하지 않는다.
2. **gate-service = 읽기 전용 캐시**: GateEngine 인스턴스를 직접 보유하지 않는다. 계산은 index-meta가 수행.
3. **composite AND**: 어느 dim이라도 차단이면 composite도 차단. 예외 없음.
4. **inactive ∩ open → reserved**: 자동 승격. 수동 해제 불가 — 원인(inactive 또는 open)을 해소해야 한다.

## 보안 제약 ^constraint

- 모든 gate 엔드포인트는 서비스 간 내부 호출 전용
- 외부 클라이언트에 gate 상태를 직접 노출하지 않는다
- flag 변경은 인증된 관리자 API를 통해서만 가능

## 성능 제약 ^constraint

- checkGate 응답 시간 < 5ms (캐시 히트 시)
- recompute는 비동기 — API 응답을 차단하지 않는다
- cascade 전파 깊이 ≤ 3 (prefix_ref 중첩 깊이 제한)

## CON-006

prefix_ref의 refEntries가 미정의이면 해당 position은 reserved 처리한다.
미완성 상태를 허용하되, 명시적으로 gate에 반영한다.

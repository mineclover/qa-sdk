---
def:
  id: perm-constraint-dkg
  tier: component
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-constraint
      type: refines
---
# 권한 제약 — DKG 제약

## 목적 ^purpose

권한 시스템과 DKG(Design Knowledge Graph) 간 제약 규칙을 정의한다. role 축 충돌 방지와 PolicyRule match 규칙.

## 정의 ^defines

- CON-001: rbac_role과 role 동시 사용 금지
- CON-002: 이벤트 prefix action dim은 `*_action` 축 사용
- PolicyRule match 기반 규칙: 암묵적 와일드카드 금지

## 소비 ^consumes

- DKG constraint 체계 (`@qa-sdk/core`)
- `PolicyRule` (`permission-engine/src/`) — match 기반 entity name + 명시적 와일드카드

## CON-001: rbac_role / role 동시 사용 금지

하나의 시스템에서 두 가지 role 개념이 공존하면 권한 해소 경로가 모호해진다. 시스템 정의 시 둘 중 하나를 선택하고, 나머지는 DKG에서 제거한다.

## 관련 제약

- **CON-002**: 이벤트 prefix action dim은 `*_action` 축 사용
- **PolicyRule match 기반**: entity name + 명시적 와일드카드(`"*"`). dim 누락 → ValidationError (암묵적 와일드카드 금지)

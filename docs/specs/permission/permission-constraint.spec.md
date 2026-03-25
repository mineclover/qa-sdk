---
def:
  id: permission-constraint
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  tags: [security]
  links:
    - target: perm-codec-spec
      type: constrains
    - target: perm-migration-spec
      type: constrains
    - target: perm-permission-code
      type: constrains
---
# 권한 비즈니스 제약

## 목적 ^purpose

권한 시스템의 비즈니스 규칙과 제약. 클라이언트는 role을 직접 확인하지 않고, 서버가 role → flat permission mask로 해소한다.

## 제약 규칙 ^constraint

- 클라이언트는 role을 직접 확인하지 않음 — 서버가 resolve
- resource: 소문자, `/` 구분, leading/trailing slash 금지, depth ≤ 4, `:param` 허용
- permission code: `{service-ref}.{type}.{resource}.{action}`
- 인코딩 선택: DB+범위 → WeightedIndex, 인메모리 필터 → BitIndex, 양쪽 → IndexBridge
- rbac_role과 role 동시 사용 금지 (CON-001)

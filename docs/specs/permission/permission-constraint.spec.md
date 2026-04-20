---
def:
  id: permission-constraint
  level: module
  tier: system
  address: def_document:v2:274563
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: perm-codec-system
      type: constrains
    - target: perm-migration-system
      type: constrains
    - target: perm-permission-code
      type: constrains
    - target: perm-constraint-role-resolution
      type: contains
    - target: perm-constraint-resource-format
      type: contains
    - target: perm-constraint-permission-code
      type: contains
    - target: perm-constraint-encoding-selection
      type: contains
    - target: perm-constraint-dkg
      type: contains
---
# 권한 비즈니스 제약

## 목적 ^purpose

권한 시스템의 비즈니스 규칙과 제약. 클라이언트는 role을 직접 확인하지 않고, 서버가 role → flat permission mask로 해소한다.

## 구성 ^overview

- `perm-constraint-role-resolution`: 클라이언트는 role을 직접 확인하지 않고, 서버가 flat permission mask로 해소하는 구조. Domain Role의 grant/deny 대칭 레이어 규칙 포함.
- `perm-constraint-resource-format`: 소문자, `/` 구분, depth ≤ 4, `:param` 허용의 canonical path 규칙.
- `perm-constraint-permission-code`: `{service-ref}.{type}.{resource}.{action}` 4파트 구조.
- `perm-constraint-encoding-selection`: WeightedIndex/BitIndex/IndexBridge/PermissionView 선택 가이드.
- `perm-constraint-dkg`: rbac_role과 role 동시 사용 금지(CON-001) 등 DKG 관련 제약.

## 방법 ^method

각 leaf가 독립적인 제약 규칙을 정의한다. role 해소가 핵심이며, resource 형식 → permission code 형식 → 인코딩 선택 순서로 구체화된다. DKG 제약은 cross-cutting.

## 위임 ^delegates

- role 해소 흐름 + deny 레이어 → `perm-constraint-role-resolution`
- resource 형식 제약 → `perm-constraint-resource-format`
- permission code 형식 → `perm-constraint-permission-code`
- 인코딩 선택 기준 → `perm-constraint-encoding-selection`
- DKG 제약 → `perm-constraint-dkg`

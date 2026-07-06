---
def:
  id: perm-migration-system
  tier: system
  address: def_document:v2:68641
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [structural, migration]
  links:
    - target: perm-migration-algorithm
      type: contains
    - target: perm-migration-mapper
      type: contains
    - target: permission-system
      type: depends_on
sources:
  - packages/permission-engine/src/migration.ts
  - packages/permission-engine/src/migration.test.ts
  - packages/permission-engine/src/permission-version.ts
  - packages/permission-engine/src/versioned-bitmap/issuer.ts
  - packages/permission-engine/src/versioned-bitmap/issuer.test.ts
---

# Permission Migration 시스템

## 목적 ^purpose

PermissionSet shape migration을 자동 재배치 규칙과 CoordMapper 보정 규칙으로 분리해, role/feature 축이 바뀌어도 grant 의미를 안정적으로 이어 가는 범위를 정의한다.

## 구성 ^overview

- `perm-migration-algorithm`: `migratePermissions()`의 자동 ID 매칭, shape 변경 시나리오, 시간 복잡도를 정의한다.
- `perm-migration-mapper`: `CoordMapper`의 커스텀 매핑 규칙, 한계, composite address와의 경계를 정의한다.

## 원본

분할 전 원본: `docs/specs/indexing/permission-engine/migration.spec.md` (perm-migration-spec)

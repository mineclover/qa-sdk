---
def:
  id: perm-constraint-role-resolution
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
sources:
  - packages/permission-engine/src/role-registry.ts
  - packages/permission-engine/src/role-registry.test.ts
  - packages/permission-engine/src/role-resolver.ts
  - packages/permission-engine/src/role-resolver.test.ts
---
# 권한 제약 — Role 해소 규칙

## 목적 ^purpose

클라이언트는 role을 직접 확인하지 않고, 서버가 role → flat permission mask로 resolve한 결과만 전달받는 구조를 정의한다. Domain Role의 grant/deny 대칭 레이어 규칙을 포함한다.

## 정의 ^defines

- Role 해소 흐름: 서버가 role hierarchy를 flat bitmask로 변환하여 클라이언트에 전달
- Domain Role deny 레이어: grant(`parents`, `ownFeatures`)와 대칭되는 deny(`denyRoles`, `denyFeatures`) 어휘

## 소비 ^consumes

- `DomainRoleDef` (`permission-engine/src/role-registry.ts`) — role 정의 타입
- `RoleRegistry` (`permission-engine/src/role-registry.ts`) — role 등록 및 resolution
- `PermissionCodec` (`permission-engine/src/permission-codec.ts`) — encode/mask 전달

## Role 해소 흐름

```
[서버]                                          [클라이언트]
role: "admin"
  → PermissionCodec.encode(permissions[]) →     Uint8Array bitmask
  → HTTP 응답 (mask 전달)                        → hasBit(mask, address) — O(1) 체크
```

이점:
- 클라이언트가 role 구조를 몰라도 된다 (role 변경 시 클라이언트 수정 불필요)
- O(1) 비트 체크로 권한 확인 (role hierarchy 탐색 없음)
- bitmask는 직렬화/전송 효율이 높다

## Domain Role deny 레이어

grant와 대칭되는 deny 어휘를 제공한다. grant가 role/feature 단위로 부여하듯, deny도 동일한 vocabulary로 제거한다.

- 타입 정의: `permission-engine/src/role-registry.ts` — `DomainRoleDef.denyRoles`, `DomainRoleDef.denyFeatures`
- grant 레이어: `parents`(role 단위 부여), `ownFeatures`(feature 단위 부여)
- deny 레이어: `denyRoles`(role 단위 제거), `denyFeatures`(feature 단위 제거)

**resolution 순서:**

```
1. parents → 상속 feature OR 합산
2. + ownFeatures 추가
3. denyRoles → 대상 role의 resolvedFeatures 전체를 deny set에 수집
4. + denyFeatures → deny set에 추가
5. final = (step 2 결과) - (deny set)
```

**규칙:**
- `denyRoles`는 같은 domain 내 role만 참조 가능
- `denyRoles` 대상 role에 feature가 추가되면 자동으로 deny에 반영됨
- 자기 자신을 deny하면 검증 에러 (`self-deny-role`)
- 존재하지 않는 role을 deny하면 검증 에러 (`unknown-deny-role`)
- deny는 해당 role의 resolved에만 영향. 부모/자식 role의 resolved에 전파되지 않음

## 구현 참조

- 구현: `permission-engine/src/role-registry.ts` — `_resolveFeatures()`, `validate()`
- 테스트 (`permission-engine/src/role-registry.test.ts`):
  - 상속 체인 기본: `:18`
  - 분기 상속: `:63`
  - denyFeatures 개별 제거: `:153`
  - denyRoles 통째로 제거: `:184`
  - denyRoles + denyFeatures 복합: `:206`
  - denyRoles 자동 반영: `:225`
  - deny mask 반영: `:245`
  - deny 검증: `:264`

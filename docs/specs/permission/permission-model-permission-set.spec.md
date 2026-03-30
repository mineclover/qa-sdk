---
def:
  id: permission-model-permission-set
  level: leaf
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-model
      type: refines
    - target: permission-encoding
      type: depends_on
---
# 권한 모델 — PermissionSet

## 목적 ^purpose

`feature × role` 2차원 권한 공간을 bitmask로 압축하는 `PermissionSet`의 상태 모델을 정의한다. 단일 권한 공간의 생성, 조작, 쿼리, 직렬화 계약을 분리한다.

## 구성 ^overview

- 생성: features/roles 정의와 mask 크기 제약
- 단일 조작: grant, revoke, has
- 배치 조작: grantAllRoles, grantAllFeatures, revokeAll
- 쿼리: rolesFor, featuresFor, queryRange, queryGranted
- 직렬화: snapshot, bytes, clone

## 생성

```typescript
const ps = new PermissionSet({
  features: { name: "features", ids: ["dashboard", "admin", "billing"] },
  roles:    { name: "roles",    ids: ["viewer", "editor", "admin"] },
});
```

- `features.ids`, `roles.ids`가 비어 있으면 `RangeError`
- 중복 ID가 있으면 `RangeError`
- `mask` 제공 시 길이는 `ceil(size/8)` 이어야 한다

## 단일 조작

| 메서드 | 설명 | 시간 |
|--------|------|------|
| `grant(feature, role)` | 비트 1 세팅 | O(1) |
| `revoke(feature, role)` | 비트 0 클리어 | O(1) |
| `has(feature, role)` | 비트 조회 | O(1) |

미등록 feature/role 이름을 전달하면 `RangeError("Unknown feature/role: ...")`.

## 배치 조작

| 메서드 | 동작 |
|--------|------|
| `grantAllRoles(feature)` | 해당 feature에 모든 role 부여 |
| `grantRoles(feature, roles)` | 해당 feature에 지정 role들 부여 |
| `revokeAllRoles(feature)` | 해당 feature에서 모든 role 회수 |
| `grantAllFeatures(role)` | 해당 role에 모든 feature 부여 |
| `revokeAllFeatures(role)` | 해당 role에서 모든 feature 회수 |
| `grantAll()` | 전체 부여 |
| `revokeAll()` | 전체 회수 |

## 쿼리

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `rolesFor(feature)` | `string[]` | 이 feature에 접근 가능한 role 목록 |
| `featuresFor(role)` | `string[]` | 이 role이 접근 가능한 feature 목록 |
| `hasAnyRole(feature, roles)` | `boolean` | role 중 하나라도 접근 가능한지 |
| `queryRange(constraints)` | `number[]` | 범위 주소 목록 |
| `queryGranted(constraints)` | `number[]` | 범위 주소 중 부여된 것만 |

## 직렬화와 뷰

```typescript
ps.toSnapshot();
PermissionSet.fromSnapshot(snap);

ps.toBytes();
PermissionSet.fromBytes(features, roles, bytes);

ps.toMatrix();
PermissionSet.fromMatrix(features, roles, matrix);
```

## 공개 속성

| 속성 | 타입 | 설명 |
|------|------|------|
| `size` | number | 전체 슬롯 수 |
| `grantCount` | number | 현재 부여된 비트 수 |
| `features` | `readonly string[]` | feature ID 배열 |
| `roles` | `readonly string[]` | role ID 배열 |
| `index` | `WeightedIndex` | 내부 인덱스 |
| `mask` | `Uint8Array` | 비트마스크 |

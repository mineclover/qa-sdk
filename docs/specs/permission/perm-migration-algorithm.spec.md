---
def:
  id: perm-migration-algorithm
  address: def_document:v2:68782
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [migration]
  links:
    - target: permission-model
      type: depends_on
    - target: permission-encoding
      type: depends_on
    - target: perm-migration-system
      type: refines
---

# PermissionSet 자동 마이그레이션 규칙

## 목적 ^purpose

`migratePermissions()`의 자동 ID 매칭 규칙을 분리해, PermissionSet shape가 바뀔 때 기존 grant를 어떤 조건에서 보존·삭제하는지 명확히 정의한다.

## 구성 ^overview

- **기본 알고리즘**: old shape의 feature/role ID를 순회하며 new shape에 동일 ID가 존재하는 grant만 새 위치에 재기록 (ID 매칭 기반)
- **shape 변경 5가지**: 추가(기본 deny), 제거(grant 소멸), 순서 변경(ID 동일하면 보존), rename/split/merge(자동 불가, mapper 필요)
- **복잡도**: O(oldFeatureCount × oldRoleCount), 개별 has/grant는 O(1) bit 연산
- **불변 원칙**: source 미변경, target은 기본 deny에서 시작, bit 위치가 아닌 ID 의미 기반으로 변환

## 1. 함수 계약

```ts
function migratePermissions(
  source: PermissionSet,
  newFeatures: DimDef,
  newRoles: DimDef,
  mapper?: CoordMapper,
): PermissionSet
```

- 항상 새 `PermissionSet` 인스턴스를 반환한다.
- 반환 집합은 `newFeatures`, `newRoles`를 그대로 사용한다.
- source는 mutate하지 않는다.
- target은 기본 deny 상태에서 보존 대상 grant만 다시 세팅한다.

## 2. 기본 알고리즘

`mapper`를 생략하면 구현은 ID 매칭 기반 자동 변환을 수행한다.

1. `newFeatures.ids`, `newRoles.ids`를 각각 `Map<id, index>`로 만든다.
2. source의 old feature ID를 순회한다.
3. 새 feature 집합에 없는 old feature는 전체 grant를 삭제된 것으로 본다.
4. 남은 feature에 대해 old role ID를 순회한다.
5. 새 role 집합에 없는 old role은 삭제된 것으로 본다.
6. `source.has(oldFeatureId, oldRoleId)`가 `true`인 slot만 새 위치에 다시 grant한다.

핵심 성질:

- bit 위치를 그대로 복사하지 않고, old shape의 의미를 읽어 new shape의 의미로 다시 쓴다.
- 같은 ID를 가진 feature/role은 순서가 바뀌어도 보존된다.
- 새 shape에 대응 ID가 없으면 grant는 소멸한다.

## 3. shape 변경 시나리오

| 변화 | 결과 |
|---|---|
| feature 추가 | 새 feature의 모든 role은 기본 deny |
| role 추가 | 새 role의 모든 feature는 기본 deny |
| feature 제거 | 해당 feature의 grant는 모두 소멸 |
| role 제거 | 해당 role의 grant는 모두 소멸 |
| 순서 변경 | 같은 ID면 grant 보존, bit 위치만 재배치 |
| rename / split / merge | 자동 보존되지 않음, mapper 필요 |

예:

- `roles v1 = [admin, viewer]`, `roles v2 = [viewer, admin]`이면 `admin` grant는 새 ordinal에 다시 기록된다.
- `payment_cancel`이 `payment_cancel_req`, `payment_cancel_approve`로 갈라지면 자동 경로만으로는 연결되지 않는다.

## 4. 복잡도와 호출 시점

- 자동 변환은 old shape 전체를 순회하므로 대략 `O(oldFeatureCount × oldRoleCount)`다.
- `source.has()`와 `target.grant()`는 각각 O(1) bit 연산이다.

대표 호출 순서:

1. 구버전 `PermissionSet` 또는 snapshot을 복원한다.
2. 새 버전의 `features.ids`, `roles.ids`를 준비한다.
3. `migratePermissions()`를 호출한다.
4. 결과를 새 snapshot으로 저장하거나 런타임 해소 경로에 투입한다.

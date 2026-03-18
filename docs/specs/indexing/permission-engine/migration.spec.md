# permission-engine migration 스펙

> `migration.ts`는 `PermissionSet`의 shape가 바뀔 때 기존 grant bit를 새 `[feature, role]` 좌표계로 재배치하는 적응 레이어다.
> 기본 경로는 ID 매칭 기반 자동 변환이고, rename/split/merge 같은 비호환 변경은 `CoordMapper`로 호출자가 명시적으로 보정한다.

패키지: `permission-engine`
운영 흐름: `[S2]` 권한 해소/검사 — [runtime-flows.spec.md](../../operations/runtime-flows.spec.md)
패키지 인덱스: [README.md](README.md)

## 상태

implemented

## 1. 범위

소스: `packages/permission-engine/src/migration.ts`

이 문서는 다음 public export를 다룬다.

| export | 형태 | 계약 |
|---|---|---|
| `CoordMapper` | type alias | old 1-based `(featureIdx, roleIdx)`를 new 1-based 좌표로 변환하거나 `null`로 삭제 |
| `migratePermissions` | function | 기존 `PermissionSet`의 grant를 새 차원 정의에 맞게 재배치한 새 `PermissionSet` 생성 |

관련 비공개 참고:

- 현재 워크스페이스에는 `packages/permission-engine/src/composite-address.ts` 소스 파일이 없다.
- `packages/permission-engine/src/index.ts`도 `composite-address`를 re-export하지 않는다.
- 대신 `packages/permission-engine/src/composite-address.test.ts`가 있으며, 이는 `weighted-index`의 `partialQueryBase`, `PrefixCodec`, 그룹별 압축을 검증하는 탐색적 테스트다.
- 따라서 현재 `permission-engine`의 public migration contract에는 composite address 전용 API가 없다.

---

## 2. `migratePermissions`

### 2.1 시그니처

```ts
function migratePermissions(
  source: PermissionSet,
  newFeatures: DimDef,
  newRoles: DimDef,
  mapper?: CoordMapper,
): PermissionSet
```

반환 계약:

- 항상 새로운 `PermissionSet` 인스턴스를 반환한다.
- 반환 집합의 차원 정의는 `newFeatures`, `newRoles`를 그대로 사용한다.
- source는 변경하지 않는다.
- target의 초기 상태는 전체 deny이고, migration 규칙에 의해 보존되는 grant만 다시 세팅된다.

### 2.2 호출 시점

대표 사용 시점:

1. 구버전 `PermissionSet` 또는 스냅샷을 복원한다.
2. 새 버전의 `features.ids`, `roles.ids`를 준비한다.
3. `migratePermissions()`로 새 `PermissionSet`을 만든다.
4. 필요하면 새 스냅샷으로 저장하거나 `[S2]` 해소 경로에 투입한다.

의미:

- 이 함수는 "bit 위치를 그대로 복사"하지 않는다.
- 항상 old shape의 의미를 읽은 뒤 new shape의 의미로 다시 grant한다.
- 따라서 shape가 바뀌어도 동일한 ID를 가진 slot은 보존되고, 새 shape에서 의미가 사라진 slot은 제거된다.

---

## 3. 자동 변환 알고리즘

`mapper`를 생략하면 구현은 ID 매칭 자동 변환 경로를 사용한다.

### 3.1 알고리즘

1. `newFeatures.ids`로 `Map<featureId, newFeatureIndex>`를 만든다.
2. `newRoles.ids`로 `Map<roleId, newRoleIndex>`를 만든다.
3. source의 모든 old feature ID를 순회한다.
4. old feature ID가 새 feature 집합에 없으면 그 feature의 모든 grant를 삭제된 것으로 본다.
5. 남은 feature에 대해 source의 모든 old role ID를 순회한다.
6. old role ID가 새 role 집합에 없으면 그 role의 grant를 삭제된 것으로 본다.
7. `source.has(oldFeatureId, oldRoleId)`가 `true`인 slot만 검사한다.
8. 공통 ID를 가진 slot은 새 ID 위치에 `target.grant(newFeatureId, newRoleId)`로 다시 쓴다.

의사코드:

```ts
const newFeatureMap = new Map(newFeatures.ids.map((id, i) => [id, i]));
const newRoleMap = new Map(newRoles.ids.map((id, i) => [id, i]));

for (const oldFeatureId of source.features) {
  const newFi = newFeatureMap.get(oldFeatureId);
  if (newFi === undefined) continue;

  for (const oldRoleId of source.roles) {
    const newRi = newRoleMap.get(oldRoleId);
    if (newRi === undefined) continue;
    if (!source.has(oldFeatureId, oldRoleId)) continue;

    target.grant(newFeatures.ids[newFi], newRoles.ids[newRi]);
  }
}
```

### 3.2 자동 변환의 성질

| 상황 | 결과 |
|---|---|
| feature 추가 | 새 feature의 모든 role은 기본 deny |
| role 추가 | 새 role의 모든 feature는 기본 deny |
| feature 제거 | 해당 feature의 기존 grant는 모두 소멸 |
| role 제거 | 해당 role의 기존 grant는 모두 소멸 |
| feature/role 순서 변경 | 동일 ID면 grant 보존 |
| ID rename | 자동 보존되지 않음 |
| split/merge | 자동 보존되지 않음 |

### 3.3 순서 변경이 안전한 이유

자동 변환은 bit position이 아니라 ID를 기준으로 동작한다.

예시:

```text
v1 roles = [admin, viewer, readonly]
v2 roles = [viewer, admin, readonly]
```

- `admin`의 ordinal은 v1에서 1, v2에서 2로 바뀐다.
- 하지만 자동 변환은 `admin`이라는 role ID를 찾아 새 ordinal에 다시 grant한다.
- 따라서 "역할 순서만 바뀐" 경우 grant 의미는 유지되고 bit 위치만 재배치된다.

### 3.4 시간 복잡도

- 자동 변환은 old shape 전체를 순회하므로 대략 `O(oldFeatureCount × oldRoleCount)`다.
- `source.has()`와 `target.grant()`는 각각 O(1) bit 연산이다.

---

## 4. shape 변경 시나리오

### 4.1 dim 추가

예시:

```text
roles v1 = [admin, developer, operator, viewer, readonly]
roles v2 = [admin, developer, operator, viewer, readonly, customer]
```

결과:

- 기존 공통 role의 grant는 보존된다.
- 새 `customer` role은 source에 대응 slot이 없으므로 모두 deny다.

### 4.2 dim 제거

예시:

```text
features v1 = [..., payment_cancel, ...]
features v2 = [..., payment_cancel_req, payment_cancel_approve, ...]
```

자동 변환 결과:

- `payment_cancel`은 새 feature ID 집합에 없으므로 기존 grant가 유지되지 않는다.
- `payment_cancel_req`, `payment_cancel_approve`는 새 feature라서 기본 deny다.

즉 "제거 + 추가"는 rename/split이 아니라 별개 변화로 취급된다.

### 4.3 dim 순서 변경

예시:

```text
features v1 = [read, write, delete]
features v2 = [delete, read, write]
```

결과:

- 같은 feature ID를 가진 grant는 모두 유지된다.
- 다만 새 `PermissionSet`의 내부 bit 주소는 새 순서를 기준으로 다시 계산된다.

### 4.4 rename / split / merge

예시:

```text
payment_cancel
→ payment_cancel_req
→ payment_cancel_approve
```

자동 변환만으로는 old ID와 new ID를 연결할 수 없다.

이 경우 호출자는 다음 중 하나를 선택해야 한다.

- `CoordMapper`를 제공해 old 좌표를 새 좌표로 직접 매핑한다.
- `migratePermissions()` 이후 별도의 후처리 grant/revoke 로직을 적용한다.

---

## 5. `CoordMapper`

### 5.1 타입 계약

```ts
type CoordMapper = (
  oldFeatureIdx: number,
  oldRoleIdx: number,
) => [newFeatureIdx: number, newRoleIdx: number] | null;
```

입력:

- old shape 기준 1-based 좌표를 받는다.
- `oldFeatureIdx`, `oldRoleIdx`는 각각 `source.features`, `source.roles`의 배열 순서를 따른다.

반환:

- `[newFeatureIdx, newRoleIdx]`: 새 shape 기준 1-based 목표 좌표
- `null`: 해당 old grant를 삭제

### 5.2 실행 규칙

구현은 `mapper`가 제공되면 다음처럼 동작한다.

1. old shape 전체를 순회한다.
2. source bit가 0인 slot은 mapper를 호출하지 않고 건너뛴다.
3. source bit가 1인 slot만 `mapper(oldFeatureIdx, oldRoleIdx)`에 전달한다.
4. mapper가 `null`을 반환하면 target에 아무 것도 쓰지 않는다.
5. mapper가 좌표를 반환하면 그 좌표의 ID를 읽어 `target.grant()`한다.

이 경로에서는 자동 ID 매칭이 섞이지 않는다.
즉 mapper를 제공하면 모든 보존/삭제 규칙은 호출자 책임이다.

### 5.3 매퍼 작성 규칙

권장 절차:

1. old 1-based index를 old ID로 복원한다.
2. old ID를 기준으로 rename/split/merge 정책을 적용한다.
3. new ID를 new shape 배열에서 찾아 1-based index로 변환한다.
4. 대응 target이 없으면 `null`을 반환한다.

예시:

```ts
const migrated = migratePermissions(v1, FEATURES_V2, ROLES_V2, (fi, ri) => {
  const featId = FEATURES_V1.ids[fi - 1];
  const roleId = ROLES_V1.ids[ri - 1];

  if (featId === "payment_cancel") {
    const newRi = ROLES_V2.ids.indexOf(roleId);
    if (newRi === -1) return null;
    return [FEATURES_V2.ids.indexOf("payment_cancel_req") + 1, newRi + 1];
  }

  const newFi = FEATURES_V2.ids.indexOf(featId);
  const newRi = ROLES_V2.ids.indexOf(roleId);
  if (newFi === -1 || newRi === -1) return null;
  return [newFi + 1, newRi + 1];
});
```

### 5.4 제약과 주의점

현재 API가 표현할 수 있는 것은 "한 old grant를 0개 또는 1개의 new grant로 옮기는 것"뿐이다.

- many-to-one: 가능
- one-to-one: 가능
- drop: 가능 (`null`)
- one-to-many fan-out: 단일 `CoordMapper` 반환값만으로는 불가

따라서 하나의 old grant를 여러 new grant로 복제해야 한다면:

- migration 후 후처리로 추가 grant를 넣거나
- `migratePermissions()` 바깥에서 별도 변환 루프를 작성해야 한다

또한 반환 좌표는 반드시 새 shape의 유효한 1-based 범위 안이어야 한다.
구현은 반환값 자체를 별도로 검증하지 않으므로, 잘못된 좌표를 반환하면 이후 ID 조회 또는 `grant()`에서 런타임 오류가 날 수 있다.

---

## 6. composite address와의 관계

현재 public source 기준으로 `permission-engine`에는 `composite-address.ts`가 없다.

따라서 migration layer의 공식 contract는 다음에 한정된다.

- `PermissionSet`의 `[feature, role]` 2D grant 재배치
- ID 매칭 자동 변환
- `CoordMapper` 기반 커스텀 좌표 변환

다만 저장/전송 레이어에서 더 큰 주소 공간을 합성할 때는 다음 맥락이 존재한다.

- `composite-address.test.ts`는 `namespace > name > env > device > region > shard > id > action` 같은 다차원 경로를
  그룹별 prefix(`svc`, `loc`, `perm`)로 압축한 뒤 다시 하나의 통합 주소로 조합하는 실험을 담고 있다.
- 이 테스트는 `weighted-index`의 `partialQueryBase`와 `PrefixCodec` 기반 부분 바인딩 원리를 검증한다.
- 즉 composite address는 "permission bitmask migration"의 public API라기보다,
  더 넓은 인덱싱 시스템에서 permission address를 다른 차원 그룹과 합성하는 설계 참고 자료다.

---

## 7. 공개 export 반영 확인

### 7.1 `migration.ts`

| 소스 export | 문서 반영 위치 |
|---|---|
| `CoordMapper` | [5. `CoordMapper`](#5-coordmapper) |
| `migratePermissions` | [2. `migratePermissions`](#2-migratepermissions), [3. 자동 변환 알고리즘](#3-자동-변환-알고리즘), [4. shape 변경 시나리오](#4-shape-변경-시나리오) |

### 7.2 `composite-address.ts`

| 확인 항목 | 결과 |
|---|---|
| `packages/permission-engine/src/composite-address.ts` 존재 여부 | 없음 |
| `packages/permission-engine/src/index.ts` public re-export | 없음 |
| 문서화 방침 | public export가 없으므로 API 스펙 대상 아님. [6. composite address와의 관계](#6-composite-address와의-관계)에서 비공개 참고 역할만 기록 |

## 8. 구현 기준 근거

- `packages/permission-engine/src/migration.ts`
- `packages/permission-engine/src/migration.test.ts`
- `packages/demo-tests/src/permission-migration.test.ts`
- `packages/platform-demo/src/pages/perm-engine.ts`
- `CLAUDE.md`의 permission-engine architecture notes

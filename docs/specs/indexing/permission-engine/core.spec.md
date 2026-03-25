---
def:
  id: permission-engine-spec
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  tags: [security]
---
# permission-engine core 스펙

## 목적 ^purpose

PermissionSet, TernaryMask, ScopedEngine로 구성된 권한 엔진 core layer. 닫힌 권한 공간을 bitmask로 압축하고, 계층 상속과 외부 컨텍스트를 분리한다.

패키지: `permission-engine`
운영 흐름: `[S2]` 권한 해소/검사 — [runtime-flows.spec.md](../../operations/runtime-flows.spec.md)
패키지 인덱스: [README.md](README.md)

## 상태

implemented

## 1. 코어 레이어 개요

### 책임 분리

| 모듈 | 책임 | 핵심 계약 |
|---|---|---|
| `PermissionSet` | `[feature, role]` 닫힌 2D 공간을 binary bitmask로 인코딩 | `grant`/`revoke`/`has` O(1), raw byte/스냅샷 직렬화 |
| `TernaryMask` | authoring 단계에서 `deny`/`unset`/`allow` 3상태 유지 | `inherit()`로 계층 merge, `toBinaryMask()`로 클라이언트용 flatten |
| `ScopedEngine` | `env`, `region`, `device` 같은 외부 열린 차원 분리 | scope key마다 독립 `PermissionSet` 유지 |

### `[S2]` 런타임 해소 경로

1. 서버는 조직/팀/사용자 정책을 `TernaryMask`로 합성한다. `[S2]`
2. 합성 결과를 `toBinaryMask()`로 flatten 하거나, 직접 `PermissionSet`으로 관리 가능한 2D grant matrix로 유지한다. `[S2]`
3. 외부 컨텍스트가 있으면 `ScopedEngine.scope(key)`로 scope별 마스크를 선택한다. `[S2]`
4. 최종 권한 판정은 `PermissionSet.has()` 또는 `TernaryMask.check()`로 수행한다. `[S2]`

### 용어 정합성

요청서의 일반 용어와 현재 구현의 실제 API 이름은 다음처럼 대응된다.

| 요청서 용어 | 실제 구현 API | 비고 |
|---|---|---|
| `check` | `PermissionSet.has()` | binary mask에서 특정 `(feature, role)` 슬롯 조회 |
| `toBuffer` | `PermissionSet.toBytes()` | Node `Buffer`가 아니라 환경 독립 `Uint8Array` 반환 |
| `fromBuffer` | `PermissionSet.fromBytes()` | 차원 정의(`features`, `roles`)를 호출자가 함께 제공 |

---

## 2. PermissionSet

소스: `packages/permission-engine/src/permission-set.ts`

### 2.1 설계 의도

- 내부 차원은 항상 닫힌 2D 공간이다: `feature × role`.
- 각 ID의 배열 위치가 1-based ordinal이 되며, `WeightedIndex([featureCount, roleCount])`가 주소를 계산한다.
- 각 주소는 1비트로 표현된다.
- 결과적으로 `grant`, `revoke`, `has`는 주소 계산 후 단일 비트 조작으로 끝나는 O(1) 연산이다.

### 2.2 인코딩 모델

```
feature ids: [f1, f2, f3, ...]  -> 1, 2, 3, ...
role ids:    [r1, r2, r3, ...]  -> 1, 2, 3, ...

shape = [features.length, roles.length]
address = index.encode([featureOrdinal, roleOrdinal])
mask[address] = 1 -> grant
mask[address] = 0 -> deny
```

- 차원 순서는 `[feature, role]`로 고정이다.
- `DimDef.ids` 순서가 바뀌면 같은 `(feature, role)` 의미도 다른 주소를 갖는다.
- 외부 차원(`env`, `region`, `device`)은 이 클래스에 포함하지 않으며 `ScopedEngine` 또는 호출자 라우팅이 담당한다.

### 2.3 공개 export 타입

| export | 형태 | 계약 |
|---|---|---|
| `DimDef<T extends string = string>` | interface | `{ name, ids }`; `ids` 순서가 1-based index |
| `PermissionSetOptions` | interface | `features`, `roles`, 선택적 `mask`를 받는 생성 옵션 |
| `PermissionSetSnapshot` | interface | `features`, `roles`, base64 `mask`를 담는 직렬화 형태 |
| `PermissionSet` | class | binary bitmask 기반 권한 집합 |

### 2.4 생성자

```ts
new PermissionSet(opts: PermissionSetOptions)
```

제약:

- `features.ids.length > 0`
- `roles.ids.length > 0`
- 각 차원 ID는 중복될 수 없다.
- `opts.mask`를 제공하면 길이는 `ceil(size / 8)`과 정확히 일치해야 한다.

초기 상태:

- `mask` 미지정 시 전체 deny로 시작한다.
- `index`는 `WeightedIndex([features.length, roles.length])`로 생성된다.

### 2.5 읽기 전용 표면

| 속성/게터 | 타입 | 설명 |
|---|---|---|
| `index` | `WeightedIndex` | 내부 주소 계산기 |
| `mask` | `Uint8Array` | 주소당 1비트 binary mask |
| `size` | `number` | 전체 슬롯 수 (`features × roles`) |
| `grantCount` | `number` | 현재 1로 설정된 슬롯 수 |
| `features` | `readonly string[]` | feature ID 목록 |
| `roles` | `readonly string[]` | role ID 목록 |

### 2.6 단일/배치 조작 API

| API | 계약 | 복잡도 |
|---|---|---|
| `grant(feature, role)` | 해당 슬롯을 1로 설정 | O(1) |
| `revoke(feature, role)` | 해당 슬롯을 0으로 설정 | O(1) |
| `has(feature, role)` | 해당 슬롯 grant 여부 조회 | O(1) |
| `grantAllRoles(feature)` | 특정 feature에 대해 모든 role grant | O(role 수) |
| `grantRoles(feature, roles)` | 특정 feature에 대해 일부 role grant | O(roles.length) |
| `revokeAllRoles(feature)` | 특정 feature의 모든 role revoke | O(role 수) |
| `grantAllFeatures(role)` | 특정 role에 대해 모든 feature grant | O(feature 수) |
| `revokeAllFeatures(role)` | 특정 role의 모든 feature revoke | O(feature 수) |
| `grantAll()` | 전체 슬롯 grant, 마지막 byte의 여분 비트는 clear | O(byte 수) |
| `revokeAll()` | 전체 슬롯 revoke | O(byte 수) |

에러 계약:

- 알 수 없는 feature는 `RangeError("Unknown feature: ...")`
- 알 수 없는 role은 `RangeError("Unknown role: ...")`

### 2.7 조회/집계 API

| API | 반환 | 설명 |
|---|---|---|
| `rolesFor(feature)` | `string[]` | 주어진 feature에 접근 가능한 role 목록 |
| `featuresFor(role)` | `string[]` | 주어진 role이 접근 가능한 feature 목록 |
| `hasAnyRole(feature, roles)` | `boolean` | 후보 role 중 하나라도 grant되었는지 |
| `queryRange([featureConstraint, roleConstraint])` | `number[]` | wildcard/range 제약에 대응하는 주소 집합 |
| `queryGranted([featureConstraint, roleConstraint])` | `number[]` | 해당 주소 집합 중 현재 grant된 주소만 필터링 |

`queryRange()`는 `weighted-index`의 `CoordConstraint` 문법을 그대로 사용한다.

- `null`: 전체 허용
- `"3"`: 단일 좌표
- `"1-3,5"`: 범위와 단일 좌표의 OR 조합

### 2.8 마스크 대수 및 변환

| API | 반환 | 설명 |
|---|---|---|
| `intersect(other)` | `PermissionSet` | 두 mask의 bitwise AND |
| `union(other)` | `PermissionSet` | 두 mask의 bitwise OR |
| `toMatrix()` | `boolean[][]` | `[featureIdx][roleIdx]` 매트릭스 뷰 |
| `fromMatrix(features, roles, matrix)` | `PermissionSet` | 매트릭스로부터 복원 |
| `clone()` | `PermissionSet` | 독립 복사 |

호환성 주의:

- 구현은 현재 `intersect()`/`union()`에서 mask byte 길이만 검증한다.
- 의미적으로는 동일한 feature/role ordering을 공유하는 집합끼리만 조합해야 한다.

### 2.9 직렬화 API

| API | 설명 |
|---|---|
| `toSnapshot()` | `PermissionSetSnapshot` 반환. feature/role ID와 base64 mask 포함 |
| `fromSnapshot(snapshot)` | base64 snapshot에서 복원 |
| `toBytes()` | raw `Uint8Array` 복사본 반환 |
| `fromBytes(features, roles, bytes)` | raw bytes에서 복원. raw bytes에는 차원 메타데이터가 없으므로 호출자가 dims 제공 |

직렬화 규칙:

- `toSnapshot()`은 환경 독립 base64 문자열을 사용한다.
- `toBytes()`는 내부 `mask`의 복사본을 반환한다.
- `fromBytes()`는 전달된 `bytes`를 다시 복사해 내부 상태로 사용한다.

### 2.10 불변조건

- 동일한 `features.ids`, `roles.ids`, `mask`면 같은 권한 상태를 뜻한다.
- 동일 byte 배열이라도 차원 순서가 다르면 다른 의미를 갖는다.
- `grantCount`는 `popcount(mask)`와 동일해야 한다.
- `grantAll()` 이후 여분 비트는 항상 0이어야 한다.

---

## 3. TernaryMask

소스: `packages/permission-engine/src/ternary-mask.ts`

### 3.1 설계 의도

- binary mask는 "명시적 deny"와 "unset"을 구분할 수 없다.
- `TernaryMask`는 authoring 단계의 3-state 모델을 유지한다.
- 서버는 상속 체인을 해소한 뒤 `toBinaryMask()`로 flatten하여 클라이언트에 보낼 수 있다. `[S2]`

### 3.2 공개 export 타입/상수

| export | 형태 | 계약 |
|---|---|---|
| `DENY` | `-1` 상수 | 명시적 거부 |
| `UNSET` | `0` 상수 | 미설정 |
| `ALLOW` | `1` 상수 | 명시적 허용 |
| `TriState` | type | `-1 | 0 | 1` |
| `DefaultPolicy` | type | `"deny" | "allow"` |
| `TernaryMask` | class | dual-mask 기반 3-state 표현 |

### 3.3 저장 모델

슬롯당 두 개의 binary mask를 사용한다.

| allow bit | deny bit | 의미 |
|---|---|---|
| `0` | `0` | `UNSET` |
| `1` | `0` | `ALLOW` |
| `0` | `1` | `DENY` |
| `1` | `1` | 충돌 상태, 해석은 항상 `DENY` |

속성:

| 속성 | 타입 | 설명 |
|---|---|---|
| `allowMask` | `Uint8Array` | 명시적 허용 비트 |
| `denyMask` | `Uint8Array` | 명시적 거부 비트 |
| `size` | `number` | 슬롯 수 |
| `allowCount` | `number` | 허용 비트 수 |
| `denyCount` | `number` | 거부 비트 수 |
| `unsetCount` | `number` | `size - allowCount - denyCount` |

생성자:

```ts
new TernaryMask(size: number, allow?: Uint8Array, deny?: Uint8Array)
```

- `allow`, `deny`를 넘기지 않으면 둘 다 0으로 채운 mask를 생성한다.
- 두 mask 길이는 모두 `ceil(size / 8)`이어야 한다.

### 3.4 단일 슬롯 API

| API | 계약 |
|---|---|
| `allow(id)` | `allow=1`, `deny=0`으로 설정 |
| `deny(id)` | `allow=0`, `deny=1`으로 설정 |
| `unset(id)` | 두 비트를 모두 0으로 되돌림 |
| `get(id)` | 현재 `TriState` 반환. 충돌 시 `DENY` |
| `check(id, defaultPolicy = "deny")` | `ALLOW -> true`, `DENY -> false`, `UNSET -> defaultPolicy` |
| `clone()` | mask 복사본 생성 |

### 3.5 계층 상속

```ts
TernaryMask.inherit(parent, child, { denyWins?: boolean })
```

기본 merge 규칙:

1. `child`가 `ALLOW` 또는 `DENY`면 child 값이 우선한다.
2. `child`가 `UNSET`이면 parent 값을 상속한다.
3. 둘 다 `UNSET`이면 결과도 `UNSET`이다.

추가 규칙:

- `denyWins` 기본값은 `true`
- `denyWins=true`이면 parent 또는 child 어느 한쪽에라도 `DENY`가 있으면 결과는 `DENY`
- `denyWins=false`이면 1번 규칙만 적용되어 child의 명시 값이 최우선이다

이 메서드는 `org -> team -> user` 같은 다단계 체인을 왼쪽에서 오른쪽으로 순차 적용하는 형태를 전제한다.

### 3.6 binary mask 변환

```ts
toBinaryMask(defaultPolicy: "deny" | "allow" = "deny"): Uint8Array
```

규칙:

- `ALLOW`는 항상 `1`
- `DENY`는 항상 `0`
- `UNSET`은 `defaultPolicy`에 따라 `0` 또는 `1`

의도:

- 클라이언트/세션/JWT에는 3-state 전체를 보내지 않고, 해소된 binary mask만 전달한다. `[S2]`
- ternary 표현은 동일 슬롯 수 기준 binary의 2배 byte를 사용하고, binary flatten 후에는 다시 1배로 줄어든다.

---

## 4. ScopedEngine

소스: `packages/permission-engine/src/scoped-engine.ts`

### 4.1 설계 의도

- `PermissionSet`은 내부 닫힌 2D 차원만 표현한다.
- `env`, `region`, `device`, `tenant-tier`처럼 열린 외부 차원은 scope key 문자열로 분리한다.
- 각 scope key는 독립된 `PermissionSet`을 갖는다.

예시 scope key:

- `prod:asia`
- `prod:asia:mobile`
- `dev:us-east-1:web`

### 4.2 공개 export

| export | 형태 | 계약 |
|---|---|---|
| `ScopedEngineSnapshot` | interface | `features`, `roles`, `scopes: Record<string, string>` |
| `ScopedEngine` | class | scope key별 `PermissionSet` 저장소 |

### 4.3 데이터 모델

```ts
Map<string, PermissionSet>
```

- key는 호출자가 정하는 canonical scope 문자열이다.
- value는 동일한 `features`/`roles` shape를 공유하는 `PermissionSet`이다.
- `scope()`는 lazy initializer 역할을 하며, 존재하지 않는 key를 조회하면 전체 deny 상태의 새 `PermissionSet`을 생성한다.

### 4.4 공개 API

| API | 반환 | 설명 |
|---|---|---|
| `new ScopedEngine(features, roles)` | `ScopedEngine` | 공통 shape로 scope router 생성 |
| `scope(key)` | `PermissionSet` | key에 대응하는 scope mask 조회 또는 생성 |
| `hasScope(key)` | `boolean` | scope 존재 여부 |
| `scopeKeys()` | `string[]` | 등록된 scope key 목록. `Map` insertion order를 따른다 |
| `deleteScope(key)` | `boolean` | scope 삭제 성공 여부 |
| `unionScopes(keys)` | `PermissionSet` | 여러 scope의 OR 합집합 |
| `intersectScopes(keys)` | `PermissionSet` | 여러 scope의 AND 교집합 |
| `toSnapshot()` | `ScopedEngineSnapshot` | 모든 scope mask를 base64 snapshot으로 직렬화 |
| `fromSnapshot(snapshot)` | `ScopedEngine` | snapshot에서 복원 |

### 4.5 scope 합성 규칙

`unionScopes(keys)`:

- 존재하는 scope만 대상으로 bitwise OR를 수행한다.
- 입력한 key 중 일부가 없어도 예외 없이 무시된다.
- 존재하는 scope가 하나도 없으면 전체 deny `PermissionSet`을 반환한다.

`intersectScopes(keys)`:

- 존재하지 않는 scope가 하나라도 있으면 결과는 전체 deny다.
- 이는 "모든 지정 환경에서 접근 가능한가?" 질의의 보수적 해석이다.
- 입력 key가 비어 있거나, 처리할 scope가 없으면 전체 deny `PermissionSet`을 반환한다.

### 4.6 직렬화 규칙

- `ScopedEngineSnapshot.scopes[key]` 값은 `PermissionSet.toSnapshot().mask`와 동일한 base64 string이다.
- `fromSnapshot()`은 snapshot 안의 `features`, `roles`를 사용해 각 scope의 `PermissionSet`을 복원한다.
- scope key 자체의 문법 검증은 이 클래스의 책임이 아니다. canonicalization이 필요하면 호출자가 사전에 수행한다.

---

## 5. 공개 export 커버리지 매트릭스

이 표는 `packages/permission-engine/src/permission-set.ts`, `ternary-mask.ts`, `scoped-engine.ts`의 모든 직접 export가 본 문서에 반영되었는지 확인하기 위한 체크리스트다.

| 소스 | export | 본 문서 위치 |
|---|---|---|
| `permission-set.ts` | `DimDef` | 2.3 |
| `permission-set.ts` | `PermissionSetOptions` | 2.3, 2.4 |
| `permission-set.ts` | `PermissionSetSnapshot` | 2.3, 2.9 |
| `permission-set.ts` | `PermissionSet` | 2 전체 |
| `ternary-mask.ts` | `DENY` | 3.2 |
| `ternary-mask.ts` | `UNSET` | 3.2 |
| `ternary-mask.ts` | `ALLOW` | 3.2 |
| `ternary-mask.ts` | `TriState` | 3.2, 3.4 |
| `ternary-mask.ts` | `DefaultPolicy` | 3.2, 3.4, 3.6 |
| `ternary-mask.ts` | `TernaryMask` | 3 전체 |
| `scoped-engine.ts` | `ScopedEngineSnapshot` | 4.2, 4.6 |
| `scoped-engine.ts` | `ScopedEngine` | 4 전체 |

## 6. 구현 경계

- 이 문서는 현재 구현된 public surface를 기준으로 작성되었다.
- `PermissionSet`의 canonical binary check API 이름은 `has()`다.
- raw binary 직렬화의 canonical API 이름은 `toBytes()` / `fromBytes()`다.
- `Buffer` 전용 API는 현재 구현에 없다.

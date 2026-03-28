---
def:
  id: permission-model
  address: def_document:v2:205961
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: perm-resource-model
      type: depends_on
    - target: perm-service-ref
      type: depends_on
---
# 권한 모델

## 목적 ^purpose

PermissionSet(권한 집합), TernaryMask(3진 마스크: allow/deny/unset), ScopedEngine(범위 해소)의 3개 코어 타입으로 구성된 권한 상태 모델.

## 구성 ^overview

- **PermissionSet**: 권한 ID 집합을 bitmask로 압축한 닫힌 권한 공간 표현
- **TernaryMask**: 각 비트에 allow(1)/deny(-1)/unset(0) 3진 값을 부여하는 논리 구조
- **ScopedEngine**: 상위 → 하위 스코프 계층 상속 + 하위에서 override 가능한 권한 해소 엔진
- **3타입 조합**: PermissionSet(공간 정의) → TernaryMask(판정 논리) → ScopedEngine(범위 해소)로 권한 상태 완성
- **클라이언트 규칙**: role 직접 확인 금지 — 서버가 role → flat permission mask로 resolve

## 상태 정의 ^state-def

- PermissionSet: 권한 ID 집합 → bitmask 압축
- TernaryMask: 각 비트에 allow(1)/deny(-1)/unset(0) 3진 값
- ScopedEngine: 상위 스코프 → 하위 스코프 상속, 하위에서 override 가능

---

## 1. PermissionSet

`feature × role` 2차원 WeightedIndex 위에 Uint8Array bitmask를 올린 권한 엔진. 주소당 1비트.

### 1.1 타입

> 타입 정의: `packages/permission-engine/src/permission-set.ts` — `DimDef`, `PermissionSetOptions`, `PermissionSetSnapshot`

### 1.2 생성

```typescript
const ps = new PermissionSet({
  features: { name: "features", ids: ["dashboard", "admin", "billing"] },
  roles:    { name: "roles",    ids: ["viewer", "editor", "admin"] },
});
```

- `features.ids`, `roles.ids`는 비어 있으면 `RangeError`.
- 중복 ID가 있으면 `RangeError`.
- `mask` 제공 시 `ceil(size / 8)` 길이가 아니면 `RangeError`.

### 1.3 단일 조작

| 메서드 | 설명 | 시간 |
|--------|------|------|
| `grant(feature, role)` | 비트 1 세팅 | O(1) |
| `revoke(feature, role)` | 비트 0 클리어 | O(1) |
| `has(feature, role)` | 비트 조회 | O(1) |

미등록 feature/role 이름을 전달하면 `RangeError("Unknown feature/role: ...")`.

### 1.4 배치 조작

| 메서드 | 동작 |
|--------|------|
| `grantAllRoles(feature)` | 해당 feature에 모든 role 부여 |
| `grantRoles(feature, roles)` | 해당 feature에 지정 role들 부여 |
| `revokeAllRoles(feature)` | 해당 feature에서 모든 role 회수 |
| `grantAllFeatures(role)` | 해당 role에 모든 feature 부여 |
| `revokeAllFeatures(role)` | 해당 role에서 모든 feature 회수 |
| `grantAll()` | 전체 부여 (여분 비트 자동 클리어) |
| `revokeAll()` | 전체 회수 (`mask.fill(0)`) |

### 1.5 쿼리

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `rolesFor(feature)` | `string[]` | 이 feature에 접근 가능한 role 목록 |
| `featuresFor(role)` | `string[]` | 이 role이 접근 가능한 feature 목록 |
| `hasAnyRole(feature, roles)` | `boolean` | 주어진 role 중 하나라도 접근 가능한지 |
| `queryRange(constraints)` | `number[]` | `[CoordConstraint, CoordConstraint]` 범위의 주소 목록 |
| `queryGranted(constraints)` | `number[]` | 범위 주소 중 부여된 것만 |

### 1.6 마스크 대수

| 메서드 | 동작 | 의미 |
|--------|------|------|
| `intersect(other)` | `maskAnd` | 둘 다 부여된 것만 (교집합) |
| `union(other)` | `maskOr` | 하나라도 부여된 것 (합집합) |

`mask.length`가 다르면 `RangeError`.

### 1.7 매트릭스 뷰

```typescript
ps.toMatrix();   // → boolean[][] (feature × role)
PermissionSet.fromMatrix(features, roles, matrix);
```

### 1.8 직렬화

```typescript
const snap = ps.toSnapshot();     // { features, roles, mask: base64 }
PermissionSet.fromSnapshot(snap);

const bytes = ps.toBytes();       // raw Uint8Array
PermissionSet.fromBytes(features, roles, bytes);

ps.clone();                       // deep copy
```

### 1.9 읽기 전용 속성

| 속성 | 타입 | 설명 |
|------|------|------|
| `size` | `number` | features.length × roles.length |
| `grantCount` | `number` | 현재 부여된 비트 수 (`popcount`) |
| `features` | `readonly string[]` | feature ID 배열 |
| `roles` | `readonly string[]` | role ID 배열 |
| `index` | `WeightedIndex` | 내부 인덱스 (shape = [features, roles]) |
| `mask` | `Uint8Array` | 비트마스크 (주소당 1비트) |

---

## 2. TernaryMask

binary mask(0/1)의 한계를 해결하는 3상태 마스크. 슬롯당 2비트(allowMask + denyMask) 구조.

### 2.1 3상태 정의

| 상수 | 값 | allowBit | denyBit | 의미 |
|------|----|----------|---------|------|
| `ALLOW` | `1` | 1 | 0 | 명시적 허용 |
| `DENY` | `-1` | 0 | 1 | 명시적 거부 — 상속된 allow를 override |
| `UNSET` | `0` | 0 | 0 | 미설정 — 상위에서 상속받거나 기본 정책 적용 |

- `allow=1, deny=1` 충돌 시 → **deny-wins** (안전 기본값).

> 타입 정의: `packages/permission-engine/src/ternary-mask.ts` — `TriState`, `DefaultPolicy`

### 2.2 크기

슬롯당 2비트 = `ceil(N/8) × 2` bytes. 40 슬롯 = 10 bytes (binary는 5 bytes).

### 2.3 생성

```typescript
const mask = new TernaryMask(40);               // 40 슬롯, 전부 UNSET
const mask = new TernaryMask(40, allowArr, denyArr); // 기존 마스크 주입
```

`allowMask.length`/`denyMask.length`가 `ceil(size/8)`과 다르면 `RangeError`.

### 2.4 단일 조작

| 메서드 | 동작 |
|--------|------|
| `allow(id)` | allowBit=1, denyBit=0 |
| `deny(id)` | allowBit=0, denyBit=1 |
| `unset(id)` | allowBit=0, denyBit=0 (상속 대기) |
| `get(id)` | → `TriState` (deny-wins: deny 비트 우선 검사) |

### 2.5 최종 판정 (`check`)

```typescript
mask.check(id, "deny");   // ALLOW→true, DENY→false, UNSET→false
mask.check(id, "allow");  // ALLOW→true, DENY→false, UNSET→true
```

`DefaultPolicy`가 UNSET을 어떻게 해석할지 결정한다.

### 2.6 상속 체인 merge (`inherit`)

```typescript
const resolved = TernaryMask.inherit(parent, child, { denyWins: true });
```

**기본 규칙 (child 우선):**
- child=ALLOW → ALLOW
- child=DENY → DENY
- child=UNSET → parent 값 상속

**denyWins (기본 true):** parent 또는 child 중 하나라도 DENY면 결과는 DENY.

size가 다르면 `RangeError`.

### 2.7 통계

| 속성 | 설명 |
|------|------|
| `allowCount` | `popcount(allowMask)` |
| `denyCount` | `popcount(denyMask)` |
| `unsetCount` | `size - allowCount - denyCount` |

### 2.8 변환

```typescript
mask.toBinaryMask("deny");   // ternary → binary Uint8Array (UNSET→0)
mask.toBinaryMask("allow");  // ternary → binary Uint8Array (UNSET→1)
mask.clone();                 // deep copy
```

클라이언트 전송 시 ternary → binary 변환 용도.

### 2.9 활용 패턴

```
org (TernaryMask)       allow:dashboard, deny:billing
  └── team (TernaryMask)   allow:billing, unset:dashboard
        └── user (TernaryMask)  unset:*, deny:admin
```

`TernaryMask.inherit(org, team)` → dashboard=ALLOW(상속), billing=DENY(deny-wins)
`TernaryMask.inherit(result, user)` → admin=DENY(child 우선)

---

## 3. ScopedEngine

env/region 같은 외부 차원을 키로 사용하여 스코프별 독립 PermissionSet을 관리하는 엔진.

### 3.1 타입

> 타입 정의: `packages/permission-engine/src/scoped-engine.ts` — `ScopedEngineSnapshot`

### 3.2 생성

```typescript
const engine = new ScopedEngine(
  { name: "features", ids: ["dashboard", "admin"] },
  { name: "roles",    ids: ["viewer", "admin"] },
);
```

모든 스코프가 같은 features/roles 차원 정의를 공유한다.

### 3.3 스코프 관리

| 메서드 | 동작 |
|--------|------|
| `scope(key)` | PermissionSet 획득. 없으면 새로 생성 (전체 deny) |
| `hasScope(key)` | 스코프 존재 여부 |
| `scopeKeys()` | 등록된 모든 스코프 키 배열 |
| `deleteScope(key)` | 스코프 제거 |

```typescript
engine.scope("prod:asia").grant("dashboard", "admin");
engine.scope("prod:asia").has("dashboard", "admin");  // true
engine.scope("dev:usa").has("dashboard", "admin");     // false (별도 스코프)
```

### 3.4 다중 스코프 연산

| 메서드 | 의미 | 없는 스코프 처리 |
|--------|------|------------------|
| `unionScopes(keys)` | "어느 환경에서든 접근 가능한가?" | skip |
| `intersectScopes(keys)` | "모든 환경에서 접근 가능한가?" | 전체 deny 반환 |

```typescript
engine.unionScopes(["prod:asia", "prod:us"]);      // 합집합
engine.intersectScopes(["prod:asia", "prod:us"]);   // 교집합
```

### 3.5 직렬화

```typescript
const snap = engine.toSnapshot();
// { features: [...], roles: [...], scopes: { "prod:asia": "base64...", ... } }

const restored = ScopedEngine.fromSnapshot(snap);
```

---

## 4. 3타입 조합 관계

```
PermissionSet           "이 feature+role 조합이 부여되었는가?" (binary 0/1)
     ↓ 기반
TernaryMask             "명시적 allow/deny/미설정인가?" (ternary -1/0/1)
     ↓ 결합
ScopedEngine            "어떤 스코프(env/region)에서 이 권한이 유효한가?"
```

**역할 분리:**
- PermissionSet: 공간 정의 (feature × role 매트릭스, 마스크 대수)
- TernaryMask: 판정 논리 (상속 체인, deny-wins, 기본 정책)
- ScopedEngine: 범위 해소 (env/region별 독립 PermissionSet, 합집합/교집합)

**클라이언트 전달 경로:**
```
서버: role → PermissionSet.grant() → TernaryMask.inherit(org,team,user)
    → toBinaryMask("deny") → Uint8Array → HTTP 응답
클라이언트: hasBit(mask, address) → O(1) 체크
```

---

## 5. PermissionSet 마이그레이션

shape 변경(역할 추가, 기능 삭제 등) 시 기존 마스크 비트를 새 shape로 재배치한다.

### 5.1 타입

> 타입 정의: `packages/permission-engine/src/migration.ts` — `CoordMapper`
>
> old 1-based coords → new 1-based coords, 또는 `null`(삭제).

### 5.2 API

> 함수 정의: `packages/permission-engine/src/migration.ts` — `migratePermissions()`

- **mapper 미지정:** ID 매칭 자동 변환. 같은 ID를 가진 feature/role의 grant가 보존되고, 삭제된 ID는 무시되며, 새 ID는 deny.
- **mapper 지정:** `mapper(oldFi, oldRi)` → `[newFi, newRi]` 또는 `null`(삭제). 명시적 좌표 재배치.

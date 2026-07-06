---
def:
  tier: component
  id: permission-encoding
  address: def_document:v2:342188
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-model
      type: depends_on
sources:
  - packages/permission-engine/src/permission-code.ts
  - packages/permission-engine/src/permission-codec.ts
  - packages/permission-engine/src/permission-codec.test.ts
  - packages/permission-engine/src/permission-view-cache.ts
  - packages/permission-engine/src/permission-view-cache.test.ts
  - packages/bit-index/src/bit-index.ts
  - packages/bit-index/src/bridge.ts
  - packages/bit-index/src/bridge.test.ts
---
# 권한 인코딩

## 목적 ^purpose

권한 데이터를 WeightedIndex(DB+범위 질의), BitIndex(인메모리 필터), IndexBridge(양쪽 호환)로 인코딩하는 데이터 구조. permission code 형식: `{service-ref}.{type}.{resource}.{action}`.

## 구성 ^overview

- **PermissionCodec** — 3-tier 프로토콜 스택: text ↔ integer ↔ bitmask 변환 코덱.
- **PermissionSet** — feature × role 2차원 비트마스크 기반 권한 관리 엔진.
- **PermissionView** — 캐시된 BitMaskSet 기반 O(1) 필터 뷰.
- **TernaryMask** — ALLOW/DENY/UNSET 3상태 마스크.
- **ScopedEngine** — 서비스 범위 제한 권한 엔진.
- **migration** — 차원 변경 시 좌표 매핑 기반 권한 마이그레이션.

## 3-tier 프로토콜 스택

```
Tier 1 (text):    "shop/payment.api.admin/teams.GET"    — 사람용 표현
Tier 2 (integer): 42 또는 "perm:v2:42"                   — 1D 주소 (SemanticAddress)
Tier 3 (bitmask): Uint8Array bit[42]=1                    — O(1) 클라이언트 체크
```

### Tier 1 ↔ Tier 2: PermissionCodec

`PermissionCodec`은 4차원 WeightedIndex로 text permission을 정수 주소로 변환한다.

**CodecDims (4차원):**

| 차원 | 예시 | 설명 |
|------|------|------|
| `services` | `"shop/payment"`, `"cms/auth"` | 서비스 참조 (namespace/name) |
| `types` | `"api"`, `"page"`, `"action"` | resource 타입 |
| `resources` | `"admin/teams"`, `"billing/invoices"` | canonical resource path |
| `actions` | `"GET"`, `"POST"`, `"view"`, `"edit"` | 행동 |

**encode/decode:**

```typescript
const codec = new PermissionCodec("v2", dims);

// Tier 1 → Tier 2
const addr = codec.encode("shop/payment.api.admin/teams.GET");  // → 42

// Tier 2 → Tier 1
const perm = codec.decode(42);
// → { service: "shop/payment", type: "api", resource: "admin/teams", action: "GET", address: 42 }

// 직렬화
codec.serialize(42);  // → "perm:v2:42"
codec.parse("perm:v2:42");  // → 42
```

### Tier 2 ↔ Tier 3: Bitmask

```typescript
const mask = codec.createMask();   // 빈 Uint8Array
codec.grantTo(mask, "shop/payment.api.admin/teams.GET");
codec.check(mask, "shop/payment.api.admin/teams.GET");   // true
codec.revokeFrom(mask, "shop/payment.api.admin/teams.GET");
codec.countGrants(mask);  // 0
```

## PermissionSet (feature × role)

2차원 비트마스크 기반 권한 관리:

```typescript
const ps = new PermissionSet({
  features: { name: "features", ids: ["dashboard", "admin", "billing"] },
  roles:    { name: "roles",    ids: ["viewer", "editor", "admin"] },
});

ps.grant("dashboard", "viewer");     // 단일 부여
ps.grantAllRoles("admin");           // 모든 역할에 부여
ps.has("dashboard", "viewer");       // O(1) 검사
ps.rolesFor("dashboard");            // ["viewer"]
ps.featuresFor("admin");             // ["dashboard", "admin", "billing"]
```

**마스크 대수:** `intersect()` (교집합), `union()` (합집합)

**직렬화:** `toSnapshot()` → base64 인코딩된 JSON, `fromSnapshot()` 복원.

**매트릭스 뷰:** `toMatrix()` → boolean[][] (feature × role).

## PermissionView (캐시 필터)

mask 1개에 대한 캐시된 BitMaskSet 기반 필터 뷰:

```typescript
const view = codec.createView(mask);

view.check("shop/payment", "api", "admin/teams", "GET");  // O(1)
view.filterByService("shop/payment");     // 서비스별 필터
view.filterByType("api");                 // 타입별 필터
view.distinctServices();                  // 고유 서비스 목록
view.filter({ service: "shop/payment", type: "api" });  // 복합 조건
```

**성능:**
- 단발 `filterGrants`: ~250 ops/s (매번 WI→BI 변환)
- `createView` 1회 + filter N회: ~1,200+ ops/s per filter (6배 향상)

**점진적 패치:** `applyGrant()`, `applyRevoke()` — view 재생성 없이 O(1) 갱신.

## BitIndex 최적화 레이어

WeightedIndex(DB용)와 BitIndex(인메모리 필터용)를 IndexBridge로 연결:

```typescript
// WI 마스크 → BitMaskSet (인메모리 최적화)
const bitSet = codec.toBitMaskSet(mask);
bitSet.filterByLabel("service", svcIdx);   // O(1) 차원 추출

// BitMaskSet → WI 마스크 (DB 저장용)
const newMask = codec.toUint8Mask(bitSet);
```

| 인코딩 | 용도 | 장점 |
|--------|------|------|
| WeightedIndex | DB 저장 + 범위 질의 | 연속 주소 공간, SQL BETWEEN 호환 |
| BitIndex | 인메모리 필터링 | O(1) 차원 추출, packed 비트 연산 |
| IndexBridge | 양방향 변환 | WI ↔ BI 무손실 변환 |

## Permission Code 형식

`{service-ref}.{type}.{resource}.{action}` 4단 구조.

**파싱 전략 (`parsePermCode`):**
1. 첫 번째 `.` → service (namespace/name, `/` 포함 가능)
2. 두 번째 `.` → type
3. 마지막 `.` → action
4. 중간 전부 → resource (내부에 `.`이 없으므로 unambiguous)

**resource 제약:**
- 소문자, `/` 구분
- leading/trailing slash 금지
- depth ≤ 4
- `:param` 허용 (예: `orders/:id`)

**PermCodeFactory:** ServiceContext를 바인딩하여 service 부분을 생략:

```typescript
const perm = createPermCodeFactory(ctx);
perm.format("api", "admin/teams", "GET");
// → "shop/payment.api.admin/teams.GET"
```

## TernaryMask

ALLOW/DENY/UNSET 3상태를 address당 2비트로 표현:

| 값 | 의미 | 비트 |
|----|------|------|
| ALLOW | 명시적 허용 | 01 |
| DENY | 명시적 거부 | 10 |
| UNSET | 미설정 | 00 |

DefaultPolicy로 UNSET의 기본 해석(allow/deny)을 결정.

## PermissionViewCache

PermissionView를 LRU 캐시로 관리하는 매니저. 읽기 경로(초당 수천 회)에서 view 재생성 비용을 제거한다.

### 타입

```typescript
interface ViewCacheOptions {
  codec: PermissionCodec;
  loadMask: (key: string) => Promise<Uint8Array>;  // cache miss 시 mask 로딩
  maxSize?: number;  // LRU 최대 크기. 기본 1000.
}

interface CacheStats {
  size: number;          // 현재 캐시 크기
  hits: number;          // 히트 수
  misses: number;        // 미스 수
  patches: number;       // 점진적 패치 횟수
  invalidations: number; // 무효화 횟수
  hitRate: number;       // hits / (hits + misses)
}
```

### 읽기 경로

```typescript
const cache = new PermissionViewCache({ codec, loadMask, maxSize: 500 });

const view = await cache.get("user:123");   // miss → loadMask → createView → 캐시
const view = await cache.get("user:123");   // hit → O(1) 반환
const view = cache.peek("user:123");        // 동기 조회 (miss 시 undefined)
```

**Singleflight:** 동일 key에 대한 동시 `get()` N개 → `loadMask` 1회만 실행, Promise 공유.

### 무효화 4수준

| 수준 | API | 동작 | 사용 시점 |
|------|-----|------|-----------|
| Level 0 | `applyGrant()` / `applyRevoke()` | view 재생성 없이 O(1) Set.add/delete | grant/revoke 1건 |
| Level 1 | `invalidate(key)` | 해당 key 삭제, 다음 get에서 재로드 | 사용자별 권한 변경 |
| Level 2 | `invalidateByDim(dimLabel, value)` | 해당 차원 값을 가진 모든 view 폐기 | resource/service 삭제 |
| Level 3 | `invalidateAll()` | 전체 캐시 클리어 | schema 변경 |

```typescript
// Level 0: 점진적 패치
cache.applyGrant("user:123", "shop/payment", "api", "admin/teams", "GET");

// Level 1: 키 무효화
cache.invalidate("user:123");

// Level 2: 차원 무효화 — "admin/teams" 리소스가 삭제됨
cache.invalidateByDim("resource", "admin/teams");
// → 해당 리소스 권한을 가진 모든 캐시 view 폐기, 무효화된 key[] 반환

// Level 3: 전체 무효화
cache.invalidateAll();
```

### LRU 제거

`maxSize` 초과 시 Map 삽입 순서상 가장 오래된 항목을 자동 제거. `get()` 히트 시 삭제 후 재삽입으로 LRU 순서를 갱신한다.

## 선택 가이드

| 상황 | 인코딩 |
|------|--------|
| DB 저장 + 범위 질의 | WeightedIndex (PermissionCodec) |
| 인메모리 빠른 필터 | BitIndex (PermissionView) |
| 양쪽 모두 | IndexBridge (codec.bridge) |
| feature × role 단순 매트릭스 | PermissionSet |
| 3상태 (allow/deny/unset) | TernaryMask |
| 반복 필터 질의 + 캐시 | PermissionViewCache |

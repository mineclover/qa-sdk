# index-meta

닫힌 패턴 인덱싱 스키마의 **안정적인 버전 관리 DB 프레임워크**.

`weighted-index`가 좌표 ↔ 정수 변환의 수학을 제공한다면, `index-meta`는 그 위에 스키마 선언, 버전 관리, 저장소, 분산 라우팅까지 구성해 — 안정적이고 일정한 간격과 기간 내에서 천천히 버전을 올릴 수 있도록 지원하는 DB 인프라를 설계한다.

> 스펙 문서: [`docs/specs/indexing/index-meta/`](../../docs/specs/indexing/index-meta/README.md)

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: 스키마 선언                                         │
│  defineTable() → TableDef                                    │
│  compileSchema() → CompiledSchema (capacity, refs, diff)     │
├─────────────────────────────────────────────────────────────┤
│  Tier 2: 중앙 레지스트리 & 라우팅                             │
│  PrefixRegistry (capacity DAG, 주소 해석, 역참조)             │
│  PrefixRouter (prefix → D1 DB 라우팅)                        │
│  syncSchemaToRegistry()                                      │
├─────────────────────────────────────────────────────────────┤
│  Tier 3: DB 저장소                                           │
│  IndexMetaStore (schema_version + entry 테이블)               │
│  어댑터: InMemory │ SqlStore │ BetterSqliteDriver              │
│  DistributedStoreClient (라우터 + 멀티 스토어)                │
├─────────────────────────────────────────────────────────────┤
│  Tier 4: 인코딩 / 디코딩                                     │
│  MetaRegistry (주소 게이트웨이: 직렬화 + 코덱 생성)           │
│  MetaCodec (독립 encode/decode, LabelRegistry+PrefixCodec) │
│  MetaResolver (외부 소비용 DecodeMap 번들)                    │
│  createIndexSDK → IndexClient (경량 소비 레이어)              │
├─────────────────────────────────────────────────────────────┤
│  Tier 5: 데이터 운영                                         │
│  exportVersion / importVersion (백업/복원)                    │
│  validateEntryBatchPayload / applyEntryBatch (API 배치)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 설치

```bash
pnpm add index-meta
```

---

## 시작하기

```ts
import { MetaRegistry } from "index-meta";

const registry = new MetaRegistry({
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["read", "write", "delete"] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],   // 순서 = WeightedIndex shape 순서
      versions: {
        iv1: { snapshots: { role: "v1", action: "v1" } },
      },
    },
  },
});

// 코덱 생성 (특정 version에 특화)
const codec = registry.createCodec("perm", "iv1");

// 엔티티 ID로 인코딩 → VersionedValue
const vv = codec.encode({ role: "editor", action: "write" });
// { indexId: "perm", versionId: "iv1", value: 4 }

// 직렬화 (기본 프로토콜: colon)
const serialized = registry.serialize(vv); // "perm:iv1:4"

// 역직렬화 + 디코딩 (프로토콜 자동 감지)
const ids = codec.decode(registry.parse(serialized));
// { role: "editor", action: "write" }
```

---

## Client SDK (경량 소비 레이어)

백엔드·프론트엔드에서 동일한 스키마로 encode/decode하는 경량 SDK.

개발자는 `"click"`, `"home"` 같은 friendly name만 입력하면, SDK가 `{ indexId, versionId, value }` (VersionedValue)로 묶어 반환한다.

### 진입점

```ts
// 브라우저·프론트엔드·Edge — 경량 진입점 (Node.js 의존성 없음)
import { createIndexSDK } from "index-meta/client";

// Node.js 백엔드 — 전체 진입점 (SQL 어댑터 포함)
import { createIndexSDK } from "index-meta";
```

`index-meta/client`는 `better-sqlite3`·SQL 어댑터를 포함하지 않는 경량 번들이다.

### SDK 정의 (공유 패키지)

```ts
// packages/my-tracking-sdk/src/index.ts
import { createIndexSDK } from "index-meta/client";

const sdk = createIndexSDK({
  dims: {
    action:   { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["click", "view", "scroll", "submit"] } } },
    page:     { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["home", "product", "cart", "checkout"] } } },
    userType: { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["guest", "member", "premium"] } } },
  },
  indices: {
    tracking: {
      dims: ["action", "page", "userType"],
      versions: { v1: { snapshots: { action: "v1", page: "v1", userType: "v1" } } },
    },
  },
});

// version-pinned 클라이언트
export const tracking = sdk.client("tracking", "v1");

// enum-like 상수 (IDE 자동완성 + typo 방지)
export const ACTION    = tracking.constants("action");    // { click: "click", view: "view", ... }
export const PAGE      = tracking.constants("page");      // { home: "home", product: "product", ... }
export const USER_TYPE = tracking.constants("userType");  // { guest: "guest", member: "member", ... }
```

### 소비 (프론트엔드)

```ts
import { tracking, ACTION, PAGE } from "@my/tracking-sdk";

function trackClick(page: string) {
  const vv = tracking.encode({ action: ACTION.click, page, userType: user.type });
  // vv = { indexId: "tracking", versionId: "v1", value: 3 }
  fetch("/api/track", { method: "POST", body: JSON.stringify(vv) });
}
```

### 소비 (백엔드)

```ts
import { tracking } from "@my/tracking-sdk";

app.post("/track", (req) => {
  const vv = req.body; // { indexId: "tracking", versionId: "v1", value: 3 }
  const decoded = tracking.decode(vv);
  // { action: "click", page: "home", userType: "member" }
  db.insert({ pk: vv.value, index_id: vv.indexId, version_id: vv.versionId });
});
```

### IndexClient API

```ts
interface IndexClient {
  encode(entities: Record<string, EntityId>): VersionedValue;
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>>;
  decodeValue(value: number): Readonly<Record<string, EntityId>>;
  matchRanges(partial: Record<string, EntityId | null>): [number, number][];
  entries(dimId: string): readonly EntityId[];
  constants(dimId: string): Readonly<Record<string, EntityId>>;
  toDecodeMap(): DecodeMap;
  readonly indexId: string;
  readonly versionId: string;
  readonly size: number;
  readonly shape: readonly number[];
}
```

| 메서드 | 설명 |
|---|---|
| `encode` | entity names → `{ indexId, versionId, value }` |
| `decode` | VersionedValue → entity names (indexId/versionId 검증) |
| `decodeValue` | value(정수)만으로 decode (검증 없음) |
| `matchRanges` | 부분 매칭 범위 조회 (DB BETWEEN 쿼리) |
| `entries` | 바인딩된 version의 dim entries 배열 |
| `constants` | entries를 enum-like 객체로 반환 |
| `toDecodeMap` | DecodeMap 추출 (다른 서비스로 전달해 독립 decode) |

---

## 핵심 개념

| 개념 | 설명 |
|---|---|
| **DimDef** | 축(dimension) 슬롯. `kind`로 들어오는 값의 타입을 선언한다. |
| **DimSnapshot** | 특정 시점의 항목 목록. `entries[i-1]`이 1-based 좌표 `i`의 EntityId. append-only. |
| **IndexDef** | 순서 있는 dim 조합. 이 순서가 WeightedIndex의 shape을 결정한다. |
| **IndexVersion** | IndexDef의 각 dim에서 어느 DimSnapshot을 쓸지 고정한 버전 스냅샷. |
| **VersionedValue** | DB 저장 단위. `{ indexId, versionId, value }`. 직렬화: `"indexId:versionId:value"`. |
| **IndexActiveManifest** | 특정 버전에서 현재 active한 좌표 집합. 프로그래밍 레이어가 선택지 필터에 사용. |

### EntityId가 행(row) 고유 식별자

각 entries 항목은 고유한 EntityId를 가진다. 버전이 올라가도 같은 EntityId가 새 스냅샷에 존재하면 `decode → re-encode` 패턴으로 자동 대응할 수 있다. 구성이 같다면 명시적 migration이 불필요하다.

### DimKind: 축 값 타입 선언

각 dim이 받는 값의 종류를 선언한다. 인코딩 방식이 아니라 **값의 의미**를 정의한다.

#### `string_enum`

entries가 문자열. 값 자체가 고유 키.

```ts
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

#### `number_enum`

entries가 숫자. 숫자 값 자체가 고유 키. 다른 index와 참조 관계 없음.

```ts
tenant_id: {
  kind: { type: "number_enum" },
  snapshots: {
    v1: { entries: [1001, 1002, 1003] },
  },
}
```

#### `index_ref`

entries가 숫자이지만, 그 값이 다른 `WeightedIndex`의 1D 압축 결과. `indexId`로 어느 index 계열의 값만 받는지 선언한다.

```ts
doc_state: {
  kind: { type: "index_ref", indexId: "document_meta" },
  snapshots: {
    v1: { entries: [0, 2, 3] },  // document_meta index의 압축값들
  },
}
```

> `versionId`는 스키마 정의 관심사가 아니다. 데이터 적재 시 값과 함께 전달한다.

**DimKind 선택 기준:**

| 상황 | DimKind |
|---|---|
| 값이 문자열 식별자 | `string_enum` |
| 값이 숫자 식별자 (다른 index와 무관) | `number_enum` |
| 값이 다른 index의 encode() 결과 | `index_ref` |

#### entryRefs: 셀 수준 index 참조

dim의 kind가 `string_enum`이어도, 특정 위치의 entry 하나가 다른 index의 압축값인 경우 `entryRefs`로 선언한다.

```ts
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: {
      entries: ["admin", 42, "viewer"],  // index 2 = 42 (perm index의 압축값)
      entryRefs: {
        2: { indexId: "perm", versionId: "iv1" }, // 엔진 확장에 versionId가 필요
      },
    },
  },
}
```

**dim-level `index_ref`와의 차이:**

| | dim-level (`DimKind`) | entry-level (`entryRefs`) |
|---|---|---|
| 선언 위치 | `kind.type = "index_ref"` | `snapshot.entryRefs[pos]` |
| 적용 범위 | 해당 축 전체 | 특정 위치 하나 |
| `versionId` 수집 | 안 함 (데이터 적재 시 관리) | 함 (엔진 확장에 필요) |

### 예약 항목(Reserved Entry) 관례

`encode()`는 모든 차원에 반드시 값이 있어야 한다. 값이 없으면 에러다. 그러나 실제 도메인에서는 정규 분류 밖의 상태가 존재한다 — 값 미지정, 분류 불가, 식별 불가 등. 이런 상태가 에러가 되면 안 되므로, entries에 해당 상태를 나타내는 **예약 항목**을 포함해야 한다.

핵심: **dim이 어떤 예약 항목을 허용하는지 명시적으로 선언한다.** 선언하지 않으면 모든 entry가 정규 도메인 값이며, 값 없이 encode를 시도하면 에러로 처리해야 한다. 허용한다면 프로젝트 전체에서 동일한 토큰을 사용해야 한다.

#### 표준 토큰

`string_enum` 표준 예약 토큰 — **예약어**이므로 정규 도메인 값으로 사용 금지:

| 토큰 | 의미 |
|---|---|
| `"_"` | **null** — 값이 없거나 아직 결정되지 않음 |
| `"~"` | **other** — 정의된 카테고리에 해당하지 않음 |
| `"?"` | **unknown** — 값이 존재하지만 식별 불가 |

`number_enum` / `index_ref`는 기본 `0`, 충돌 시 `description`에 대체 토큰을 명시한다.

#### 규칙

1. 예약 항목은 **entries 배열의 앞쪽에 배치**. 순서: `"_"` → `"~"` → `"?"`.
2. `description`에 `reserved: [position]=token (의미)` 형식으로 선언.
3. `reserved:` 선언이 없으면 예약 항목 없음. 모든 entry가 정규 값.

```ts
// ── null만 허용 ───────────────────────────────────────────────────
priority: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미지정)',
  snapshots: {
    v1: { entries: ["_", "low", "medium", "high"] },
  },
}

// ── null + other 허용 ─────────────────────────────────────────────
category: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미분류), [2]="~" (기타)',
  snapshots: {
    v1: { entries: ["_", "~", "tech", "science", "art"] },
  },
}

// ── 예약 항목 없음 — 값은 반드시 정규 도메인 값 ───────────────────
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

#### 소비자 판단

1. `description`에 `reserved:` 선언이 **있으면**: 해당 토큰이 예약 항목. `"_"`, `"~"`, `"?"` 표준 토큰은 토큰 자체로 의미 확정.
2. `reserved:` 선언이 **없으면**: 모든 entry가 정규 값. 값 없이 encode할 수 없으므로 호출자가 에러 처리.

#### 마이그레이션에서의 활용

새 차원이 추가될 때 기존 데이터에 예약 토큰을 기본값으로 할당:

```ts
// v1: role × action (2차원) → v2: role × action × env (3차원)
const v1 = registry.createCodec("perm", "v1");
const v2 = registry.createCodec("perm", "v2");
const ids = v1.decode(oldV1Value);
const migrated = v2.encode({
  ...ids,
  env: 0,  // reserved: "환경 미지정"
});
```

### 버전 관리

#### DimSnapshot 버전

dim의 항목 목록이 시간이 지남에 따라 변할 때 새 snapshot을 추가한다.

```ts
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
    v2: { entries: ["admin", "editor", "viewer", "guest"] }, // guest 추가
  },
}
```

**entries는 append-only.** 한 번 부여된 1-based 좌표는 불변이다. 항목을 추가할 때는 항상 배열 끝에 붙인다. 기존 위치를 변경하면 안 된다.

**`capacity` (선택):** `DimSnapshotInput.capacity`를 entries.length보다 크게 설정하면 headroom(여유 공간)이 생긴다. entries를 추가해도 capacity 이내라면 shape/weight 변경 없이 동일 버전을 유지할 수 있다. 생략 시 entries.length와 동일.

```ts
v1: { entries: ["admin", "editor", "viewer"], capacity: 8 }
// headroom = 8 - 3 = 5. 항목 5개 추가까지 shape 불변.
```

#### IndexVersion

IndexDef의 각 dim에서 어느 DimSnapshot을 사용할지 고정한다.

```ts
perm: {
  dims: ["role", "action", "resource"],
  versions: {
    // v1: role의 v1 snapshot 사용 (total=3)
    v1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
    // v2: role이 v2로 교체 (total=4로 확장)
    v2: { snapshots: { role: "v2", action: "v1", resource: "v1" } },
  },
}
```

버전이 올라갈 때 WeightedIndex shape이 변경되므로, 버전별로 독립적인 value 공간을 가진다.

### Active/Inactive 관리

특정 항목을 삭제하지 않고 비활성화할 수 있다. entries에서 제거하면 좌표가 깨지므로, `entryFlags`로 inactive 처리한다.

```ts
action: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["read", "write", "delete"] },
    v2: {
      entries: ["read", "write", "delete"],  // 배열 유지
      entryFlags: {
        3: {  // 1-based. delete(3번)을 비활성화
          status: "inactive",
          reason: "deprecated in v2",
          updatedAt: "2026-03-01",
        },
      },
    },
  },
}
```

#### IndexActiveManifest로 선택지 필터링

```ts
const manifest = registry.getActiveManifest("perm", "v2");
// {
//   indexId: "perm", versionId: "v2",
//   dims: [
//     { dimId: "role",   snapshotId: "v2", total: 4, activeIndices: [1,2,3,4] },
//     { dimId: "action", snapshotId: "v2", total: 3, activeIndices: [1,2] },  // delete 제외
//     { dimId: "resource", ... }
//   ]
// }

const actionDim = manifest.dims.find(d => d.dimId === "action")!;
// 프로그래밍 레이어에서 activeIndices만 허용하는 필터로 활용
const activeActions = actionDim.activeIndices.map(i =>
  registry.getDimSnapshot("action", actionDim.snapshotId).entries[i - 1]
);
// ["read", "write"]
```

**중요:** `MetaCodec.encode()`와 `decode()`는 inactive를 강제하지 않는다. 기존에 inactive 항목으로 인코딩된 값도 항상 decode할 수 있다. active/inactive 강제는 호출자(프로그래밍 레이어)의 책임이다.

---

## Tier 1–5: 상세 아키텍처

스키마 선언(`defineTable`/`compileSchema`), 저장소(`IndexMetaStore`), 중앙 레지스트리(`PrefixRegistry`), 인코딩/디코딩(`MetaRegistry`/`MetaCodec`/`MetaResolver`), 데이터 운영(`exportVersion`/`importVersion`/`applyEntryBatch`)의 상세 사용법.

> 상세: [`docs/tier-architecture.md`](docs/tier-architecture.md)

---

## 마이그레이션

EntityId 기반 암묵적 이동, 좌표 수준 명시적 이동(`DimSnapshotMigration`), 즉시 마이그레이션 유틸(`migrateAddress`/`migrateValue`/`migrateBatch`), cross-index 정보 전이(`migrateCrossIndex`/`completeCrossIndex`).

> 상세: [`docs/migration.md`](docs/migration.md)

---

## 좌표 쿼리 레이어 (Coordinate Query Layer)

cross-index 탐색, 버전 횡단 쿼리, 정책 해석을 지원한다. `weighted-index`의 pattern-lattice 위에 구축된다.

### Cross-Index Query

하위 index 조건으로 상위 index의 주소 범위를 계산하거나, 중첩 index를 재귀적으로 decode한다.

```ts
import { composeQuery, deepDecode } from "index-meta";

// "format=PDF인 article의 value 범위" — doc_meta 조건으로 article 범위 계산
const ranges = composeQuery(
  { indexId: "article", versionId: "v1" },
  "quality_tier",     // index_ref dim
  { format: "PDF" },  // 하위 index 조건
  registry,
);
// → [[20, 39], [80, 99]]  (format=PDF인 quality_tier 위치에 해당하는 article 범위)

// 중첩 index 재귀 decode
const result = deepDecode(
  { indexId: "article", versionId: "v1", value: 25 },
  registry,
);
// result.layers: Map { "article" → { quality_tier: 5, priority: 0 }, "doc_meta" → { format: "PDF", lang: "ko" } }
// result.path: [article vv, doc_meta vv]
```

`deepDecode`는 visited set으로 순환 참조를 방지한다. dim-level `index_ref`와 entry-level `entryRefs` 모두 추적.

### Version Query

entity 이름 기준으로 여러 version에 걸쳐 검색하거나, 버전 간 좌표 제약을 변환한다.

```ts
import { queryAcrossVersions, entityVersionSpan, translateConstraint } from "index-meta";

// entity 기준으로 여러 version의 범위 반환 (position이 달라도 동일 의미 조건 적용)
const result = queryAcrossVersions("perm", ["iv1", "iv2", "iv3"], { role: "admin" }, registry);
// → Map { "iv1" → [[0,8]], "iv2" → [[0,8]], "iv3" → [[0,11]] }

// entity가 존재하는 version 범위
entityVersionSpan("perm", "role", "guest", registry);
// → ["iv2", "iv3"]  (guest는 iv2부터 존재)

// activeOnly 옵션으로 inactive version 제외
entityVersionSpan("perm", "role", "viewer", registry, { activeOnly: true });
// → ["iv1", "iv2"]  (viewer는 iv3에서 inactive)

// 버전 간 좌표 제약 변환 (migration edge 또는 EntityId 기반)
translateConstraint("perm", "iv1", "iv2", { role: "2", action: null }, registry);
// → { role: "3", action: null }  (migration에 의해 position 변경)
```

### Policy Resolver

패턴 기반 규칙 매칭과 충돌 감지. RBAC 등의 정책 해석에 사용.

```ts
import { matchRules, resolvePolicy, detectConflicts } from "index-meta";
import type { CoordConstraint } from "weighted-index";

const shape = [8, 4, 16];
const rules = [
  { pattern: [null, null, null] as CoordConstraint[], value: "deny" },
  { pattern: ["3", "2", null] as CoordConstraint[], value: "allow" },
];

// 좌표에 매칭되는 규칙 목록 (구체성 순 정렬)
matchRules([3, 2, 5], rules, shape);
// → [{ pattern: ["3","2",null], value: "allow" }, { pattern: [null,null,null], value: "deny" }]

// 전략별 정책 해석
resolvePolicy([3, 2, 5], rules, shape, "most-specific"); // → "allow"
resolvePolicy([3, 2, 5], rules, shape, "first-match");   // → "deny" (입력 순서)

// 규칙 간 충돌 감지 (패턴이 겹치는데 값이 다른 경우)
const conflicts = detectConflicts(rules, shape);
// → [{ ruleA: rules[0], ruleB: rules[1], overlap: ["3","2",null] }]
```

**전략:**

| 전략 | 설명 |
|---|---|
| `most-specific` | `patternSpecificity`가 가장 높은 규칙 승리 |
| `priority` | 배열 인덱스 우선 (낮은 인덱스 = 높은 우선순위) |
| `first-match` | 매칭되는 첫 번째 규칙 |
| `collect` | 매칭되는 모든 규칙의 값 배열 반환 |

---

## 게이트 제어 (encode/decode 허용 여부)

composite 주소별 encode/decode 허용 여부를 제어한다. dim별 상태를 composite 주소 공간으로 미리 계산해 캐싱하고, 조회 시 O(log n)으로 반환한다.

### 4가지 상태

| 상태 | encode | decode | 설명 |
|---|---|---|---|
| `active` | ✓ | ✓ | 정상 |
| `inactive` | ✗ | ✓ | 기존 데이터 조회만, 새 값 추가 불가 |
| `open` | ✓ | ✗ | 빈 슬롯, 값 채울 수 있으나 아직 없음 |
| `reserved` | ✗ | ✗ | 완전 잠금 |

composite 게이트 = 각 dim 게이트의 AND. inactive dim + open dim이 겹치는 composite 주소 → reserved로 승격.

### 사용법

```ts
import {
  computeStateRanges, checkGate, positionsToConstraint,
  InMemoryAddressStateStore,
} from "index-meta";
import type { DimStateSpec } from "index-meta";

const shape = [8, 4, 16, 4]; // role(8) × action(4) × resource(16) × env(4)

// dim별 상태 선언 (active는 기본값이므로 선언 불필요)
const specs: DimStateSpec[] = [
  { dimIndex: 0, state: "inactive", coords: "5",   reason: "deprecated" },
  { dimIndex: 0, state: "open",     coords: "6-8", reason: "여유 공간" },
];

// composite 주소 구간 계산
const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(shape, specs);

// 캐시 저장
const store = new InMemoryAddressStateStore();
await store.save({
  prefix: "perm", versionId: "v1",
  specs, reservedRanges, inactiveRanges, openRanges,
  computedAt: new Date().toISOString(),
});

// 게이트 조회 — O(log n)
const cached = await store.get("perm", "v1");
const { reservedRanges: rv, inactiveRanges: ia, openRanges: op } = cached!;

const gate = checkGate(address, rv, ia, op);
// { encode: boolean, decode: boolean, state: AddressState, shouldVerify: boolean }
if (!gate.encode) { /* encode 차단 */ }
if (gate.shouldVerify) {
  // open 상태: 캐시 stale 가능 → 실제 조회로 검증 권장
}
```

캐시 없으면 (`null`) 전체 active로 처리한다.

#### coords 표현

`DimStateSpec.coords`는 `CoordConstraint` 문자열. `null`이면 해당 dim 전체.

```ts
// positionsToConstraint는 weighted-index가 원천, index-meta에서 re-export
import { positionsToConstraint } from "index-meta";    // re-export
import { positionsToConstraint } from "weighted-index"; // 원천

positionsToConstraint([6, 7, 8])    // → "6-8"
positionsToConstraint([1, 3, 5])    // → "1,3,5"
positionsToConstraint([1, 2, 5, 6]) // → "1-2,5-6"
```

#### shouldVerify

`open` 상태에서만 `true`. 캐시가 갱신되기 전 이미 값이 채워졌을 수 있으므로 실제 조회 권장. `reserved`는 의도적 잠금이므로 `false` (hard block).

### 구간 조회 헬퍼

```ts
import { encodableRanges, decodableRanges, activeRanges } from "index-meta";

encodableRanges(capacity, reservedRanges, inactiveRanges)          // active + open
decodableRanges(capacity, reservedRanges, openRanges)              // active + inactive
activeRanges(capacity, reservedRanges, inactiveRanges, openRanges) // active만
```

---

## API 레퍼런스

`MetaRegistry`, `MetaCodec`, 조회 API, Migration API, Diff & Validation, 즉시 마이그레이션, Coordinate Query Layer, 게이트 제어, `MetaResolver`의 전체 시그니처.

> 상세: [`docs/api-reference.md`](docs/api-reference.md)

---

## 에러 처리

모든 에러는 `IndexMetaError`를 상속한다.

```ts
import {
  IndexMetaError,
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  EntryNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
} from "index-meta";
```

| 에러 | 발생 조건 |
|---|---|
| `DimNotFoundError` | 등록되지 않은 dimId |
| `SnapshotNotFoundError` | 등록되지 않은 snapshotId |
| `IndexNotFoundError` | 등록되지 않은 indexId (parse, index_ref 교차검증 등) |
| `IndexVersionNotFoundError` | 등록되지 않은 versionId |
| `EntryNotFoundError` | encode 시 EntityId를 snapshot에서 찾지 못함 |
| `MigrationNotFoundError` | getMigration 직접 조회 실패 / traceMigration 경로 없음 |
| `ValidationError` | 입력 데이터 제약 조건 위반 (중복 ID, 빈 entries, 범위 오류 등) |
| `ParseError` | serialize 문자열 형식 오류 |

```ts
try {
  const codec = registry.createCodec("perm", "iv1");
  const vv = codec.encode({ role: "unknown_role", action: "read" });
} catch (e) {
  if (e instanceof EntryNotFoundError) {
    // EntityId가 snapshot에 없음
  } else if (e instanceof IndexMetaError) {
    // 그 외 라이브러리 에러
  } else {
    throw e;
  }
}
```

---

## 공개 API

```ts
// ── Client SDK ────────────────────────────────────────
export { createIndexSDK } from "index-meta";              // 또는 "index-meta/client"
export type { IndexSDK, IndexClient } from "index-meta";  // 또는 "index-meta/client"

// ── 인코딩/디코딩 ────────────────────────────────────
export { MetaRegistry, MetaCodec, MetaResolver } from "index-meta";

// ── 스키마 선언 ──────────────────────────────────────
export { defineTable, compileSchema } from "index-meta";

// ── 저장소 & 인프라 ─────────────────────────────────
export { InMemoryIndexMetaStore } from "index-meta";
export { InMemoryPrefixRegistry } from "index-meta";
export { SqlPrefixRegistry } from "index-meta";
export { InMemoryPrefixRouter } from "index-meta";
export { SqlIndexMetaStore } from "index-meta";        // + SqlDriver 인터페이스
export { BetterSqliteDriver } from "index-meta";       // Node.js SQLite 드라이버
export { DistributedStoreClient } from "index-meta";
export { syncSchemaToRegistry } from "index-meta";

// ── 데이터 운영 ──────────────────────────────────────
export { exportVersion, importVersion } from "index-meta";
export { validateEntryBatchPayload, applyEntryBatch } from "index-meta";

// ── 즉시 마이그레이션 유틸 ───────────────────────────
export { migrateAddress, migrateValue, migrateBatch } from "index-meta";
export { migrateCrossIndex, completeCrossIndex } from "index-meta";

// ── 좌표 쿼리 레이어 ────────────────────────────────
export { composeQuery, deepDecode } from "index-meta";
export { queryAcrossVersions, entityVersionSpan, translateConstraint } from "index-meta";
export { matchRules, resolvePolicy, detectConflicts } from "index-meta";

// ── 게이트 제어 ──────────────────────────────────────
export { ADDRESS_GATE, computeStateRanges, checkGate, classifyAddress } from "index-meta";
export { encodableRanges, decodableRanges, activeRanges, positionsToConstraint } from "index-meta";
export { InMemoryAddressStateStore } from "index-meta";
export { SqlAddressStateStore } from "index-meta";
export { InMemoryEntryFlagStore } from "index-meta";
export { SqlEntryFlagStore } from "index-meta";

// ── 인터페이스 ───────────────────────────────────────
export type { IndexMetaStore, SchemaVersionRecord, EntryRecord } from "index-meta";
export type { PrefixRegistry, PrefixRegistryRecord } from "index-meta";
export type { PrefixRouter } from "index-meta";
export type { DimRef, ResolvedAddress } from "index-meta";
export type { EntryFlagStore, EntryFlagRecord } from "index-meta";

// ── 스키마 타입 ──────────────────────────────────────
export type { TableDef, AddressRef, LeafVersion, CompositeVersion, TableVersion } from "index-meta";
export type {
  CompiledSchema, SchemaDiff, TableSpec, LeafTableSpec, CompositeTableSpec,
  LeafVersionSpec, CompositeVersionSpec, CompositeVersionDim,
  TableVersionChange, VersionCapacityChange,
} from "index-meta";

// ── 인코딩 타입 ──────────────────────────────────────
export type {
  EntityId, VersionedValue, DecodeMap,
  MetaRegistryInput, AddressConfig,
  DimKind, DimDef, DimSnapshot, IndexDef, IndexVersion,
  DimActiveSet, IndexActiveManifest,
  DimRange, IndexRange, MetaDataset,
  DimSnapshotMigration, DimSnapshotInput, DimInput,
  IndexVersionInput, IndexInput,
  EntryStatus, EntryFlag, EntryIndexRef,
  SnapshotDiff, VersionDiff,
} from "index-meta";

// ── 마이그레이션 타입 ─────────────────────────────────
export type { MigrateResult, CrossIndexPartialResult, CrossIndexMigrateResult } from "index-meta";

// ── 데이터 운영 타입 ─────────────────────────────────
export type { VersionBackup } from "index-meta";
export type { EntryBatchPayload } from "index-meta";

// ── 게이트 제어 타입 ──────────────────────────────────
export type { DimStateSpec, AddressState, GateResult } from "index-meta";
export type { AddressStateStore, AddressStateCacheRecord } from "index-meta";

// ── 에러 ─────────────────────────────────────────────
export {
  IndexMetaError, DimNotFoundError, SnapshotNotFoundError,
  IndexNotFoundError, IndexVersionNotFoundError, EntryNotFoundError,
  MigrationNotFoundError, ValidationError, ParseError,
} from "index-meta";
```

---

## 빌드

```bash
pnpm build       # tsup → dist/ (ESM + CJS, 2 entry points)
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
```

tsup이 두 진입점(`src/index.ts`, `src/client.ts`)을 빌드하며, 공통 코드는 chunk로 분리된다.

| 진입점 | import 경로 | 포함 내용 | better-sqlite3 |
|---|---|---|---|
| `index.ts` | `"index-meta"` | 전체 (SQL 어댑터, 마이그레이션, 분산 클라이언트) | ✓ (external) |
| `client.ts` | `"index-meta/client"` | SDK + 코어 (MetaRegistry, MetaCodec, MetaResolver) | ✗ |

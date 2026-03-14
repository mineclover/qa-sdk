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
│  어댑터: InMemory │ SqlStore │ D1Store │ BetterSqliteDriver  │
│  DistributedStoreClient (라우터 + 멀티 스토어)                │
├─────────────────────────────────────────────────────────────┤
│  Tier 4: 인코딩 / 디코딩                                     │
│  MetaRegistry (주소 게이트웨이: 직렬화 + 코덱 생성)           │
│  MetaCodec (독립 encode/decode, LabelRegistry+PrefixRegistry) │
│  MetaResolver (외부 소비용 DecodeMap 번들)                    │
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

## 스키마 선언 (Tier 1)

`defineTable()`로 테이블을 선언하고, `compileSchema()`로 버전 변경을 감지한다.

```ts
import { defineTable, compileSchema } from "index-meta";

const role = defineTable("role", {
  kind: "leaf",
  versions: [{ id: "v1", capacity: 8 }],
});

const perm = defineTable("perm", {
  kind: "composite",
  versions: [{
    id: "v1",
    refs: [
      { table: "role", versionId: "v1" },
      { table: "action", versionId: "v1" },
    ],
  }],
});

const compiled = compileSchema({ role, perm });
// compiled.diff — 이전 스키마 대비 변경 사항
// compiled.tables — capacity, refs 확정된 테이블 정보
```

---

## 저장소 (Tier 2–3)

### IndexMetaStore — entry 저장

```ts
import { InMemoryIndexMetaStore } from "index-meta";
// 또는: SqlIndexMetaStore + BetterSqliteDriver (Node.js)
// 또는: D1IndexMetaStore (Cloudflare Workers)

const store = new InMemoryIndexMetaStore();
await store.upsertSchemaVersion({ prefix: "role", versionId: "v1", capacity: 8 });
await store.insertEntry({ prefix: "role", versionId: "v1", position: 1, value: "admin" });
```

### PrefixRegistry — 중앙 DAG 관리

모든 prefix의 capacity, 의존 관계(refs), 역참조를 관리한다. 주소 해석(`resolveAddress`)도 제공.

```ts
import { InMemoryPrefixRegistry } from "index-meta";

const registry = new InMemoryPrefixRegistry();
await registry.register({ prefix: "role", versionId: "v1", capacity: 8, refs: [] });
await registry.register({ prefix: "perm", versionId: "v1", capacity: 2048,
  refs: [{ prefix: "role", versionId: "v1", capacity: 8 }] });

const resolved = await registry.resolveAddress("perm:v1:42");
// { prefix: "perm", versionId: "v1", index: 42, capacity: 2048, shape: [8,4,16,4], ... }
```

### 분산 저장소

```ts
import { DistributedStoreClient, InMemoryPrefixRouter } from "index-meta";

const router = new InMemoryPrefixRouter();
router.assign("role", store1);
router.assign("perm", store2);

const client = new DistributedStoreClient(router);
await client.insertEntry({ prefix: "role", versionId: "v1", position: 1, value: "admin" });
// → router가 store1으로 라우팅
```

### 데이터 운영 (Tier 5)

```ts
import { exportVersion, importVersion, applyEntryBatch } from "index-meta";

// 백업/복원
const backup = await exportVersion(store, "role", "v1");
await importVersion(targetStore, backup);

// API 배치 적재
await applyEntryBatch(store, {
  prefix: "role", versionId: "v1",
  entries: [{ position: 1, value: "admin" }, { position: 2, value: "editor" }],
});
```

---

## DimKind: 축 값 타입 선언

각 dim이 받는 값의 종류를 선언한다. 인코딩 방식이 아니라 **값의 의미**를 정의한다.

### `string_enum`

entries가 문자열. 값 자체가 고유 키.

```ts
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

### `number_enum`

entries가 숫자. 숫자 값 자체가 고유 키. 다른 index와 참조 관계 없음.

```ts
tenant_id: {
  kind: { type: "number_enum" },
  snapshots: {
    v1: { entries: [1001, 1002, 1003] },
  },
}
```

### `index_ref`

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

---

## 버전 관리

### DimSnapshot 버전

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

### IndexVersion

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

---

## Active/Inactive 관리

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

### IndexActiveManifest로 선택지 필터링

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

## 버전 간 이동

### EntityId 기반 암묵적 이동 (권장)

같은 EntityId가 두 버전 모두에 존재하면, `decode → re-encode` 패턴으로 자동 대응된다.

```ts
const v1 = registry.createCodec("perm", "v1");
const v2 = registry.createCodec("perm", "v2");

// v1에 저장된 값
const old = registry.parse("perm:v1:8");
const entityIds = v1.decode(old);
// { role: "viewer", action: "read", resource: "articles" }

// v2로 re-encode — idToIndex가 v2 snapshot에서 자동으로 위치를 찾는다
const migrated = v2.encode(entityIds);
// { indexId: "perm", versionId: "v2", value: ... }
```

구성이 같다면 명시적 migration 없이 버전 간 이동이 가능하다.

### Migration: 좌표 수준 명시적 이동

entries의 순서가 바뀌거나, 같은 위치에 다른 엔티티가 들어오는 경우 `DimSnapshotMigration`으로 좌표 변환 동선을 기록한다.

```ts
category: {
  kind: { type: "string_enum" },
  snapshots: {
    s1: { entries: ["tech", "science", "art"] },         // science=2, art=3
    s2: { entries: ["tech", "art", "science", "culture"] }, // art=2, science=3
  },
  migrations: [
    {
      fromSnapshotId: "s1",
      toSnapshotId: "s2",
      indexMap: {
        2: 3,  // s1의 2번(science) → s2의 3번
        3: 2,  // s1의 3번(art)     → s2의 2번
        // 1(tech)은 명시 없음 → identity (1 → 1)
      },
    },
  ],
}
```

#### `getMigration` — 직접 등록된 migration 조회

```ts
const mig = registry.getMigration("category", "s1", "s2");
// { fromSnapshotId: "s1", toSnapshotId: "s2", indexMap: { 2: 3, 3: 2 } }
```

#### `traceMigration` — BFS 체인

직접 연결이 없어도 등록된 migration edge를 따라 경로를 찾는다.

```ts
// s1→s2→s3 chain이 등록되어 있으면 s1→s3 직접 추적 가능
const newIndex = registry.traceMigration("category", "s1", "s3", 2);
// s1의 2번(science)이 s3에서 어디 있는지 반환
```

`indexMap`에 명시되지 않은 위치는 identity(동일 번호 유지)로 처리된다.

---

## 예약 항목(Reserved Entry) 관례

`encode()`는 모든 차원에 반드시 값이 있어야 한다. 값이 없으면 에러다. 그러나 실제 도메인에서는 정규 분류 밖의 상태가 존재한다 — 값 미지정, 분류 불가, 식별 불가 등. 이런 상태가 에러가 되면 안 되므로, entries에 해당 상태를 나타내는 **예약 항목**을 포함해야 한다.

핵심: **dim이 어떤 예약 항목을 허용하는지 명시적으로 선언한다.** 선언하지 않으면 모든 entry가 정규 도메인 값이며, 값 없이 encode를 시도하면 에러로 처리해야 한다. 허용한다면 프로젝트 전체에서 동일한 토큰을 사용해야 한다.

### 표준 토큰

`string_enum` 표준 예약 토큰 — **예약어**이므로 정규 도메인 값으로 사용 금지:

| 토큰 | 의미 |
|---|---|
| `"_"` | **null** — 값이 없거나 아직 결정되지 않음 |
| `"~"` | **other** — 정의된 카테고리에 해당하지 않음 |
| `"?"` | **unknown** — 값이 존재하지만 식별 불가 |

`number_enum` / `index_ref`는 기본 `0`, 충돌 시 `description`에 대체 토큰을 명시한다.

### 규칙

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

### 소비자 판단

1. `description`에 `reserved:` 선언이 **있으면**: 해당 토큰이 예약 항목. `"_"`, `"~"`, `"?"` 표준 토큰은 토큰 자체로 의미 확정.
2. `reserved:` 선언이 **없으면**: 모든 entry가 정규 값. 값 없이 encode할 수 없으므로 호출자가 에러 처리.

### 마이그레이션에서의 활용

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

---

## entryRefs: 셀 수준 index 참조

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

---

## 중첩 index (index_ref 계층)

`index_ref` dim을 사용하면 index를 중첩할 수 있다.

```ts
const registry = new MetaRegistry({
  dims: {
    format: {
      kind: { type: "string_enum" },
      snapshots: { fv1: { entries: ["pdf", "html"] } },
    },
    lang: {
      kind: { type: "string_enum" },
      snapshots: { lv1: { entries: ["ko", "en"] } },
    },
    // doc_meta index의 압축값을 저장하는 dim
    quality_tier: {
      kind: { type: "index_ref", indexId: "doc_meta" },
      snapshots: {
        qtv1: { entries: [0, 2] }, // pdf/ko=0, html/ko=2 (doc_meta 압축값)
      },
    },
  },
  indices: {
    doc_meta: {
      dims: ["format", "lang"],
      versions: { dmv1: { snapshots: { format: "fv1", lang: "lv1" } } },
    },
    article: {
      dims: ["quality_tier"],
      versions: { av1: { snapshots: { quality_tier: "qtv1" } } },
    },
  },
});

// outer encode
const articleCodec = registry.createCodec("article", "av1");
const vv = articleCodec.encode({ quality_tier: 2 });

// outer decode → doc_meta 압축값(=2) 반환
const outer = articleCodec.decode(vv);
// { quality_tier: 2 }

// inner decode → format + lang 복원
const docMetaCodec = registry.createCodec("doc_meta", "dmv1");
const inner = docMetaCodec.decodeValue(outer.quality_tier as number);
// { format: "html", lang: "ko" }
```

`MetaCodec.decode()`는 EntityId 수준에서 중단한다. `index_ref` dim의 경우 반환된 숫자 값을 inner index의 코덱으로 재귀 decode하는 것은 호출자의 책임이다.

---

## Address 프로토콜 바인딩

`address` 설정을 추가하면 VersionedValue를 UUID 등 고정 포맷으로 직렬화할 수 있다. 이를 통해 RDB의 PK로 직접 사용 가능하다.

### 설정

```ts
import { MetaRegistry } from "index-meta";
import { PACK_FORMATS } from "weighted-index";

const registry = new MetaRegistry({
  dims: {
    role:   { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["admin", "editor"] } } },
    action: { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["read", "write"] } } },
  },
  indices: {
    perm: { dims: ["role", "action"], versions: { v1: { snapshots: { role: "v1", action: "v1" } } } },
  },
  address: {
    format: PACK_FORMATS.uuid,   // 컨테이너 포맷
    schemaChars: 4,              // indexId → hex 4자리
    versionChars: 2,             // versionId → hex 2자리
    schemas:  { perm: 1 },       // indexId → 숫자 매핑
    versions: { v1: 1 },         // versionId → 숫자 매핑
  },
});
```

### UUID PK 생성/복원

```ts
const codec = registry.createCodec("perm", "v1");

// entity ID → UUID PK (codec.encode + serialize)
const pk = registry.serialize(codec.encode({ role: "admin", action: "read" }));
// → "00010001-0000-0000-0000-000000000000"
//    ├──┤├┤                          ├──┤
//   schema ver         gap          index

// UUID PK → entity ID (parse + codec.decode)
codec.decode(registry.parse(pk));
// → { role: "admin", action: "read" }
```

### 다중 프로토콜

`serialize`/`parse`는 `weighted-index`의 `AddressConverter`에 위임한다. 프로토콜을 명시하거나 자동 감지할 수 있다.

```ts
const vv = codec.encode({ role: "admin", action: "read" });

registry.serialize(vv);              // 기본 → UUID (address 설정 시)
registry.serialize(vv, "colon");     // → "perm:v1:0"
registry.serialize(vv, "uri");       // → "wi://perm/v1/0"
registry.serialize(vv, "compact");   // → "perm-v1-0"

// 자동 감지 파싱
registry.parse("perm:v1:0");                                    // colon
registry.parse("wi://perm/v1/0");                                // uri
registry.parse("00010001-0000-0000-0000-000000000000");          // layout:uuid

// converter를 직접 사용한 프로토콜 간 변환
registry.converter.convert("perm:v1:0", "layout:uuid");
```

### 역할 분리

프로토콜 변환 로직은 `weighted-index`의 `AddressConverter`에만 존재하며, MetaRegistry는 위임 + 레지스트리 검증(indexId/versionId 존재, value 범위)만 수행한다.

```
weighted-index  →  AddressConverter, createLayoutProtocol  (프로토콜 변환)
index-meta      →  MetaRegistry.serialize/parse            (위임 + 검증)
```

### AddressConfig 검증 규칙

- 등록된 모든 indexId가 `schemas`에 매핑되어야 한다
- 등록된 모든 versionId가 `versions`에 매핑되어야 한다
- 매핑 값은 non-negative integer, 값 중복 불가 (역매핑 충돌 방지)

---

## API 레퍼런스

### `new MetaRegistry(input)`

생성자에서 모든 검증을 수행한다. 검증 통과 후에는 불변.

```ts
new MetaRegistry(input: MetaRegistryInput)
```

### 핵심 API

```ts
// 특정 version에 특화된 독립 코덱 생성
createCodec(indexId: string, versionId: string): MetaCodec

// 버전별 활성 인덱스 집합 반환
getActiveManifest(indexId: string, versionId: string): IndexActiveManifest

// VersionedValue ↔ 프로토콜 문자열 (AddressConverter에 위임)
// protocol 생략 시 기본 프로토콜 (address 미설정: colon, 설정: layout)
serialize(vv: VersionedValue, protocol?: string): string
parse(input: string, protocol?: string): VersionedValue

// AddressConverter 접근 및 기본 프로토콜
get converter(): AddressConverter
get defaultProtocol(): string
```

### MetaCodec API

```ts
// DecodeMap으로 직접 생성하거나, registry.createCodec()으로 생성
new MetaCodec(map: DecodeMap)

// 엔티티 ID 레코드 → VersionedValue (inactive 강제 없음)
encode(entityIds: Record<string, EntityId>): VersionedValue

// VersionedValue → 엔티티 ID 레코드 (indexId/versionId 일치 검증, inactive도 decode 가능)
decode(vv: VersionedValue): Readonly<Record<string, EntityId>>

// value만으로 decode (indexId/versionId 검증 없음)
decodeValue(value: number): Readonly<Record<string, EntityId>>

get indexId(): string
get versionId(): string
get size(): number
get shape(): readonly number[]
toDecodeMap(): DecodeMap
```

### 조회 API

```ts
getDimDef(dimId: string): DimDef
getDimSnapshot(dimId: string, snapshotId: string): DimSnapshot
getIndexDef(indexId: string): IndexDef
getIndexVersion(indexId: string, versionId: string): IndexVersion
getWeightedIndex(indexId: string, versionId: string): WeightedIndex  // 캐시됨

get dimIds(): readonly string[]
get indexIds(): readonly string[]
getVersionIds(indexId: string): readonly string[]
getSnapshotIds(dimId: string): readonly string[]
```

### Migration API

```ts
// 직접 등록된 migration 반환. 없으면 MigrationNotFoundError
getMigration(dimId: string, fromSnapshotId: string, toSnapshotId: string): DimSnapshotMigration

// BFS로 경로를 찾아 indexMap 체인 적용. 최종 1-based index 반환
traceMigration(dimId: string, fromSnapshotId: string, toSnapshotId: string, index: number): number
```

### Resolver API

`MetaResolver`는 MetaRegistry의 데이터를 외부 소비용 번들로 변환한다. DB 동기화, 프론트엔드 전송, API 응답 등에 사용.

```ts
import { MetaResolver } from "index-meta";

const resolver = new MetaResolver(registry);

// 특정 version의 디코딩 최소 번들 (외부에서 MetaRegistry 없이 decode 가능)
resolver.getDecodeMap(indexId: string, versionId: string): DecodeMap

// dim의 모든 snapshot (버전 range)
resolver.getDimRange(dimId: string): DimRange

// index의 모든 version (shape/size/dims 포함)
resolver.getIndexRange(indexId: string): IndexRange

// 전체 데이터셋 (index별 + dim별 그룹핑)
resolver.getDataset(): MetaDataset
```

#### DecodeMap 외부 디코딩 예시

```ts
const map = resolver.getDecodeMap("perm", "v1");
// → { shape: [3,3,3], size: 27, dims: [{dimId:"role", entries:[...]}, ...] }

// 외부 시스템에서 MetaRegistry 없이 value → entity ID 복원:
const weights = map.shape.map((_, i) => map.shape.slice(i + 1).reduce((a, b) => a * b, 1));
let remaining = value;
for (let i = 0; i < map.dims.length; i++) {
  const coord = Math.floor(remaining / weights[i]) + 1;
  remaining = remaining % weights[i];
  result[map.dims[i].dimId] = map.dims[i].entries[coord - 1];
}
```

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
// ── 인코딩/디코딩 ────────────────────────────────────
export { MetaRegistry, MetaCodec, MetaResolver } from "index-meta";

// ── 스키마 선언 ──────────────────────────────────────
export { defineTable, compileSchema } from "index-meta";

// ── 저장소 & 인프라 ─────────────────────────────────
export { InMemoryIndexMetaStore } from "index-meta";
export { InMemoryPrefixRegistry } from "index-meta";
export { InMemoryPrefixRouter } from "index-meta";
export { SqlIndexMetaStore } from "index-meta";        // + SqlDriver 인터페이스
export { DistributedStoreClient } from "index-meta";

// ── 데이터 운영 ──────────────────────────────────────
export { exportVersion, importVersion } from "index-meta";
export { validateEntryBatchPayload, applyEntryBatch } from "index-meta";

// ── 인터페이스 ───────────────────────────────────────
export type { IndexMetaStore, SchemaVersionRecord, EntryRecord } from "index-meta";
export type { PrefixRegistry, PrefixRegistryRecord } from "index-meta";
export type { PrefixRouter } from "index-meta";

// ── 스키마 타입 ──────────────────────────────────────
export type { TableDef, AddressRef, LeafVersion, CompositeVersion } from "index-meta";
export type { CompiledSchema, SchemaDiff } from "index-meta";

// ── 인코딩 타입 ──────────────────────────────────────
export type {
  EntityId, VersionedValue, DecodeMap,
  MetaRegistryInput, AddressConfig,
  DimKind, DimDef, DimSnapshot, IndexDef, IndexVersion,
  DimActiveSet, IndexActiveManifest,
  DimRange, IndexRange, MetaDataset,
} from "index-meta";

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
pnpm build       # tsup → dist/ (ESM + CJS)
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
```

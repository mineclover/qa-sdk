> 메인 문서: [`README.md`](../README.md)
> 네이밍 체계: [`naming.md`](naming.md)

## Tier 1: 스키마 선언

`defineTable()`로 테이블을 선언하고, `compileSchema()`로 버전 변경을 감지한다.

```ts
import { defineTable, compileSchema } from "index-meta";

const role = defineTable("role", {
  source: { kind: { type: "string_enum" } },
  versions: { v1: { capacity: 8 } },
});

const action = defineTable("action", {
  source: { kind: { type: "string_enum" } },
  versions: { v1: { capacity: 4 } },
});

const perm = defineTable("perm", {
  dims: [role, action],
  versions: {
    v1: {
      refs: {
        role: { prefix: "role", version: "v1" },
        action: { prefix: "action", version: "v1" },
      },
    },
  },
});

const compiled = compileSchema([role, action, perm]);
// compiled.tables — capacity, refs 확정된 TableSpec 배열
// compiled.getTable("perm") — 특정 테이블 조회
// compiled.diff(previousCompiled) — 이전 스키마 대비 변경 사항
```

---

## Tier 2–3: 저장소 & 레지스트리

### DB 테이블 구조와 책임

저장 구조는 **두 계층**으로 나뉜다.

#### 계층 1 — PrefixRegistry (중앙 SQL / 인메모리)

SQL 기반 영속화: `prefix_registry` + `prefix_ref` 테이블. prefix의 capacity와 shape(refs)를 관리하는 중앙 레지스트리.

| 필드 | 역할 |
|---|---|
| `prefix`, `versionId` | 식별자 |
| `capacity` | 이 prefix의 주소 공간 크기 |
| `refs[]` | 의존 dim의 (prefix, versionId, capacity) — composite의 WeightedIndex shape |

composite index의 `shape = refs[].capacity 배열`. `resolveAddress("perm:v1:42")`로 shape과 refs를 복원한다.

#### 계층 2 — IndexMetaStore (분산 SQLite, prefix별 DB 인스턴스)

| 테이블 | 책임 |
|---|---|
| `schema_version` | 버전 존재 게이트. capacity 동기화 지점. entry 삽입 전 반드시 존재해야 함. |
| `entry` | `position → EntityId` 영구 매핑. **append-only, sparse** (빈 position은 row 없음). |
| `entry_flag` | entry 수준 활성화 상태 이력. append-only. 현재 상태 = `updatedAt` 최신 row. |
| `address_state_cache` | encode/decode 게이트 구간 캐시. `computeStateRanges` 결과를 저장. |

**핵심 설계 결정 — entry 테이블에 status 컬럼이 없다:**

inactive 상태는 `entry_flag` 테이블의 이력으로 관리하고, `address_state_cache`의 `inactive_json` 구간으로 캐싱한다. entry row는 건드리지 않고 flag와 cache만 갱신하면 상태를 변경할 수 있다. cache를 삭제하면 재계산 전까지 전체 active로 처리된다.

```
entry row 삭제 → ✗ (append-only, coord가 깨짐)
entry status 변경 → entry_flag 테이블에 이력 추가
address_state_cache 갱신 → ✓ (inactive_json 재계산 후 저장)
```

### IndexMetaStore — entry 저장

```ts
import { InMemoryIndexMetaStore } from "index-meta";
// 또는: SqlIndexMetaStore + BetterSqliteDriver (Node.js)

const store = new InMemoryIndexMetaStore();
await store.insertSchemaVersion({ prefix: "role", versionId: "v1", capacity: 8, createdAt: new Date().toISOString() });
await store.insertEntry({ prefix: "role", versionId: "v1", position: 1, value: "admin", createdAt: new Date().toISOString() });
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
import { DistributedStoreClient, InMemoryPrefixRouter, InMemoryPrefixRegistry } from "index-meta";

const prefixRegistry = new InMemoryPrefixRegistry();
const router = new InMemoryPrefixRouter();
await router.route("role", "db-1");
await router.route("perm", "db-2");

const stores = new Map([
  ["db-1", store1],
  ["db-2", store2],
]);

const client = new DistributedStoreClient(prefixRegistry, router, stores);
const entries = await client.getEntries("role", "v1");
// → router가 "db-1" → store1으로 라우팅
```

---

## Tier 3: PositionEngine — entry 관리 인프라

Position 안정 축 위에 버전 라이프사이클, 마이그레이션 이력, 캐시 계층, 메타데이터를 제공한다.

> 상세 설계: [`position-engine.md`](position-engine.md)

### 구성요소

| 모듈 | 역할 | 캐시 정책 |
|------|------|----------|
| `VersionLifecycleStore` | 버전 상태 머신 (draft→released→active→deprecated) | — |
| `MigrationStore` | 버전 간 EntityId 변경/비활성화 이력 | 불변 (release 시 확정) |
| `EntryCache` (L1) | prefix+version 양방향 position↔EntityId 캐시 | 불변 (영구 유효) |
| `MigrationCache` (L2) | 버전 쌍 마이그레이션 매핑 캐시 | 불변 (영구 유효) |
| `CrossVersionEntrySync` | 멀티 버전 entry 동기화 (active SSOT, 동일 position 전파) | — |
| `EntryMetadataStore` | position 기반 관계형 메타데이터 | 가변 (upsert) |
| `CoalescingCache` | single-flight 캐시 프리미티브 (L1/L2 기반) | — |

### EntryLifecycle — 데이터 흐름

entry가 버전을 거치며 진화하는 전체 과정. 비활성화 모드(strict/flexible)에 따라 경로가 분기.

```
strict:   deactivate → draft에서만 → release 시 MigrationStore에 불변 기록
flexible: deactivate → EntryFlagStore에 즉시 기록 → AddressStateStore 재계산
```

### 사용법

```ts
import {
  InMemoryVersionLifecycleStore,
  InMemoryMigrationStore,
  InMemoryEntryMetadataStore,
  InMemoryIndexMetaStore,
  CrossVersionEntrySync,
  EntryCache,
  MigrationCache,
} from "index-meta";

// 버전 라이프사이클
const versions = new InMemoryVersionLifecycleStore();
await versions.createDraft("role", "v1", null, 8, "strict");
await versions.release("role", "v1");
await versions.activate("role", "v1");

// entry 캐시 (IndexMetaStore 위에 L1 캐시)
const metaStore = new InMemoryIndexMetaStore();
const entryCache = new EntryCache(metaStore);

// Cross-Version Entry Sync — 멀티 버전 entry 동기화
const entrySync = new CrossVersionEntrySync(versions, metaStore, entryCache);
const result = await entrySync.addEntry("role", "admin");
// { position: 1, added: ["v1"], skipped: [] }

// 캐시에서 즉시 조회 (DB 재조회 없음)
await entryCache.getByPosition("role", "v1", 1); // "admin"
await entryCache.getByValue("role", "v1", "admin"); // 1

// 마이그레이션 이력 + 캐시
const migrationStore = new InMemoryMigrationStore();
const migrationCache = new MigrationCache(migrationStore);

// 관계형 메타데이터
const metadata = new InMemoryEntryMetadataStore();
await metadata.set("role", 1, "display_name", "관리자");
await metadata.set("role", 1, "icon", "shield");
const all = await metadata.getAll("role", 1);
// { display_name: "관리자", icon: "shield" }
```

---

## Tier 4: 인코딩 / 디코딩

`address` 설정을 추가하면 VersionedValue를 UUID 등 고정 포맷으로 직렬화할 수 있다. MetaRegistry/MetaCodec이 인코딩 게이트웨이 역할을 하며, MetaResolver는 외부 소비용 DecodeMap 번들을 제공한다.

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

프로토콜 변환, range 연산 등 순수 수학 로직은 `weighted-index`에만 존재하며, `index-meta`는 위임 + 도메인 검증만 수행한다.

```
weighted-index  →  AddressConverter, createLayoutProtocol  (프로토콜 변환)
                   mergeRanges, intersectRanges,            (range 연산)
                   subtractRanges, complementRanges,
                   containsAddress, positionsToConstraint
                   fitShape, fitLayout, planCapacity        (용량 계획)
index-meta      →  MetaRegistry.serialize/parse             (위임 + 검증)
                   computeStateRanges, checkGate             (도메인 게이트 로직)
```

### AddressConfig 검증 규칙

- 등록된 모든 indexId가 `schemas`에 매핑되어야 한다
- 등록된 모든 versionId가 `versions`에 매핑되어야 한다
- 매핑 값은 non-negative integer, 값 중복 불가 (역매핑 충돌 방지)

### 중첩 index (index_ref 계층)

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

## Tier 6: 데이터 운영

```ts
import { exportVersion, importVersion, applyEntryBatch } from "index-meta";

// 백업/복원
const backup = await exportVersion("role", "v1", prefixRegistry, store);
await importVersion(backup, prefixRegistry, targetStore);

// API 배치 적재
await applyEntryBatch("role", "v1", {
  capacity: 8,
  entries: { "1": "admin", "2": "editor" },
}, prefixRegistry, store);
```

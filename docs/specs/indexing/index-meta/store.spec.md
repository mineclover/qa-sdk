---
def:
  id: index-meta-store
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: [tier-infra]
  links:
    - target: table-schema-spec
      type: depends_on
    - target: address-spec
      type: depends_on
---

# IndexMetaStore 스펙

## 목적 ^purpose

index-meta의 DB 저장 레이어.
테이블 버전 메타(schema_version)와 실제 entry 데이터(entry)를 저장하고 조회한다.

패키지 인덱스: [README.md](README.md)
스키마 선언 레이어: [table-schema.spec.md](table-schema.spec.md)

## 상태

implemented

---

## 1. 설계 목적

`weighted-index`는 각 차원의 최댓값(capacity)만 있으면 특정 값들의 주소 범위를 즉시 계산할 수 있다. 이것이 이 시스템의 핵심 특성이다:

```
capacity(shape) → WeightedIndex → 주소 범위 계산 → 필요한 position 범위만 조회
```

따라서 DB는 세 가지를 보장해야 한다:

| 요구사항 | 이유 |
|---------|------|
| **capacity 빠른 반환** | WeightedIndex shape 결정 → 주소 범위 계산의 선행 조건 |
| **position 범위 조회** | 계산된 주소 범위로 entries를 부분 조회 → 전체 로딩 불필요 |
| **실시간 확장 대응** | 새 entries 추가가 기존 조회를 방해하지 않아야 함 |

`getCapacity`와 `getEntriesInRange`가 이 요구사항의 핵심 API다.

---

## 2. 역할 분리

```
compileSchema  → 주소 공간 명세 (capacity, refs)  ─┐
                                                    ├→ IndexMetaStore
DB 클라이언트  → entries INSERT (언제든 가능)       ─┘
                                                    ↓
                                              schema_version 테이블
                                              entry 테이블
```

`IndexMetaStore`는 두 가지 데이터를 분리하여 관리한다:

| 테이블 | 저장 내용 | 변경 시점 |
|--------|----------|----------|
| `schema_version` | 버전 메타 (capacity, 배포 시각) | capacity 변화 시 |
| `entry` | position별 실제 값과 등록 시각 | 언제든 추가 가능 |

---

## 3. 저장 타입

```ts
interface SchemaVersionRecord {
  tableId: string;
  versionId: string;
  capacity: number;
  createdAt: string;  // ISO 8601
}

interface EntryRecord {
  tableId: string;
  versionId: string;
  position: number;   // 1-based, [1, capacity]
  value: EntityId;    // string 또는 number
  createdAt: string;  // ISO 8601
}
```

---

## 4. IndexMetaStore 인터페이스

```ts
interface IndexMetaStore {
  // ── schema_version ────────────────────────────────────
  insertSchemaVersion(record: SchemaVersionRecord): Promise<void>;
  getSchemaVersions(tableId: string): Promise<SchemaVersionRecord[]>;
  getSchemaVersion(tableId: string, versionId: string): Promise<SchemaVersionRecord | null>;

  /** capacity 전용 fast-path. WeightedIndex shape 계산에 사용. 없으면 null. */
  getCapacity(tableId: string, versionId: string): Promise<number | null>;

  // ── entry ─────────────────────────────────────────────
  insertEntry(record: EntryRecord): Promise<void>;
  getEntries(tableId: string, versionId: string): Promise<EntryRecord[]>;

  /** position [from, to] 범위 조회. WeightedIndex 주소 범위 계산 결과로 부분 조회 시 사용. */
  getEntriesInRange(tableId: string, versionId: string, from: number, to: number): Promise<EntryRecord[]>;

  getEntry(tableId: string, versionId: string, position: number): Promise<EntryRecord | null>;
}
```

---

## 5. 동작 규칙

### insertSchemaVersion

- `(tableId, versionId)` 중복 시 에러.
- composite 테이블도 저장 가능 (capacity는 `compileSchema`에서 계산된 값).

### insertEntry

- 해당 `(tableId, versionId)` 의 `schema_version`이 먼저 존재해야 한다.
  - 없으면 에러 — schema_version 없이 entry를 저장하는 것은 허용하지 않음.
- `position`이 `[1, capacity]` 범위를 벗어나면 에러.
- 같은 position에 중복 삽입 시 에러.
- `schema_version`이 있으면 버전 내 언제든 추가 가능 — 새 버전 불필요.

### getSchemaVersions

- `createdAt` 오름차순 정렬.
- 등록된 버전이 없으면 빈 배열.

### getEntries

- `position` 오름차순 정렬.
- 비어있는 position은 결과에 포함되지 않는다 (sparse).

---

## 6. 인메모리 구현

테스트 및 개발 목적의 기본 구현체.

```ts
class InMemoryIndexMetaStore implements IndexMetaStore
```

키 전략:
- schema_version: `"${tableId}:${versionId}"`
- entry: `"${tableId}:${versionId}:${position}"`

인메모리 구현도 동일한 검증 규칙을 적용한다.

---

## 7. 사용 예시

```ts
import { InMemoryIndexMetaStore } from "index-meta";

const store = new InMemoryIndexMetaStore();

// ── 1. 버전 배포 시 schema_version 등록 ──────────────────

await store.insertSchemaVersion({
  tableId: "role",
  versionId: "v1",
  capacity: 8,
  createdAt: "2026-01-01T00:00:00Z",
});

// ── 2. entries는 언제든 추가 가능 ─────────────────────────

await store.insertEntry({ tableId: "role", versionId: "v1", position: 1, value: "guest",        createdAt: "2026-01-01T00:00:00Z" });
await store.insertEntry({ tableId: "role", versionId: "v1", position: 2, value: "viewer",       createdAt: "2026-01-01T00:00:00Z" });
await store.insertEntry({ tableId: "role", versionId: "v1", position: 3, value: "editor",       createdAt: "2026-01-01T00:00:00Z" });

// 나중에 추가 — 버전 변화 없음
await store.insertEntry({ tableId: "role", versionId: "v1", position: 4, value: "admin",        createdAt: "2026-03-01T00:00:00Z" });
await store.insertEntry({ tableId: "role", versionId: "v1", position: 5, value: "super_admin",  createdAt: "2026-03-01T00:00:00Z" });
// positions 6, 7, 8 은 비어있는 주소 — 언제든 채울 수 있음

// ── 3. 조회 ──────────────────────────────────────────────

const entries = await store.getEntries("role", "v1");
// [
//   { position: 1, value: "guest",       ... },
//   { position: 2, value: "viewer",      ... },
//   { position: 3, value: "editor",      ... },
//   { position: 4, value: "admin",       ... },
//   { position: 5, value: "super_admin", ... },
// ]
// positions 6~8은 포함되지 않음 (빈 주소)

const versions = await store.getSchemaVersions("role");
// [{ tableId: "role", versionId: "v1", capacity: 8, createdAt: "..." }]
```

---

## 8. DB 상태 예시

```
schema_version
┌──────────┬────────────┬──────────┬─────────────────────┐
│ tableId  │ versionId  │ capacity │ createdAt           │
├──────────┼────────────┼──────────┼─────────────────────┤
│ role     │ v1         │ 8        │ 2026-01-01T00:00:00Z│
│ role     │ v2         │ 16       │ 2026-06-01T00:00:00Z│
│ action   │ v1         │ 4        │ 2026-01-01T00:00:00Z│
│ perm     │ v1         │ 32       │ 2026-01-01T00:00:00Z│  ← composite: 8×4
└──────────┴────────────┴──────────┴─────────────────────┘

entry
┌──────────┬────────────┬──────────┬──────────────┬─────────────────────┐
│ tableId  │ versionId  │ position │ value        │ createdAt           │
├──────────┼────────────┼──────────┼──────────────┼─────────────────────┤
│ role     │ v1         │ 1        │ guest        │ 2026-01-01T00:00:00Z│
│ role     │ v1         │ 2        │ viewer       │ 2026-01-01T00:00:00Z│
│ role     │ v1         │ 3        │ editor       │ 2026-01-01T00:00:00Z│
│ role     │ v1         │ 4        │ admin        │ 2026-03-01T00:00:00Z│  ← 나중에 추가
│ action   │ v1         │ 1        │ read         │ 2026-01-01T00:00:00Z│
│ action   │ v1         │ 2        │ write        │ 2026-01-01T00:00:00Z│
│ action   │ v1         │ 3        │ delete       │ 2026-01-01T00:00:00Z│
│ action   │ v1         │ 4        │ manage       │ 2026-01-01T00:00:00Z│
└──────────┴────────────┴──────────┴──────────────┴─────────────────────┘

※ perm 테이블은 entry 없음 — composite는 주소 공간만 존재
※ role v1의 position 5~8은 빈 주소 (미등록)
```

---

## 9. 설계 노트

- `entry`는 leaf 테이블에만 의미가 있다. composite는 주소 공간만 선언되며 실제 값은 leaf entries의 조합으로 계산된다.
- entries 추가마다 `MetaRegistry` rebuild가 필요하지 않다. encode/decode가 필요한 시점에 DB에서 entries를 읽어 `MetaCodec`을 생성한다 (`MetaRegistry.createCodec()` 또는 `new MetaCodec(decodeMap)`).
- `value` 타입은 `EntityId (string | number)`. DB 어댑터 구현 시 number는 별도 직렬화 처리가 필요할 수 있다.

### 슬롯 마커와 entry 저장

`TableDef.versions.reserved`에 선언된 슬롯 마커는 스키마 레이어의 선언이다. 실제 저장은 `insertEntry`를 통해 일반 entry와 동일하게 처리된다.

```ts
// reserved: [{ position: 1, token: "NaN" }] 선언 시
await store.insertEntry({
  tableId: "score",
  versionId: "v1",
  position: 1,
  value: "NaN",   // token 값을 그대로 저장
  createdAt: "...",
});
```

- `number_enum` 테이블의 `"NaN"` 마커는 `string` 타입으로 저장된다. `EntryRecord.value`는 `EntityId (string | number)`를 허용하므로 처리 가능.
- 마커 슬롯과 정규 entry는 `entry` 테이블에서 구분 없이 저장된다. 마커 여부 판단은 `TableDef.reserved` 선언을 참조한다.

---

## 10. 주소 해석 (Address Resolution)

`PrefixRegistry`에 `getShape` + `resolveAddress`를 추가해 주소 문자열에서 모든 정보를 즉시 복원한다.

### getShape

```ts
// PrefixRegistry 추가 메서드
getShape(prefix: string, versionId: string): Promise<number[]>
// leaf      → [capacity]
// composite → refs.map(r => r.capacity)  ← WeightedIndex 생성에 직접 사용
```

### ResolvedAddress

```ts
interface ResolvedAddress {
  prefix: string;
  versionId: string;
  index: number;
  capacity: number;
  /** WeightedIndex(shape)으로 decode 가능. leaf면 [capacity]. */
  shape: number[];
  /** composite면 dim 참조 목록. graph 탐색에 사용. leaf면 []. */
  refs: readonly DimRef[];
  /** index가 [0, capacity-1] 범위 내인지 */
  valid: boolean;
}
```

### resolveAddress

```ts
// PrefixRegistry 추가 메서드
resolveAddress(serialized: string): Promise<ResolvedAddress | null>
// "perm:v1:1345" → { prefix:"perm", versionId:"v1", index:1345,
//                    capacity:2048, shape:[8,4,16,4], refs:[...], valid:true }
// 미등록 prefix → null
```

---

## 11. 디코딩 없는 주소 재사용 (Graph-DB 효율)

leaf 값까지 디코딩하지 않고 1D 정수 주소를 다른 composite의 dim으로 직접 재사용한다.

### 원리

```
article:v1 = content_type(4) × perm(2048) × lang(2)

DB 저장:
  article table: article_index INTEGER  ← "perm 주소 포함 article의 1D 주소"

"role=editor(position 3)인 article 조회" (디코딩 불필요):
  ① perm:v1 shape=[8,4,16,4]에서 role dim(index 0) position=3의 주소 범위 계산
     WeightedIndex([8,4,16,4]).rangeFor(dim=0, coord=3) → [from_perm, to_perm]
  ② article:v1 shape=[4,2048,2]에서 perm dim(index 1)이 [from_perm, to_perm]인
     article 주소 범위 계산
     → 여러 구간의 article address range
  ③ SELECT * FROM article_data WHERE article_index IN (range₁ ∪ range₂ ∪ ...)
```

### 효율

| 접근 방식 | 비용 |
|----------|------|
| 전체 디코딩 후 필터 | O(n) — 모든 row decode |
| **주소 범위 계산** | O(1) — 산술 연산만, entry 조회 없음 |

### DB 저장 패턴

```
article 테이블 (composite):
  article_index INTEGER PRIMARY KEY  ← article:v1의 1D 주소
  (perm 주소는 article_index 안에 인코딩되어 있음 — 별도 컬럼 불필요)

perm 주소 범위로 article 필터링:
  WeightedIndex(article_shape).rangeFor(dim=perm_dim_index, coord_range=[from,to])
  → article address ranges
  → SELECT * WHERE article_index IN ranges (range scan)
```

composite는 entry가 없고 address 공간만 있으므로, 이 필터링은 순수 산술 연산이다.

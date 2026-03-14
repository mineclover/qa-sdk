# index-meta 스펙

> 가중진법 인덱스의 **스키마 메타 DB**.
> `WeightedIndex`가 정수 ↔ 좌표 변환을 담당한다면, `index-meta`는 "각 축이 무엇을 의미하는가", "각 위치에 어떤 엔티티가 있는가"를 정의하고 버전 간 변경 동선을 관리한다.

패키지: `@qa-sdk/index-meta`
의존: `weighted-index`

> 기반 원리는 [`foundation.md`](foundation.md), 사용 패턴은 [`patterns.md`](patterns.md), 프로젝트 관례는 [`conventions.md`](conventions.md)를 참조한다.

## 상태

implemented

---

## 1. 엔티티 계층

```
MetaRegistryInput
├── dims: Record<dimId, DimInput>
│   ├── kind: DimKind              ← 축이 받는 값의 형태 선언
│   ├── snapshots: Record<snapshotId, DimSnapshotInput>
│   │   ├── entries: EntityId[]   ← 1-based 순번, append-only
│   │   ├── entryFlags?           ← 개별 entry 활성/비활성 상태
│   │   └── entryRefs?            ← 특정 셀이 다른 index의 1D 압축값
│   └── migrations?: DimSnapshotMigration[]  ← snapshot 간 좌표 이동 동선
└── indices: Record<indexId, IndexInput>
    ├── dims: string[]             ← 축 ID 목록 (순서 고정)
    └── versions: Record<versionId, IndexVersionInput>
        └── snapshots: Record<dimId, snapshotId>  ← 각 축의 어느 스냅샷을 쓸지
```

### 1D 복원 경로

```
VersionedValue { indexId, versionId, value }
  → IndexDef[indexId].dims               → [dim_0, ..., dim_n]
  → IndexVersion[indexId,versionId]      → { dim_i: snapshotId_i }
  → DimSnapshot[dim_i, snapshotId_i]     → entries.length → N_i (shape)
  → WeightedIndex(shape).decode(value)   → coords
  → DimSnapshot.entries[coord_i - 1]     → EntityId
     ├─ string_enum → 문자열 그대로 반환
     ├─ number_enum → 숫자 그대로 반환
     └─ index_ref   → 반환값이 또 다른 VersionedValue.value
                       (프로그래밍 레이어에서 재귀 확장 가능; MetaRegistry.decode()는 여기서 중단)
```

---

## 2. DimKind — 축 값 타입 분류

축에 들어오는 값의 형태를 선언한다. 인코딩 방식이 아니라 **값의 의미**를 정의한다.

```ts
type DimKind =
  | { type: "string_enum" }
  | { type: "number_enum" }
  | { type: "index_ref"; indexId: string };
```

### 분류 기준

| DimKind | entries 타입 | 의미 | 예시 |
|---|---|---|---|
| `string_enum` | `string[]` | 문자열 값 자체가 고유 키 | `["admin", "editor", "viewer"]` |
| `number_enum` | `number[]` | 숫자 값 자체가 고유 키. 다른 index와 무관 | `[10, 20, 30]` |
| `index_ref` | `number[]` | 다른 WeightedIndex의 1D 압축 결과. `indexId`로 어느 index 계열인지 선언. `versionId`는 데이터 적재 시 함께 전달 | `[42, 87, 156]` ← `document_meta` index의 압축값 |

> **`number_enum` vs `index_ref` 구분**: 숫자 값이 다른 index를 가리키는 참조인지 아닌지로 구분한다.
> 참조가 없는 숫자 식별자는 `number_enum`, 다른 index 계열의 값임을 명시하면 `index_ref`.

### 검증 규칙

- `string_enum`: entries가 모두 `string`이어야 함. 단, `entryRefs`로 선언된 위치는 `number` 허용.
- `number_enum` / `index_ref`: entries가 모두 정수(≥ 0)여야 함.
- `index_ref`: `indexId`로 지정한 IndexDef가 registry에 존재해야 함. (forward-reference 허용: indices 루프 완료 후 교차 검증)

---

## 3. DimSnapshot — 버전화된 항목 목록

하나의 차원(dim)이 특정 시점에 가지고 있는 항목 목록.

```ts
interface DimSnapshot {
  dimId: string;
  snapshotId: string;
  entries: readonly EntityId[];        // entries[i-1] = 1-based index i의 entity ID
  entryFlags: Readonly<Record<number, EntryFlag>>;  // sparse: 1-based key
  entryRefs: Readonly<Record<number, EntryIndexRef>>;  // sparse: 1-based key
  createdAt?: string;
  changelog?: string;
}
```

### entries 불변성

- `entries`의 순서 = WeightedIndex shape의 좌표. **불변**.
- 항목이 추가될 때는 배열 끝에 append. 기존 위치는 절대 변경하지 않는다.
- 항목을 "삭제"하려면 `entryFlags`로 inactive 처리. entries에서 제거하지 않는다.

### EntryFlag — 활성/비활성

```ts
interface EntryFlag {
  status: "active" | "inactive";
  reason?: string;
  updatedAt: string;
}
```

- `entryFlags`는 sparse: 명시 없으면 active로 간주.
- inactive entry로 인코딩된 기존 값도 항상 decode 가능.
- **encode도 inactive 여부를 검사하지 않는다.** active/inactive 강제(enforcement)는 프로그래밍 레이어의 책임.
- `entryFlags` key 범위는 검증하지 않는다. 접근은 `[1, entries.length]` 순회 시에만 발생하므로 범위 밖 key는 무시된다.

### entryRefs — 셀 수준 index 참조

특정 셀 하나가 다른 WeightedIndex의 1D 압축값일 때 붙이는 메타데이터.

```ts
interface EntryIndexRef {
  indexId: string;
  versionId: string;  // 엔진이 확장(expand)하려면 정확한 version이 필요
}
```

**dim-level `index_ref`와의 차이**:

| 구분 | dim-level (`DimKind`) | entry-level (`entryRefs`) |
|---|---|---|
| 선언 위치 | `DimKind.type = "index_ref"` | `DimSnapshotInput.entryRefs[pos]` |
| 적용 범위 | 해당 축의 모든 entry | 특정 위치의 entry 하나 |
| `versionId` | 수집 안 함 (데이터 적재 시 관리) | 수집함 (엔진 확장에 필요) |
| 대상 index | 모두 같은 `indexId` 계열 | entry마다 다른 `indexId + versionId` 가질 수 있음 |

검증:
- 해당 위치의 entry 값이 정수(≥ 0)여야 함.
- `indexId + versionId` 모두 비어있으면 안 됨.
- 지정한 `indexId + versionId`가 registry에 존재해야 함. (indices 루프 완료 후 교차 검증)
- key 범위: `[1, entries.length]`.

---

## 4. EntityId와 버전 간 추적

### EntityId가 행(row) 고유 식별자

각 snapshot의 모든 항목은 고유한 EntityId를 가진다. 내부적으로 `idToIndex: Map<EntityId, number>` bijection이 유지된다.

**암묵적 버전 이동 (decode → re-encode):**

저장된 VersionedValue를 새 버전으로 옮길 때 EntityId가 양쪽 스냅샷에 모두 존재하면 자동으로 처리된다:

```ts
// 구 버전으로 저장된 값
const old = registry.parse("content_perm:v1:5");

// EntityId 추출 (v1 기준으로 decode)
const ids = registry.decode(old);
// { role: "editor", doc_type: "draft" }

// 새 버전으로 re-encode (idToIndex가 v2에서 위치를 자동 찾음)
const migrated = registry.encode("content_perm", "v2", ids);
```

entries에 같은 EntityId가 있는 한, 위치가 바뀌어도 `idToIndex.get(entityId)`로 항상 새 위치를 찾는다. 구성이 동일하다면 명시적 migration 없이 버전 간 대응이 가능하다.

### DimSnapshotMigration — 좌표 수준 명시적 이동 기록

EntityId로 자동 처리가 어렵거나, decode/re-encode를 거치지 않고 **좌표(1-based index) 수준에서 직접** 변환해야 할 때 사용한다.

사용 시나리오:
- 의미론적 변경: 같은 위치에 다른 엔티티가 들어와 EntityId 자체가 바뀐 경우
- 좌표 직접 변환이 필요한 경우 (VersionedValue 전체 decode 없이 좌표만 translate)

```ts
interface DimSnapshotMigration {
  fromSnapshotId: string;
  toSnapshotId: string;
  /**
   * key   = fromSnapshot 기준 1-based index
   * value = toSnapshot 기준 1-based index
   * 명시 없는 위치는 identity (동일 index 유지)
   * value는 unique (bijection 강제)
   */
  indexMap: Record<number, number>;
  createdAt?: string;
  changelog?: string;
}
```

- `indexMap`은 sparse: 명시 없는 위치는 identity (같은 번호 유지).
- bijection 보장: value 중복 불가.
- key 범위: `[1, fromSnapshot.entries.length]`
- value 범위: `[1, toSnapshot.entries.length]`

### traceMigration — BFS + indexMap 체인

```ts
traceMigration(dimId, fromSnapshotId, toSnapshotId, index): number
```

**동작 순서:**

1. `dimId`가 registry에 없으면 `DimNotFoundError`.
2. `fromSnapshotId === toSnapshotId`이면 `index` 그대로 반환.
3. 등록된 migration edge를 BFS로 탐색해 `from → to` 경로를 찾는다.
4. 경로가 없으면 `MigrationNotFoundError`.
4. 경로의 각 구간 migration을 순서대로 적용:
   - `indexMap[current]`가 존재하면 그 값으로 이동.
   - **`indexMap`에 해당 key가 없으면 identity (현재 index 유지).** BFS는 등록된 edge만 따르므로 각 구간에는 반드시 registered migration이 있다. identity는 "경로 구간 누락"이 아니라 "해당 구간 migration의 `indexMap`에 key 미포함"을 의미한다.

`getMigration`도 미등록 dimId에 대해 `DimNotFoundError`를 던진다 (직접 migration이 없는 경우는 `MigrationNotFoundError`).

---

## 5. IndexDef와 IndexVersion

### IndexDef — 축 조합 정의

```ts
interface IndexDef {
  id: string;
  dims: readonly string[];  // 축 ID 목록, 순서 고정
  description?: string;
  domain?: string;
}
```

### IndexVersion — 특정 시점 스냅샷 조합

```ts
interface IndexVersion {
  indexId: string;
  versionId: string;
  snapshots: Readonly<Record<string, string>>;  // dimId → snapshotId
  createdAt?: string;
  changelog?: string;
}
```

IndexVersion은 IndexDef의 각 차원에서 어느 DimSnapshot을 사용할지를 고정한다. 버전이 올라간다는 것은 한 축 이상의 snapshot이 교체된다는 의미.

---

## 6. VersionedValue — DB 저장 단위

```ts
interface VersionedValue {
  indexId: string;
  versionId: string;
  value: number;  // WeightedIndex.encode() 결과
}
```

직렬화 형식: `"{indexId}:{versionId}:{value}"`

예: `"document_state:v2:42"`

이 세 값이 있으면 1D 정수를 완전히 복원할 수 있다:
1. `indexId + versionId` → IndexVersion 조회
2. 각 dim → snapshotId → DimSnapshot 조회
3. DimSnapshot.entries.length 배열로 shape 구성
4. WeightedIndex(shape).decode(value) → 좌표
5. 좌표 → entries 조회 → EntityId

---

## 7. IndexActiveManifest — 활성 인덱스 집합

프로그래밍 레이어에 제공되는 출력. 어떤 버전의 어떤 인덱스에서 현재 사용 가능한 좌표가 무엇인지를 정의한다.

```ts
interface DimActiveSet {
  dimId: string;
  snapshotId: string;
  total: number;            // = entries.length. inactive가 있어도 불변. WeightedIndex shape에 사용.
  activeIndices: number[];  // 현재 active 상태인 1-based 인덱스 목록 (정렬됨)
}

interface IndexActiveManifest {
  indexId: string;
  versionId: string;
  dims: DimActiveSet[];  // IndexDef.dims 순서 유지
}
```

`total`이 `activeIndices.length`와 다를 수 있다 — inactive entry가 있을 때. WeightedIndex의 shape은 항상 `total` 기준이다.

---

## 8. MetaRegistry API

### 생성자

```ts
new MetaRegistry(input: MetaRegistryInput)
```

생성자에서 모든 검증을 수행한다. 검증 통과 후에는 불변.

**검증 순서:**
1. dims 루프: dim/snapshot/entryRefs 검증, migration 검증
2. indices 루프: IndexDef/IndexVersion 검증
3. 교차 검증: dim-level `index_ref` indexId 존재 확인, entry-level entryRefs indexId+versionId 존재 확인

### 핵심 API

| 메서드 | 설명 |
|---|---|
| `getActiveManifest(indexId, versionId)` | 버전 단위 활성 인덱스 집합 반환 |
| `encode(indexId, versionId, entityIds)` | `{ dimId: EntityId }` → `VersionedValue`. inactive 검사 없음 |
| `decode(vv)` | `VersionedValue` → `{ dimId: EntityId }`. inactive 값도 항상 가능 |
| `serialize(vv)` | `VersionedValue` → `"{indexId}:{versionId}:{value}"` |
| `parse(serialized)` | 문자열 → `VersionedValue`. 형식 오류 → `ParseError`. 미등록 index/version → `IndexNotFoundError`/`IndexVersionNotFoundError` |

### 조회 API

| 메서드 | 설명 |
|---|---|
| `getDimDef(dimId)` | DimDef 반환 |
| `getDimSnapshot(dimId, snapshotId)` | DimSnapshot 반환 |
| `getIndexDef(indexId)` | IndexDef 반환 |
| `getIndexVersion(indexId, versionId)` | IndexVersion 반환 |
| `getWeightedIndex(indexId, versionId)` | 캐시된 WeightedIndex 인스턴스 반환 |
| `dimIds` | 등록된 dim ID 목록 |
| `indexIds` | 등록된 index ID 목록 |
| `getVersionIds(indexId)` | 특정 index의 버전 ID 목록 |
| `getSnapshotIds(dimId)` | 특정 dim의 snapshot ID 목록 |

### Migration API

| 메서드 | 설명 |
|---|---|
| `getMigration(dimId, fromSnapshotId, toSnapshotId)` | 직접 등록된 migration 반환. 미등록 dimId → `DimNotFoundError`. 경로 없으면 `MigrationNotFoundError` |
| `traceMigration(dimId, fromSnapshotId, toSnapshotId, index)` | BFS로 경로를 찾아 각 구간 indexMap을 순서대로 적용. 최종 1-based index 반환. 미등록 dimId → `DimNotFoundError` |

### encode/decode 동작

**encode:**
- 각 dim에 대해 `entityIds[dimId]` 조회 → 없으면 `ValidationError`
- `idToIndex.get(entityId)`로 1-based 좌표 획득 → 없으면 `EntryNotFoundError`
- inactive 여부 무시: inactive entry로도 encode 가능

**decode:**
- `wi.decode(value)`로 좌표 획득
- 각 dim에 대해 `entries[coord - 1]`로 EntityId 반환
- inactive entry로 인코딩된 값도 항상 decode 가능

---

## 9. 에러 계층

```
IndexMetaError (base)
├── DimNotFoundError            # 등록되지 않은 dim ID
├── SnapshotNotFoundError       # 등록되지 않은 snapshot ID (migration 검증 등)
├── IndexNotFoundError          # 등록되지 않은 index ID (index_ref 교차검증, parse 등)
├── IndexVersionNotFoundError   # 등록되지 않은 version ID (entryRefs 교차검증, parse 등)
├── EntryNotFoundError          # encode 시 EntityId를 snapshot에서 찾지 못함
├── MigrationNotFoundError      # getMigration 직접 조회 실패 / traceMigration 경로 없음
├── ValidationError             # 입력 데이터 제약 조건 위반 (중복 ID, 빈 entries, indexMap 범위 등)
└── ParseError                  # serialize 문자열 형식 오류 (구조 자체가 잘못된 경우)
```

---

## 10. 모듈 구조

```
src/
  types.ts         # 모든 공개 타입 (DimKind, DimSnapshot, IndexVersion, VersionedValue, ...)
  errors.ts        # 에러 클래스 계층
  meta-registry.ts # MetaRegistry 클래스 (생성자 검증 + 모든 API)
  index.ts         # 공개 API 재수출
```

### WeightedIndex 캐시

내부 Map: `"{indexId}:{versionId}" → WeightedIndex` 인스턴스.
동일 조합은 첫 호출 시 1회 생성 후 재사용.

shape는 `IndexVersion`의 각 dim → snapshotId → `entries.length` 순으로 결정.

---

## 11. 사용 예시

### 기본 사용

```ts
import { MetaRegistry } from "@qa-sdk/index-meta";

const registry = new MetaRegistry({
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
      },
    },
    doc_type: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: {
          entries: ["article", "draft", "archive"],
          entryFlags: {
            3: { status: "inactive", reason: "deprecated", updatedAt: "2026-01-01" },
          },
        },
      },
    },
  },
  indices: {
    content_perm: {
      dims: ["role", "doc_type"],
      versions: {
        pv1: { snapshots: { role: "v1", doc_type: "v1" } },
      },
    },
  },
});

// 활성 인덱스 집합 조회
const manifest = registry.getActiveManifest("content_perm", "pv1");
// {
//   indexId: "content_perm", versionId: "pv1",
//   dims: [
//     { dimId: "role",     snapshotId: "v1", total: 3, activeIndices: [1, 2, 3] },
//     { dimId: "doc_type", snapshotId: "v1", total: 3, activeIndices: [1, 2] },  // 3 inactive
//   ]
// }

// 인코딩 (inactive여도 encode 가능 — enforcement는 호출자 책임)
const vv = registry.encode("content_perm", "pv1", { role: "editor", doc_type: "draft" });
// { indexId: "content_perm", versionId: "pv1", value: 4 }

// 직렬화 (DB 저장)
const s = registry.serialize(vv); // "content_perm:pv1:4"

// 역직렬화 + 디코딩
const decoded = registry.decode(registry.parse(s));
// { role: "editor", doc_type: "draft" }
```

### EntityId 기반 암묵적 버전 이동

```ts
// v1에 저장된 값
const old = registry.parse("content_perm:pv1:4");
const ids = registry.decode(old);   // { role: "editor", doc_type: "draft" }

// pv2 추가 (role snapshot 교체)
const registry2 = new MetaRegistry({
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
        v2: { entries: ["admin", "viewer", "editor", "guest"] }, // 순서 변경
      },
    },
    doc_type: { /* ... */ },
  },
  indices: {
    content_perm: {
      dims: ["role", "doc_type"],
      versions: {
        pv1: { snapshots: { role: "v1", doc_type: "v1" } },
        pv2: { snapshots: { role: "v2", doc_type: "v1" } },
      },
    },
  },
});

// "editor"가 v2에서 3번으로 이동했더라도 idToIndex가 자동으로 찾아줌
const migrated = registry2.encode("content_perm", "pv2", ids);
// { indexId: "content_perm", versionId: "pv2", value: ... }  ← "editor" 위치 자동 반영
```

### 좌표 수준 Migration (traceMigration)

```ts
const registry = new MetaRegistry({
  dims: {
    status: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["open", "closed", "pending"] },
        v2: { entries: ["open", "pending", "closed", "archived"] },
      },
      migrations: [
        {
          fromSnapshotId: "v1",
          toSnapshotId: "v2",
          indexMap: {
            2: 3,  // v1의 2번("closed") → v2의 3번("closed")
            3: 2,  // v1의 3번("pending") → v2의 2번("pending")
            // 1("open")은 명시 없음 → identity (1 → 1)
          },
        },
      ],
    },
  },
  indices: { /* ... */ },
});

// 좌표 수준 직접 변환 (decode/re-encode 없이)
const newIndex = registry.traceMigration("status", "v1", "v2", 2); // → 3
```

### index_ref (중첩 index) 예시

```ts
const registry = new MetaRegistry({
  dims: {
    doc_state: {
      kind: { type: "index_ref", indexId: "document_meta" },
      snapshots: {
        v1: { entries: [42, 87, 156] }, // document_meta index의 1D 압축값들
      },
    },
  },
  indices: {
    document_meta: {
      dims: ["doc_type", "format"],
      versions: {
        mv1: { snapshots: { doc_type: "dt_v1", format: "fmt_v1" } },
      },
    },
    event_index: {
      dims: ["doc_state"],
      versions: {
        ev1: { snapshots: { doc_state: "v1" } },
      },
    },
  },
});

// decode 결과: { doc_state: 42 }
// 42는 document_meta index의 1D 압축값 → 프로그래밍 레이어에서 추가 decode 가능
const vv = registry.encode("event_index", "ev1", { doc_state: 42 });
const ids = registry.decode(vv);
// { doc_state: 42 }  — MetaRegistry는 여기서 중단; 재귀 확장은 호출자 책임
```

---

## 12. 검증 규칙 요약

| 규칙 | 대상 | 에러 |
|---|---|---|
| ID는 비어있으면 안 됨 | dimId, snapshotId, indexId, versionId | `ValidationError` |
| ID에 `:` 문자 포함 불가 | dimId, snapshotId, indexId, versionId | `ValidationError` |
| entries 비어있으면 안 됨 | DimSnapshot | `ValidationError` |
| entries 중복 EntityId 불가 (`-0 → 0` 정규화) | DimSnapshot | `ValidationError` |
| string_enum: entries는 모두 string (entryRefs 위치 제외) | DimSnapshot | `ValidationError` |
| number_enum/index_ref: entries는 모두 정수(≥ 0) | DimSnapshot | `ValidationError` |
| entryRefs 키: `[1, entries.length]` 범위 | DimSnapshot | `ValidationError` |
| entryRefs 대상 entry 값: 정수(≥ 0) | DimSnapshot | `ValidationError` |
| entryRefs indexId + versionId 비어있으면 안 됨 | DimSnapshot | `ValidationError` |
| migration fromSnapshotId ≠ toSnapshotId | DimSnapshotMigration | `ValidationError` |
| migration: 양쪽 snapshotId 존재해야 함 | DimSnapshotMigration | `SnapshotNotFoundError` |
| migration: 동일 (from, to) 쌍 중복 불가 | DimSnapshotMigration | `ValidationError` |
| migration: indexMap key ∈ `[1, fromSnapshot.length]`, value ∈ `[1, toSnapshot.length]` | DimSnapshotMigration | `ValidationError` |
| migration: indexMap value 중복 불가 (bijection) | DimSnapshotMigration | `ValidationError` |
| IndexDef: dims 비어있으면 안 됨 | IndexDef | `ValidationError` |
| IndexDef: 참조하는 dimId 존재해야 함 | IndexDef | `DimNotFoundError` |
| IndexVersion: 모든 dim에 snapshotId 있어야 함 | IndexVersion | `ValidationError` |
| IndexVersion: 참조하는 snapshotId 존재해야 함 | IndexVersion | `SnapshotNotFoundError` |
| index_ref DimKind: indexId 존재해야 함 | DimDef (교차 검증) | `IndexNotFoundError` |
| entryRefs: indexId 존재해야 함 | DimSnapshot (교차 검증) | `IndexNotFoundError` |
| entryRefs: versionId 존재해야 함 | DimSnapshot (교차 검증) | `IndexVersionNotFoundError` |
| parse: 형식이 `{indexId}:{versionId}:{value}` 구조가 아닌 경우 | parse() | `ParseError` |
| parse: 미등록 indexId | parse() | `IndexNotFoundError` |
| parse: 미등록 versionId | parse() | `IndexVersionNotFoundError` |
| parse: value ≥ WeightedIndex.size (범위 초과) | parse() | `ParseError` |
| getMigration / traceMigration: 미등록 dimId | getMigration(), traceMigration() | `DimNotFoundError` |

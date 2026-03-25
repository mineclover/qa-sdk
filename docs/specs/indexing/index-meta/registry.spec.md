---
def:
  id: meta-registry-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: registry-data-model
      type: depends_on
---

# MetaRegistry 스펙

## 목적 ^purpose

MetaRegistry — 주소 게이트웨이. 스키마 관리 + 직렬화 + 코덱 생성.
entity ID ↔ VersionedValue 변환(encode/decode)은 [MetaCodec](codec.spec.md)이 담당한다.

패키지 인덱스: [README.md](README.md)
디코딩 파이프라인: [../pipeline.md](../pipeline.md)

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
                       (프로그래밍 레이어에서 재귀 확장 가능; MetaCodec.decode()는 여기서 중단)
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
| `index_ref` | `number[]` | 다른 WeightedIndex의 1D 압축 결과. `indexId`로 어느 index 계열인지 선언 | `[42, 87, 156]` |

### 검증 규칙

- `string_enum`: entries가 모두 `string`이어야 함. 단, `entryRefs`로 선언된 위치는 `number` 허용.
- `number_enum` / `index_ref`: entries가 모두 정수(≥ 0)여야 함.
- `index_ref`: `indexId`로 지정한 IndexDef가 registry에 존재해야 함. (forward-reference 허용)

---

## 3. DimSnapshot — 버전화된 항목 목록

하나의 차원(dim)이 특정 시점에 가지고 있는 항목 목록.

```ts
interface DimSnapshot {
  dimId: string;
  snapshotId: string;
  entries: readonly EntityId[];
  entryFlags: Readonly<Record<number, EntryFlag>>;
  entryRefs: Readonly<Record<number, EntryIndexRef>>;
  createdAt?: string;
  changelog?: string;
}
```

### entries 불변성

- `entries`의 순서 = WeightedIndex shape의 좌표. **불변**.
- 항목 추가 시 배열 끝에 append. 기존 위치는 절대 변경하지 않는다.
- "삭제"하려면 `entryFlags`로 inactive 처리. entries에서 제거하지 않는다.

### EntryFlag — 활성/비활성

- sparse: 명시 없으면 active. inactive 값도 항상 decode 가능.
- **encode도 inactive 여부를 검사하지 않는다.** enforcement는 프로그래밍 레이어 책임.

### entryRefs — 셀 수준 index 참조

| 구분 | dim-level (`DimKind`) | entry-level (`entryRefs`) |
|---|---|---|
| 적용 범위 | 해당 축의 모든 entry | 특정 위치의 entry 하나 |
| `versionId` | 수집 안 함 | 수집함 (엔진 확장에 필요) |

---

## 4. EntityId와 버전 간 추적

### 암묵적 버전 이동 (decode → re-encode)

EntityId가 양쪽 스냅샷에 모두 존재하면 `idToIndex.get(entityId)`로 자동 대응.

### DimSnapshotMigration — 좌표 수준 명시적 이동

- `indexMap`: key = fromSnapshot 1-based, value = toSnapshot 1-based
- 명시 없는 위치는 identity. bijection 강제.

### traceMigration — BFS + indexMap 체인

등록된 migration edge를 BFS로 탐색해 경로를 찾고 각 구간 indexMap을 순서대로 적용.

---

## 5. IndexDef, IndexVersion, VersionedValue, IndexActiveManifest

- **IndexDef**: 순서 있는 dim 조합. 이 순서가 shape 결정.
- **IndexVersion**: 각 dim에서 어느 DimSnapshot을 사용하는지 고정.
- **VersionedValue**: `{ indexId, versionId, value }` — DB 저장 단위.
- **IndexActiveManifest**: 각 dim의 active 1-based 인덱스 목록. `total`은 shape에 사용(inactive 포함).

---

## 6. MetaRegistry API

### 생성자

```ts
new MetaRegistry(input: MetaRegistryInput)
```

생성자에서 모든 검증을 수행. 검증 통과 후 불변.

### 핵심 API

| 메서드 | 설명 |
|---|---|
| `createCodec(indexId, versionId)` | 특정 version에 특화된 독립 코덱 생성 → [MetaCodec](codec.spec.md) |
| `createCodecBig(indexId, versionId)` | BigInt 기반 코덱 생성 → [MetaCodecBig](../bigint-addressing.spec.md) |
| `getActiveManifest(indexId, versionId)` | 버전 단위 활성 인덱스 집합 |
| `getCapacityInfo(indexId, versionId)` | `VersionCapacityInfo` 반환 (BigInt 정확 값 포함) |
| `serialize(vv, protocol?)` | VersionedValue → 프로토콜 문자열 ([address.spec.md](address.spec.md) 참조) |
| `serializeBig(vvb)` / `parseBig(input)` | BigInt 주소 직렬화/파싱 ([bigint-addressing.spec.md](../bigint-addressing.spec.md) §4) |
| `parse(input, protocol?)` | 프로토콜 문자열 → VersionedValue (검증 포함) |
| `toInput()` | 생성자 입력의 deep clone 반환 (fork 패턴) |

> **Note**: encode/decode/toPK/fromPK는 MetaCodec으로 분리되었다.
> `codec.encode(entityIds)` + `reg.serialize(vv)` 조합으로 사용한다.
> BigInt 인덱스(shape product > 2^53)는 `createCodecBig()` + `serializeBig()` 사용. 상세: [bigint-addressing.spec.md](../bigint-addressing.spec.md)

### 조회 API

`getDimDef`, `getDimSnapshot`, `getIndexDef`, `getIndexVersion`, `getWeightedIndex`, `dimIds`, `indexIds`, `getVersionIds`, `getSnapshotIds`

### Migration API

`getMigration`, `traceMigration` (BFS)

---

## 7. 에러 계층

```
IndexMetaError (base)
├── DimNotFoundError
├── SnapshotNotFoundError
├── IndexNotFoundError
├── IndexVersionNotFoundError
├── EntryNotFoundError
├── MigrationNotFoundError
├── ValidationError
└── ParseError
```

---

## 8. 검증 규칙 요약

| 규칙 | 대상 | 에러 |
|---|---|---|
| ID 비어있으면 안 됨 | dimId, snapshotId, indexId, versionId | `ValidationError` |
| ID에 `:` 포함 불가 | dimId, snapshotId, indexId, versionId | `ValidationError` |
| entries 비어있으면 안 됨 | DimSnapshot | `ValidationError` |
| entries 중복 EntityId 불가 (`-0 → 0`) | DimSnapshot | `ValidationError` |
| DimKind 타입 불일치 | DimSnapshot | `ValidationError` |
| entryRefs 키 범위 / 값 타입 | DimSnapshot | `ValidationError` |
| migration bijection | DimSnapshotMigration | `ValidationError` |
| IndexDef dims 비어있으면 안 됨 | IndexDef | `ValidationError` |
| index_ref / entryRefs 교차 검증 | 생성자 | `IndexNotFoundError` / `IndexVersionNotFoundError` |
| parse value 범위 초과 | parse() | `ParseError` |

Address 검증 규칙은 [address.spec.md](address.spec.md) 참조.

---

## 9. 사용 예시

### 기본 사용

```ts
import { MetaRegistry } from "@qa-sdk/index-meta";

const registry = new MetaRegistry({
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["admin", "editor", "viewer"] } },
    },
    doc_type: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: {
          entries: ["article", "draft", "archive"],
          entryFlags: { 3: { status: "inactive", reason: "deprecated", updatedAt: "2026-01-01" } },
        },
      },
    },
  },
  indices: {
    content_perm: {
      dims: ["role", "doc_type"],
      versions: { pv1: { snapshots: { role: "v1", doc_type: "v1" } } },
    },
  },
});

// 코덱 생성 → encode → serialize → parse → decode
const codec = registry.createCodec("content_perm", "pv1");
const vv = codec.encode({ role: "editor", doc_type: "draft" });
const decoded = codec.decode(registry.parse(registry.serialize(vv)));
// { role: "editor", doc_type: "draft" }
```

### EntityId 기반 암묵적 버전 이동

```ts
const v1 = registry.createCodec("content_perm", "pv1");
const v2 = registry.createCodec("content_perm", "pv2");

const ids = v1.decode(oldVersionedValue);
const migrated = v2.encode(ids);
// idToIndex가 v2에서 위치를 자동 찾음
```

### 좌표 수준 Migration

```ts
const newIndex = registry.traceMigration("status", "v1", "v2", 2); // → 3
```

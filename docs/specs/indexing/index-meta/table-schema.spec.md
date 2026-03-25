---
def:
  id: table-schema-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
---

# TableDef / compileSchema 스펙

## 목적 ^purpose

테이블 단위 스키마 선언 레이어.
`MetaRegistry`가 런타임 encode/decode를 담당한다면,
이 레이어는 **외부 DB의 주소 공간(address space)을 정의하고 버전을 관리**한다.

패키지 인덱스: [README.md](README.md)
저장소 레이어: [store.spec.md](store.spec.md)

## 상태

implemented

---

## 1. 설계 원칙

### 테이블 = 1D 주소 공간

`weighted-index`가 n개의 1D → 1D 압축을 수행한다면, 각 1D 슬롯의 **스펙**을 관리하는 단위가 테이블이다.

```
TableDef (leaf)      → 원본 값을 가지는 독립 1D 주소 공간
TableDef (composite) → 다른 테이블들을 조합한 nD → 1D 주소 공간
```

### capacity / entries 분리

```
capacity — 주소 공간 크기 선언. 버전의 핵심. 변화 시에만 새 버전.
entries  — 주소에 실제로 채워진 값. DB가 관리. 버전과 무관하게 추가 가능.
```

- `capacity = 8`이면 position 1~8이 예약됨. 실제 값이 없는 position은 빈 주소.
- 새 항목 추가 = 빈 position에 값을 채우는 것 → 버전 불필요.
- `capacity`가 변할 때만 → 새 버전.

### composite는 leaf를 FK로 참조

composite 테이블의 각 dim은 다른 테이블(leaf 또는 composite)의 `{ prefix, version }`을 참조한다.
composite의 capacity = 참조 dim capacity들의 곱.

---

## 2. 타입 계층

```
TableDef
├── id: string                     ← prefix (주소 식별자)
├── source?: { kind }              ← leaf only — 원본 값의 타입
├── dims?: TableDef[]              ← composite only — 참조할 테이블 목록
└── versions: Record<versionId, TableVersion>
    ├── LeafVersion     { capacity, reserved? }       ← leaf
    └── CompositeVersion { refs: Record<dimId, AddressRef> }  ← composite

AddressRef
├── prefix: string     ← 참조 테이블의 id
└── version: string    ← 참조 테이블의 versionId

ReservedSlot          ← 슬롯 마커 선언 (LeafVersion 전용)
├── position: number  ← 1-based, capacity 범위 내
└── token: string     ← 마커 값 ("_", "~", "?", "NaN", 또는 커스텀)
```

### 리프 vs 복합 구분

| 구분 | `source` | `dims` | version 형태 |
|------|----------|--------|-------------|
| leaf | ✓ | — | `{ capacity, reserved? }` |
| composite | — | ✓ | `{ refs }` |

하나의 `TableDef`는 leaf 또는 composite 중 하나여야 한다. 둘 다이거나 둘 다 아닌 경우는 `ValidationError`.

### 슬롯 마커 (reserved)

`LeafVersion.reserved`는 해당 버전의 어느 position이 마커 슬롯인지를 선언한다.

- 마커는 스키마 레이어의 선언 — 실제 entry 저장은 `IndexMetaStore`가 담당.
- `capacity` 변화 없이 마커만 추가하는 경우 → 새 버전 불필요 (마커도 entry의 일종).
- 마커가 추가될 때 해당 position의 entry는 DB에 `token` 값으로 자동 시드될 수 있다.
- `conventions.md §2` 표준 토큰 참조.

---

## 3. defineTable API

```ts
function defineTable(id: string, input: {
  source?: { kind: { type: "string_enum" } | { type: "number_enum" } };
  dims?: TableDef[];
  versions: Record<string, TableVersion>;
  description?: string;
}): TableDef
```

### 검증 규칙

| 규칙 | 에러 |
|------|------|
| id 비어있음 | `ValidationError` |
| id에 `:` 포함 | `ValidationError` |
| source와 dims 동시 선언 | `ValidationError` |
| source도 dims도 없음 | `ValidationError` |
| versions 비어있음 | `ValidationError` |
| versionId 비어있음 / `:` 포함 | `ValidationError` |
| leaf version에 capacity 없음 | `ValidationError` |
| capacity가 양의 정수가 아님 | `ValidationError` |
| composite version에 refs 없음 | `ValidationError` |
| refs에 선언된 dim 누락 | `ValidationError` |
| refs의 key가 dims에 없는 id | `ValidationError` |
| `ref.prefix !== dimId` | `ValidationError` |
| ref.prefix / ref.version 비어있음 | `ValidationError` |

---

## 4. compileSchema API

```ts
function compileSchema(defs: TableDef[]): CompiledSchema
```

`TableDef` 배열을 받아 의존성 순서대로 처리하고, capacity가 계산된 `CompiledSchema`를 반환한다.

### 내부 처리 단계

```
① collectAllDefs  — 재귀로 dims 참조를 따라가 모든 TableDef 수집
                    (인자에 직접 넘기지 않아도 dims 체인에 있으면 자동 포함)
② topologicalSort — leaf 먼저, composite 나중. 순환 참조 시 ValidationError.
③ spec 빌드      — 정렬된 순서대로 처리:
                    leaf     → LeafTableSpec (capacity 그대로)
                    composite → CompositeVersionSpec (capacity = dim capacity 곱)
```

### 검증 규칙

| 규칙 | 에러 |
|------|------|
| 동일 id를 가진 서로 다른 TableDef 객체 | `ValidationError` |
| 순환 의존성 | `ValidationError` |
| composite가 참조하는 prefix가 specMap에 없음 | `ValidationError` |
| composite가 참조하는 version이 해당 spec에 없음 | `ValidationError` |

---

## 5. CompiledSchema

```ts
interface CompiledSchema {
  readonly tables: readonly TableSpec[];
  getTable(id: string): TableSpec | undefined;
  diff(from: CompiledSchema): SchemaDiff;
}
```

### TableSpec

```ts
type TableSpec = LeafTableSpec | CompositeTableSpec;

interface LeafTableSpec {
  kind: "leaf";
  id: string;
  entryKind: { type: "string_enum" } | { type: "number_enum" };
  versions: ReadonlyMap<string, LeafVersionSpec>;  // versionId → { versionId, capacity }
}

interface CompositeTableSpec {
  kind: "composite";
  id: string;
  versions: ReadonlyMap<string, CompositeVersionSpec>;
}

interface CompositeVersionSpec {
  versionId: string;
  capacity: number;    // 자동 계산: 모든 dim capacity의 곱
  dims: CompositeVersionDim[];
}

interface CompositeVersionDim {
  dimId: string;
  ref: { prefix: string; version: string; capacity: number };
}
```

### diff

`diff(from)`은 **capacity 변화만** 감지한다. entries 변화는 스키마 관심사가 아니다.

```ts
interface SchemaDiff {
  added: TableSpec[];           // from에 없던 테이블
  removed: string[];            // to에 없는 테이블 id
  changed: TableVersionChange[];
}

interface TableVersionChange {
  tableId: string;
  addedVersions: VersionCapacityChange[];   // 새로 추가된 버전 또는 capacity 변경
  removedVersions: string[];
}

interface VersionCapacityChange {
  versionId: string;
  capacity: number;
  previousCapacity?: number;  // capacity가 변경된 경우
}
```

---

## 6. 사용 예시

```ts
import { defineTable, compileSchema } from "index-meta";

// ── leaf 테이블 ───────────────────────────────────────────

const roleTable = defineTable("role", {
  source: { kind: { type: "string_enum" } },
  versions: {
    v1: {
      capacity: 8,
      reserved: [
        { position: 1, token: "_" },  // null — 역할 미지정
        { position: 2, token: "~" },  // other — 분류 불가
      ],
    },
    v2: { capacity: 16 },  // 주소 공간 확장 → 새 버전
  },
});

const scoreTable = defineTable("score", {
  source: { kind: { type: "number_enum" } },
  versions: {
    v1: {
      capacity: 16,
      reserved: [
        { position: 1, token: "NaN" },  // 숫자가 아닌 값이 들어온 경우
      ],
    },
  },
});

const actionTable = defineTable("action", {
  source: { kind: { type: "string_enum" } },
  versions: {
    v1: { capacity: 4 },
  },
});

// ── composite 테이블 ──────────────────────────────────────

const permTable = defineTable("perm", {
  dims: [roleTable, actionTable],
  versions: {
    v1: {
      refs: {
        role:   { prefix: "role",   version: "v1" },  // capacity 8
        action: { prefix: "action", version: "v1" },  // capacity 4
      },
      // capacity 자동 계산: 8 × 4 = 32
    },
    v2: {
      refs: {
        role:   { prefix: "role",   version: "v2" },  // capacity 16 → 크기 변화
        action: { prefix: "action", version: "v1" },
      },
      // capacity 자동 계산: 16 × 4 = 64
    },
  },
});

// ── 컴파일 ────────────────────────────────────────────────

const schema = compileSchema([roleTable, actionTable, permTable]);
// roleTable, actionTable은 dims 체인으로 자동 수집되므로 생략 가능:
// compileSchema([permTable])  ← 동일한 결과

const permSpec = schema.getTable("perm")!;
// permSpec.kind === "composite"
// permSpec.versions.get("v1")!.capacity === 32
// permSpec.versions.get("v2")!.capacity === 64

// ── diff ──────────────────────────────────────────────────

const previousSchema = compileSchema([roleTable, actionTable]);
const diff = schema.diff(previousSchema);
// diff.added = [CompositeTableSpec("perm")]
```

---

## 7. 레이어 위치

```
defineTable / compileSchema   ← 이 스펙 (스키마 선언 레이어)
      ↓ 주소 공간 명세 (capacity, refs)
IndexMetaStore                ← store.spec.md (DB 저장 레이어)
      ↓ entries 저장/조회
MetaRegistry                  ← registry.spec.md (런타임 encode/decode)
      ↓ 1D 주소 계산
WeightedIndex                 ← weighted-index/core.spec.md (수학 레이어)
```

`compileSchema`의 출력(`CompiledSchema`)은 DB 마이그레이션 판단과 스키마 검증에 사용된다.
런타임 encode/decode가 필요하면 DB에서 entries를 읽어 `MetaRegistry`를 생성하고, `createCodec()`으로 특정 version의 `MetaCodec`을 얻는다.

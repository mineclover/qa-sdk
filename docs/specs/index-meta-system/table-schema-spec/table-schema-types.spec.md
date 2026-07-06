---
def:
  tier: component
  id: table-schema-types-spec
  address: def_document:v2:342207
  scope: data
  aspect: domain_data
  depth: specification
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [data, structural, contract]
  links:
    - target: table-schema-spec
      type: refines
sources:
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/table-def.test.ts
  - packages/index-meta/src/index.ts
---

# TableDef 설계 원칙 및 타입 계층

## 목적 ^purpose

TableDef의 이원 구조(leaf / composite)와 capacity/entries 분리 원칙,
그리고 타입 계층(TableDef, AddressRef, LeafVersion, CompositeVersion)을 정의한다.

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
    ├── LeafVersion     { capacity }                   ← leaf
    └── CompositeVersion { refs: Record<dimId, AddressRef> }  ← composite

AddressRef
├── prefix: string     ← 참조 테이블의 id
└── version: string    ← 참조 테이블의 versionId
```

### 리프 vs 복합 구분

| 구분 | `source` | `dims` | version 형태 |
|------|----------|--------|-------------|
| leaf | ✓ | — | `{ capacity }` |
| composite | — | ✓ | `{ refs }` |

하나의 `TableDef`는 leaf 또는 composite 중 하나여야 한다. 둘 다이거나 둘 다 아닌 경우는 `ValidationError`.

### 슬롯 마커 경계

현재 source-backed `LeafVersion`은 `capacity`만 갖는다. `ReservedSlot` 또는 `LeafVersion.reserved`는 public TableDef 타입 계약이 아니다.

- marker token을 entry로 저장해야 하는 경우 `IndexMetaStore` 또는 registry convention에서 처리한다.
- 이 문서는 marker seeding API나 reserved field를 소유하지 않는다.
- capacity 변화 없이 entry를 채우는 원칙은 유지되지만, 해당 entry의 의미는 table schema가 아니라 store/registry consumer가 정한다.

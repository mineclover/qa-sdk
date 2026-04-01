---
def:
  id: meta-semantic-data-contract
  level: module
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: ms-concept-data-facets
      type: depends_on
    - target: ms-concept-pipe
      type: depends_on
    - target: meta-semantic-pipe-impl
      type: depends_on
---

# 데이터 계약 — 스키마 정의 + 관계 + 계보 추적

## 목적 ^purpose

데이터의 스키마를 정의하고, 엔티티 간 관계를 표현하고,
파이프 흐름에서 필드 단위의 데이터 계보를 추적하는 체계.
기존 table-ref의 DimRef/ColumnRef 위에서 패싯 역할 매핑,
관계 카디널리티, 스키마 호환성, 필드 lineage를 확장한다.

## 방법 ^method

**DataSchema**가 테이블의 컬럼별 패싯 역할을 매핑하고,
**DataRelation**이 엔티티 간 관계 유형과 cascade를 정의하고,
**DataContract**가 파이프 step별 생산/소비 스키마 호환성을 검증하고,
**FieldLineage**가 파이프를 거치며 필드가 어떻게 변환되는지 추적하고,
**SchemaVersion**이 스키마 변경의 호환성을 판별한다.

## 구성 ^overview

5개 구성 요소:

1. **DataSchema** — 컬럼 정의 + 패싯 역할 매핑 (기존 TableSchema 확장)
2. **DataRelation** — 엔티티 간 관계 유형 + cascade (기존 ColumnRef.table_ref 확장)
3. **DataContract** — 파이프 step의 생산/소비 스키마 호환 검증
4. **FieldLineage** — 필드 단위 데이터 변환 추적 (A.name → B.userName)
5. **SchemaVersion** — 스키마 변경 이력 + breaking/non-breaking 판별

---

## 1. DataSchema — 컬럼 + 패싯 역할

### 기존 TableSchema와의 관계

```
기존 TableSchema:
  columns: { name: ColumnRef, age: ColumnRef, ... }
  ColumnRef: scalar | axis_ref | table_ref | prefix_ref

DataSchema (확장):
  columns: { name: DataColumn, age: DataColumn, ... }
  DataColumn = ColumnRef + 패싯 역할 + 제약
```

### 타입 정의

```typescript
interface DataSchema {
  /** 스키마 식별자 */
  schemaId: string;
  version: string;

  /** 컬럼 정의 */
  columns: Record<string, DataColumn>;

  /** 기본키 */
  primaryKey: string[];

  /** 스키마 해시 (구조적 동등성) */
  schemaHash: string;
}

interface DataColumn {
  /** 기존 ColumnRef 타입 */
  ref: ColumnRef;

  /** 패싯 역할: 이 컬럼이 데이터 흐름에서 어떤 역할인가 */
  facetRole?: FacetRole;

  /** 필수 여부 */
  required: boolean;

  /** 기본값 */
  defaultValue?: unknown;

  /** 검증 제약 */
  constraints?: ColumnConstraint[];
}

/** 컬럼의 패싯 역할 */
type FacetRole =
  | "produced"     // 이 컬럼은 이 엔티티에서 생산됨 (시작점)
  | "consumed"     // 이 컬럼은 외부에서 받아서 소비됨
  | "derived"      // 이 컬럼은 다른 컬럼에서 계산으로 파생됨
  | "managed"      // 이 컬럼은 정합성 관리 대상 (검증 규칙 적용)
  | "identity";    // 이 컬럼은 UID/PK — 저장의 식별자

/** 컬럼 제약 */
interface ColumnConstraint {
  type: "not-null" | "unique" | "range" | "pattern" | "enum" | "fk";
  value?: unknown;
}

/** 기존 ColumnRef (재사용) */
type ColumnRef =
  | { kind: "scalar"; type: string }
  | { kind: "axis_ref"; axisId: string }
  | { kind: "table_ref"; table: string }
  | { kind: "prefix_ref"; prefixId: string };
```

### 예시

```typescript
const orderSchema: DataSchema = {
  schemaId: "orders",
  version: "v1",
  primaryKey: ["id"],
  schemaHash: "abc123",
  columns: {
    id: {
      ref: { kind: "scalar", type: "string" },
      facetRole: "identity",
      required: true,
    },
    member_id: {
      ref: { kind: "table_ref", table: "members" },
      facetRole: "consumed",   // 외부(members)에서 받음
      required: true,
      constraints: [{ type: "fk", value: "members.id" }],
    },
    status: {
      ref: { kind: "axis_ref", axisId: "order_action" },
      facetRole: "managed",    // 상태 전이 규칙으로 관리
      required: true,
    },
    total_amount: {
      ref: { kind: "scalar", type: "number" },
      facetRole: "derived",    // cart_items에서 계산으로 파생
      required: true,
    },
    service_addr: {
      ref: { kind: "prefix_ref", prefixId: "service" },
      facetRole: "consumed",   // 좌표 주소 참조
      required: true,
    },
  },
};
```

---

## 2. DataRelation — 엔티티 간 관계

### 기존 ColumnRef.table_ref와의 관계

```
기존: { kind: "table_ref", table: "members" }
  → "이 컬럼이 members 테이블을 참조" (FK 존재만 표현)

DataRelation (확장):
  → 카디널리티 (1:1, 1:N, N:M)
  → cascade 규칙 (삭제/갱신 시 동작)
  → 방향 (소유 vs 참조)
```

### 타입 정의

```typescript
interface DataRelation {
  /** 관계 식별자 */
  relationId: string;

  /** 소스 엔티티 */
  source: { schemaId: string; column: string };

  /** 대상 엔티티 */
  target: { schemaId: string; column: string };

  /** 카디널리티 */
  cardinality: "1:1" | "1:N" | "N:1" | "N:M";

  /** 관계 성격 */
  ownership: RelationOwnership;

  /** cascade 규칙 */
  cascade: CascadeRule;
}

type RelationOwnership =
  | "owns"         // source가 target을 소유 (삭제 시 함께 삭제)
  | "references"   // source가 target을 참조 (삭제 시 null 또는 제약)
  | "embeds";      // source 안에 target이 내장 (비정규화)

interface CascadeRule {
  onDelete: "cascade" | "set-null" | "restrict" | "no-action";
  onUpdate: "cascade" | "restrict" | "no-action";
}
```

### 예시

```typescript
const relations: DataRelation[] = [
  {
    relationId: "order-member",
    source: { schemaId: "orders", column: "member_id" },
    target: { schemaId: "members", column: "id" },
    cardinality: "N:1",
    ownership: "references",
    cascade: { onDelete: "restrict", onUpdate: "cascade" },
  },
  {
    relationId: "cart-items",
    source: { schemaId: "carts", column: "id" },
    target: { schemaId: "cart_items", column: "cart_id" },
    cardinality: "1:N",
    ownership: "owns",
    cascade: { onDelete: "cascade", onUpdate: "cascade" },
  },
];
```

---

## 3. DataContract — 파이프 step의 스키마 호환 검증

### 개념

파이프의 각 step은 데이터를 소비하거나 생산한다.
**생산자가 내보내는 스키마**와 **소비자가 기대하는 스키마**가 호환되어야 한다.

```
PipeStep(facet: "소비")
  → 이 step이 기대하는 필드: { id, name, amount }
  → 실제 들어오는 데이터: { id, name, amount, extra_field }
  → 호환: ✓ (상위 호환 — 추가 필드는 무시)

PipeStep(facet: "생산")
  → 이 step이 내보내는 필드: { id, result }
  → 다음 step이 기대하는 필드: { id, result, status }
  → 호환: ✗ (status 누락 — 하위 호환 실패)
```

### 타입 정의

```typescript
interface DataContract {
  /** 계약 식별자 */
  contractId: string;

  /** 파이프 참조 */
  pipeId: string;
  stepPath: string;           // "flow.steps[1]"

  /** 생산 스키마: 이 step이 내보내는 필드 */
  produces?: FieldSet;

  /** 소비 스키마: 이 step이 기대하는 필드 */
  consumes?: FieldSet;
}

interface FieldSet {
  fields: Record<string, FieldSpec>;
}

interface FieldSpec {
  type: string;               // "string", "number", "Order", etc.
  required: boolean;
  source?: string;            // 원본 스키마 참조 (schemaId.column)
}

/** 호환성 검증 결과 */
interface CompatibilityResult {
  compatible: boolean;
  /** 누락 필드 (소비자가 기대하지만 생산자에 없는) */
  missingFields: string[];
  /** 타입 불일치 */
  typeMismatches: Array<{ field: string; expected: string; actual: string }>;
  /** 추가 필드 (생산자에 있지만 소비자가 기대하지 않는 — 상위 호환) */
  extraFields: string[];
  /** breaking 여부 */
  breaking: boolean;
}

/** 두 FieldSet의 호환성 검증 */
function checkCompatibility(
  producer: FieldSet,
  consumer: FieldSet,
): CompatibilityResult;
```

### 호환성 규칙

| 상황 | 판정 | breaking? |
|------|------|-----------|
| 소비자 기대 필드가 생산자에 있음 | 호환 | ✗ |
| 생산자에 추가 필드 있음 | 상위 호환 | ✗ |
| 소비자 기대 필드가 생산자에 없음 | 비호환 | **✓** |
| 같은 필드인데 타입 다름 | 비호환 | **✓** |
| 소비자 required인데 생산자 optional | 비호환 | **✓** |
| 생산자 required인데 소비자 optional | 호환 | ✗ |

---

## 4. FieldLineage — 필드 단위 데이터 변환 추적

### 개념

파이프를 거치면서 필드가 어떻게 변환되는지 추적한다.

```
orders.total_amount (derived)
  ← cart_items.price × cart_items.quantity (계산)
    ← items.price (원본)

→ lineage: items.price → cart_items.price → Σ(price × qty) → orders.total_amount
```

### 타입 정의

```typescript
interface FieldLineage {
  /** 대상 필드 */
  target: FieldRef;

  /** 원본 필드(들) */
  sources: FieldRef[];

  /** 변환 유형 */
  transform: TransformKind;

  /** 변환 표현식 (사람 읽기용) */
  expression?: string;

  /** 이 변환이 발생하는 파이프/step */
  pipeId: string;
  stepPath: string;
}

interface FieldRef {
  schemaId: string;
  column: string;
}

type TransformKind =
  | "direct"       // 직접 복사 (A.name → B.name)
  | "rename"       // 이름 변경 (A.name → B.userName)
  | "compute"      // 계산 (A.price × A.qty → B.total)
  | "aggregate"    // 집계 (Σ A.amount → B.total)
  | "lookup"       // 참조 조회 (A.userId → lookup(users) → B.userName)
  | "derive"       // 파생 (A.birthDate → compute(age) → B.age)
  | "concat"       // 결합 (A.first + A.last → B.fullName)
  | "split"        // 분할 (A.fullName → B.first, B.last)
  | "filter"       // 필터링 (A.items → filter(active) → B.activeItems)
  | "cast";        // 타입 변환 (A.amount(string) → B.amount(number))
```

### 계보 그래프

```typescript
interface LineageGraph {
  /** 전체 lineage 목록 */
  lineages: FieldLineage[];

  /** 특정 필드의 원본 추적 (역방향) */
  traceOrigins(field: FieldRef): FieldLineage[];

  /** 특정 필드의 영향 추적 (순방향) */
  traceImpact(field: FieldRef): FieldLineage[];

  /** 특정 스키마의 모든 lineage */
  getSchemaLineage(schemaId: string): FieldLineage[];
}
```

---

## 5. SchemaVersion — 스키마 변경 이력 + 호환성

### 타입 정의

```typescript
interface SchemaVersion {
  schemaId: string;
  version: string;
  previousVersion?: string;

  /** 변경 내역 */
  changes: SchemaChange[];

  /** 전체 호환성 판정 */
  compatibility: "backward" | "forward" | "full" | "breaking";

  changelog?: string;
  createdAt: string;
}

interface SchemaChange {
  /** 변경 유형 */
  type: SchemaChangeType;
  /** 대상 컬럼 */
  column: string;
  /** 상세 */
  detail?: string;
}

type SchemaChangeType =
  | "add-optional"     // 선택 필드 추가 (backward compatible)
  | "add-required"     // 필수 필드 추가 (BREAKING)
  | "remove"           // 필드 제거 (BREAKING)
  | "rename"           // 필드 이름 변경 (BREAKING)
  | "type-change"      // 타입 변경 (BREAKING)
  | "constraint-add"   // 제약 추가 (potentially breaking)
  | "constraint-remove" // 제약 제거 (backward compatible)
  | "default-add"      // 기본값 추가 (backward compatible)
  | "default-change";  // 기본값 변경 (backward compatible)
```

### 호환성 판별 규칙

| 변경 유형 | backward? | forward? | breaking? |
|----------|:---------:|:--------:|:---------:|
| add-optional | ✓ | ✗ | ✗ |
| add-required | ✗ | ✓ | **✓** |
| remove | ✗ | ✓ | **✓** |
| rename | ✗ | ✗ | **✓** |
| type-change | ✗ | ✗ | **✓** |
| constraint-add | △ | ✗ | △ |
| constraint-remove | ✓ | ✗ | ✗ |
| default-add | ✓ | ✓ | ✗ |
| default-change | ✓ | ✓ | ✗ |

---

## 6. 파이프 흐름과의 연결

### PipeStep에 DataContract 연결

```typescript
// 확장: PipeStep에 계약 참조 추가
interface PipeStep {
  kind: "step";
  facet: string;
  eventKey?: string;
  constraints?: Constraint[];
  timeout?: number;

  /** 이 step의 데이터 계약 (확장) */
  dataContract?: {
    consumes?: FieldSet;      // 기대하는 입력 스키마
    produces?: FieldSet;      // 보장하는 출력 스키마
    accesses?: SchemaAccess[]; // 접근하는 테이블/컬럼
  };
}

interface SchemaAccess {
  schemaId: string;
  columns: string[];
  mode: "read" | "write" | "readwrite";
}
```

### 검증 파이프라인

```
PipeGraph 정의
  ↓
각 PipeStep의 dataContract 검증
  → step[0].produces ↔ step[1].consumes 호환 검증
  → 테이블 접근 권한 검증
  → FK 무결성 검증
  ↓
FieldLineage 자동 추출
  → step 간 필드 매핑 추적
  → 계보 그래프 구축
  ↓
SchemaVersion 변경 시
  → breaking change 감지
  → 영향받는 파이프 목록
  → 호환되지 않는 계약 식별
```

---

## 7. 기존 table-ref 체계와의 관계

| 기존 | 확장 | 관계 |
|------|------|------|
| `DimRef` (axis/prefix_ref/table_ref) | `DataColumn.ref` | ColumnRef 그대로 재사용 |
| `ColumnRef` 4종 | `DataColumn` (ref + facetRole + constraints) | 패싯 역할 추가 |
| `TableSchema` | `DataSchema` (columns + PK + hash) | 구조화 확장 |
| (없음) | `DataRelation` (카디널리티 + cascade) | 신규 |
| (없음) | `DataContract` (생산/소비 스키마 매칭) | 신규 |
| (없음) | `FieldLineage` (필드 변환 추적) | 신규 |
| (없음) | `SchemaVersion` (호환성 판별) | 신규 |

---

## 8. 범위

### 현재 범위

- DataSchema: 컬럼 정의 + 패싯 역할 + 제약
- DataRelation: 1:1/1:N/N:M + cascade
- DataContract: 생산/소비 스키마 호환 검증
- FieldLineage: 10종 변환 유형 + 계보 그래프
- SchemaVersion: 9종 변경 유형 + 호환성 판별

### 후속 구현

| 순서 | 구현 | 파일 |
|------|------|------|
| 1 | DataSchema + DataColumn 타입 | `core/src/types/data-schema.ts` |
| 2 | DataRelation 타입 | `core/src/types/data-relation.ts` |
| 3 | checkCompatibility() | `core/src/data-contract.ts` |
| 4 | FieldLineage + LineageGraph | `core/src/data-lineage.ts` |
| 5 | SchemaVersion + 호환성 판별 | `core/src/schema-version.ts` |

---
def:
  id: meta-semantic-data-contract
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
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
  sources:
    - packages/core/src/types/data-schema.ts
    - packages/core/src/pipe/data-contract.ts
    - packages/core/src/pipe/data-contract.test.ts
    - packages/core/src/pipe/pipe-lineage.ts
    - packages/core/src/pipe/pipe-lineage.test.ts
    - packages/core/src/pipe/meta-semantic-integration.test.ts

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
**checkCompatibility**가 파이프 step별 생산/소비 스키마 호환성을 검증하고,
**LineageCollector**가 파이프를 거치며 필드가 어떻게 변환되는지 추적하고,
**VersionCollector**가 스키마 변경의 호환성을 판별하고 이력을 관리한다.

## 구성 ^overview

5개 구성 요소 + 관련 소스:

| 구성 | 설명 | 구현 파일 |
|------|------|----------|
| DataSchema | 컬럼 + 패싯 역할(produced/consumed/derived/managed/identity) + 제약 | `packages/core/src/types/data-schema.ts` |
| DataRelation | 1:1/1:N/N:M + owns/references/embeds + cascade | `packages/core/src/types/data-schema.ts` |
| 호환 검증 | checkCompatibility(producer, consumer) → 누락/타입불일치 판정 | `packages/core/src/pipe/data-contract.ts` |
| 계보 추적 | LineageCollector — 10종 변환(direct/rename/compute/aggregate/...) + 원본/영향 추적 | `packages/core/src/pipe/data-contract.ts` |
| 버전 관리 | VersionCollector — 9종 변경 유형 + backward/forward/breaking 판별 | `packages/core/src/pipe/data-contract.ts` |

테스트: `packages/core/src/pipe/data-contract.test.ts` (36 tests)
통합: `packages/core/src/pipe/meta-semantic-integration.test.ts` (시나리오 9~10)

---

## 1. DataSchema — 컬럼 + 패싯 역할

기존 TableSchema를 확장: `DataColumn = ColumnRef + facetRole + constraints`

| facetRole | 의미 | 예시 |
|-----------|------|------|
| `produced` | 이 엔티티에서 생산 | orders.id (자동 생성) |
| `consumed` | 외부에서 받아서 소비 | orders.member_id (members에서) |
| `derived` | 다른 컬럼에서 계산 파생 | orders.total_amount (cart_items에서 집계) |
| `managed` | 정합성 관리 대상 | orders.status (상태 전이 규칙) |
| `identity` | UID/PK — 저장의 식별자 | orders.id |

> 타입 상세: `packages/core/src/types/data-schema.ts` `DataSchema`, `DataColumn`, `FacetRole` 참조

---

## 2. DataRelation — 엔티티 간 관계

기존 ColumnRef.table_ref에 카디널리티 + cascade 추가.

| 필드 | 설명 |
|------|------|
| cardinality | 1:1, 1:N, N:1, N:M |
| ownership | owns(소유), references(참조), embeds(내장) |
| cascade.onDelete | cascade, set-null, restrict, no-action |
| cascade.onUpdate | cascade, restrict, no-action |

> 타입 상세: `packages/core/src/types/data-schema.ts` `DataRelation`, `CascadeRule` 참조

---

## 3. 스키마 호환 검증

생산자 스키마 ↔ 소비자 기대 스키마 매칭.

| 상황 | 판정 | breaking? |
|------|------|-----------|
| 소비자 기대 필드가 생산자에 있음 | 호환 | ✗ |
| 생산자에 추가 필드 | 상위 호환 | ✗ |
| 소비자 필수 필드 누락 | 비호환 | **✓** |
| 타입 불일치 | 비호환 | **✓** |

> 구현: `packages/core/src/pipe/data-contract.ts` `checkCompatibility()` 참조

---

## 4. 계보 추적 (FieldLineage)

10종 변환 유형: direct, rename, compute, aggregate, lookup, derive, concat, split, filter, cast

```
items.price → cart_items.subtotal (compute: price × qty)
  → orders.total_amount (aggregate: Σ subtotal)
    → payments.amount (direct)
      → report.revenue (aggregate: Σ amount)
```

| API | 설명 |
|-----|------|
| `LineageCollector.record(lineage)` | 계보 기록 |
| `.traceOrigins(field)` | 원본 역추적 |
| `.traceImpact(field)` | 영향 순추적 |
| `.getSchemaLineage(schemaId)` | 스키마별 계보 |

> 구현: `packages/core/src/pipe/data-contract.ts` `LineageCollector` 참조

---

## 5. 스키마 버전 관리

9종 변경 유형 + 호환성 자동 판별.

| 변경 | 호환성 |
|------|--------|
| add-optional, default-add/change, constraint-remove | backward |
| constraint-add | forward |
| add-required, remove, rename, type-change | **breaking** |

| API | 설명 |
|-----|------|
| `collectSchemaChanges(old, new)` | 변경 수집 |
| `determineCompatibility(changes)` | 호환성 판별 |
| `createSchemaVersion(old, new)` | SchemaVersion 생성 |
| `VersionCollector.getBreakingChanges(id)` | breaking 필터 |

> 구현: `packages/core/src/pipe/data-contract.ts` `VersionCollector` 참조

---

## 6. 파이프 흐름과의 연결 — 시뮬레이션 기반 계보

계보 추적의 데이터 소스는 **시뮬레이션 결과(`SimulationResult`)**이다.
시뮬레이션이 실행 경로를 확정한 후에야 step 간 데이터 흐름을 추적할 수 있다.

```
시뮬레이션 → SimulationResult (실행된 step 순서 확정)
    ↓
계보 추적 → step 간 produces/consumes 매칭 → 필드 단위 계보 수집
    ↓
스키마 호환 검증 → 변경 감지 → 호환성 판정
```

PipeStep.dataContract로 파이프 step별 입출력 스키마 + 접근 테이블 정의.

| API | 입력 | 설명 |
|-----|------|------|
| `extractLineageFromSimulation(result, pipes)` | `SimulationResult` | 시뮬 결과에서 계보 자동 추출 |
| `validateStepContracts(result, pipes)` | `SimulationResult` | 실행된 step 간 스키마 호환 검증 |

> 시뮬레이션 없이는 "어떤 step이 실행되었는지" 알 수 없으므로 계보도 구성 불가.

> 구현: `packages/core/src/pipe/pipe-bridge.ts` 참조
> 타입: `packages/core/src/types/pipe-spec.ts` `StepDataContract` 참조

---

## 7. 기존 table-ref와의 관계

| 기존 | 확장 | 관계 |
|------|------|------|
| DimRef (axis/prefix_ref/table_ref) | DataColumn.ref | ColumnRef 그대로 재사용 |
| ColumnRef 4종 | DataColumn (ref + facetRole + constraints) | 패싯 역할 추가 |
| TableSchema | DataSchema (columns + PK + hash) | 구조화 확장 |

---

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/data-contract.test.ts   # 36 tests
pnpm --filter @qa-sdk/core test                                 # 275 tests (통합 포함)
```

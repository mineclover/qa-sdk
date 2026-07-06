---
def:
  id: facet-code-lineage
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-static-lineage
      type: depends_on
    - target: data-object-binding
      type: depends_on
    - target: pipe-store-sqlite
      type: depends_on
  sources:
    - packages/core/src/data-object/facet-code-registry.ts
    - packages/core/src/data-object/facet-code-registry.test.ts
    - packages/core/src/data-object/lineage-chain.ts
    - packages/core/src/data-object/lineage-chain.test.ts
    - packages/core/src/pipe/pipe-lineage.ts
    - packages/core/src/pipe/pipe-lineage.test.ts
    - packages/pipe-store-sqlite/src/facet-code-store.ts
    - packages/pipe-store-sqlite/src/facet-code-store.test.ts

---

# 패싯-코드 매핑 + 3단 계보 체인

## 목적 ^purpose

패싯(PipeStep.facet)과 소스 코드 구현체를 연결하여,
데이터 계보 추적 시 "이 변환이 실제로 어디서 구현되나"까지 도달할 수 있게 한다.
코드 → 패싯 → 데이터 → 좌표 4단 연결의 핵심 브릿지.

## ^overview

```
코드 (validate.ts:checkPayment)
  ↕ FacetCodeMapping
패싯 ("결제검증")
  ↕ FieldLineage.facet
데이터 계보 (orderId → paymentResult)
  ↕ DataObjectBinding
좌표 (order_event:v1:42)
```

3개 레지스트리를 연결: FacetCodeStore + LineageCollector + BindingRegistry.

## ^defines

### FacetCodeRef — 소스 코드 위치

```ts
interface FacetCodeRef {
  file: string;       // 모노레포 루트 기준 상대 경로
  symbol?: string;    // 함수/클래스명
  lines?: [number, number];
}
```

### FacetCodeMapping — 패싯 ↔ 코드 매핑

```ts
interface FacetCodeMapping {
  facet: string;                    // PipeStep.facet 값
  implementations: FacetCodeRef[];  // 1:N 코드 위치
  schemaId?: string;                // DataSchema 연결
}
```

### FacetCodeStore — 포트 인터페이스

```ts
interface FacetCodeStore {
  register(mapping: FacetCodeMapping): void;
  getByFacet(facet: string): FacetCodeMapping | null;
  getByFile(file: string): FacetCodeMapping[];
  getBySchema(schemaId: string): FacetCodeMapping[];
  listAll(): FacetCodeMapping[];
  remove(facet: string): boolean;
}
```

어댑터: `FacetCodeRegistry` (인메모리), `SqliteFacetCodeStore` (drizzle SQLite).

### FieldLineage.facet — 계보에 패싯 컨텍스트 주입

```ts
interface FieldLineage {
  target: FieldRef;
  sources: FieldRef[];
  transform: TransformKind;
  facet?: string;       // 이 변환을 수행한 패싯
  // ... 기존 필드
}
```

`deriveStaticLineage`에서 `step.facet` 자동 주입.

### FullLineageChain — 3단 체인 조립

```ts
interface LineageChainNode {
  field: FieldRef;
  facet?: string;
  codeRefs?: FacetCodeRef[];
  binding?: DataObjectBinding;
  transform?: TransformKind;
}

interface FullLineageChain {
  target: LineageChainNode;
  sources: LineageChainNode[];
  quality: {
    bound: number;    // 좌표 바인딩 있는 노드
    unbound: number;  // 바인딩 없는 노드
    mapped: number;   // 코드 매핑 있는 패싯
    unmapped: number; // 코드 매핑 없는 패싯
  };
}
```

| 함수 | 역할 |
|------|------|
| `buildFullLineageChain(target, collector, facetReg, bindingReg)` | 3단 체인 조립 |
| `resolveFacetMappings(graph, registry)` | PipeGraph의 모든 step.facet 매핑 조회 |

### SQLite 스키마

```sql
CREATE TABLE facet_code_mappings (
  facet TEXT PRIMARY KEY,
  implementations TEXT NOT NULL,  -- FacetCodeRef[] JSON
  schema_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_fcm_schema_id ON facet_code_mappings (schema_id);
```

## 설계 결정

- PipeSpec 순수성 유지 — 코드 매핑은 별도 레지스트리, PipeStep에 codeRef 직접 추가 안 함
- 불완전 허용 — unmapped/unbound는 warning, 에러 아님 (quality 메트릭으로 판단)
- 포트 패턴 — FacetCodeStore 인터페이스로 인메모리/SQLite 어댑터 교체 가능

## ^consumes

- `FieldLineage`, `FieldRef`, `TransformKind` (data-schema.ts)
- `DataObjectBinding` (data-object/types.ts)
- `BindingRegistry` (data-object/registry.ts)
- `LineageCollector` (pipe/data-contract.ts)
- `collectFlowSteps` (pipe/pipe-fold.ts)

## 구현 현황

| 항목 | 파일 | 상태 |
|------|------|------|
| FacetCodeRef, FacetCodeMapping 타입 | `packages/core/src/data-object/types.ts` | 완료 |
| FacetCodeStore 포트 | `packages/core/src/data-object/facet-code-registry.ts` | 완료 |
| FacetCodeRegistry 인메모리 | `packages/core/src/data-object/facet-code-registry.ts` | 완료 (7 tests) |
| resolveFacetMappings | `packages/core/src/data-object/facet-code-registry.ts` | 완료 |
| FieldLineage.facet | `packages/core/src/types/data-schema.ts` | 완료 |
| facet 자동 주입 | `packages/core/src/pipe/pipe-lineage.ts` | 완료 |
| buildFullLineageChain | `packages/core/src/data-object/lineage-chain.ts` | 완료 (3 tests) |
| SqliteFacetCodeStore | `pipe-store-sqlite/facet-code-store.ts` | 완료 (8 tests) |

### 폐기 항목

| 항목 | 사유 |
|------|------|
| ~~enrichLineage~~ | `buildFullLineageChain` 내부 `enrichNode()`가 동일 기능 수행. 별도 함수 중복 |
| ~~validateFullLineageChain~~ | `FullLineageChain.quality` 메트릭 + `validateLineageChainDetailed`로 이미 커버 |
| ~~@facet.impl annotation 수집~~ | 소비자 없음. 수동 `register()` 호출로 충분. 소비자(대시보드, CLI) 발생 시 착수 |

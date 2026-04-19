---
def:
  id: data-object-binding
  type: design
  tier: system
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-data-contract
      type: depends_on
    - target: prefix-path-summation
      type: depends_on
    - target: pipe-static-lineage
      type: depends_on
    - target: data-object-codegen
      type: contains
    - target: facet-code-lineage
      type: contains
---

# DataObject Binding — 데이터 스키마 ↔ prefix 좌표 바인딩

## 목적 ^purpose

DataSchema를 prefix 주소 공간에 바인딩하여 데이터 인스턴스를
좌표로 식별 가능한 객체로 만들고, 필드 단위 계보 추적의 기반을 제공한다.

## ^defines

### 소스 패싯 매핑

| 소스 모듈 | 패싯 | 역할 |
|-----------|------|------|
| `core/data-object/types.ts` | 타입 정의 | DataObjectBinding, ColumnAxisMapping, BoundDataObject, ChainIssue 등 9 인터페이스 |
| `core/data-object/registry.ts` | 레지스트리 | BindingRegistry (register/getBySchema/getByPrefix/listAll/remove) |
| `core/data-object/validate.ts` | 검증 | validateBindings, validateLineageChain, validateLineageChainDetailed |
| `core/data-object/lineage-chain.ts` | 계보 체인 | buildFullLineageChain |
| `core/data-object/facet-code-registry.ts` | 패싯↔코드 | FacetCodeRegistry, resolveFacetMappings |

### 핵심 타입

```ts
// 참조: core/data-object/types.ts
interface DataObjectBinding {
  schemaId: string;
  schemaVersion: string;
  prefixId: string;
  prefixVersion: string;
  columnToAxis: Record<string, ColumnAxisMapping>;
}

interface ColumnAxisMapping {
  dimLabel: string;
  segmentId?: string;  // sum 모델
}
```

### 검증 항목

| 검증 | 심각도 |
|------|--------|
| identity 컬럼이 columnToAxis에 매핑 | error |
| dimLabel이 prefix.dims에 존재 | error |
| sum 모델: segmentId가 segments에 존재 | error |
| 같은 prefix에 중복 바인딩 | error |
| columnToAxis의 dim이 축 entries와 호환 | warning |

### 계보 체인 검증

| 함수 | 반환 |
|------|------|
| `validateLineageChain(lineages, registry)` | `{ bound, unbound, mismatched }` |
| `validateLineageChainDetailed(lineages, registry)` | `{ bound, unbound, mismatched, issues: ChainIssue[] }` |

## 테스트 현황

| 파일 | 건수 |
|------|------|
| `registry.test.ts` | 7 |
| `validate.test.ts` | 13 |
| `facet-code-registry.test.ts` | 7 |
| `lineage-chain.test.ts` | 3 |
| **합계** | **30** |

## ^delegates

| 하위 스펙 | 내용 |
|-----------|------|
| `data-object-codegen` | generateDataObjectBindings codegen |
| `facet-code-lineage` | FacetCodeRegistry + resolveFacetMappings |

## ^consumes

- `Catalog`, `PrefixDef`, `PathSegment` (catalog.types.ts)
- `FieldLineage`, `FieldRef` (data-schema.ts)
- `DataSchema` (data-schema.ts)

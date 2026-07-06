---
status: draft
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/src/indexer/index.ts
  - packages/taxonomy-engine/src/query/walk-by-coordinate.ts
  - packages/taxonomy-engine/src/query/walk-relation.ts
  - packages/taxonomy-engine/__tests__/dogfooding.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-def-catalog.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-ingest.test.ts
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
  - docs/taxonomies/qa-sdk-def-catalog.yaml
  - docs/taxonomies/lesson-builder-content.yaml
  - docs/taxonomies/dkg-schema.yaml
  - docs/taxonomies/ingest-coords.yaml
  - docs/specs/system/meta-taxonomy.spec.md
  - docs/specs/system/dual-coordinate-system.spec.md
---

# Taxonomy Coordinate System — 청사진

## 목적

taxonomy 체계를 통합적으로 관리하고, 비즈니스 분해 좌표계를 중심으로 모든 taxonomy가 같은 대상을 각자의 관점으로 해석할 수 있는 구조를 설계한다.

## 배경

qa-sdk에는 5개 taxonomy가 독립적으로 존재한다. 각 taxonomy는 자체 관점·계층·목표를 갖고 있으나, "같은 대상의 같은 부분"을 가리키는 공유 좌표가 없다. 서비스 레지스트리(최상위)와 각 taxonomy 해석(최하위) 사이의 **비즈니스 분해 좌표**(중간층)가 비어있다.

이 청사진은 그 빈 중간층을 채우고, taxonomy 간 관계를 수학적으로 표현 가능하게 만드는 것을 목표로 한다.

## 전체 구조

```
서비스 레지스트리 (최상위) — "어떤 시스템인가"
    │
    ▼
비즈니스 분해 좌표 (중간) — "그 시스템의 어떤 부분인가"
    │
    ▼
각 taxonomy algebra (해석) — 같은 노드를 다른 관점으로 해석
    │
    ▼
좌표 행렬 (표현) — taxonomy 흐름을 수학적 연산으로 표현
```

## 문서 구성

| 문서 | 다루는 개념 |
|------|-----------|
| [meta-taxonomy.memo.md](meta-taxonomy.memo.md) | taxonomy 분류군 (topological/functional/bridge) |
| [taxonomy-interpretation-model.memo.md](taxonomy-interpretation-model.memo.md) | taxonomy 고유 기여: 입력 → 관점 → 산출 |
| [business-decomposition-coordinate.memo.md](business-decomposition-coordinate.memo.md) | 비즈니스 분해 좌표계, 코끼리 문제, 분해 기준 |
| [fold-algebra-pattern.memo.md](fold-algebra-pattern.memo.md) | 재귀적 분해 fold/algebra 패턴, Product Algebra |
| [coordinate-matrix.memo.md](coordinate-matrix.memo.md) | 좌표 행렬, taxonomy 흐름의 수학적 표현 |
| [production-factory-coordinate.memo.md](production-factory-coordinate.memo.md) | 정의된 좌표를 구현/검증 거버넌스 규범으로 매칭하는 계약 |
| [document-addressing-contract.memo.md](document-addressing-contract.memo.md) | 문서 주소 계약, family/role, identity/path 분리 |
| [link-tag-redesign.memo.md](link-tag-redesign.memo.md) | links/tags 재설계 방향 |
| [taxonomy-as-indexing.memo.md](taxonomy-as-indexing.memo.md) | RDF + 좌표 인덱싱 + 재귀 내포, 상대 깊이 원칙, 위치 기반 컨텍스트 주입 |

## 관련 spec

- `docs/specs/system/meta-taxonomy.spec.md` — taxonomy 분류군 정의 (코드 반영 완료)
- `docs/specs/system/taxonomy-boundaries.spec.md` — 기존 taxonomy 경계 정의
- `docs/specs/system/document-addressing-contract.memo.md` — 원본 메모 (이 청사진으로 분할됨)

## 참조

- `oa-sdk/docs/guides/schema-algebra.md` — fold/algebra 재귀 분해 패턴
- `packages/definition-catalog/src/vocabulary.ts` — TAXONOMY_FAMILY, TAXONOMY_REGISTRY
- `packages/definition-catalog/src/types.ts` — TaxonomyFamily, TaxonomyMeta 타입

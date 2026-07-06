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

# Meta-Taxonomy — taxonomy 분류군

## 목적

taxonomy 자체를 분류하는 상위 체계. 각 taxonomy가 제공하는 기능의 본질에 따라 분류군을 부여한다.

## 분류군

| 분류군 | 식별자 | 역할 |
|--------|--------|------|
| 위상 좌표계 | `topological` | 자체 좌표계로 대상의 위치를 정의 |
| 기능 부여 | `functional` | 대상에 역할·기능을 부여 |
| 브릿지 | `bridge` | 자체 좌표계 + 타 좌표계 의도 보존 |

## 분류 기준

1. **자체 좌표계 보유 여부**: taxonomy가 독자적 주소 공간을 갖는가
2. **타 좌표계 연결 여부**: 다른 taxonomy의 좌표계와 명시적 연결점이 있는가

## 기존 taxonomy 배치

| taxonomy | 분류군 | 1차 질문 |
|----------|--------|---------|
| definition-taxonomy | `topological` | 어떤 인지 관점으로 읽고 기록할 것인가 |
| structural-taxonomy | `topological` | 실제로 어떤 단위가 존재하고 어떻게 배열되는가 |
| observability-taxonomy | `functional` | 무엇을 어떤 층위에서 관측하는가 |
| PM-taxonomy | `functional` | 무엇을 누가 언제 끝내는가 |
| decision-flow taxonomy | `bridge` | 왜 이런 판단을 했는가 |

## 분류군의 한계

대부분의 taxonomy는 좌표계·연결·기능을 동시에 가진다.

- PM은 자체 계층(initiative→epic→...→task)이 위상 좌표계이면서 상태 기록 기능도 수행
- observability는 코드↔문서를 연결하는 브릿지 성격이 있으면서 계보 추적이라는 기능 목적이 분류를 결정
- decision-flow는 4층 자체 좌표계 + definition 브릿지 + 판단 기록 기능을 모두 가짐

분류군은 배타적 분류가 아니라 **1차 기여**를 표현하는 것이다.

## 구현 상태

- `docs/specs/system/meta-taxonomy.spec.md` — spec 문서 생성 완료
- `packages/definition-catalog/src/types.ts` — `TaxonomyFamily`, `TaxonomyMeta` 타입
- `packages/definition-catalog/src/vocabulary.ts` — `TAXONOMY_FAMILY`, `TAXONOMY_REGISTRY`

## 미해결 질문

1. 분류군의 배타성 — 복합 분류(PM=topological+functional)를 허용할지
2. 각 taxonomy의 내부 완성도가 아직 분류를 확정할 수준이 아닌 것들이 있음
3. 새 taxonomy 추가 시 분류군 확장 규칙

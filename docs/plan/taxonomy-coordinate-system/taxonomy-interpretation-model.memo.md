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

# Taxonomy 해석 모델 — 입력 → 관점 → 산출

## 목적

taxonomy의 핵심 기능과 고유 기여를 정의하는 모델. taxonomy가 "무엇에 작용해서 무엇을 만들어내는지"를 명시한다.

## 핵심 정의

taxonomy의 핵심은 **정보를 해석하는 일관된 관점을 제공**하는 것이다. 각 taxonomy는 같은 대상을 다른 관점으로 해석하여 서로 다른 산출물을 만든다.

## 해석 관점

| taxonomy | "이것을 통해 보면 X가 보인다" |
|----------|------------------------------|
| definition | 문서를 통해 보면 **소프트웨어가 무엇으로 구성되어 있는지**가 보인다 |
| structural | 구조를 통해 보면 **실제 단위들이 어떻게 배열되어 있는지**가 보인다 |
| observability | 관측을 통해 보면 **런타임에서 무슨 일이 일어나고 있는지**가 보인다 |
| PM | 전달을 통해 보면 **일이 어디까지 진행되었는지**가 보인다 |
| decision-flow | 판단을 통해 보면 **왜 이런 선택이 이루어졌는지**가 보인다 |

## 고유 기여 = 입력 → 관점 → 산출

관점만으로는 부족하다. taxonomy가 무엇에 작용해서 무엇을 만들어내는지까지 정의해야 고유 기여가 선명해진다.

| taxonomy | 입력 | 관점 적용 | 산출 |
|----------|------|----------|------|
| definition | 문서 | 인지 분류 | 분류 좌표(scope×aspect×depth) |
| structural | 시스템 단위 | 배치 분석 | 구조 맵(boundary, facet) |
| observability | 런타임 이벤트 | 관측 계층화 | 관측점(trace, metric) |
| PM | 작업 항목 | 전달 추적 | 진행 상태(checkpoint, verdict) |
| decision-flow | 결정 과정 | 근거 추적 | 판단 기록(evidence, verdict) |

## 온톨로지와의 대응

| 온톨로지 3요소 | taxonomy 체계 대응 |
|---------------|-------------------|
| concept (개념) | taxonomy 축의 기능 정의 |
| instance (개체) | 축 아래의 하위 기능들 (독립 완성) |
| relation (관계) | taxonomy 간 연결 (의미 고정) |

- 각 taxonomy는 독립적으로 완전한 분류 체계다
- 하나의 taxonomy만으로는 의미가 부유한다
- taxonomy 간 교차가 의미를 특정 관점·계층에 안정적으로 고정시킨다

## 미해결 질문

1. taxonomy algebra의 인터페이스 정의 — 각 taxonomy가 구현해야 할 해석 함수는 무엇인가
2. 입력→산출 매핑의 검증 가능성 — taxonomy 해석 결과의 정합성을 어떻게 확인하는가

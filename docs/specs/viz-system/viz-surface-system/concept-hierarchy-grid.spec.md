---
def:
  id: concept-hierarchy-grid
  tier: component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [visualization, testing]
  links:
    - target: viz-surface-system
      type: refines
    - target: system-concepts
      type: depends_on
    - target: definition-taxonomy
      type: depends_on
    - target: ms-concept-boundary
      type: depends_on
    - target: ms-concept-data-facets
      type: depends_on
    - target: ms-concept-contract-descent
      type: depends_on
    - target: ms-concept-verification-unit
      type: depends_on
    - target: scope-nesting-provider-patterns
      type: depends_on
    - target: scope-nesting-mount-flow
      type: depends_on
    - target: test-phase-propagation
      type: depends_on
    - target: definition-quality-gates
      type: depends_on
    - target: definition-code-link-coverage
      type: depends_on
---

# Concept Hierarchy Grid

## 목적 ^purpose

핵심 개념을 2차원 grid 위에 배치하여, 위로 갈수록 더 큰 개념이고 아래로 갈수록 더 작은 검증 단위가 되도록 시각화한다. 동시에 세로 plane을 바운더리로 읽을 수 있게 만든다.

## ^defines

- 위치: `packages/viz-web/concept-hierarchy.html` + `packages/viz-web/src/concept-hierarchy-preview.ts`
- 데이터 모델: `packages/viz-core/src/concept-grid.ts`
- 열 4종
  - 문서 좌표
  - 패싯 · 바운더리
  - Nesting Context
  - 검증 · 추적
- 행 4종
  - L0 기초 개념
  - L1 구조 단위
  - L2 조합 구조
  - L3 검증 단위
- 시각 규칙
  - 아래 행일수록 더 작은 셀
  - 같은 열은 하나의 boundary plane처럼 읽음
  - 링크 색으로 derives / constrains / verifies / bridges 구분

## ^consumes

- `packages/viz-core/src/concept-grid.ts`
- `packages/viz-web/src/concept-hierarchy-preview.ts`
- `packages/viz-web/concept-hierarchy.html`

## 표현 규칙

- y축은 개념의 높낮이이며, 높을수록 더 추상적이다.
- x축은 관심 세계를 가로로 분리한다.
- boundary는 semantic column의 개념일 뿐 아니라, 각 column 전체를 감싸는 plane 박스로도 표현한다.
- test phase, verification unit, gate doc, code-doc link는 바닥 행에 가까운 작은 단위로 놓는다.

## 해석 관점 ^interpretation

이 grid는 하나의 canonical 트리만 강제하지 않는다.
같은 배치를 서로 다른 독해 렌즈로 병렬 기록할 수 있다.

### 관점 1 — 상향식 진입점 분류

- `facet/boundary`는 시스템을 실제로 분해하는 의미론적 축이다.
  패싯이 먼저 있고, boundary는 패싯 일부를 가진 검증 가능한 기능 단위로 형성된다.
- `definition scope`는 boundary를 어떤 인지 관점에서 먼저 붙잡는지, 즉 상향식 접근의 진입점을 분류하는 축이다.
  현재 열 이름은 `문서 좌표`이지만, 이 관점에서는 `인지 관점 / 정의 진입점` plane으로도 읽을 수 있다.
- `scope-nesting`은 boundary를 계약 소유자 단위의 scope로 배열하여
  상위 → 하위 계약 하향을 표현하는 구조 축이다.
- 따라서 이 grid는 `생성(facet/boundary) → 인지(definition scope) → 배치(scope-nesting)` 흐름으로도 읽을 수 있다.
- 이 해석은 유효한 관점 중 하나이며, 다른 도메인이나 문서에서는 다른 관점을 추가로 기록할 수 있다.

## 포함해야 하는 대표 개념

- `definition-taxonomy`
- `definition-level`
- `ms-concept-data-facets`
- `ms-concept-boundary`
- `ms-concept-contract-descent`
- `ms-concept-verification-unit`
- `scope-nesting-provider-patterns`
- `scope-nesting-mount-flow`
- `test-phase-propagation`
- `definition-quality-gates`
- `definition-code-link-coverage`

## 관련 소스

- `packages/viz-core/src/concept-grid.ts`
- `packages/viz-core/src/concept-grid.test.ts`
- `packages/viz-web/src/concept-hierarchy-preview.ts`
- `packages/viz-web/concept-hierarchy.html`

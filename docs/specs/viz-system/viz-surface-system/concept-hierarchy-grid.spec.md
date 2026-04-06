---
def:
  id: concept-hierarchy-grid
  level: leaf
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

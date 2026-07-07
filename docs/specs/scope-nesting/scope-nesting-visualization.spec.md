---
def:
  id: scope-nesting-visualization
  tier: system
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [visualization, testing]
  links:
    - target: scope-nesting-timeline-renderer
      type: contains
    - target: scope-nesting-preview-surface
      type: contains
    - target: scope-nesting-viz-package
      type: traces_to
    - target: scope-nesting-system
      type: depends_on
contains:
  - scope-nesting-timeline-renderer
  - scope-nesting-preview-surface
sources:
  - packages/viz-core/src/scope-nesting-timeline.ts
  - packages/viz-core/src/scope-nesting-timeline.test.ts
  - packages/viz-web/src/scope-nesting-preview.ts
  - packages/viz-web/scope-nesting.html
---

# Scope Nesting 시각화

## 목적 ^purpose

scope-nesting의 5계층 시뮬레이션 결과를 통합 타임라인으로 렌더링하는 라이브러리 함수와 프리뷰 웹을 정의한다. 기존 pipe-svg 토큰 + canvas-viewport 추상화를 재사용하여 시각화 일관성을 확보한다.

## 구성 ^overview

- `scope-nesting-timeline-renderer` — `viz-core`에 있는 SVG/D3 renderer와 데이터 모델
- `scope-nesting-preview-surface` — `viz-web`에 있는 preview HTML/TS surface와 상호작용

## 분해 원칙

- renderer contract와 preview page는 구현 패키지와 책임이 다르므로 같은 문서에 두지 않는다.
- `viz-core`는 재사용 가능한 rendering/data contract를 소유한다.
- `viz-web`는 예제 데이터, 탭/필터 UI, preview surface를 소유한다.

## 관련 문서

- `scope-nesting-timeline-renderer`
- `scope-nesting-preview-surface`

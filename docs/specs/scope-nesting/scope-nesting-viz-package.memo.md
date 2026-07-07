---
def:
  tier: component
  id: scope-nesting-viz-package
  type: knowledge
  knowledge_kind: narrative
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: scope-nesting-visualization
      type: traces_to
sources:
  - packages/viz-core/src/index.ts
  - packages/viz-core/src/scope-nesting-timeline.ts
  - packages/viz-core/src/scope-nesting-timeline.test.ts
  - packages/viz-web/src/scope-nesting-preview.ts
  - packages/viz-web/scope-nesting.html
---

# 시각화 패키지 분리 기록

## 목적 ^purpose

scope-nesting 시각화가 `core`에서 `viz-core`와 `viz-web`로 분리된 과정과 결정 근거를 기록한다. 잔여 구현 backlog가 아니라 완료된 migration log를 보존하는 memo다.

## 결정 요약

- `viz-core`를 시각화 코어 패키지로 채택
- `pipe-svg`와 `scope-nesting-timeline`을 `viz-core`로 이동
- preview 웹은 `viz-web`의 `scope-nesting-preview.ts` + `scope-nesting.html`로 고정

## 완료된 단계

- primitives/shapes/mermaid/d3 계층을 `viz-core`로 복사
- core re-export를 거쳐 소비자 import를 `viz-core`로 전환
- `scope-nesting-timeline.ts`와 테스트를 `viz-core`에 직접 추가
- `viz-web`에 scope-nesting preview 페이지를 추가

## 관련 소스

- `packages/viz-core/src/index.ts`
- `packages/viz-core/src/scope-nesting-timeline.ts`
- `packages/viz-web/src/scope-nesting-preview.ts`
- `packages/viz-web/scope-nesting.html`

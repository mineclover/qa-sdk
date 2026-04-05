---
def:
  id: scope-nesting-preview-surface
  level: leaf
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [visualization, testing]
  links:
    - target: scope-nesting-visualization
      type: refines
    - target: scope-nesting-timeline-renderer
      type: depends_on
---

# Scope Nesting Preview Surface

## 목적 ^purpose

`viz-web`에서 scope-nesting timeline/mermaid/D3를 탭 기반 preview surface로 노출하는 페이지 구조와 상호작용을 정의한다.

## ^defines

- 위치: `packages/viz-web/scope-nesting.html` + `packages/viz-web/src/scope-nesting-preview.ts`
- 탭 3종: Timeline / Mermaid / D3 Data
- 예제 소스 2종: canonical-review, incident-escalation
- 행 필터: scope / contract / pipe / delegation 체크박스
- 출력: timeline SVG, mermaid 3종, D3 JSON dump

## ^consumes

- `packages/viz-web/src/scope-nesting-preview.ts`
- `packages/viz-web/scope-nesting.html`
- `packages/viz-core/src/index.ts`

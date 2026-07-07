---
def:
  id: viz-surface-system
  tier: system
  address: def_document:v2:1029
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [structural, cross-scope]
  links:
    - target: viz-panel-layout
      type: contains
    - target: graph-renderer-pipeline
      type: contains
    - target: graph-renderer-live
      type: contains
    - target: concept-hierarchy-grid
      type: contains
    - target: viz-core
      type: contains
    - target: viz-system
      type: depends_on
sources:
  - packages/viz-web/src/main.ts
  - packages/viz-web/src/graph/layout.ts
  - packages/viz-web/src/graph/renderer.ts
  - packages/viz-web/src/graph/updater.ts
  - packages/viz-web/src/panels/scenario-selector.ts
  - packages/viz-web/src/panels/event-log.ts
  - packages/viz-web/src/panels/verdict-panel.ts
  - packages/viz-core/src/index.ts
---

# Viz 표면 구성 그룹

## 목적 ^purpose

패널 레이아웃과 그래프 렌더러를 시각 배치, 렌더링 파이프라인, 실시간 업데이트 문서로 나눠 UI 표면의 변경 범위를 줄인다.

## 구성 ^overview

- `viz-panel-layout`: scenario selector, session list, event log, verdict panel, roleplay iframe의 배치와 제약을 정리한 문서.
- `graph-renderer-pipeline`: scenario spec을 graph로 compile하고 SVG/canvas viewport로 렌더링하는 파이프라인을 정리한 문서.
- `graph-renderer-live`: WebSocket/record replay 기반 실시간 업데이트 규칙을 정리한 문서.
- `concept-hierarchy-grid`: 핵심 개념을 2차원 그리드 위에 배치해 높낮이와 바운더리 plane을 시각화하는 문서.

원본: `docs/specs/visualization/panels.spec.md` (`viz-panels-spec`), `docs/specs/visualization/graph-renderer.spec.md` (`graph-renderer-spec`)

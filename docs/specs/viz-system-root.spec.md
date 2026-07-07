---
def:
  id: viz-system-root
  type: spec
  tier: layout
  scope: ui
  aspect: layout
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viz
  links:
    - target: viz-system
      type: depends_on
    - target: viz-system
      type: refs
    - target: viz-language-system
      type: refs
    - target: viz-surface-system
      type: refs
    - target: viz-roleplay-system
      type: refs
sources:
  - packages/viz-web/src/main.ts
  - packages/viz-core/src/index.ts
  - packages/viz-3d/src/index.ts
  - packages/roleplay-web/src/main.ts
---
# Visualization System Root
## 목적 ^purpose
QA-SDK의 지식 그래프와 데이터를 2D/3D로 시각화하는 전체 시스템을 관장한다.

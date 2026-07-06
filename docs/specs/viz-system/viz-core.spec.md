---
def:
  id: viz-core
  type: spec
  tier: component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: domain
  svc: viz-core
  tags: [visualization, primitives]
  links:
    - target: viz-panel-layout
      type: traces_to
source: packages/viz-core/src/index.ts
---

# viz-core — 시각화 코어

## 목적 ^purpose

QA-SDK 시각화 레이어의 코어 — SVG primitives, 디자인 토큰, 공용 renderer 함수. `viz-web`·`viz-3d`·`registry-ui` 같은 소비 앱이 동일한 토큰과 primitive 집합 위에서 렌더링하도록 단일 원본을 제공.

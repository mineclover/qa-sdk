---
def:
  id: canvas-viewport-spec
  tier: system
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: canvas-viewport
  tags: [frontend, visualization, runtime]
  links:
    - target: viz-system
      type: traces_to
    - target: scope-nesting-visualization
      type: refs
sources:
  - packages/canvas-viewport/src/index.ts
  - packages/canvas-viewport/src/math.ts
  - packages/canvas-viewport/src/controller.ts
  - packages/canvas-viewport/src/chrome.ts
  - packages/canvas-viewport/src/hud.ts
  - packages/canvas-viewport/src/support-bar.ts
  - packages/canvas-viewport/src/ui-state.ts
---
# Canvas Viewport

## 목적 ^purpose

캔버스 기반 UI에서 pan/zoom/minimap/HUD를 공통으로 다루는 viewport 수학과 상태 보조층.

## 구성 ^overview

- `math` — viewport 계산
- `controller` — viewport 제어
- `chrome`, `hud`, `support-bar` — 보조 UI 표면
- `ui-state` — 상태 모델
- `styles.css` — 공용 스타일 export

## 관련 소스

- `packages/canvas-viewport/src/math.ts`
- `packages/canvas-viewport/src/controller.ts`
- `packages/canvas-viewport/src/chrome.ts`
- `packages/canvas-viewport/src/hud.ts`

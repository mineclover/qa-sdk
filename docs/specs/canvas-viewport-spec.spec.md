---
def:
  id: canvas-viewport-overview
  type: spec
  tier: layout
  scope: ui
  aspect: layout
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, visualization]
  links:
    - target: canvas-viewport-spec
      type: refs
    - target: viz-system
      type: refs
    - target: scope-nesting-visualization
      type: refs
    - target: system-packages
      type: refs
sources:
  - docs/specs/viz-system/canvas-viewport.spec.md
  - docs/specs/viz-system/viz-system.md
  - docs/specs/viz-system/viz-surface-system.cases.md
  - docs/specs/scope-nesting/scope-nesting-visualization.cases.md
  - docs/specs/system/system-packages.spec.md
  - packages/canvas-viewport/package.json
  - packages/canvas-viewport/README.md
  - packages/canvas-viewport/src/index.ts
  - packages/canvas-viewport/src/math.ts
  - packages/canvas-viewport/src/math.test.ts
  - packages/canvas-viewport/src/controller.ts
  - packages/canvas-viewport/src/chrome.ts
  - packages/canvas-viewport/src/hud.ts
  - packages/canvas-viewport/src/support-bar.ts
  - packages/canvas-viewport/src/ui-state.ts
  - packages/canvas-viewport/src/styles.css
  - packages/viz-web/src/graph/renderer.ts
  - packages/viz-web/src/main.ts
  - packages/registry-ui/src/pages/file-map/page.ts
  - packages/registry-ui/src/pages/file-map/render-canvas.ts
---
# Canvas Viewport Spec

## 목적 ^purpose

무한 캔버스 기반의 뷰포트 제어, 줌/팬, 미니맵, HUD, 보조 바, pane focus 상태를 한 진입점에서 찾기 위한 layout overview다. 실제 구현 계약은 `canvas-viewport-spec`이 소유하고, 이 문서는 viz-system 및 소비 UI가 같은 viewport abstraction을 공유하도록 라우팅한다.

## 구성 ^overview

- `canvas-viewport-spec`: `canvas-viewport` 패키지의 public export, math, controller, chrome, HUD, support bar, UI state, stylesheet 계약.
- `viz-system`: 시각화 surface가 `canvas-viewport-spec`을 2D viewport abstraction으로 참조하는 상위 UI layout.
- `scope-nesting-visualization`: timeline/preview 계열 소비자가 canvas viewport 추상을 재사용해야 하는 validation scenario.
- `viz-web`, `registry-ui`: `canvas-viewport` exports와 `styles.css`를 소비하는 현재 브라우저 surface.

## 검증 ^validation

```bash
corepack pnpm --filter canvas-viewport build
corepack pnpm --filter canvas-viewport typecheck
corepack pnpm --filter @qa-sdk/viz-web build
corepack pnpm --filter @qa-sdk/registry-ui build
corepack pnpm def:check
corepack pnpm arch:feedback
```

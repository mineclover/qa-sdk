---
def:
  id: viz-3d-spec
  tier: component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viz-3d
  tags: [frontend, visualization, runtime]
  links:
    - target: viz-system
      type: refines
    - target: wi-system
      type: depends_on
sources:
  - packages/viz-3d/src/index.ts
  - packages/viz-3d/src/core-bundle.ts
  - packages/viz-3d/src/core/types.ts
  - packages/viz-3d/src/core/signal-model.ts
  - packages/viz-3d/src/adapter/browser-codec.ts
  - packages/viz-3d/scripts/generate-browser-catalog.ts
---
# Viz 3D

## 목적 ^purpose

좌표/시그널을 Three.js 기반 3D 장면으로 시각화하는 데모 패키지. browser codec과 3D 렌더링을 묶어 platform-demo와 브라우저 데모 surface에서 소비한다.

## 구성 ^overview

- `index.ts` — public export
- `core-bundle.ts` — 순수 번들/핵심 묶음
- `generate-browser-catalog.ts` — prebuild catalog 생성
- Vite build 기반 번들 산출

## 관련 소스

- `packages/viz-3d/src/index.ts`
- `packages/viz-3d/src/core-bundle.ts`
- `packages/viz-3d/scripts/generate-browser-catalog.ts`

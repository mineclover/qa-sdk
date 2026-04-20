---
def:
  id: weighted-ui-spec
  level: leaf
  tier: component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: weighted-ui
  tags: [frontend, visualization, design-system]
  links:
    - target: viz-system
      type: refines
---
# Weighted UI

## 목적 ^purpose

weighted-index 계열 앱이 공통으로 쓰는 UI 컴포넌트와 스타일 토큰 묶음. 시각적 일관성을 위한 재사용 레이어다.

## 구성 ^overview

- `components` — badge, hex-bar, mode-toggle
- `styles` — 공통 CSS와 테마 토큰
- `utils` — colors, format
- consumer — weighted-index-explorer, platform-demo 등

## 관련 소스

- `packages/weighted-ui/src/components/`
- `packages/weighted-ui/src/styles/index.css`
- `packages/weighted-ui/src/utils/colors.ts`

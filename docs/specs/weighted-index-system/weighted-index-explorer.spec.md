---
def:
  id: weighted-index-explorer-spec
  level: leaf
  tier: component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: weighted-index-explorer
  tags: [frontend, visualization, demo]
  links:
    - target: wi-system
      type: refines
---
# Weighted Index Explorer

## 목적 ^purpose

weighted-index 개념을 주소, 버전, 다중 인덱스, 레이아웃 플래너 등 페이지 단위로 탐색하는 브라우저 데모 패키지.

## 구성 ^overview

- `main.ts` — 앱 부팅
- `pages/*` — 개념별 탐색 페이지
- `ui/*` — detail/grid/list 공용 UI
- `weighted-ui`와 `weighted-index`를 조합한 학습/디버깅용 surface

## 관련 소스

- `packages/weighted-index-explorer/src/main.ts`
- `packages/weighted-index-explorer/src/pages/`
- `packages/weighted-index-explorer/src/ui/`

---
def:
  id: viz-system
  tier: layout
  address: def_document:v2:1030
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [structural, entry-point]
  links:
    - target: api-client-spec
      type: refs
    - target: canvas-viewport-overview
      type: refs
    - target: canvas-viewport-spec
      type: refs
    - target: docs-explorer-spec
      type: refs
    - target: iframe-protocol-spec
      type: refs
    - target: mermaid-gen-spec
      type: refs
    - target: platform-demo-api-spec
      type: refs
    - target: registry-ui-spec
      type: refs
    - target: viz-3d-spec
      type: refs
    - target: weighted-ui-spec
      type: refs
sources:
  - packages/viz-web/src/main.ts
  - packages/viz-core/src/index.ts
  - packages/viz-3d/src/index.ts
  - packages/roleplay-web/src/main.ts
  - packages/platform-demo-api/src/index.ts
---

## 목적 ^purpose

시각화 패널, 그래프 렌더러, 폼 빌더 등 프론트엔드 UI 시스템.

## 구성 ^overview

- `viz-surface-system`: viz-web의 패널 배치와 그래프 렌더러를 시각 구성/실시간 갱신 문서로 분리한 그룹.
- `viz-language-system`: RLSC 계약을 모델/통합 문서로 분리한 그룹.
- `viz-roleplay-system`: form-builder와 QA bridge를 구조/렌더링/런타임 문서로 분리한 그룹.
- `api-client-spec`: viz-web에서 ingest-server와 통신하기 위한 REST fetch/WebSocket/SSE 클라이언트 계층.
- `iframe-protocol-spec`: viz-web(부모)과 roleplay-web(자식 iframe) 간의 `postMessage` 기반 양방향 통신 프로토콜.
- `mermaid-gen-spec`: DKG 그래프에서 Mermaid 텍스트를 생성하는 12종 다이어그램 함수와 카탈로그 함수.

---
def:
  id: viz-system
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [structural, entry-point, tier-frontend]
  links:
    - target: viz-surface-system
      type: contains
    - target: motion-editor-component
      type: contains
    - target: viz-language-system
      type: contains
    - target: viz-roleplay-system
      type: contains
    - target: api-client-spec
      type: contains
    - target: iframe-protocol-spec
      type: contains
    - target: mermaid-gen-spec
      type: contains
---

## 목적 ^purpose

시각화 패널, 그래프 렌더러, 모션 에디터, 폼 빌더 등 프론트엔드 UI 시스템.

## 구성 ^overview

- `viz-surface-system`: 패널 배치와 그래프 렌더러를 시각 구성/실시간 갱신 문서로 분리한 그룹.
- `motion-editor-component`: motion-content 코어를 소비하는 DOM 기반 편집기 셸.
- `viz-language-system`: RLSC와 motion-content 계약을 모델/통합/경계 문서로 분리한 그룹.
- `viz-roleplay-system`: form-builder와 QA bridge를 구조/렌더링/런타임 문서로 분리한 그룹.
- `api-client-spec`: viz-web에서 ingest-server와 통신하기 위한 REST fetch 래퍼와 EventSource 기반 SSE 구독 클라이언트.
- `iframe-protocol-spec`: viz-web(부모)과 roleplay-web(자식 iframe) 간의 `postMessage` 기반 양방향 통신 프로토콜.
- `mermaid-gen-spec`: DKG 그래프에서 Mermaid 텍스트를 생성하는 12종 다이어그램 함수와 카탈로그 함수.

---
def:
  id: viz-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: platform-demo
  tags: [entry-point, tier-frontend]
  links:
    - target: viz-panels-spec
      type: contains
    - target: graph-renderer-spec
      type: contains
    - target: motion-editor-component
      type: contains
    - target: rlsc-spec
      type: contains
    - target: form-builder-spec
      type: contains
    - target: api-client-spec
      type: contains
    - target: iframe-protocol-spec
      type: contains
    - target: qa-bridge-spec
      type: contains
    - target: motion-content-glossary
      type: contains
---

## 목적 ^purpose

시각화 패널, 그래프 렌더러, 모션 에디터, 폼 빌더 등 프론트엔드 UI 시스템.

## 구성 ^overview

overview: 총 9개 멤버.
- `viz-panels-spec`: viz-web의 세 보조 패널 레이아웃.
- `graph-renderer-spec`: `SpecGraph`를 dagre 기반 DAG 레이아웃으로 배치하고, SVG로 렌더링하며, SSE 이벤트 스트림에 따라 그래프 상태를 실시간 갱신하는 시각화 파이프라인.
- `motion-editor-component`: motion-content 코어를 소비하는 DOM 기반 편집기 셸.
- `rlsc-spec`: 디자인의 시각적 구조(레이아웃, 계층, Role)를 좌표계 DSL로 표현하고, 검색·대치·생성이 가능한 마크업 언어
- `form-builder-spec`: roleplay-web의 핵심 UI: DOM 트리 데이터 모델, DevTools 스타일 트리 뷰, 속성 편집기, Figma 스타일 auto-layout, 실시간 폼 프리뷰.
- `api-client-spec`: viz-web에서 ingest-server와 통신하기 위한 REST fetch 래퍼와 EventSource 기반 SSE 구독 클라이언트.
- `iframe-protocol-spec`: viz-web(부모)과 roleplay-web(자식 iframe) 간의 `postMessage` 기반 양방향 통신 프로토콜.
- `qa-bridge-spec`: roleplay-web에서 사용자 폼 상호작용을 QA 이벤트로 변환하고 ingest-server로 전송하는 SDK 통합 계층.
- `motion-content-glossary`: `motion-content` 계열 패키지는 Remotion식 개념층을 참고하되 런타임은 GSAP으로만 실행하는 선언형 모션 편집 스택이다.

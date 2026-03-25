---
def:
  id: viz-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
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

9개 정의: 패널 레이아웃, 그래프 렌더러, 모션 에디터, RLSC, 폼 빌더, API 클라이언트, iframe 프로토콜, QA 브릿지, 모션 콘텐츠 용어.

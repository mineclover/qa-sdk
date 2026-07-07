---
def:
  id: viz-roleplay-system
  tier: system
  address: def_document:v2:1028
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: roleplay-web
  tags: [structural, cross-scope]
  links:
    - target: form-builder-structure
      type: contains
    - target: form-builder-renderer
      type: contains
    - target: qa-bridge-runtime
      type: contains
    - target: viz-system
      type: depends_on
sources:
  - packages/roleplay-web/src/main.ts
  - packages/roleplay-web/src/form-builder/dom-tree.ts
  - packages/roleplay-web/src/form-builder/tree-view.ts
  - packages/roleplay-web/src/form-builder/element-editor.ts
  - packages/roleplay-web/src/form-builder/form-renderer.ts
  - packages/roleplay-web/src/sdk/qa-bridge.ts
  - packages/roleplay-web/src/sdk/event-emitter.ts
---

# Viz 역할놀이 그룹

## 목적 ^purpose

roleplay-web의 form-builder와 QA bridge를 DOM 구조 모델, 렌더링, 이벤트 전송 문서로 분리해 편집기 변경과 계측 변경을 독립시킨다.

## 구성 ^overview

- `form-builder-structure`: `DomNode` 트리, tree view, element editor의 구조 모델을 정리한 문서.
- `form-builder-renderer`: `DomNode`를 DOM preview로 렌더링하고 auto-layout style을 읽고 쓰는 규칙을 정리한 문서.
- `qa-bridge-runtime`: 사용자 상호작용을 QA 이벤트로 변환하고 ingest/iframe 경로로 전달하는 런타임 문서.

원본: `docs/specs/roleplay/form-builder.spec.md` (`form-builder-spec`), `docs/specs/roleplay/qa-bridge.spec.md` (`qa-bridge-spec`)

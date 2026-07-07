---
def:
  tier: component
  id: form-builder-renderer
  address: def_document:v2:1152
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [frontend, runtime, structural]
  links:
    - target: viz-roleplay-system
      type: refines
sources:
  - packages/roleplay-web/src/form-builder/form-renderer.ts
  - packages/roleplay-web/src/form-builder/auto-layout.ts
  - packages/roleplay-web/src/form-builder/dom-tree.ts
  - packages/roleplay-web/src/styles/form-builder.css
---

# Form Builder 렌더링

## 목적 ^purpose

form-builder의 auto-layout, 폼 렌더러, 전체 데이터 흐름을 분리해 편집 결과가 프리뷰와 동기화되는 경로를 설명한다.

## 구성 ^overview

roleplay-web의 `DomNode`가 폼 렌더링의 기반이다. renderer는 node tag/attributes/styles/text/children을 실제 DOM element로 변환하고, 모든 element에 `data-node-id`를 부여해 preview 클릭 선택을 가능하게 한다.

## 노드 렌더링

- `buildElement(node)`가 `document.createElement(node.tag)`로 element를 만든다.
- `attributes`는 `setAttribute()`로 반영한다.
- `styles`는 camelCase key를 kebab-case로 바꿔 inline style에 반영한다.
- `textContent`는 leaf node에 직접 넣고, child가 있는 node에서는 첫 text node로 삽입한다.
- 모든 element에는 `el.dataset.nodeId = node.id`를 설정한다.

## 데이터 흐름 — 편집에서 프리뷰까지

```
DomNode tree
  │
  ├── TreeView / ElementEditor
  │     │
  │     └── 사용자 변경 → node.attributes/styles/text/tag 수정
  │           │
  │           └── fullUpdate()
  │                 ├── treeView.update(rootNode)
  │                 ├── rerender()
  │                 └── attachPreviewEvents()
  │
  └── Preview DOM → click/input/change/submit 이벤트 emit
```

## auto-layout 규칙

- auto-layout은 `DomNode.styles`의 flex 속성으로 표현한다.
- `applyAutoLayout(node, config)`가 display/flexDirection/gap/padding/alignItems/justifyContent를 쓴다.
- `readAutoLayout(node)`가 기존 styles에서 `AutoLayoutConfig`를 읽는다.
- align/justify 값은 UI 친화 enum(`start`, `center`, `end`, `stretch`, `space-between`)과 CSS 값 사이를 매핑한다.

## 프리뷰 동기화

`renderFormPreview(container, root)`는 최초 렌더 후 `rerender()` 함수를 반환한다. main shell은 node 변경, add/delete/duplicate/clear 후 `rerender()`를 호출하고 preview event listener를 다시 붙인다.

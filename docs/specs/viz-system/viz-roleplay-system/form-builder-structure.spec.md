---
def:
  tier: component
  id: form-builder-structure
  address: def_document:v2:1154
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [frontend, structural, runtime]
  links:
    - target: viz-roleplay-system
      type: refines
sources:
  - packages/roleplay-web/src/main.ts
  - packages/roleplay-web/src/form-builder/dom-tree.ts
  - packages/roleplay-web/src/form-builder/tree-view.ts
  - packages/roleplay-web/src/form-builder/element-editor.ts
---

# Form Builder 구조

## 목적 ^purpose

form-builder의 DOM 트리 모델, 트리 뷰, 속성 편집기 사이의 구조적 책임을 분리해 편집기 셸을 안정화한다.

## 구성 ^overview

roleplay-web 편집기는 `DomNode` 트리를 중심으로 구성된다. 루트 `div.form-container` 아래 form/input/button 같은 HTML node를 중첩하고, `main.ts`가 `rootNode`와 `selectedNode`를 보유한다. TreeView는 구조 탐색, ElementEditor는 tag/text/attributes/styles 편집, Preview는 선택 node highlighting을 담당한다.

## 편집 트리 모델

```
DomNode
  ├── id: crypto.randomUUID()
  ├── tag: HTML tag name
  ├── attributes: Record<string, string>
  ├── styles: Record<string, string>
  ├── textContent?: string
  └── children: DomNode[]
```

## 선택 상태 — selectedNode

선택 상태는 단일 `DomNode | null`이다.

- TreeView에서 node 선택 → `elementEditor.setNode(node)` + preview highlight.
- Preview에서 `[data-node-id]` 클릭 → 같은 node를 찾아 TreeView와 ElementEditor를 동기화.
- 삭제/복제는 root node가 아닌 선택 node에만 적용한다.

## 구조 조작 API

- `createNode(tag, attrs?)`: 새 node 생성.
- `addChild(parent, child)`: 부모 children에 추가.
- `removeChild(parent, childId)`: id 기준 삭제.
- `findNode(root, id)` / `findParent(root, childId)`: 트리 탐색.
- `cloneNode(node)`: 새 id를 가진 deep clone.
- `createDefaultTree()`: 기본 name/email form scaffold 생성.

## ElementEditor 책임

- tag select는 허용된 HTML tag 목록 중에서 선택한다.
- text content, attributes, common style 속성을 직접 수정한다.
- 변경 시 `onChange(node)`를 호출하고, main shell이 tree/preview를 다시 렌더링한다.

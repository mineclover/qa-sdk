---
def:
  id: form-builder-spec
  scope: ui
  aspect: component
  depth: specification
  lifecycle: deprecated
  tags: [tier-frontend]
  links:
    - target: iframe-protocol-spec
      type: depends_on
    - target: qa-bridge-spec
      type: depends_on
---

# Form Builder — DOM 트리 모델 + 비주얼 에디터

## 목적 ^purpose

roleplay-web의 핵심 UI: DOM 트리 데이터 모델, DevTools 스타일 트리 뷰, 속성 편집기, Figma 스타일 auto-layout, 실시간 폼 프리뷰.

## 상태

implemented

## 설계 원칙

- DOM 구조를 `DomNode` 트리 모델로 관리하고, 실제 DOM은 모델의 투영(projection)으로 렌더링한다.
- 모델 변경 → 트리 뷰 갱신 + 프리뷰 갱신의 단방향 데이터 흐름을 유지한다.
- auto-layout은 CSS flexbox의 추상화이며, Figma의 auto-layout 개념을 차용한다.

## 1. DOM 트리 모델 (dom-tree.ts)

```typescript
interface DomNode {
  id: string;                         // crypto.randomUUID()
  tag: string;                        // HTML 태그명
  attributes: Record<string, string>; // HTML 속성
  styles: Record<string, string>;     // CSS 스타일 (camelCase 키)
  children: DomNode[];                // 자식 노드
  textContent?: string;               // 텍스트 콘텐츠
}
```

### 조작 함수

| 함수 | 설명 |
|---|---|
| `createNode(tag, attrs?)` | 새 `DomNode` 생성. id는 `crypto.randomUUID()` |
| `addChild(parent, child)` | parent.children 끝에 추가 |
| `removeChild(parent, childId)` | childId와 일치하는 자식 제거 |
| `findNode(root, id)` | 재귀 탐색으로 id 매칭 노드 반환 |
| `findParent(root, childId)` | childId의 부모 노드 반환 |
| `cloneNode(node)` | 깊은 복사 (새 id 부여) |
| `createDefaultTree()` | 기본 폼 트리 생성 |

### 기본 트리 구조

```
div.form-container  (flex column, gap 12px, padding 24px)
  └─ form#main-form  (flex column, gap 8px)
       ├─ label "Name"
       ├─ input[type=text, name=name]
       ├─ label "Email"
       ├─ input[type=email, name=email]
       └─ button[type=submit] "Submit"
```

## 2. 트리 뷰 (tree-view.ts)

DevTools Elements 패널 스타일의 접기/펼치기 트리 UI.

```typescript
interface TreeView {
  render(): void;
  update(root: DomNode): void;
  selectNode(id: string): void;
}

function createTreeView(
  container: HTMLElement,
  root: DomNode,
  onSelect: (node: DomNode) => void,
): TreeView;
```

### 동작

1. 각 노드를 `<div class="tree-row">` 로 렌더링한다. depth에 따라 `paddingLeft: {depth * 16 + 4}px`.
2. 자식이 있는 노드는 접기/펼치기 화살표(▸/▾)를 표시한다.
3. 노드 라벨: `<tag attr="val"> "text..."` 형식. 속성은 `tree-attrname`/`tree-attrval` 클래스로 색상 구분.
4. 텍스트 콘텐츠는 20자에서 truncate.
5. 펼쳐진 노드는 닫는 태그(`</tag>`)도 표시.
6. 클릭 시 `onSelect(node)` 콜백 호출, 선택 노드에 `tree-row--selected` 클래스 적용.
7. root와 1차 자식은 기본 펼침 상태.

### HTML 이스케이프

`&`, `<`, `>`, `"`, `'` 를 HTML 엔티티로 변환하여 XSS를 방지한다.

## 3. 속성 편집기 (element-editor.ts)

선택된 `DomNode`의 속성을 편집하는 패널.

```typescript
interface ElementEditor {
  setNode(node: DomNode): void;
  clear(): void;
}

function createElementEditor(
  container: HTMLElement,
  onChange: (node: DomNode) => void,
): ElementEditor;
```

### 편집 섹션

1. **Tag** — 드롭다운 선택 (21개 태그)
2. **Text Content** — 텍스트 입력
3. **Attributes** — 키-값 쌍 편집 + 추가/삭제
4. **Styles** — 공통 스타일 프리셋 + 커스텀 키-값

### 지원 태그 목록

```
div, form, input, button, label, select, textarea, option,
h1, h2, h3, h4, h5, h6, p, span, a, img, ul, ol, li
```

### 공통 스타일 프리셋

| 라벨 | CSS 속성 | 입력 형태 |
|---|---|---|
| Display | `display` | select (block, flex, inline, inline-flex, grid, none) |
| Flex Direction | `flexDirection` | select (row, column, row-reverse, column-reverse) |
| Justify Content | `justifyContent` | select (flex-start, center, flex-end, space-between, space-around, space-evenly) |
| Align Items | `alignItems` | select (flex-start, center, flex-end, stretch, baseline) |
| Gap | `gap` | text |
| Padding | `padding` | text |
| Margin | `margin` | text |
| Width | `width` | text |
| Height | `height` | text |
| Background | `background` | text |
| Color | `color` | text |
| Font Size | `fontSize` | text |
| Border | `border` | text |
| Border Radius | `borderRadius` | text |

프리셋에 없는 커스텀 스타일도 키-값 쌍으로 편집 가능하다.

### 속성 편집 키-값 행

- 키 입력 + 값 입력 + 삭제 버튼(×)으로 구성
- `change` 이벤트에서 `onChange(node)` 호출
- "Add Attribute" 버튼으로 새 속성 추가

## 4. Auto Layout (auto-layout.ts)

Figma의 auto-layout 개념을 CSS flexbox로 매핑한다.

```typescript
interface AutoLayoutConfig {
  direction: "horizontal" | "vertical";
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  alignItems: "start" | "center" | "end" | "stretch";
  justifyContent: "start" | "center" | "end" | "space-between";
}

function applyAutoLayout(node: DomNode, config: AutoLayoutConfig): void;
function readAutoLayout(node: DomNode): AutoLayoutConfig;
function defaultAutoLayout(): AutoLayoutConfig;
```

### CSS 매핑

| AutoLayoutConfig | CSS 속성 |
|---|---|
| `direction: "horizontal"` | `flexDirection: "row"` |
| `direction: "vertical"` | `flexDirection: "column"` |
| `gap: N` | `gap: "{N}px"` |
| `paddingTop: N` | `paddingTop: "{N}px"` |
| `alignItems: "start"` | `alignItems: "flex-start"` |
| `justifyContent: "space-between"` | `justifyContent: "space-between"` |

- `applyAutoLayout()` — config를 node.styles에 반영. `display: "flex"` 자동 설정.
- `readAutoLayout()` — node.styles에서 역으로 config를 추출.
- `defaultAutoLayout()` — direction: vertical, gap: 8, padding: 0, alignItems: stretch, justifyContent: start.

## 5. 폼 렌더러 (form-renderer.ts)

`DomNode` 트리를 실제 HTML DOM으로 변환하여 프리뷰 영역에 렌더링한다.

```typescript
function renderFormPreview(container: HTMLElement, root: DomNode): () => void;
```

### 동작

1. container를 비우고 `buildElement(root)`로 실제 DOM을 생성하여 삽입한다.
2. 반환값은 `render()` 함수로, 호출 시 동일 로직을 재실행한다 (모델 변경 후 리렌더).
3. `buildElement()`:
   - `document.createElement(node.tag)`
   - `node.attributes` → `el.setAttribute(key, value)`
   - `node.styles` → `el.style.setProperty(kebab-case, value)` (camelCase → kebab-case 변환)
   - `node.textContent` → 리프 노드면 `el.textContent`, 자식이 있으면 `TextNode`으로 prepend
   - 재귀적으로 자식 빌드
   - `el.dataset.nodeId = node.id` — 프리뷰에서 클릭 시 모델 노드 식별용

## 전체 데이터 흐름

```
[사용자]
  ├── tree-view 클릭 → onNodeSelect → elementEditor.setNode(node) + 프리뷰 하이라이트
  ├── element-editor 수정 → onNodeChange → treeView.update() + rerender() + attachPreviewEvents()
  ├── 프리뷰 클릭 → data-node-id로 모델 노드 식별 → 트리뷰 선택 + 에디터 표시
  ├── 툴바 Add → createNode(tag) → addChild() → fullUpdate()
  ├── 툴바 Delete → removeChild() → fullUpdate()
  ├── 툴바 Duplicate → cloneNode() → addChild() → fullUpdate()
  └── 툴바 Clear → createDefaultTree() → 초기화

fullUpdate() = treeView.update() + rerender() + attachPreviewEvents() + highlightPreviewNode()
```

### Void element 처리

`input`, `img`, `br`, `hr`은 자식을 가질 수 없는 void element다. 선택된 노드가 void element이면 add 시 부모에 추가한다.

## 제약 조건

- `DomNode.id`는 `crypto.randomUUID()`로 생성한다. 브라우저 환경에서만 동작한다.
- 스타일 키는 camelCase로 저장하고, 실제 DOM 적용 시 kebab-case로 변환한다.
- 트리 뷰의 depth 제한은 없으나, 과도한 중첩 시 성능 저하가 발생할 수 있다.
- `cloneNode()`는 깊은 복사를 수행하며, 모든 자손 노드에 새 id를 부여한다.
- root 노드는 삭제할 수 없다.

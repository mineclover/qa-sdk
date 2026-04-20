---
def:
  id: rlsc-query
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
---

## 목적 ^purpose
RLSCDocument에서 조건 기반 노드 검색, 불변 갱신, 두 문서 간 diff를 제공한다.
문서 자체는 변경하지 않으며 모든 갱신 연산은 새 문서를 반환한다.

## ^defines

### queryNodes(doc: RLSCDocument, query: RLSCQuery) → RLSCNode[]

다중 조건 AND 필터로 노드를 검색한다. flattenTree로 전체 노드를 평탄화한 뒤 조건을 순서대로 적용한다.

**RLSCQuery 필터 조건** (모두 선택, AND 결합):
| 필드 | 타입 | 설명 |
|------|------|------|
| `tag` | string | HTML 태그명 일치 |
| `role` | string | ARIA role 일치 |
| `hasClass` | string | classes 배열 포함 여부 |
| `textContains` | string | textContent 대소문자 무시 포함 검색 |
| `withinRect` | LayoutRect | 노드 rect와 교차(intersects) 여부 |
| `minArea` | number | width×height >= minArea |
| `maxArea` | number | width×height <= maxArea |
| `zRange` | {min?, max?} | zIndex 범위 (양쪽 포함) |
| `visibleOnly` | boolean | visible === true인 노드만 |

### findByRect(doc, rect) → RLSCNode[]

`queryNodes(doc, { withinRect: rect })`의 편의 래퍼.

### findByRole(doc, role) → RLSCNode[]

`queryNodes(doc, { role })`의 편의 래퍼.

### findByAddress(doc, address) → RLSCNode[]

`node.address === address` 조건으로 노드를 검색한다. data-qa-address 기반 좌표 주소 조회에 사용.

### findById(doc, id) → RLSCNode | undefined

`node.id === id` 첫 번째 일치 노드 반환. 없으면 undefined.

### replaceNode(doc, nodeId, patch) → RLSCDocument

nodeId에 해당하는 노드에 patch를 적용한 새 문서를 반환한다 (불변).

**patch 허용 범위**: `rect`, `zIndex`, `role`, `textContent`만. 구조(id, tag, children)는 변경 불가.
내부적으로 트리를 재귀 순회하며 일치하는 노드에만 스프레드 병합을 적용한다.

### removeNode(doc, nodeId) → RLSCDocument

nodeId에 해당하는 노드를 트리에서 제거한 새 문서를 반환한다 (불변).
재귀적으로 children을 필터링하며, 일치하는 노드의 자식도 함께 제거된다.

### diffDocuments(before, after) → LayoutDiff[]

두 문서의 노드 집합을 id 기준으로 비교하여 변화 목록을 반환한다.

**LayoutDiff 타입**:
```typescript
interface LayoutDiff {
  type: "added" | "removed" | "moved" | "resized" | "reordered";
  nodeId: string;
  before?: LayoutRect;
  after?: LayoutRect;
}
```

**변화 유형 판정 규칙**:
- `added`: after에만 존재
- `removed`: before에만 존재
- `resized`: width 또는 height 변경
- `moved`: x 또는 y 변경 (크기 동일)
- `reordered`: zIndex 변경

`resized`/`moved` 판정은 rect 변경 여부를 먼저 확인하며, 같은 노드에서 zIndex도 변경된 경우 `reordered` diff가 추가로 생성된다.

^consumes
- `types.ts` — RLSCDocument, RLSCNode, RLSCQuery, LayoutRect
- `tree-utils.ts` — flattenTree

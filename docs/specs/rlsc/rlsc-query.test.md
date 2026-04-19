---
def:
  id: rlsc-query-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-query
      type: refines
  source: packages/rlsc/src/query.test.ts
---

## 목적 ^purpose

`queryNodes` 필터 조건, `diffDocuments` 변경 유형 탐지, `replaceNode`/`removeNode` 불변성을 검증한다.

소스: `packages/rlsc/src/query.test.ts`

## queryNodes — 필터

| 필터 | 시나리오 | 기대 결과 |
|------|----------|----------|
| `role` | `{ role: "banner" }` | banner 포함, main 미포함 |
| `minArea` | `{ minArea: 1000 }` | big(200×200=40000) 포함, small(10×10=100) 미포함 |
| `maxArea` | `{ maxArea: 500 }` | small 포함, big 미포함 |
| `zRange.min` | `{ zRange: { min: 10 } }` | high(zIndex=100) 포함, low(zIndex=0) 미포함 |
| `textContains` | `{ textContains: "hello" }` | "Hello World" 노드 포함, "Goodbye" 미포함 (대소문자 무관) |

## diffDocuments — 변경 유형

| 변경 | 시나리오 | 기대 결과 |
|------|----------|----------|
| added | after에만 id "new" 존재 | `{ type: "added", nodeId: "new" }` |
| removed | before에만 id "old" 존재 | `{ type: "removed", nodeId: "old" }` |
| moved | 동일 id "n", x/y 변경 | `{ type: "moved", nodeId: "n" }` |
| resized | 동일 id "n", width 변경 | `{ type: "resized", nodeId: "n" }` |
| reordered | 동일 id "n", zIndex 변경 | `{ type: "reordered", nodeId: "n" }` |

## 불변성

- `replaceNode(doc, "child", { zIndex: 99 })` → 원본 `doc.root.children[0].zIndex === 0` 유지, 새 문서 `.zIndex === 99`
- `removeNode(doc, "child")` → 원본 `doc.root.children` 길이 1 유지, 새 문서 길이 0

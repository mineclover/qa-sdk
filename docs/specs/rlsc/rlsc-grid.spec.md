---
def:
  id: rlsc-grid
  level: leaf
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

뷰포트를 고정 크기 셀(기본 16px)로 분할하고 각 셀의 노드 점유를 행렬로 분석한다.
각 셀은 점유 노드 목록, z-index 정렬 스택, dominant 노드, coverage(점유율)를 가진다.

## ^defines

- `packages/rlsc/src/grid.ts:analyzeGrid` — `(root, viewport, cellSize?) → LayoutGrid`
  - `DEFAULT_CELL_SIZE`: 16px
  - `cols = Math.ceil(viewport.width / cellSize)`, `rows = Math.ceil(viewport.height / cellSize)`
  - 가시 노드만(`visible && width > 0 && height > 0`) flattenTree 후 셀 매핑
  - 각 노드의 bounding rect → 점유 셀 범위 계산 (colStart/colEnd/rowStart/rowEnd)
  - 셀별 후처리:
    - `zStack`: nodeIds를 z-index 오름차순 정렬
    - `dominant`: 셀과 교차 면적이 가장 큰 노드 id
    - `coverage`: 총 교차 면적 / (cellSize²), `Math.min(1, ...)` clamping

- `packages/rlsc/src/grid.ts:gridToText` — `(grid) → string`
  - `extractRegions()` 결과를 `(colRange,rowRange): nodeId` 형식으로 출력
  - 헤더: `GRID {cellSize}px cols:{cols} rows:{rows}`

- `packages/rlsc/src/grid.ts:intersectionArea` — 두 LayoutRect 교차 면적 계산 (내부)
  - 교차 없으면 0 반환

- `packages/rlsc/src/grid.ts:extractRegions` — dominant 기준 연속 영역 병합 (내부)
  - 오른쪽 → 아래 방향으로 확장하여 사각형 영역 추출
  - 방문 셀은 재방문하지 않음

## ^consumes

- `packages/rlsc/src/types.ts` — RLSCNode, LayoutGrid, GridCell, LayoutRect
- `packages/rlsc/src/tree-utils.ts` — flattenTree

import type { RLSCNode, LayoutGrid, GridCell, LayoutRect } from "./types.js";
import { flattenTree } from "./tree-utils.js";

/** 기본 그리드 셀 크기 (px) — 16px = 고해상도 행렬 */
const DEFAULT_CELL_SIZE = 16;

/**
 * 뷰포트를 고정 크기 셀로 분할하고,
 * 각 셀에 어떤 노드가 점유하고 있는지 행렬로 분석한다.
 */
export function analyzeGrid(
  root: RLSCNode,
  viewport: { width: number; height: number },
  cellSize: number = DEFAULT_CELL_SIZE,
): LayoutGrid {
  const cols = Math.ceil(viewport.width / cellSize);
  const rows = Math.ceil(viewport.height / cellSize);

  // 빈 행렬 초기화
  const cells: GridCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: GridCell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ nodeIds: [], zStack: [], coverage: 0 });
    }
    cells.push(row);
  }

  // 가시 노드만 평면화 (리프 또는 의미론적 노드 우선)
  const nodes = flattenTree(root).filter(
    (n) => n.visible && n.rect.width > 0 && n.rect.height > 0,
  );

  // 각 노드가 점유하는 셀 계산
  for (const node of nodes) {
    const colStart = Math.max(0, Math.floor(node.rect.x / cellSize));
    const colEnd = Math.min(
      cols - 1,
      Math.floor((node.rect.x + node.rect.width - 1) / cellSize),
    );
    const rowStart = Math.max(0, Math.floor(node.rect.y / cellSize));
    const rowEnd = Math.min(
      rows - 1,
      Math.floor((node.rect.y + node.rect.height - 1) / cellSize),
    );

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const cell = cells[r][c] as Mutable<GridCell>;
        (cell.nodeIds as string[]).push(node.id);
      }
    }
  }

  // z-stack 정렬 + dominant + coverage 계산
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c] as Mutable<GridCell>;
      if (cell.nodeIds.length === 0) continue;

      // z-index 순서로 정렬
      const sorted = [...cell.nodeIds].toSorted((a, b) => {
        const za = nodeMap.get(a)?.zIndex ?? 0;
        const zb = nodeMap.get(b)?.zIndex ?? 0;
        return za - zb;
      });
      (cell as Mutable<GridCell>).zStack = sorted;

      // 셀 영역과 노드 영역의 교차 면적으로 dominant 결정
      const cellRect: LayoutRect = {
        x: c * cellSize,
        y: r * cellSize,
        width: cellSize,
        height: cellSize,
      };
      let maxOverlap = 0;
      let dominant: string | undefined;
      let totalOverlap = 0;

      for (const id of cell.nodeIds) {
        const node = nodeMap.get(id);
        if (!node) continue;
        const overlap = intersectionArea(cellRect, node.rect);
        totalOverlap += overlap;
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          dominant = id;
        }
      }

      cell.dominant = dominant;
      cell.coverage = Math.min(1, totalOverlap / (cellSize * cellSize));
    }
  }

  return { cellSize, cols, rows, cells };
}

/** 두 rect의 교차 면적 */
function intersectionArea(a: LayoutRect, b: LayoutRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

/** 그리드를 텍스트 행렬로 출력 */
export function gridToText(grid: LayoutGrid): string {
  const lines: string[] = [
    `GRID ${grid.cellSize}px cols:${grid.cols} rows:${grid.rows}`,
  ];

  // 연속된 dominant 영역을 병합하여 표시
  const regions = extractRegions(grid);
  for (const region of regions) {
    const colRange =
      region.colStart === region.colEnd
        ? `${region.colStart}`
        : `${region.colStart}..${region.colEnd}`;
    const rowRange =
      region.rowStart === region.rowEnd
        ? `${region.rowStart}`
        : `${region.rowStart}..${region.rowEnd}`;
    lines.push(`  (${colRange},${rowRange}): ${region.nodeId}`);
  }

  return lines.join("\n");
}

export interface GridRegion {
  nodeId: string;
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

/** 그리드에서 dominant 노드 기준으로 연속 영역 추출 */
export function extractRegions(grid: LayoutGrid): GridRegion[] {
  const visited = new Set<string>();
  const regions: GridRegion[] = [];

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c];
      const key = `${r},${c}`;
      if (visited.has(key) || !cell.dominant) continue;

      const nodeId = cell.dominant;
      // 오른쪽으로 확장
      let colEnd = c;
      while (
        colEnd + 1 < grid.cols &&
        grid.cells[r][colEnd + 1].dominant === nodeId &&
        !visited.has(`${r},${colEnd + 1}`)
      ) {
        colEnd++;
      }
      // 아래로 확장
      let rowEnd = r;
      outer: while (rowEnd + 1 < grid.rows) {
        for (let cc = c; cc <= colEnd; cc++) {
          if (
            grid.cells[rowEnd + 1][cc].dominant !== nodeId ||
            visited.has(`${rowEnd + 1},${cc}`)
          ) {
            break outer;
          }
        }
        rowEnd++;
      }

      // 방문 표시
      for (let rr = r; rr <= rowEnd; rr++) {
        for (let cc = c; cc <= colEnd; cc++) {
          visited.add(`${rr},${cc}`);
        }
      }

      regions.push({ nodeId, colStart: c, colEnd, rowStart: r, rowEnd });
    }
  }

  return regions;
}

// ─── 내부 타입 헬퍼 ─────────────────────────────────────────────────

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

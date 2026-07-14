// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * GridBuilder — CellGridDef[] → 3D 셀 위치 계산.
 *
 * Three.js에 의존하지 않는 순수 계산 모듈.
 * 렌더러가 이 결과를 받아 Three.js 오브젝트를 생성한다.
 */

import type { CellGridDef, ViewMode, ViewPosition, MatrixStackDef } from './types.js';

// ═══════════════════════════════════════════════════
//  셀 위치 계산 결과
// ═══════════════════════════════════════════════════

export interface CellLayout {
  readonly key: string;
  readonly gridId: string;
  readonly entry: string;
  /** 그리드 내 로컬 좌표 */
  readonly localX: number;
  readonly localY: number;
  readonly localZ: number;
  /** 인덱스 */
  readonly col: number;
  readonly row: number;
  readonly depth: number;
}

export interface GridLayout {
  readonly id: string;
  readonly category: string;
  readonly layer: number;
  readonly cells: readonly CellLayout[];
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly cols: number;
  readonly rows: number;
  readonly depths: number;
  /** 3D 큐브 여부 */
  readonly is3d: boolean;
}

export interface GridPositions {
  readonly grids: readonly GridLayout[];
  readonly viewPositions: Record<ViewMode, Record<string, ViewPosition>>;
  readonly cellMap: Map<
    string,
    {
      gridId: string;
      entry: string;
      localX: number;
      localY: number;
      localZ: number;
      layer: number;
      category: string;
    }
  >;
}

// ═══════════════════════════════════════════════════
//  Builder
// ═══════════════════════════════════════════════════

export function buildGridPositions(
  defs: readonly CellGridDef[],
  layerHeights: readonly number[],
  cellSize: number,
  cellGap: number,
): GridPositions {
  const grids: GridLayout[] = [];
  const cellMap = new Map<
    string,
    {
      gridId: string;
      entry: string;
      localX: number;
      localZ: number;
      layer: number;
      category: string;
    }
  >();

  for (const def of defs) {
    const cells: CellLayout[] = [];
    const step = cellSize + cellGap;

    if (def.axes3d) {
      // 3D 큐브 배치: x × y × z
      const xE = def.axes3d.x.entries;
      const yE = def.axes3d.y?.entries ?? ['_'];
      const zE = def.axes3d.z?.entries ?? ['_'];
      const xN = xE.length,
        yN = yE.length,
        zN = zE.length;

      for (let xi = 0; xi < xN; xi++) {
        for (let yi = 0; yi < yN; yi++) {
          for (let zi = 0; zi < zN; zi++) {
            const lx = (-(xN - 1) * step) / 2 + xi * step;
            const ly = yi * step;
            const lz = (-(zN - 1) * step) / 2 + zi * step;
            const entry =
              yN > 1 || zN > 1
                ? [xE[xi], yE[yi] !== '_' ? yE[yi] : null, zE[zi] !== '_' ? zE[zi] : null]
                    .filter(Boolean)
                    .join('/')
                : xE[xi];
            const key = `${def.id}/${entry}`;

            cells.push({
              key,
              gridId: def.id,
              entry,
              localX: lx,
              localY: ly,
              localZ: lz,
              col: xi,
              row: yi,
              depth: zi,
            });
            cellMap.set(key, {
              gridId: def.id,
              entry,
              localX: lx,
              localY: ly,
              localZ: lz,
              layer: def.layer,
              category: def.category,
            });
          }
        }
      }

      grids.push({
        id: def.id,
        category: def.category,
        layer: def.layer,
        cells,
        width: xN * step,
        height: yN * step,
        depth: zN * step,
        cols: xN,
        rows: yN,
        depths: zN,
        is3d: yN > 1,
      });
    } else {
      // 2D 판 배치 (기존 호환)
      const rows = Math.ceil(def.entries.length / def.cols);
      for (let i = 0; i < def.entries.length; i++) {
        const col = i % def.cols;
        const row = Math.floor(i / def.cols);
        const lx = (-(def.cols - 1) * step) / 2 + col * step;
        const lz = (-(rows - 1) * step) / 2 + row * step;
        const key = `${def.id}/${def.entries[i]}`;

        cells.push({
          key,
          gridId: def.id,
          entry: def.entries[i],
          localX: lx,
          localY: 0,
          localZ: lz,
          col,
          row,
          depth: 0,
        });
        cellMap.set(key, {
          gridId: def.id,
          entry: def.entries[i],
          localX: lx,
          localY: 0,
          localZ: lz,
          layer: def.layer,
          category: def.category,
        });
      }

      grids.push({
        id: def.id,
        category: def.category,
        layer: def.layer,
        cells,
        width: def.cols * step,
        height: step,
        depth: rows * step,
        cols: def.cols,
        rows,
        depths: 1,
        is3d: false,
      });
    }
  }

  // 뷰 모드별 그리드 위치 계산
  const viewPositions = computeViewPositions(defs, layerHeights, cellSize, cellGap);

  return { grids, viewPositions, cellMap };
}

// ═══════════════════════════════════════════════════
//  뷰 모드 위치 계산
// ═══════════════════════════════════════════════════

function computeViewPositions(
  defs: readonly CellGridDef[],
  layerHeights: readonly number[],
  cellSize: number = 0.42,
  cellGap: number = 0.1,
): Record<ViewMode, Record<string, ViewPosition>> {
  const result: Record<ViewMode, Record<string, ViewPosition>> = {
    layer: {},
    category: {},
    dsl: {},
    service: {},
  };

  // Layer view — 실제 grid 크기 기반 배치
  const gridSizes = new Map<string, { w: number; d: number }>();
  for (const d of defs) {
    const step = cellSize + cellGap;
    if (d.axes3d) {
      gridSizes.set(d.id, {
        w: d.axes3d.x.entries.length * step,
        d: (d.axes3d.z?.entries.length ?? 1) * step,
      });
    } else {
      const rows = Math.ceil(d.entries.length / d.cols);
      gridSizes.set(d.id, { w: d.cols * step, d: rows * step });
    }
  }

  const byLayer: CellGridDef[][] = layerHeights.map(() => []);
  for (const d of defs) byLayer[d.layer]?.push(d);
  const margin = cellSize * 2; // grid 사이 여백

  for (let li = 0; li < byLayer.length; li++) {
    const grps = byLayer[li];
    const perRow = Math.min(grps.length, 4);

    // 행별 x 위치 계산 (실제 너비 기반)
    for (let gi = 0; gi < grps.length; gi++) {
      const _col = gi % perRow;
      const row = Math.floor(gi / perRow);

      // 같은 줄의 grid들 총 너비
      const rowGrids = grps.filter((_, i) => Math.floor(i / perRow) === row);
      const totalW = rowGrids.reduce((s, g) => s + (gridSizes.get(g.id)?.w ?? 2) + margin, -margin);
      let xCursor = -totalW / 2;
      const colIdx = gi - row * perRow;
      for (let c = 0; c < colIdx; c++) {
        xCursor += (gridSizes.get(rowGrids[c].id)?.w ?? 2) + margin;
      }
      const myW = gridSizes.get(grps[gi].id)?.w ?? 2;
      xCursor += myW / 2;

      // z: 행별 깊이 (실제 depth 기반)
      const maxDepth = Math.max(...rowGrids.map((g) => gridSizes.get(g.id)?.d ?? 2));
      result.layer[grps[gi].id] = {
        x: xCursor,
        y: layerHeights[li],
        z: row * -(maxDepth + margin * 2),
      };
    }
  }

  // Category view — 카테고리별: x=카테고리, y=그리드 내 순서, z=카테고리 깊이
  const cats = [...new Set(defs.map((d) => d.category))];
  cats.forEach((cat, ci) => {
    const grps = defs.filter((d) => d.category === cat);
    const col = ci % 3,
      row = Math.floor(ci / 3);
    grps.forEach((g, gi) => {
      result.category[g.id] = { x: -12 + col * 12, y: 4 - gi * 3.5, z: row * -8 };
    });
  });

  // DSL view — x=DSL, z=멤버 깊이
  const dsls = [...new Set(defs.map((d) => d.dsl).filter(Boolean))];
  const noDsl = defs.filter((d) => !d.dsl);
  dsls.forEach((dsl, di) => {
    const grps = defs.filter((d) => d.dsl === dsl);
    const col = di % 4,
      row = Math.floor(di / 4);
    grps.forEach((g, gi) => {
      result.dsl[g.id] = { x: -18 + col * 12, y: 4 - gi * 3, z: row * -10 };
    });
  });
  noDsl.forEach((g, gi) => {
    result.dsl[g.id] = { x: 24, y: 4 - gi * 3, z: -12 };
  });

  // Service view — x=서비스, z=tier 깊이
  const svcs = [...new Set(defs.map((d) => d.service).filter(Boolean))];
  const noSvc = defs.filter((d) => !d.service);
  svcs.forEach((svc, si) => {
    const grps = defs.filter((d) => d.service === svc);
    grps.forEach((g, gi) => {
      result.service[g.id] = { x: -16 + si * 8, y: 4 - Math.floor(gi / 2) * 3.5, z: (gi % 2) * -5 };
    });
  });
  noSvc.forEach((g, gi) => {
    result.service[g.id] = { x: 24, y: 4, z: -gi * 5 };
  });

  return result;
}

// ═══════════════════════════════════════════════════
//  매트릭스 스택 위치 계산
// ═══════════════════════════════════════════════════

export function computeStackPositions(
  stacks: readonly MatrixStackDef[],
  _grids: readonly GridLayout[],
): Record<string, ViewPosition> {
  const positions: Record<string, ViewPosition> = {};

  for (const stack of stacks) {
    stack.grids.forEach((gridId, i) => {
      const offset = i * stack.gap;
      positions[gridId] = {
        x: stack.position.x + (stack.axis === 'x' ? offset : 0),
        y: stack.position.y + (stack.axis === 'y' ? offset : 0),
        z: stack.position.z + (stack.axis === 'z' ? offset : 0),
      };
    });
  }

  return positions;
}

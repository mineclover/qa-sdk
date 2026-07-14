// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, it, expect } from 'vitest';
import { buildGridPositions } from './grid-builder.js';
import type { CellGridDef } from './types.js';

const SAMPLE_GRIDS: CellGridDef[] = [
  {
    id: 'page_view',
    category: 'observation',
    layer: 0,
    entries: ['home', 'product', 'cart', 'checkout'],
    cols: 2,
    dsl: 'dsl-obs',
    service: 'web',
  },
  {
    id: 'endpoint',
    category: 'observation',
    layer: 1,
    entries: ['GET', 'POST', 'PUT'],
    cols: 3,
    dsl: 'dsl-obs',
    service: 'infra',
  },
  {
    id: 'orders',
    category: 'table',
    layer: 3,
    entries: ['id', 'status', 'amount'],
    cols: 3,
    dsl: 'dsl-commerce',
    service: 'backend',
  },
];

const CUBE_GRIDS: CellGridDef[] = [
  {
    id: 'page_cube',
    category: 'observation',
    layer: 0,
    entries: [],
    cols: 1,
    axes3d: {
      x: { label: 'page', entries: ['home', 'product', 'cart', 'checkout'] },
      y: { label: 'userType', entries: ['guest', 'member', 'premium'] },
      z: { label: 'locale', entries: ['ko', 'en', 'ja'] },
    },
  },
];

describe('GridBuilder', () => {
  it('2D 판: 모든 셀에 대해 위치를 계산한다', () => {
    const result = buildGridPositions(SAMPLE_GRIDS, [8, 2, -4, -10], 0.4, 0.08);

    expect(result.grids.length).toBe(3);
    expect(result.grids[0].cells.length).toBe(4);
    expect(result.grids[0].is3d).toBe(false);
    expect(result.grids[0].cells[0].localY).toBe(0); // 2D 판은 y=0

    expect(result.cellMap.size).toBe(10);
    expect(result.cellMap.has('page_view/home')).toBe(true);
  });

  it('3D 큐브: axes3d → x×y×z 셀 배치', () => {
    const result = buildGridPositions(CUBE_GRIDS, [8], 0.4, 0.08);

    const cube = result.grids[0];
    expect(cube.is3d).toBe(true);
    expect(cube.cols).toBe(4); // x: 4 pages
    expect(cube.rows).toBe(3); // y: 3 userTypes
    expect(cube.depths).toBe(3); // z: 3 locales
    expect(cube.cells.length).toBe(36); // 4×3×3

    // y축이 실제로 사용됨
    const yValues = new Set(cube.cells.map((c) => c.localY));
    expect(yValues.size).toBe(3); // 3개 y 레벨

    // 키 형식: page_cube/home/guest/ko
    expect(cube.cells[0].key).toContain('page_cube/');
    expect(cube.height).toBeGreaterThan(0);
  });

  it('3D 큐브: cellMap에 localY가 포함됨', () => {
    const result = buildGridPositions(CUBE_GRIDS, [8], 0.4, 0.08);

    for (const [, cell] of result.cellMap) {
      expect(typeof cell.localY).toBe('number');
    }
  });

  it('뷰 모드: z축이 활용됨 (레이어 뷰에서 같은 레이어의 그리드가 z로 분산)', () => {
    // 같은 레이어에 5개 이상 그리드가 있으면 z축으로 분산
    const manyGrids: CellGridDef[] = Array.from({ length: 6 }, (_, i) => ({
      id: `g${i}`,
      category: 'entity',
      layer: 1,
      entries: ['a', 'b'],
      cols: 2,
    }));
    const result = buildGridPositions(manyGrids, [8, 2], 0.4, 0.08);

    const zValues = Object.values(result.viewPositions.layer).map((p) => p.z);
    const uniqueZ = new Set(zValues);
    expect(uniqueZ.size).toBeGreaterThan(1); // z축 활용됨
  });

  it('service 뷰: z축으로 깊이 배치', () => {
    const result = buildGridPositions(SAMPLE_GRIDS, [8, 2, -4, -10], 0.4, 0.08);
    // service 뷰에서 같은 서비스의 그리드가 z로 분산될 수 있음
    for (const pos of Object.values(result.viewPositions.service)) {
      expect(typeof pos.z).toBe('number');
    }
  });
});

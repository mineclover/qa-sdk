// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, expect, it } from 'vitest';
import { buildConceptHierarchyGrid } from './concept-grid.js';

describe('buildConceptHierarchyGrid', () => {
  it('4열 × 4행 기반 concept grid를 제공한다', () => {
    const grid = buildConceptHierarchyGrid();

    expect(grid.columns).toHaveLength(4);
    expect(grid.rows).toHaveLength(4);
    expect(grid.cells.length).toBeGreaterThanOrEqual(16);
    expect(grid.boundaries).toHaveLength(4);
    expect(grid.links.length).toBeGreaterThan(0);
  });

  it('아래 행일수록 더 작은 단위를 표현하도록 unitScale이 감소한다', () => {
    const grid = buildConceptHierarchyGrid();
    const scales = grid.rows.map((row) => row.unitScale);

    expect(scales).toEqual([1, 0.92, 0.84, 0.76]);
  });
});

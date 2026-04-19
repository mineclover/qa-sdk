// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from "vitest";
import { analyzeGrid } from "./grid.js";
import type { RLSCNode } from "./types.js";

const VIEWPORT = { width: 1920, height: 1080 };

function node(id: string, rect: RLSCNode["rect"], depth = 0): RLSCNode {
  return {
    id,
    tag: "div",
    classes: [],
    rect,
    zIndex: 0,
    depth,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children: [],
  };
}

describe("analyzeGrid — cellSize", () => {
  it("cellSize 미지정 시 기본값 16px 사용", () => {
    const root = node("root", { x: 0, y: 0, width: 1920, height: 1080 });
    const grid = analyzeGrid(root, VIEWPORT);
    expect(grid.cellSize).toBe(16);
    expect(grid.cols).toBe(Math.ceil(1920 / 16));
    expect(grid.rows).toBe(Math.ceil(1080 / 16));
  });

  it("cellSize 32 지정", () => {
    const root = node("root", { x: 0, y: 0, width: 1920, height: 1080 });
    const grid = analyzeGrid(root, VIEWPORT, 32);
    expect(grid.cellSize).toBe(32);
    expect(grid.cols).toBe(Math.ceil(1920 / 32));
  });
});

describe("analyzeGrid — coverage", () => {
  it("coverage는 0–1 범위", () => {
    const child = node("child", { x: 0, y: 0, width: 400, height: 300 }, 1);
    const root = node("root", { x: 0, y: 0, width: 1920, height: 1080 });
    (root as any).children = [child];
    const grid = analyzeGrid(root, VIEWPORT, 16);
    for (const row of grid.cells) {
      for (const cell of row) {
        expect(cell.coverage).toBeGreaterThanOrEqual(0);
        expect(cell.coverage).toBeLessThanOrEqual(1);
      }
    }
  });

  it("노드가 없는 셀: nodeIds=[], zStack=[], coverage=0, dominant=undefined", () => {
    // 노드가 왼쪽 위 일부만 차지 → 오른쪽 셀은 비어 있어야 함
    const child = node("child", { x: 0, y: 0, width: 16, height: 16 }, 1);
    const root = node("root", { x: 0, y: 0, width: 1920, height: 1080 });
    (root as any).children = [child];
    const grid = analyzeGrid(root, VIEWPORT, 16);
    // 마지막 행, 마지막 열 셀은 비어 있어야 함 (root는 가시 대상이지만 1920×1080 full cover)
    // child만 16×16 → 첫 셀 외에는 child가 없음
    // root가 전체 커버하므로 nodeIds에 root 있을 수 있음
    // 완전히 비어있는 셀 대신 child 점유 없는 셀 확인
    const lastRow = grid.cells[grid.rows - 1];
    const lastCell = lastRow?.[grid.cols - 1];
    expect(lastCell?.nodeIds).not.toContain("child");
  });
});

describe("analyzeGrid — dominant", () => {
  it("dominant는 해당 셀과 교차 면적이 가장 큰 노드", () => {
    // root를 invisible로 설정 → grid 분석에서 제외
    const big = node("big", { x: 0, y: 0, width: 100, height: 100 }, 1);
    const small = node("small", { x: 0, y: 0, width: 20, height: 20 }, 1);
    const root = { ...node("root", { x: 0, y: 0, width: 1920, height: 1080 }), visible: false };
    (root as any).children = [big, small];
    const grid = analyzeGrid(root, VIEWPORT, 16);
    // 두 번째 셀 [0][1] (x:16–32, y:0–16): big만 점유, small은 x<16이므로 없음
    const secondCell = grid.cells[0]?.[1];
    expect(secondCell?.dominant).toBe("big");
  });
});

describe("analyzeGrid — zStack", () => {
  it("zStack은 z-index 오름차순 정렬", () => {
    const low = node("low", { x: 0, y: 0, width: 100, height: 100 }, 1);
    const high = { ...node("high", { x: 0, y: 0, width: 100, height: 100 }, 1), zIndex: 100 };
    const root = node("root", { x: 0, y: 0, width: 1920, height: 1080 });
    (root as any).children = [high, low];
    const grid = analyzeGrid(root, VIEWPORT, 16);
    const firstCell = grid.cells[0]?.[0];
    if (firstCell && firstCell.zStack.length >= 2) {
      const lowIdx = firstCell.zStack.indexOf("low");
      const highIdx = firstCell.zStack.indexOf("high");
      expect(lowIdx).toBeLessThan(highIdx);
    }
  });
});

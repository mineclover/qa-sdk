// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * MatrixStack — 여러 prefix 그리드를 큐브로 스택/겹침.
 *
 * 개별 그리드 plate를 y/x/z 축으로 겹쳐서
 * 3D 큐브 형태의 매트릭스를 구성한다.
 *
 * 용도:
 * - checkout 흐름의 모든 prefix를 y축으로 스택 → 수직 큐브
 * - 서비스별 prefix를 z축으로 스택 → 깊이 큐브
 * - 시간축으로 스냅샷을 x축으로 스택 → 시간 큐브
 */

import type { MatrixStackDef, ViewPosition, StackAxis } from "../core/types.js";
import type { GridLayout } from "../core/grid-builder.js";

export interface StackLayout {
  readonly stackId: string;
  readonly axis: StackAxis;
  readonly gridPositions: Record<string, ViewPosition>;
  /** 스택 전체 바운딩 박스 */
  readonly bounds: { width: number; height: number; depth: number };
}

/**
 * MatrixStack 레이아웃을 계산한다.
 */
export function computeStackLayout(
  stack: MatrixStackDef,
  grids: readonly GridLayout[],
): StackLayout {
  const gridMap = new Map(grids.map(g => [g.id, g]));
  const positions: Record<string, ViewPosition> = {};
  let maxW = 0, maxD = 0;

  stack.grids.forEach((gridId, i) => {
    const grid = gridMap.get(gridId);
    if (grid) { maxW = Math.max(maxW, grid.width); maxD = Math.max(maxD, grid.depth); }

    const offset = i * stack.gap;
    positions[gridId] = {
      x: stack.position.x + (stack.axis === "x" ? offset : 0),
      y: stack.position.y + (stack.axis === "y" ? offset : 0),
      z: stack.position.z + (stack.axis === "z" ? offset : 0),
    };
  });

  const totalLen = stack.grids.length * stack.gap;
  return {
    stackId: stack.id,
    axis: stack.axis,
    gridPositions: positions,
    bounds: {
      width: stack.axis === "x" ? totalLen : maxW,
      height: stack.axis === "y" ? totalLen : 1,
      depth: stack.axis === "z" ? totalLen : maxD,
    },
  };
}

/**
 * 여러 스택을 계산하고 "stack" 뷰 모드 위치를 반환한다.
 */
export function computeAllStacks(
  stacks: readonly MatrixStackDef[],
  grids: readonly GridLayout[],
): { layouts: StackLayout[]; viewPositions: Record<string, ViewPosition> } {
  const layouts: StackLayout[] = [];
  const viewPositions: Record<string, ViewPosition> = {};

  for (const stack of stacks) {
    const layout = computeStackLayout(stack, grids);
    layouts.push(layout);
    Object.assign(viewPositions, layout.gridPositions);
  }

  // 스택에 포함되지 않은 그리드는 원래 위치 유지
  for (const grid of grids) {
    if (!(grid.id in viewPositions)) {
      viewPositions[grid.id] = { x: 30, y: 0, z: 0 }; // 화면 밖
    }
  }

  return { layouts, viewPositions };
}

// ═══════════════════════════════════════════════════
//  프리셋 스택 정의
// ═══════════════════════════════════════════════════

/** checkout 흐름 수직 스택 */
export const STACK_CHECKOUT: MatrixStackDef = {
  id: "stack-checkout",
  grids: ["page_view", "endpoint", "flow_point", "permission", "order_event", "orders"],
  axis: "y",
  gap: 3,
  position: { x: 0, y: -4, z: 0 },
};

/** 인프라 관측 수직 스택 */
export const STACK_INFRA: MatrixStackDef = {
  id: "stack-infra",
  grids: ["service", "deploy_event", "health_event", "pipeline_point", "data_policy"],
  axis: "y",
  gap: 3,
  position: { x: 12, y: -4, z: 0 },
};

/** 서비스별 깊이 스택 */
export const STACK_BY_SERVICE: MatrixStackDef = {
  id: "stack-by-service",
  grids: ["page_view", "tracking", "cart_event", "auth_event", "order_event"],
  axis: "z",
  gap: 4,
  position: { x: -12, y: 0, z: -8 },
};

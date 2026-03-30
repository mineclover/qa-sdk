import { describe, it, expect } from "vitest";
import { computeStackLayout, computeAllStacks, STACK_CHECKOUT, STACK_INFRA } from "./matrix-stack.js";
import type { GridLayout } from "../core/grid-builder.js";

const MOCK_GRIDS: GridLayout[] = [
  { id: "page_view", category: "observation", layer: 0, cells: [], width: 3, depth: 2, cols: 4, rows: 2 },
  { id: "endpoint", category: "observation", layer: 1, cells: [], width: 2, depth: 1, cols: 3, rows: 1 },
  { id: "flow_point", category: "observation", layer: 1, cells: [], width: 2, depth: 2, cols: 3, rows: 3 },
  { id: "permission", category: "policy", layer: 1, cells: [], width: 3, depth: 1, cols: 4, rows: 2 },
  { id: "order_event", category: "event", layer: 1, cells: [], width: 1, depth: 1, cols: 2, rows: 2 },
  { id: "orders", category: "table", layer: 3, cells: [], width: 2, depth: 1, cols: 3, rows: 2 },
  { id: "service", category: "entity", layer: 2, cells: [], width: 2, depth: 1, cols: 3, rows: 2 },
  { id: "deploy_event", category: "event", layer: 2, cells: [], width: 2, depth: 1, cols: 3, rows: 2 },
  { id: "health_event", category: "event", layer: 2, cells: [], width: 1, depth: 1, cols: 2, rows: 2 },
  { id: "pipeline_point", category: "observation", layer: 2, cells: [], width: 2, depth: 1, cols: 3, rows: 2 },
  { id: "data_policy", category: "observation", layer: 2, cells: [], width: 1, depth: 1, cols: 2, rows: 2 },
];

describe("MatrixStack", () => {
  it("checkout 스택 — y축으로 6개 그리드 배치", () => {
    const layout = computeStackLayout(STACK_CHECKOUT, MOCK_GRIDS);

    expect(layout.stackId).toBe("stack-checkout");
    expect(Object.keys(layout.gridPositions).length).toBe(6);

    // y축 간격 확인
    const positions = Object.values(layout.gridPositions);
    const yValues = positions.map(p => p.y).toSorted((a, b) => a - b);
    expect(yValues[1] - yValues[0]).toBe(STACK_CHECKOUT.gap);
  });

  it("computeAllStacks — 여러 스택 동시 계산", () => {
    const { layouts, viewPositions } = computeAllStacks([STACK_CHECKOUT, STACK_INFRA], MOCK_GRIDS);

    expect(layouts.length).toBe(2);
    // checkout + infra 스택의 모든 그리드 + 나머지
    expect(Object.keys(viewPositions).length).toBeGreaterThanOrEqual(10);
  });

  it("스택에 포함되지 않은 그리드는 화면 밖", () => {
    const { viewPositions } = computeAllStacks([STACK_CHECKOUT], MOCK_GRIDS);

    // page_view는 checkout 스택에 포함
    expect(viewPositions["page_view"].x).toBe(STACK_CHECKOUT.position.x);

    // data_policy는 미포함 → 화면 밖 (x=30)
    expect(viewPositions["data_policy"].x).toBe(30);
  });
});

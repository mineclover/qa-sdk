// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, it, expect } from "vitest";
import {
  scalar, row, grid, cube, spine, shelf, nested,
  inferPattern, inferRole, extractDims, computePatternLayout,
  type DimInfo,
} from "./split-pattern.js";

describe("SplitPattern — 패턴 정의", () => {

  it("0D scalar — 단일 값", () => {
    const p = scalar("health_event", "health_status");
    expect(p.type).toBe("scalar");
    expect(p.mappings[0].channel).toBe("color");
  });

  it("1D row — 가로 행", () => {
    const p = row("cart_event", "action");
    expect(p.type).toBe("row");
    expect(p.mappings[0].channel).toBe("x");
  });

  it("2D grid — 행렬", () => {
    const p = grid("page_view", "page", "userType");
    expect(p.type).toBe("grid");
    expect(p.mappings.length).toBe(2);
    expect(p.mappings[0].channel).toBe("x");
    expect(p.mappings[1].channel).toBe("z");
  });

  it("3D cube — 큐브", () => {
    const p = cube("flow_point", "flow_name", "flow_step", "flow_variant");
    expect(p.type).toBe("cube");
    expect(p.mappings.length).toBe(3);
  });

  it("3D→1D spine — 압축 행", () => {
    const p = spine("service", "svc_name", ["env", "region"]);
    expect(p.type).toBe("spine");
    const collapsed = p.mappings.filter(m => m.channel === "collapse");
    expect(collapsed.length).toBe(2);
  });

  it("3D→2D shelf — 선반", () => {
    const p = shelf("flow_point", "flow_name", "flow_step", "flow_variant");
    expect(p.type).toBe("shelf");
    expect(p.mappings[0].channel).toBe("group");
    expect(p.mappings[0].subPattern).toBe("grid");
  });

  it("ND→Group nested — 계층 분해", () => {
    const p = nested("pipeline_point", "pipeline_phase", "grid");
    expect(p.type).toBe("nested");
  });
});

describe("inferRole — 축 역할 추론", () => {
  it("flow_step → sequence", () => expect(inferRole("flow_step", "axis")).toBe("sequence"));
  it("flow_name → classify", () => expect(inferRole("flow_name", "axis")).toBe("classify"));
  it("flow_variant → variant", () => expect(inferRole("flow_variant", "axis")).toBe("variant"));
  it("svc_ref (prefix_ref) → context", () => expect(inferRole("svc_ref", "prefix_ref")).toBe("context"));
  it("actor (table_ref) → context", () => expect(inferRole("actor", "table_ref")).toBe("context"));
  it("http_method → identity", () => expect(inferRole("http_method", "axis")).toBe("identity"));
});

describe("inferPattern — 역할 기반 추론", () => {
  it("1축 identity → row", () => {
    expect(inferPattern("cart_event", ["action"]).type).toBe("row");
  });

  it("2축 identity → grid", () => {
    expect(inferPattern("tracking", ["trackAction", "page"]).type).toBe("grid");
  });

  it("3축 identity → cube", () => {
    expect(inferPattern("rbac", ["role", "action", "resource"]).type).toBe("cube");
  });

  it("flow_point: classify(flow_name) + sequence(flow_step) + variant(flow_variant) → shelf", () => {
    const p = inferPattern("flow_point", [
      { label: "flow_name", kind: "axis" },
      { label: "flow_step", kind: "axis" },
      { label: "flow_variant", kind: "axis" },
    ] as DimInfo[]);
    expect(p.type).toBe("shelf"); // flow_name이 classify → shelf
    expect(p.mappings.find(m => m.role === "classify")?.channel).toBe("group");
  });

  it("page_view: prefix_ref(svc_ref) → collapse, axis들 → grid", () => {
    const p = inferPattern("page_view", [
      { label: "svc_ref", kind: "prefix_ref" },
      { label: "page", kind: "axis" },
      { label: "locale", kind: "axis" },
      { label: "userType", kind: "axis" },
    ] as DimInfo[]);
    // svc_ref는 context → collapse
    expect(p.mappings.find(m => m.axis === "svc_ref")?.channel).toBe("collapse");
    // page, locale, userType 중 하나가 x, 하나가 z
    expect(p.mappings.filter(m => m.channel === "x" || m.channel === "z").length).toBeGreaterThanOrEqual(2);
  });

  it("cart_event: table_ref → link", () => {
    const p = inferPattern("cart_event", [
      { label: "actor", kind: "table_ref" },
      { label: "action", kind: "axis" },
      { label: "target", kind: "table_ref" },
    ] as DimInfo[]);
    expect(p.mappings.filter(m => m.channel === "link").length).toBe(2);
    expect(p.type).toBe("row"); // axis 1개(action) → row
  });

  it("order_event: prefix_ref + axis → row with collapse", () => {
    const p = inferPattern("order_event", [
      { label: "service_ctx", kind: "prefix_ref" },
      { label: "action", kind: "axis" },
    ] as DimInfo[]);
    expect(p.mappings.find(m => m.axis === "service_ctx")?.channel).toBe("collapse");
    expect(p.type).toBe("row");
  });
});

describe("computePatternLayout — 셀 위치 계산", () => {

  it("row: 3 entries → 3개 셀", () => {
    const p = row("cart_event", "action");
    const layout = computePatternLayout(p, { action: ["add", "remove", "checkout"] });
    expect(layout.cells.length).toBe(3);
    expect(layout.cells[0].x).toBe(0);
    expect(layout.cells[1].x).toBeGreaterThan(0);
    expect(layout.bounds.width).toBeGreaterThan(0);
  });

  it("grid: 3×2 → 6개 셀", () => {
    const p = grid("tracking", "trackAction", "userType");
    const layout = computePatternLayout(p, {
      trackAction: ["click", "view", "scroll"],
      userType: ["guest", "member"],
    });
    expect(layout.cells.length).toBe(6);
  });

  it("cube: 2×2×2 → 8개 셀", () => {
    const p = cube("test", "a", "b", "c");
    const layout = computePatternLayout(p, {
      a: ["x", "y"], b: ["p", "q"], c: ["1", "2"],
    });
    expect(layout.cells.length).toBe(8);
    expect(layout.bounds.height).toBeGreaterThan(0);
    expect(layout.bounds.depth).toBeGreaterThan(0);
  });

  it("spine: 5 entries, 2 collapsed axes → 5개 셀 + collapsed 메타", () => {
    const p = spine("service", "svc_name", ["env", "region"]);
    const layout = computePatternLayout(p, {
      svc_name: ["web", "backend", "auth", "payment", "gateway"],
      env: ["dev", "prod", "stage"],
      region: ["asia", "usa"],
    });
    expect(layout.cells.length).toBe(5);
    expect(layout.cells[0].collapsed).toBeDefined();
    expect(layout.cells[0].collapsed!.env).toContain("3 entries");
  });

  it("shelf: 3 groups × 2×2 grid → 12개 셀", () => {
    const p = shelf("flow_point", "flow_name", "flow_step", "flow_variant");
    const layout = computePatternLayout(p, {
      flow_name: ["checkout", "login", "browse"],
      flow_step: ["entry", "success"],
      flow_variant: ["default", "retry"],
    });
    expect(layout.cells.length).toBe(12); // 3 × 2 × 2
    // 그룹별 y 오프셋
    const checkoutCell = layout.cells.find(c => c.group === "checkout");
    const loginCell = layout.cells.find(c => c.group === "login");
    expect(checkoutCell!.y).not.toBe(loginCell!.y);
  });
});

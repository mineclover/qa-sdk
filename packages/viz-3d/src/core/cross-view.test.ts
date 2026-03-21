import { describe, it, expect } from "vitest";
import {
  computeCrossViewLayout, matchEventToCells,
  PRESET_AXES, PRESET_VIEWS,
} from "./cross-view.js";

describe("CrossView — 임의 축 교차 뷰", () => {

  it("2축 교차: page × flow_step → 2D 그리드", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[0]); // page-x-flowstep
    expect(layout.xEntries.length).toBe(8); // page entries
    expect(layout.zEntries.length).toBe(7); // flow_step entries
    expect(layout.totalCells).toBe(56); // 8 × 7
    expect(layout.bounds.width).toBeGreaterThan(0);
    expect(layout.bounds.depth).toBeGreaterThan(0);
    // y축 없으면 yEntries=["_"], height = cellSize
    expect(layout.bounds.height).toBeLessThanOrEqual(1);
  });

  it("2축 교차: method × verdict → 2D 그리드", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[1]); // method-x-verdict
    expect(layout.totalCells).toBe(25); // 5 × 5
  });

  it("3축 교차: svc × phase × health → 3D 큐브", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[2]); // svc-x-phase-x-health
    expect(layout.xEntries.length).toBe(5);
    expect(layout.yEntries.length).toBe(5);
    expect(layout.zEntries.length).toBe(4);
    expect(layout.totalCells).toBe(100); // 5 × 5 × 4
    expect(layout.bounds.height).toBeGreaterThan(0); // y축 있음
  });

  it("group 축: page × action, userType별 그룹", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[3]); // page-x-action-by-usertype
    expect(layout.groups.length).toBe(3); // guest, member, premium
    expect(layout.totalCells).toBe(3 * 8 * 8); // 3 groups × 8 pages × 8 actions
  });

  it("필터 적용: flow_name 제한", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[5]); // flow-x-step-by-svc
    // flow_name 필터: checkout, login, payment만
    expect(layout.xEntries.length).toBe(3);
    // svc_name × 3 flows × 7 steps
    expect(layout.totalCells).toBe(5 * 3 * 7);
  });

  it("이벤트 매칭: decoded 값 → 셀 키", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[0]); // page-x-flowstep
    const matched = matchEventToCells(
      { page: "checkout", flow_step: "success" },
      layout,
    );
    expect(matched.length).toBe(1);
    expect(matched[0]).toBe("checkout:success");
  });

  it("이벤트 매칭: 부분 매칭", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[0]);
    // page만 있고 flow_step이 없으면 매칭 안 됨
    const matched = matchEventToCells({ page: "checkout" }, layout);
    expect(matched.length).toBe(0);
  });

  it("이벤트 매칭: 3D 큐브", () => {
    const layout = computeCrossViewLayout(PRESET_VIEWS[2]); // svc × phase × health
    const matched = matchEventToCells(
      { svc_name: "shopping-web", pipeline_phase: "verdict", health_status: "healthy" },
      layout,
    );
    expect(matched.length).toBe(1);
  });

  it("셀 좌표: x/z 값이 grid 위치에 매핑", () => {
    const layout = computeCrossViewLayout({
      id: "test", name: "test",
      channels: [
        { axis: { id: "a", name: "A", entries: ["a1", "a2", "a3"], usedBy: [] }, channel: "x" },
        { axis: { id: "b", name: "B", entries: ["b1", "b2"], usedBy: [] }, channel: "z" },
      ],
    });
    expect(layout.totalCells).toBe(6);
    // a1:b1은 (0,0,0), a2:b1은 (step,0,0)
    expect(layout.cells[0].x).toBe(0);
    expect(layout.cells[0].z).toBe(0);
    expect(layout.cells[1].x).toBe(0);
    expect(layout.cells[1].z).toBeGreaterThan(0); // b2
  });
});

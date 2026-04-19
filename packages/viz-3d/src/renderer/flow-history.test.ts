// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, it, expect } from "vitest";
import { FlowHistory, type FlowEntry } from "./flow-history.js";

function entry(name: string, keys: string[], flow: { tier: string; cell: string }[] = []): FlowEntry {
  return {
    name, desc: "", keys, ctx: {},
    flow: flow.map(f => ({ ...f, label: f.cell })),
    timestamp: new Date().toISOString(), source: "demo",
  };
}

describe("FlowHistory", () => {
  it("push → 이력 누적", () => {
    const h = new FlowHistory();
    h.push(entry("step1", ["page_view/home"]));
    h.push(entry("step2", ["endpoint/GET"]));
    expect(h.length).toBe(2);
    expect(h.isLive).toBe(true);
  });

  it("prev/next 탐색", () => {
    const h = new FlowHistory();
    h.push(entry("s1", ["a"]));
    h.push(entry("s2", ["b"]));
    h.push(entry("s3", ["c"]));

    expect(h.current()?.name).toBe("s3"); // 최신

    const p1 = h.prev();
    expect(p1?.name).toBe("s2");
    expect(h.isLive).toBe(false);

    const p2 = h.prev();
    expect(p2?.name).toBe("s1");

    const p3 = h.prev(); // 더 이상 못 감
    expect(p3?.name).toBe("s1");

    const n1 = h.next();
    expect(n1?.name).toBe("s2");

    const n2 = h.next();
    expect(n2?.name).toBe("s3");
    expect(h.isLive).toBe(true); // 최신 복귀
  });

  it("goTo 특정 인덱스", () => {
    const h = new FlowHistory();
    h.push(entry("s1", ["a"]));
    h.push(entry("s2", ["b"]));
    h.push(entry("s3", ["c"]));

    const e = h.goTo(0);
    expect(e?.name).toBe("s1");
    expect(h.viewIndex).toBe(0);
  });

  it("goLive → 최신 모드", () => {
    const h = new FlowHistory();
    h.push(entry("s1", ["a"]));
    h.push(entry("s2", ["b"]));
    h.prev();
    expect(h.isLive).toBe(false);
    h.goLive();
    expect(h.isLive).toBe(true);
  });

  it("filterByPrefix", () => {
    const h = new FlowHistory();
    h.push(entry("s1", ["page_view/home", "tracking/view"]));
    h.push(entry("s2", ["endpoint/GET"]));
    h.push(entry("s3", ["page_view/cart", "endpoint/POST"]));

    const pv = h.filterByPrefix("page_view");
    expect(pv.length).toBe(2);
    expect(pv[0].name).toBe("s1");
    expect(pv[1].name).toBe("s3");
  });

  it("indexLabel", () => {
    const h = new FlowHistory();
    expect(h.indexLabel()).toBe("-/-");
    h.push(entry("s1", []));
    h.push(entry("s2", []));
    expect(h.indexLabel()).toBe("2/2"); // live = 최신
    h.prev();
    expect(h.indexLabel()).toBe("1/2");
  });

  it("clear 초기화", () => {
    const h = new FlowHistory();
    h.push(entry("s1", []));
    h.clear();
    expect(h.length).toBe(0);
    expect(h.isLive).toBe(true);
  });
});

// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { detectPathSegments } from "./pipe-segment.js";
import { validatePrefixSegments, validateManifestSegments, chainSegments } from "../catalog/path-summation.js";
import type { PipeSpec, PipeGraph, PipeConnection, PrefixDef, Catalog } from "@qa-sdk/core";
import { step } from "./__fixtures__/pipe-fixtures.js";

// ── 헬퍼 ──────────────────────────────────────────────

function makePipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return {
    pipeId: id,
    version: "1.0.0",
    trigger: { eventKey: `${id}_trigger` },
    flow: step(),
    ...overrides,
  };
}

function conn(from: string, to: string, kind: PipeConnection["kind"] = "next"): PipeConnection {
  return { from, to, kind };
}

// ── detectPathSegments ──────────────────────────────

describe("detectPathSegments", () => {
  it("선형 체인 → 단일 세그먼트", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B"), makePipe("C")],
      connections: [conn("A", "B"), conn("B", "C")],
      entryPipeId: "A",
    };

    const { segments, reasons } = detectPathSegments(graph);
    expect(segments).toHaveLength(1);
    expect(reasons[0].kind).toBe("linear-chain");
  });

  it("conditional 분기 → 분기별 세그먼트", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [
        makePipe("A"),
        makePipe("B"),
        makePipe("C"),
      ],
      connections: [
        { from: "A", to: "B", kind: "conditional", condition: "type=card" },
        { from: "A", to: "C", kind: "conditional", condition: "type=bank" },
      ],
      entryPipeId: "A",
    };

    const { segments, reasons } = detectPathSegments(graph);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(reasons.some(r => r.kind === "conditional-branch")).toBe(true);
  });

  it("event connection → transition 설정", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [
        makePipe("order", { produces: ["payment_trigger"] }),
        makePipe("payment", { trigger: { eventKey: "payment_trigger" } }),
      ],
      connections: [
        { from: "order", to: "payment", kind: "event" },
      ],
      entryPipeId: "order",
    };

    const { segments } = detectPathSegments(graph);
    expect(segments.length).toBeGreaterThanOrEqual(1);

    // event connection이 있으면 transition이 설정됨
    const hasTransition = segments.some(s => s.transition?.eventKey === "payment_trigger");
    expect(hasTransition).toBe(true);
  });

  it("fan-out → 병렬 세그먼트", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B"), makePipe("C")],
      connections: [
        { from: "A", to: ["B", "C"], kind: "fan-out" },
      ],
      entryPipeId: "A",
    };

    const { segments, reasons } = detectPathSegments(graph);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(reasons.some(r => r.kind === "fan-out")).toBe(true);
  });

  it("pipeId 기반 consumes + event transition", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [
        makePipe("A"),
        makePipe("B"),
        makePipe("C", { trigger: { eventKey: "payment_start" } }),
      ],
      connections: [
        conn("A", "B"),
        { from: "B", to: "C", kind: "event" as const },
      ],
      entryPipeId: "A",
    };

    const { segments } = detectPathSegments(graph);
    expect(segments.length).toBeGreaterThanOrEqual(1);

    // A,B가 체인 → consumes에 pipeId 포함
    const chain = segments.find(s => s.consumes.includes("A"));
    expect(chain).toBeDefined();
    expect(chain!.consumes).toContain("B");

    // event connection → transition
    expect(chain!.transition?.eventKey).toBe("payment_start");
  });

  it("빈 그래프 → 빈 세그먼트", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [],
      connections: [],
      entryPipeId: "",
    };

    const { segments } = detectPathSegments(graph);
    expect(segments).toHaveLength(0);
  });
});

// ── validatePrefixSegments ──────────────────────────

describe("validatePrefixSegments", () => {
  const prefix: PrefixDef = {
    id: "test",
    name: "test",
    labels: ["orderType", "paymentMethod"],
    dims: {
      orderType: { kind: "axis", axisId: "order_type" },
      paymentMethod: { kind: "axis", axisId: "payment_method" },
    },
    versions: [{ version: "v1", axisVersions: { order_type: "v1", payment_method: "v1" } }],
    addressModel: "sum",
  };

  it("정상 — consumes가 prefix dims의 부분집합", () => {
    const segs = [
      { segmentId: "s1", consumes: ["orderType"], shape: [3], addressOffset: 0, size: 3 },
    ] as const;
    expect(validatePrefixSegments(prefix, segs)).toHaveLength(0);
  });

  it("에러 — consumes에 prefix에 없는 dim", () => {
    const segs = [
      { segmentId: "s1", consumes: ["orderType", "unknownDim"], shape: [3, 2], addressOffset: 0, size: 6 },
    ] as const;
    const errors = validatePrefixSegments(prefix, segs);
    expect(errors.some(e => e.includes("unknownDim"))).toBe(true);
  });

  it("에러 — route axis가 consumes에 없음", () => {
    const segs = [{
      segmentId: "s1",
      consumes: ["orderType"] as readonly string[],
      shape: [3] as readonly number[],
      addressOffset: 0,
      size: 3,
      routes: [
        { when: { axis: "paymentMethod", eq: 0 }, transition: { eventKey: "x" } },
      ] as const,
    }];
    const errors = validatePrefixSegments(prefix, segs);
    expect(errors.some(e => e.includes("route axis") && e.includes("paymentMethod"))).toBe(true);
  });

  it("에러 — shape가 axis capacity와 불일치 (catalog 검증)", () => {
    // axisVersions 키는 label(orderType)이지 axisId(order_type)가 아님
    const prefixWithLabel: PrefixDef = {
      ...prefix,
      versions: [{ version: "v1", axisVersions: { orderType: "v1", paymentMethod: "v1" } }],
    };
    const catalog: Catalog = {
      id: "test-catalog", name: "test",
      axes: {
        order_type: { id: "order_type", name: "주문유형", versions: { v1: { entries: ["normal", "express", "sub"] } } },
        payment_method: { id: "payment_method", name: "결제수단", versions: { v1: { entries: ["card", "bank", "crypto", "point"] } } },
      },
      prefixes: { test: prefixWithLabel },
    };

    const segs = chainSegments([
      { segmentId: "s1", consumes: ["orderType", "paymentMethod"], shape: [3, 5] }, // 5 ≠ 4
    ]);
    const errors = validatePrefixSegments(prefixWithLabel, segs, catalog, "v1");
    expect(errors.some(e => e.includes("shape") && e.includes("paymentMethod") && e.includes("4"))).toBe(true);
  });

  it("정상 — shape가 axis capacity와 일치", () => {
    const prefixWithLabel: PrefixDef = {
      ...prefix,
      versions: [{ version: "v1", axisVersions: { orderType: "v1", paymentMethod: "v1" } }],
    };
    const catalog: Catalog = {
      id: "test-catalog", name: "test",
      axes: {
        order_type: { id: "order_type", name: "주문유형", versions: { v1: { entries: ["normal", "express", "sub"] } } },
        payment_method: { id: "payment_method", name: "결제수단", versions: { v1: { entries: ["card", "bank", "crypto", "point"] } } },
      },
      prefixes: { test: prefixWithLabel },
    };

    const segs = chainSegments([
      { segmentId: "s1", consumes: ["orderType", "paymentMethod"], shape: [3, 4] },
    ]);
    const errors = validatePrefixSegments(prefixWithLabel, segs, catalog, "v1");
    expect(errors).toHaveLength(0);
  });

  it("에러 — route value가 shape 범위 초과", () => {
    const segs = [{
      segmentId: "s1",
      consumes: ["orderType"] as readonly string[],
      shape: [3] as readonly number[],
      addressOffset: 0,
      size: 3,
      routes: [
        { when: { axis: "orderType", eq: 5 }, transition: { eventKey: "x" } }, // 5 ≥ 3
      ] as const,
    }];
    const errors = validatePrefixSegments(prefix, segs);
    expect(errors.some(e => e.includes("route") && e.includes("≥"))).toBe(true);
  });
});

// ── validateManifestSegments ────────────────────────

describe("validateManifestSegments", () => {
  it("정상 — sum prefix의 segments 유효", () => {
    const segs = chainSegments([
      { segmentId: "s1", consumes: ["orderType"], shape: [3] },
    ]);
    const catalog: Catalog = {
      id: "cat", name: "cat",
      axes: { order_type: { id: "order_type", name: "", versions: { v1: { entries: ["a", "b", "c"] } } } },
      prefixes: {
        order: {
          id: "order", name: "", labels: ["orderType"],
          dims: { orderType: { kind: "axis", axisId: "order_type" } },
          versions: [{ version: "v1", axisVersions: { order_type: "v1" }, segments: segs }],
          addressModel: "sum",
        },
      },
    };
    expect(validateManifestSegments(catalog, { order: "v1" })).toHaveLength(0);
  });

  it("에러 — sum prefix인데 segments 없음", () => {
    const catalog: Catalog = {
      id: "cat", name: "cat", axes: {},
      prefixes: {
        order: {
          id: "order", name: "", labels: [],
          dims: {},
          versions: [{ version: "v1", axisVersions: {} }],
          addressModel: "sum",
        },
      },
    };
    const errors = validateManifestSegments(catalog, { order: "v1" });
    expect(errors.some(e => e.includes("segments 없음"))).toBe(true);
  });

  it("product prefix는 검증 건너뜀", () => {
    const catalog: Catalog = {
      id: "cat", name: "cat", axes: {},
      prefixes: {
        tracking: {
          id: "tracking", name: "", labels: ["a"],
          dims: { a: { kind: "axis", axisId: "a" } },
          versions: [{ version: "v1", axisVersions: { a: "v1" } }],
          // addressModel 미선언 = product
        },
      },
    };
    expect(validateManifestSegments(catalog, { tracking: "v1" })).toHaveLength(0);
  });
});

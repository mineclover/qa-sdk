// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { DEMO_DKG_CONFIG } from "demo-dkg-config";
import { bootstrapDkg } from "dkg-enrichment";
import { recordDecision, recordObservation } from "./record-operation.js";

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

describe("recordDecision", () => {
  it("대상 없으면 blocked", () => {
    const result = recordDecision(graph, {
      targetId: "nonexistent",
      type: "capacity",
      title: "test",
      rationale: "test",
    });
    expect(result.verdict).toBe("blocked");
    expect(result.decision).toBeNull();
  });

  it("유효하지 않은 type이면 blocked", () => {
    const result = recordDecision(graph, {
      targetId: "order_event",
      type: "invalid" as any,
      title: "test",
      rationale: "test",
    });
    expect(result.verdict).toBe("blocked");
  });

  it("유효한 입력이면 Decision 노드 반환", () => {
    const result = recordDecision(graph, {
      targetId: "order_event",
      type: "dim-add",
      title: "테스트 결정",
      rationale: "테스트 근거",
    });
    expect(result.verdict).toBe("ok");
    expect(result.decision).not.toBeNull();
    expect(result.decision!.kind).toBe("decision");
    expect(result.decision!.title).toBe("테스트 결정");
    expect(result.decision!.rationale).toBe("테스트 근거");
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].type).toBe("governs");
    expect(result.edges[0].to).toBe("order_event");
  });

  it("scaffoldDecision의 alternatives가 포함됨", () => {
    const result = recordDecision(graph, {
      targetId: "order_event",
      type: "dim-add",
      title: "t",
      rationale: "r",
    });
    expect(result.decision!.alternatives!.length).toBeGreaterThan(0);
  });

  it("추가 alternatives를 scaffold alternatives에 병합한다", () => {
    const result = recordDecision(graph, {
      targetId: "order_event",
      type: "dim-add",
      title: "t",
      rationale: "r",
      alternatives: ["수동 대안 A", "수동 대안 B"],
    });
    expect(result.decision!.alternatives).toEqual(
      expect.arrayContaining(["수동 대안 A", "수동 대안 B"]),
    );
  });
});

describe("recordObservation", () => {
  it("대상 없으면 blocked", () => {
    const result = recordObservation(graph, {
      targetId: "nonexistent",
      finding: "test",
    });
    expect(result.verdict).toBe("blocked");
    expect(result.observation).toBeNull();
  });

  it("유효한 입력이면 Observation 노드 반환", () => {
    const result = recordObservation(graph, {
      targetId: "permission",
      finding: "role 축 headroom 감소 추세",
    });
    expect(result.verdict).toBe("ok");
    expect(result.observation).not.toBeNull();
    expect(result.observation!.kind).toBe("observation");
    expect(result.observation!.source).toBe("manual");
    expect(result.observation!.finding).toBe("role 축 headroom 감소 추세");
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].to).toBe("permission");
  });

  it("suggestion 포함 가능", () => {
    const result = recordObservation(graph, {
      targetId: "permission",
      finding: "test",
      suggestion: { kind: "add-entry", axis: "role", entry: "viewer" },
    });
    expect(result.observation!.suggestion).toEqual({
      kind: "add-entry",
      axis: "role",
      entry: "viewer",
    });
  });
});

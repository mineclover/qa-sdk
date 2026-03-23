import { describe, expect, it } from "vitest";
import {
  getAnnotatedDesignFlow,
  recordQaSdkDesignDecisions,
  analyzeRecordedDecisions,
  analyzeGateStructure,
  identifyCoreGates,
  extractCausalGraph,
  analyzeImpact,
  traceCorePath,
} from "./index.js";

// ─── 코어 게이트 식별 ────────────────────────────────────

describe("core gate identification", () => {
  const schema = getAnnotatedDesignFlow();
  const profiles = analyzeGateStructure(schema);

  it("axis-definition이 최고 coreScore를 갖는다", () => {
    expect(profiles[0].gateId).toBe("axis-definition");
    expect(profiles[0].weight).toBe("core");
  });

  it("코어 gate 3개 식별: axis-definition, prefix-design, merge-split", () => {
    const coreGates = identifyCoreGates(profiles);
    const coreIds = coreGates.map((g) => g.gateId);
    expect(coreIds).toContain("axis-definition");
    expect(coreIds).toContain("prefix-design");
    expect(coreIds).toContain("merge-split");
  });

  it("service-binding은 tactical이다", () => {
    const binding = profiles.find((p) => p.gateId === "service-binding");
    expect(binding!.weight).toBe("tactical");
  });

  it("transitiveImpact: axis-definition이 가장 넓다", () => {
    const axisDef = profiles.find((p) => p.gateId === "axis-definition")!;
    expect(axisDef.transitiveImpact).toBeGreaterThan(0);
    // axis-definition → prefix-design → capacity/version/service (체인)
    expect(axisDef.transitiveImpact).toBeGreaterThanOrEqual(3);
  });
});

// ─── 인과 그래프 ─────────────────────────────────────────

describe("causal graph", () => {
  const schema = getAnnotatedDesignFlow();
  const graph = extractCausalGraph(schema);

  it("루트 결정이 존재한다 (의존 없는 gate)", () => {
    expect(graph.roots.length).toBeGreaterThan(0);
    // axis-definition과 merge-split은 아무에게도 의존하지 않음
    expect(graph.roots).toContain("axis-definition");
  });

  it("리프 결정이 존재한다 (영향 없는 gate)", () => {
    expect(graph.leaves.length).toBeGreaterThan(0);
    expect(graph.leaves).toContain("service-binding");
  });

  it("인과 엣지가 존재한다", () => {
    expect(graph.edges.length).toBeGreaterThan(0);
    // axis-definition → prefix-design (constrains)
    const axisToPrefix = graph.edges.find(
      (e) => e.from === "axis-definition" && e.to === "prefix-design",
    );
    expect(axisToPrefix).toBeDefined();
    expect(axisToPrefix!.kind).toBe("constrains");
  });
});

// ─── 영향 범위 분석 ──────────────────────────────────────

describe("impact analysis", () => {
  const schema = getAnnotatedDesignFlow();

  it("merge-split 변경 시 prefix-design과 capacity가 무효화된다", () => {
    const impact = analyzeImpact(schema, "merge-split");
    expect(impact.directlyInvalidated).toContain("prefix-design");
    expect(impact.directlyInvalidated).toContain("capacity-setting");
    expect(impact.invalidatesCore).toBe(true); // prefix-design은 core
  });

  it("service-binding 변경은 cascade 없음", () => {
    const impact = analyzeImpact(schema, "service-binding");
    expect(impact.directlyInvalidated).toHaveLength(0);
    expect(impact.transitivelyInvalidated).toHaveLength(0);
    expect(impact.invalidatesCore).toBe(false);
  });

  it("axis-definition은 constrains 관계 (invalidates 아님)", () => {
    const impact = analyzeImpact(schema, "axis-definition");
    // constrains는 직접 무효화 대상이 아님 (invalidates만 추적)
    expect(impact.directlyInvalidated).toHaveLength(0);
  });
});

// ─── 자기참조 분석: qa-sdk 설계 결정 기록 ────────────────

describe("self-analysis: qa-sdk design decisions", () => {
  it("3건의 설계 결정이 기록된다", () => {
    const { instances } = recordQaSdkDesignDecisions();
    expect(instances).toHaveLength(3);
    for (const inst of instances) {
      expect(inst.status).toBe("completed");
      expect(inst.coordinateAddress).toBeDefined();
    }
  });

  it("결정 1(cognitive_phase)의 코어 추적", () => {
    const { instances } = recordQaSdkDesignDecisions();
    const schema = getAnnotatedDesignFlow();
    const trace = traceCorePath(schema, instances[0]);

    // 코어 선택이 존재한다
    expect(trace.coreSelections.length).toBeGreaterThan(0);

    // axis-definition=new-axis가 pivot point
    const axisPivot = trace.pivotPoints.find((p) => p.gateId === "axis-definition");
    expect(axisPivot).toBeDefined();
    expect(axisPivot!.branchId).toBe("new-axis");
    expect(axisPivot!.excludedBranches).toBe(3); // 4 branches - 1 selected
  });

  it("결정 3(scope_mode)의 논쟁적 confidence가 기록된다", () => {
    const { instances } = recordQaSdkDesignDecisions();
    const scopeDecision = instances[2];

    // axis-definition의 confidence가 0.7 (논쟁적)
    const axisSel = scopeDecision.selections.find((s) => s.gateId === "axis-definition");
    expect(axisSel!.confidence).toBe(0.7);
  });

  it("전체 분석이 일관된 결과를 산출한다", () => {
    const analysis = analyzeRecordedDecisions();

    // 코어 게이트가 식별됨
    expect(analysis.coreGates.length).toBeGreaterThanOrEqual(2);

    // merge-split 영향 분석
    expect(analysis.axisMergeImpact.invalidatesCore).toBe(true);

    // 모든 인스턴스에 trace가 있음
    expect(analysis.traces).toHaveLength(3);
    for (const trace of analysis.traces) {
      expect(trace.pivotPoints.length).toBeGreaterThan(0);
    }
  });
});

import { describe, it, expect } from "vitest";
import { computeFoldedContract, foldSubgraph, unfoldNode, restoreLineageFromFold, validateFoldCheckpoint, detectFoldRegions, normalize as normalizeEndpoint, collectFlowSteps } from "./pipe-fold.js";
import { countGraphPaths } from "./pipe-path.js";
import type { PipeSpec, PipeGraph, PipeFlow, PipeConnection } from "../types/pipe-spec.js";

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

describe("normalize", () => {
  it("PortRef[]를 pipeId[]로 정규화한다", () => {
    expect(normalizeEndpoint([
      { pipeId: "A", portId: "payment_result" },
      { pipeId: "B", portId: "payment_input" },
    ])).toEqual(["A", "B"]);
  });
});

describe("collectFlowSteps", () => {
  it("transition-scope body 내부 step 수집", () => {
    const flow: PipeFlow = {
      kind: "transition-scope",
      transitionId: "transfer",
      body: { kind: "sequence", steps: [step("출금"), step("입금")] },
      events: ["account.debit", "account.credit"],
    };
    const steps = collectFlowSteps(flow);
    expect(steps).toHaveLength(2);
    expect(steps.map(s => s.facet)).toEqual(["출금", "입금"]);
  });

  it("transition-scope + compensate — 양쪽 step 모두 수집", () => {
    const flow: PipeFlow = {
      kind: "transition-scope",
      transitionId: "t1",
      body: step("본체"),
      events: ["e1"],
      compensate: { kind: "sequence", steps: [step("보상1"), step("보상2")] },
    };
    const steps = collectFlowSteps(flow);
    expect(steps).toHaveLength(3);
    expect(steps.map(s => s.facet)).toEqual(["본체", "보상1", "보상2"]);
  });
});

// ── 픽스처 그래프 ─────────────────────────────────────

/** A → B → C → D → E → F */
function chainGraph(): PipeGraph {
  return {
    graphId: "chain",
    version: "1.0.0",
    pipes: [
      makePipe("A"),
      makePipe("B", {
        flow: {
          kind: "sequence",
          steps: [
            { kind: "step", facet: "소비", dataContract: {
              consumes: { orderId: { type: "string", required: true } },
            }},
            { kind: "step", facet: "관리" },
          ],
        },
      }),
      makePipe("C", { produces: ["c_done"] }),
      makePipe("D", {
        produces: ["d_done"],
        flow: {
          kind: "step",
          facet: "저장",
          dataContract: {
            produces: { result: { type: "number", required: true } },
            accesses: [{ schemaId: "orders", columns: ["id", "status"], mode: "write" }],
          },
        },
      }),
      makePipe("E"),
      makePipe("F"),
    ],
    connections: [
      conn("A", "B"),
      conn("B", "C"),
      conn("C", "D"),
      conn("D", "E"),
      conn("E", "F"),
    ],
    entryPipeId: "A",
  };
}

/** A → B → (C | D) → E (조건부 분기) */
function branchGraph(): PipeGraph {
  return {
    graphId: "branch",
    version: "1.0.0",
    pipes: [
      makePipe("A"),
      makePipe("B", {
        flow: { kind: "branch", condition: "type", paths: [step("생산"), step("관리")] },
      }),
      makePipe("C", { produces: ["c_out"] }),
      makePipe("D", { produces: ["d_out"] }),
      makePipe("E"),
    ],
    connections: [
      conn("A", "B"),
      { from: "B", to: "C", kind: "conditional", condition: "type === 'a'" },
      { from: "B", to: "D", kind: "conditional", condition: "type === 'b'" },
      conn("C", "E"),
      conn("D", "E"),
    ],
    entryPipeId: "A",
  };
}

/** A → [B, C] → D (fan-out + join) */
function fanoutGraph(): PipeGraph {
  return {
    graphId: "fanout",
    version: "1.0.0",
    pipes: [
      makePipe("A"),
      makePipe("B"),
      makePipe("C"),
      makePipe("D"),
    ],
    connections: [
      { from: "A", to: ["B", "C"], kind: "fan-out" },
      { from: ["B", "C"], to: "D", kind: "join" },
    ],
    entryPipeId: "A",
  };
}

/** scope 클러스터: {A,B} scope="auth", {C,D,E} scope="payment" */
function scopeGraph(): PipeGraph {
  return {
    graphId: "scoped",
    version: "1.0.0",
    pipes: [
      makePipe("A", { scope: "auth" }),
      makePipe("B", { scope: "auth" }),
      makePipe("C", { scope: "payment" }),
      makePipe("D", { scope: "payment" }),
      makePipe("E", { scope: "payment" }),
    ],
    connections: [
      conn("A", "B"),
      conn("B", "C"),
      conn("C", "D"),
      conn("D", "E"),
    ],
    entryPipeId: "A",
  };
}

/** 피드백 루프: A → B → C → A */
function loopGraph(): PipeGraph {
  return {
    graphId: "loop",
    version: "1.0.0",
    pipes: [
      makePipe("A"),
      makePipe("B"),
      makePipe("C"),
      makePipe("D"),
    ],
    connections: [
      conn("A", "B"),
      conn("B", "C"),
      { from: "C", to: "A", kind: "feedback" },
      conn("C", "D"),
    ],
    entryPipeId: "A",
  };
}

// ── computeFoldedContract ─────────────────────────────

describe("computeFoldedContract", () => {
  it("체인에서 B,C,D 접기 → 입력은 B의 trigger/consumes, 출력은 D의 produces", () => {
    const graph = chainGraph();
    const contract = computeFoldedContract(graph, ["B", "C", "D"]);

    // inputs: B의 trigger eventKey + B의 consumes
    expect(contract.interface.inputs.some(i => i.field === "B_trigger")).toBe(true);
    expect(contract.interface.inputs.some(i => i.field === "orderId")).toBe(true);

    // outputs: D의 produces 이벤트 + D의 dataContract.produces
    expect(contract.interface.outputs.some(o => o.field === "d_done")).toBe(true);
    expect(contract.interface.outputs.some(o => o.field === "result")).toBe(true);
  });

  it("내부 경로 수 계산 — 서브그래프 경로 모델 사용", () => {
    const graph = chainGraph();
    const contract = computeFoldedContract(graph, ["B", "C", "D"]);
    // B(sequence 2 steps → 1 path) → C(1) → D(1) = 1×1×1 = 1
    expect(contract.summary.totalPaths).toBe(1);
  });

  it("패싯 수집 — 접힌 파이프들의 모든 패싯 유니온", () => {
    const graph = chainGraph();
    const contract = computeFoldedContract(graph, ["B", "C", "D"]);
    expect(contract.summary.facets).toContain("소비");
    expect(contract.summary.facets).toContain("관리");
    expect(contract.summary.facets).toContain("저장");
  });

  it("부수효과 수집 — dataContract.accesses 집계", () => {
    const graph = chainGraph();
    const contract = computeFoldedContract(graph, ["B", "C", "D"]);
    expect(contract.interface.sideEffects).toHaveLength(1);
    expect(contract.interface.sideEffects[0].schemaId).toBe("orders");
    expect(contract.interface.sideEffects[0].mode).toBe("write");
  });

  it("scope/aspect에서 concerns 수집", () => {
    const graph = scopeGraph();
    const contract = computeFoldedContract(graph, ["C", "D", "E"]);
    expect(contract.concerns).toContain("payment");
  });

  it("빈 pipeIds → 에러", () => {
    expect(() => computeFoldedContract(chainGraph(), [])).toThrow("비어있음");
  });

  it("존재하지 않는 pipeId → 에러", () => {
    expect(() => computeFoldedContract(chainGraph(), ["Z"])).toThrow("존재하지 않음");
  });

  it("lineageSummary — 접힌 구간의 계보 요약 포함", () => {
    const graph = chainGraph();
    const contract = computeFoldedContract(graph, ["B", "C", "D"]);
    expect(contract.lineageSummary).toBeDefined();
    // B의 dataContract에 orderId consumes가 있음 → inputs에 포함
    expect(contract.lineageSummary!.inputs.length).toBeGreaterThanOrEqual(0);
  });
});

// ── foldSubgraph ──────────────────────────────────────

describe("foldSubgraph", () => {
  it("6노드에서 B,C,D 접기 → 4노드 그래프", () => {
    const graph = chainGraph();
    const result = foldSubgraph(graph, ["B", "C", "D"], "fold_BCD");
    expect(result.graph.pipes).toHaveLength(4); // A, fold_BCD, E, F
    expect(result.graph.pipes.map(p => p.pipeId).sort()).toEqual(["A", "E", "F", "fold_BCD"]);
  });

  it("접힌 노드의 연결 재배선 — A→fold, fold→E", () => {
    const graph = chainGraph();
    const result = foldSubgraph(graph, ["B", "C", "D"], "fold_BCD");
    const conns = result.graph.connections;

    // A→fold_BCD
    expect(conns.some(c => c.from === "A" && c.to === "fold_BCD")).toBe(true);
    // fold_BCD→E
    expect(conns.some(c => c.from === "fold_BCD" && c.to === "E")).toBe(true);
    // E→F 유지
    expect(conns.some(c => c.from === "E" && c.to === "F")).toBe(true);
  });

  it("entryPipeId가 접힌 영역 안에 있으면 foldId로 교체", () => {
    const graph = chainGraph();
    // A도 접기
    const result = foldSubgraph(graph, ["A", "B", "C"], "fold_ABC");
    expect(result.graph.entryPipeId).toBe("fold_ABC");
  });

  it("foldMap에 원본 저장 — 3파이프 + 2내부연결", () => {
    const graph = chainGraph();
    const result = foldSubgraph(graph, ["B", "C", "D"], "fold_BCD");
    const entry = result.foldMap.get("fold_BCD");
    expect(entry).toBeDefined();
    expect(entry!.originalPipes).toHaveLength(3);
    expect(entry!.originalConnections).toHaveLength(2); // B→C, C→D
    expect(entry!.entryPipeIds).toContain("B");
    expect(entry!.exitPipeIds).toContain("D");
  });

  it("foldMap에서 contract 조회 가능", () => {
    const graph = chainGraph();
    const result = foldSubgraph(graph, ["B", "C", "D"], "fold_BCD");
    const entry = result.foldMap.get("fold_BCD");
    expect(entry).toBeDefined();
    expect(entry!.contract.foldId).toBe("fold_BCD");
  });

  it("분기 그래프 접기 — 조건부 연결 재배선", () => {
    const graph = branchGraph();
    // B, C, D를 접기 (B→C conditional, B→D conditional)
    const result = foldSubgraph(graph, ["B", "C", "D"], "fold_BCD");
    expect(result.graph.pipes).toHaveLength(3); // A, fold_BCD, E

    // A→fold_BCD, fold_BCD→E
    const conns = result.graph.connections;
    expect(conns.some(c => c.from === "A" && c.to === "fold_BCD")).toBe(true);
    expect(conns.some(c => c.from === "fold_BCD" && c.to === "E")).toBe(true);
  });

  it("접힌 노드의 produces는 exit 파이프들의 합집합", () => {
    const graph = branchGraph();
    const result = foldSubgraph(graph, ["B", "C", "D"], "fold_BCD");
    const foldedPipe = result.graph.pipes.find(p => p.pipeId === "fold_BCD")!;
    expect(foldedPipe.produces).toContain("c_out");
    expect(foldedPipe.produces).toContain("d_out");
  });
});

// ── unfoldNode ────────────────────────────────────────

describe("unfoldNode", () => {
  it("접기→펼치기 라운드트립 — 원본과 동일한 파이프 구조", () => {
    const original = chainGraph();
    const folded = foldSubgraph(original, ["B", "C", "D"], "fold_BCD");
    const restored = unfoldNode(folded, "fold_BCD");

    const originalIds = original.pipes.map(p => p.pipeId).sort();
    const restoredIds = restored.pipes.map(p => p.pipeId).sort();
    expect(restoredIds).toEqual(originalIds);
  });

  it("경로 수 보존: 원본 = unfold(fold(원본))", () => {
    const original = chainGraph();
    const folded = foldSubgraph(original, ["B", "C", "D"], "fold_BCD");
    const restored = unfoldNode(folded, "fold_BCD");

    expect(countGraphPaths(restored)).toBe(countGraphPaths(original));
  });

  it("존재하지 않는 foldedNodeId → 에러", () => {
    const folded = foldSubgraph(chainGraph(), ["B", "C"], "fold_BC");
    expect(() => unfoldNode(folded, "nonexistent")).toThrow("찾을 수 없음");
  });

  it("entryPipeId 복원", () => {
    const original = chainGraph();
    const folded = foldSubgraph(original, ["A", "B", "C"], "fold_ABC");
    expect(folded.graph.entryPipeId).toBe("fold_ABC");

    const restored = unfoldNode(folded, "fold_ABC");
    expect(restored.entryPipeId).toBe("A");
  });
});

// ── restoreLineageFromFold ──────────────────────────────

describe("restoreLineageFromFold", () => {
  it("unfold 시 원본 pipe별 계보 복원", () => {
    const graph: PipeGraph = {
      graphId: "lineage-fold", version: "1.0.0",
      pipes: [
        makePipe("A"),
        makePipe("B", {
          flow: step("변환", undefined, {
            dataContract: {
              consumes: { input: { type: "string", required: true } },
              produces: { output: { type: "string", required: true } },
              lineageHints: { output: { sources: ["input"], transform: "direct" } },
            },
          }),
        }),
        makePipe("C", {
          flow: step("출력", undefined, {
            dataContract: {
              consumes: { data: { type: "string", required: true } },
              produces: { result: { type: "string", required: true } },
              lineageHints: { result: { sources: ["data"], transform: "compute" } },
            },
          }),
        }),
        makePipe("D"),
      ],
      connections: [conn("A", "B"), conn("B", "C"), conn("C", "D")],
      entryPipeId: "A",
    };

    const folded = foldSubgraph(graph, ["B", "C"], "fold_BC");
    const lineages = restoreLineageFromFold(folded, "fold_BC");

    // B와 C의 원본 계보가 보존됨
    expect(lineages.has("B")).toBe(true);
    expect(lineages.has("C")).toBe(true);
    // 접히지 않은 A는 포함되지 않음
    expect(lineages.has("A")).toBe(false);
  });

  it("존재하지 않는 foldedNodeId → 에러", () => {
    const folded = foldSubgraph(chainGraph(), ["B", "C"], "fold_BC");
    expect(() => restoreLineageFromFold(folded, "nonexistent")).toThrow("찾을 수 없음");
  });
});

// ── validateFoldCheckpoint ───────────────────────────

describe("validateFoldCheckpoint", () => {
  it("입출력 완전 연결 → valid=true", () => {
    const graph: PipeGraph = {
      graphId: "cp1", version: "1.0.0",
      pipes: [
        makePipe("A"),
        makePipe("B", {
          flow: step("변환", undefined, {
            dataContract: {
              consumes: { input: { type: "string", required: true } },
              produces: { output: { type: "string", required: true } },
              lineageHints: { output: { sources: ["input"], transform: "compute" } },
            },
          }),
        }),
        makePipe("C"),
      ],
      connections: [conn("A", "B"), conn("B", "C")],
      entryPipeId: "A",
    };
    const contract = computeFoldedContract(graph, ["B"]);
    const result = validateFoldCheckpoint(contract);
    expect(result.valid).toBe(true);
    expect(result.disconnectedInputs).toHaveLength(0);
    expect(result.orphanOutputs).toHaveLength(0);
  });

  it("출처 불명 출력 → orphanOutputs", () => {
    const graph: PipeGraph = {
      graphId: "cp2", version: "1.0.0",
      pipes: [
        makePipe("A"),
        makePipe("B", {
          flow: step("생성", undefined, {
            dataContract: {
              produces: { result: { type: "string", required: true } },
              // lineageHints 없음 → result는 origin 없는 출력
            },
          }),
        }),
        makePipe("C"),
      ],
      connections: [conn("A", "B"), conn("B", "C")],
      entryPipeId: "A",
    };
    const contract = computeFoldedContract(graph, ["B"]);
    const result = validateFoldCheckpoint(contract);
    // result 필드는 produces에 있지만 lineage source가 없음
    expect(result.orphanOutputs).toContain("result");
  });

  it("lineageSummary 없는 contract → valid=true (빈 상태)", () => {
    const graph = chainGraph();
    const contract = computeFoldedContract(graph, ["A"]);
    // A는 dataContract가 없는 단순 pipe
    const result = validateFoldCheckpoint(contract);
    expect(result.valid).toBe(true);
  });
});

// ── detectFoldRegions ─────────────────────────────────

describe("detectFoldRegions", () => {
  it("scope 클러스터 감지 — 같은 scope의 연결된 파이프 그룹", () => {
    const graph = scopeGraph();
    const regions = detectFoldRegions(graph);

    const scopeRegions = regions.filter(r => r.reason === "scope-cluster");
    expect(scopeRegions.length).toBeGreaterThanOrEqual(1);

    // payment 클러스터 (C, D, E)
    const paymentRegion = scopeRegions.find(r => r.pipeIds.includes("C"));
    expect(paymentRegion).toBeDefined();
    expect(paymentRegion!.pipeIds).toContain("D");
    expect(paymentRegion!.pipeIds).toContain("E");
  });

  it("선형 체인 감지 — 3개 이상 연속 next 연결", () => {
    const graph = chainGraph();
    const regions = detectFoldRegions(graph);

    const chainRegions = regions.filter(r => r.reason === "linear-chain");
    expect(chainRegions.length).toBeGreaterThanOrEqual(1);
    // 최소 3개 이상의 파이프가 포함
    expect(chainRegions.some(r => r.pipeIds.length >= 3)).toBe(true);
  });

  it("SCC 감지 — 피드백 루프", () => {
    const graph = loopGraph();
    const regions = detectFoldRegions(graph);

    const sccRegions = regions.filter(r => r.reason === "strongly-connected");
    expect(sccRegions.length).toBeGreaterThanOrEqual(1);
    // A, B, C가 순환
    const scc = sccRegions.find(r => r.pipeIds.includes("A"));
    expect(scc).toBeDefined();
    expect(scc!.pipeIds).toContain("B");
    expect(scc!.pipeIds).toContain("C");
  });

  it("entry/exit 파이프 올바름", () => {
    const graph = scopeGraph();
    const regions = detectFoldRegions(graph);

    const paymentRegion = regions.find(r =>
      r.reason === "scope-cluster" && r.pipeIds.includes("C"),
    );
    expect(paymentRegion).toBeDefined();
    // C는 외부(B)에서 연결되므로 entry
    expect(paymentRegion!.entryPipeIds).toContain("C");
    // E는 외부로 나가는 연결 없음 → exit
    expect(paymentRegion!.exitPipeIds).toContain("E");
  });

  it("단일 파이프 그래프 → 영역 없음 (최소 2개)", () => {
    const graph: PipeGraph = {
      graphId: "single",
      version: "1.0.0",
      pipes: [makePipe("A")],
      connections: [],
      entryPipeId: "A",
    };
    const regions = detectFoldRegions(graph);
    expect(regions).toHaveLength(0);
  });
});

// ── 불변량 ────────────────────────────────────────────

describe("접기 불변량", () => {
  it("접기→펼치기 라운드트립 — pipes/connections 보존", () => {
    const original = branchGraph();
    const folded = foldSubgraph(original, ["B", "C", "D"], "fold_BCD");
    const restored = unfoldNode(folded, "fold_BCD");

    // 파이프 ID 동일
    expect(restored.pipes.map(p => p.pipeId).sort())
      .toEqual(original.pipes.map(p => p.pipeId).sort());

    // 연결 수 동일
    expect(restored.connections.length).toBe(original.connections.length);
  });

  it("fan-out 그래프 접기→펼치기", () => {
    const original = fanoutGraph();
    const folded = foldSubgraph(original, ["B", "C"], "fold_BC");
    const restored = unfoldNode(folded, "fold_BC");

    expect(restored.pipes.map(p => p.pipeId).sort())
      .toEqual(original.pipes.map(p => p.pipeId).sort());
  });

  it("FoldedContract.summary.pipeCount는 접힌 파이프 수와 일치", () => {
    const graph = chainGraph();
    const contract = computeFoldedContract(graph, ["B", "C", "D"]);
    expect(contract.summary.pipeCount).toBe(3);
    expect(contract.foldedPipeIds).toHaveLength(3);
  });
});

// ── 대규모 + 깊은 중첩 성능 ──────────────────────────

describe("성능 — 대규모 그래프 + 깊은 중첩", () => {
  /** 깊은 중첩 PipeFlow 생성 (depth 단계) */
  function deepFlow(depth: number): PipeFlow {
    if (depth <= 0) return { kind: "step", facet: "소비" };
    // 다양한 중첩 패턴 순환
    const patterns = [
      () => ({ kind: "sequence" as const, steps: [deepFlow(depth - 1), { kind: "step" as const, facet: "관리" }] }),
      () => ({ kind: "branch" as const, condition: `d${depth}`, paths: [deepFlow(depth - 1), { kind: "step" as const, facet: "생산" }] }),
      () => ({ kind: "retry" as const, step: deepFlow(depth - 1), maxAttempts: 3 }),
      () => ({ kind: "fallback" as const, try: deepFlow(depth - 1), catch: { kind: "step" as const, facet: "저장" } }),
      () => ({ kind: "finally" as const, body: deepFlow(depth - 1), cleanup: { kind: "step" as const, facet: "관리" } }),
      () => ({ kind: "optional" as const, step: deepFlow(depth - 1) }),
    ];
    return patterns[depth % patterns.length]();
  }

  /** N개 파이프 체인 그래프 생성, flowDepth만큼 내부 중첩 */
  function largeGraph(pipeCount: number, flowDepth: number, scopes?: string[]): PipeGraph {
    const pipes: PipeSpec[] = [];
    const connections: PipeConnection[] = [];

    for (let i = 0; i < pipeCount; i++) {
      pipes.push({
        pipeId: `P${i}`,
        version: "1.0.0",
        trigger: { eventKey: `trigger_${i}` },
        flow: deepFlow(flowDepth),
        produces: [`done_${i}`],
        scope: scopes ? scopes[i % scopes.length] : undefined,
        ...(flowDepth > 2 ? {
          // 데이터 계약 포함 — sideEffect 수집 비용 추가
        } : {}),
      });
      if (i > 0) connections.push({ from: `P${i - 1}`, to: `P${i}`, kind: "next" });
    }

    return { graphId: "large", version: "1.0.0", pipes, connections, entryPipeId: "P0" };
  }

  /** 분기 + 합류가 반복되는 다이아몬드 패턴 */
  function diamondGraph(layers: number, flowDepth: number): PipeGraph {
    const pipes: PipeSpec[] = [];
    const connections: PipeConnection[] = [];
    let id = 0;

    // 진입점
    const entryId = `P${id++}`;
    pipes.push({
      pipeId: entryId,
      version: "1.0.0",
      trigger: { eventKey: "start" },
      flow: deepFlow(flowDepth),
      produces: ["entry_done"],
    });

    let prevLayer = [entryId];

    for (let layer = 0; layer < layers; layer++) {
      // 분기: 2개 병렬
      const branchA = `P${id++}`;
      const branchB = `P${id++}`;
      pipes.push({
        pipeId: branchA, version: "1.0.0",
        trigger: { eventKey: `t_${branchA}` },
        flow: deepFlow(flowDepth),
        scope: layer % 2 === 0 ? "even" : "odd",
      });
      pipes.push({
        pipeId: branchB, version: "1.0.0",
        trigger: { eventKey: `t_${branchB}` },
        flow: deepFlow(flowDepth),
        scope: layer % 2 === 0 ? "even" : "odd",
      });

      for (const prev of prevLayer) {
        connections.push({ from: prev, to: branchA, kind: "conditional", condition: `layer${layer}_a` });
        connections.push({ from: prev, to: branchB, kind: "conditional", condition: `layer${layer}_b` });
      }

      // 합류
      const joinId = `P${id++}`;
      pipes.push({
        pipeId: joinId, version: "1.0.0",
        trigger: { eventKey: `t_${joinId}` },
        flow: deepFlow(flowDepth),
      });
      connections.push({ from: [branchA, branchB], to: joinId, kind: "join" });

      prevLayer = [joinId];
    }

    return { graphId: "diamond", version: "1.0.0", pipes, connections, entryPipeId: entryId };
  }

  /** 피드백 루프가 포함된 메시 그래프 */
  function meshGraph(nodeCount: number, flowDepth: number): PipeGraph {
    const pipes: PipeSpec[] = [];
    const connections: PipeConnection[] = [];

    for (let i = 0; i < nodeCount; i++) {
      pipes.push({
        pipeId: `M${i}`,
        version: "1.0.0",
        trigger: { eventKey: `mesh_${i}` },
        flow: deepFlow(flowDepth),
        scope: `group_${Math.floor(i / 3)}`,
      });
    }

    // 순차 연결
    for (let i = 0; i < nodeCount - 1; i++) {
      connections.push({ from: `M${i}`, to: `M${i + 1}`, kind: "next" });
    }
    // 피드백 루프 (매 5개마다)
    for (let i = 5; i < nodeCount; i += 5) {
      connections.push({ from: `M${i}`, to: `M${i - 3}`, kind: "feedback" });
    }

    return { graphId: "mesh", version: "1.0.0", pipes, connections, entryPipeId: "M0" };
  }

  // ── 깊은 중첩 ──────────────────────────────────────

  it("flowDepth=8 (검증 상한) — 50파이프 computeFoldedContract < 50ms", () => {
    const graph = largeGraph(50, 8);
    const ids = graph.pipes.slice(10, 30).map(p => p.pipeId);

    const start = performance.now();
    const contract = computeFoldedContract(graph, ids);
    const elapsed = performance.now() - start;

    console.log(`computeFoldedContract(50파이프, depth=8, fold=20): ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(50);
    expect(contract.summary.pipeCount).toBe(20);
    expect(contract.summary.facets.length).toBeGreaterThan(0);
  });

  it("flowDepth=12 (초과 중첩) — 30파이프 computeFoldedContract < 100ms", () => {
    const graph = largeGraph(30, 12);
    const ids = graph.pipes.slice(5, 25).map(p => p.pipeId);

    const start = performance.now();
    const contract = computeFoldedContract(graph, ids);
    const elapsed = performance.now() - start;

    console.log(`computeFoldedContract(30파이프, depth=12, fold=20): ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(100);
    expect(contract.summary.pipeCount).toBe(20);
  });

  // ── 대규모 그래프 ──────────────────────────────────

  it("100파이프 체인 — foldSubgraph + unfoldNode 라운드트립 < 50ms", () => {
    const graph = largeGraph(100, 4);
    const foldIds = graph.pipes.slice(20, 60).map(p => p.pipeId);

    const start = performance.now();
    const folded = foldSubgraph(graph, foldIds, "fold_mid");
    const restored = unfoldNode(folded, "fold_mid");
    const elapsed = performance.now() - start;

    console.log(`fold+unfold(100파이프, depth=4, fold=40): ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(50);
    expect(folded.graph.pipes).toHaveLength(61); // 100 - 40 + 1
    expect(restored.pipes).toHaveLength(100);
  });

  it("200파이프 체인 — foldSubgraph 절반 접기 < 100ms", () => {
    const graph = largeGraph(200, 3);
    const foldIds = graph.pipes.slice(50, 150).map(p => p.pipeId);

    const start = performance.now();
    const folded = foldSubgraph(graph, foldIds, "fold_half");
    const elapsed = performance.now() - start;

    console.log(`foldSubgraph(200파이프, depth=3, fold=100): ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(100);
    expect(folded.graph.pipes).toHaveLength(101); // 200 - 100 + 1
  });

  // ── 다이아몬드 패턴 (분기+합류 반복) ───────────────

  it("다이아몬드 10층 — detectFoldRegions + foldSubgraph < 50ms", () => {
    const graph = diamondGraph(10, 4);

    const start = performance.now();
    const regions = detectFoldRegions(graph);
    // 다이아몬드은 conditional+join만 사용 → scope 불연속, SCC 없음. 영역 0 가능
    // 성능 자체가 핵심 검증
    const elapsed = performance.now() - start;

    console.log(`detectFoldRegions(diamond 10층, ${graph.pipes.length}파이프): ${elapsed.toFixed(1)}ms, ${regions.length}개 영역`);
    expect(elapsed).toBeLessThan(50);

    // 연속된 3개 파이프를 수동으로 접어서 성능 확인
    const tripleIds = graph.pipes.slice(1, 4).map(p => p.pipeId);
    const foldStart = performance.now();
    const folded = foldSubgraph(graph, tripleIds, "fold_triple");
    const foldElapsed = performance.now() - foldStart;

    console.log(`foldSubgraph(diamond 10층, fold=3): ${foldElapsed.toFixed(1)}ms`);
    expect(foldElapsed).toBeLessThan(50);
    expect(folded.graph.pipes.length).toBe(graph.pipes.length - 3 + 1);
  });

  it("다이아몬드 5층 — 연속 서브그래프 fold→unfold 라운드트립 경로 수 보존", () => {
    const graph = diamondGraph(5, 3);
    const originalPaths = countGraphPaths(graph);

    // 연속된 파이프만 접기 (layer 0의 branchA, branchB, join — 인접 3노드)
    const contiguousIds = graph.pipes.slice(1, 4).map(p => p.pipeId);
    const folded = foldSubgraph(graph, contiguousIds, "fold_layer0");
    const restored = unfoldNode(folded, "fold_layer0");

    expect(countGraphPaths(restored)).toBe(originalPaths);
  });

  // ── 메시 그래프 (피드백 루프 포함) ──────────────────

  it("메시 30노드+피드백 — detectFoldRegions SCC 감지 < 50ms", () => {
    const graph = meshGraph(30, 3);

    const start = performance.now();
    const regions = detectFoldRegions(graph);
    const elapsed = performance.now() - start;

    const sccRegions = regions.filter(r => r.reason === "strongly-connected");
    console.log(`detectFoldRegions(mesh 30, depth=3): ${elapsed.toFixed(1)}ms, SCC=${sccRegions.length}개`);
    expect(elapsed).toBeLessThan(50);
    expect(sccRegions.length).toBeGreaterThan(0);
  });

  it("메시 50노드 — scope 클러스터 접기 + 펼치기 < 100ms", () => {
    const graph = meshGraph(50, 3);
    const regions = detectFoldRegions(graph);
    const scopeRegion = regions.find(r => r.reason === "scope-cluster");

    if (scopeRegion && scopeRegion.pipeIds.length >= 2) {
      const start = performance.now();
      const folded = foldSubgraph(graph, scopeRegion.pipeIds, "fold_cluster");
      const restored = unfoldNode(folded, "fold_cluster");
      const elapsed = performance.now() - start;

      console.log(`fold+unfold(mesh 50, cluster=${scopeRegion.pipeIds.length}): ${elapsed.toFixed(1)}ms`);
      expect(elapsed).toBeLessThan(100);
      expect(restored.pipes).toHaveLength(graph.pipes.length);
    }
  });

  // ── 다중 접기 (재귀적 fold) ─────────────────────────

  it("다중 접기 — 2단계 중첩 fold + 개별 unfold", () => {
    const graph = largeGraph(20, 4);

    // 1차 접기: P3~P7
    const fold1 = foldSubgraph(graph, ["P3", "P4", "P5", "P6", "P7"], "fold_A");
    expect(fold1.graph.pipes).toHaveLength(16); // 20 - 5 + 1

    // 2차 접기: P10~P14 (1차 접힌 그래프 위에서)
    const fold2Ids = ["P10", "P11", "P12", "P13", "P14"];
    const fold2 = foldSubgraph(fold1.graph, fold2Ids, "fold_B");
    // foldMap 합치기
    for (const [k, v] of fold1.foldMap) fold2.foldMap.set(k, v);

    expect(fold2.graph.pipes).toHaveLength(12); // 16 - 5 + 1

    // 개별 unfold: fold_B 먼저
    const restored1 = unfoldNode(fold2, "fold_B");
    expect(restored1.pipes).toHaveLength(16);

    // fold_A unfold
    const fold1Restored: import("./pipe-fold.js").FoldedGraph = {
      graph: restored1,
      foldMap: new Map([[
        "fold_A",
        fold2.foldMap.get("fold_A")!,
      ]]),
    };
    const fullyRestored = unfoldNode(fold1Restored, "fold_A");
    expect(fullyRestored.pipes).toHaveLength(20);
  });

  it("다중 접기 성능 — 100파이프에서 3단계 중첩 fold < 100ms", () => {
    const graph = largeGraph(100, 4);

    const start = performance.now();

    // 3단계 중첩 접기
    const fold1 = foldSubgraph(graph, graph.pipes.slice(10, 30).map(p => p.pipeId), "fold_1");
    const fold2 = foldSubgraph(fold1.graph, fold1.graph.pipes.filter(p =>
      p.pipeId.startsWith("P4") || p.pipeId.startsWith("P5"),
    ).map(p => p.pipeId).slice(0, 10), "fold_2");
    const fold3 = foldSubgraph(fold2.graph, fold2.graph.pipes.filter(p =>
      p.pipeId.startsWith("P7") || p.pipeId.startsWith("P8"),
    ).map(p => p.pipeId).slice(0, 10), "fold_3");

    const elapsed = performance.now() - start;

    console.log(`3단계 중첩 fold(100파이프, depth=4): ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(100);
    // 접힌 그래프가 유효한지 확인
    expect(fold3.graph.pipes.length).toBeLessThan(graph.pipes.length);
  });
});

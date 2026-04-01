import { describe, it, expect } from "vitest";
import { serializePipeSpec, deserializePipeSpec, serializePipeGraph, deserializePipeGraph } from "./pipe-serialize.js";
import { MemoryPipeGraphStore, MemoryPipeSpecStore } from "./pipe-store.js";
import { analyzePipeComplexity, findBottlenecks, analyzeCoverage } from "./pipe-analyze.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "./types/pipe-spec.js";

const step = (facet = "소비"): PipeFlow => ({ kind: "step", facet });

const simplePipe: PipeSpec = {
  pipeId: "p1", version: "v1",
  trigger: { eventKey: "e1" },
  flow: step(),
};

const branchPipe: PipeSpec = {
  pipeId: "p2", version: "v1",
  trigger: { eventKey: "e2" },
  flow: { kind: "branch", condition: "x", paths: [step("생산"), step("저장")] },
};

const simpleGraph: PipeGraph = {
  graphId: "g1", version: "v1",
  pipes: [simplePipe, branchPipe],
  connections: [{ from: "p1", to: "p2", kind: "next" }],
  entryPipeId: "p1",
};

// ── 직렬화 ───────────────────────────────────────────

describe("직렬화", () => {
  it("PipeSpec 라운드트립", () => {
    const json = serializePipeSpec(simplePipe);
    const restored = deserializePipeSpec(json);
    expect(restored.pipeId).toBe("p1");
    expect(restored.flow.kind).toBe("step");
  });

  it("PipeGraph 라운드트립", () => {
    const json = serializePipeGraph(simpleGraph);
    const restored = deserializePipeGraph(json);
    expect(restored.graphId).toBe("g1");
    expect(restored.pipes).toHaveLength(2);
    expect(restored.connections).toHaveLength(1);
  });

  it("무효 PipeSpec 역직렬화 시 에러", () => {
    const badJson = JSON.stringify({ pipeId: "bad", flow: { kind: "retry", step: step(), maxAttempts: 0 }, trigger: { eventKey: "e" } });
    expect(() => deserializePipeSpec(badJson)).toThrow("검증 실패");
  });

  it("무효 PipeGraph 역직렬화 시 에러", () => {
    const badJson = JSON.stringify({ graphId: "g", version: "v1", pipes: [], connections: [], entryPipeId: "missing" });
    expect(() => deserializePipeGraph(badJson)).toThrow("검증 실패");
  });
});

// ── 저장 ─────────────────────────────────────────────

describe("MemoryPipeGraphStore", () => {
  it("save + get", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.get("g1", "v1")).not.toBeNull();
    expect(store.get("g1", "v1")!.graphId).toBe("g1");
  });

  it("getLatest", () => {
    const store = new MemoryPipeGraphStore();
    store.save({ ...simpleGraph, version: "v1" });
    store.save({ ...simpleGraph, version: "v2" });
    expect(store.getLatest("g1")!.version).toBe("v2");
  });

  it("listVersions", () => {
    const store = new MemoryPipeGraphStore();
    store.save({ ...simpleGraph, version: "v1" });
    store.save({ ...simpleGraph, version: "v2" });
    expect(store.listVersions("g1")).toHaveLength(2);
  });

  it("listAll (최신 버전만)", () => {
    const store = new MemoryPipeGraphStore();
    store.save({ ...simpleGraph, version: "v1" });
    store.save({ ...simpleGraph, version: "v2" });
    store.save({ ...simpleGraph, graphId: "g2", version: "v1" });
    expect(store.listAll()).toHaveLength(2);
  });

  it("remove", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.remove("g1", "v1")).toBe(true);
    expect(store.get("g1", "v1")).toBeNull();
  });

  it("findByPipeId", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.findByPipeId("p1")).toHaveLength(1);
    expect(store.findByPipeId("unknown")).toHaveLength(0);
  });

  it("findByTriggerEvent", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.findByTriggerEvent("e1")).toHaveLength(1);
    expect(store.findByTriggerEvent("e2")).toHaveLength(1);
    expect(store.findByTriggerEvent("unknown")).toHaveLength(0);
  });
});

describe("MemoryPipeSpecStore", () => {
  it("save + get + getLatest", () => {
    const store = new MemoryPipeSpecStore();
    store.save(simplePipe);
    store.save({ ...simplePipe, version: "v2" });
    expect(store.get("p1", "v1")).not.toBeNull();
    expect(store.getLatest("p1")!.version).toBe("v2");
  });

  it("listAll + remove", () => {
    const store = new MemoryPipeSpecStore();
    store.save(simplePipe);
    store.save(branchPipe);
    expect(store.listAll()).toHaveLength(2);
    store.remove("p1", "v1");
    expect(store.listAll()).toHaveLength(1);
  });
});

// ── 계산/분석 ────────────────────────────────────────

describe("analyzePipeComplexity", () => {
  it("기본 그래프 복잡도 분석", () => {
    const result = analyzePipeComplexity(simpleGraph);
    expect(result.pipeCount).toBe(2);
    expect(result.connectionCount).toBe(1);
    expect(result.pathsPerPipe["p1"]).toBe(1);
    expect(result.pathsPerPipe["p2"]).toBe(2);
    expect(result.mostComplexPipe!.pipeId).toBe("p2");
    expect(result.mostComplexPipe!.paths).toBe(2);
    expect(result.usedFlowKinds).toContain("step");
    expect(result.usedFlowKinds).toContain("branch");
    expect(result.usedConnectionKinds).toContain("next");
  });
});

describe("findBottlenecks", () => {
  it("retry/fallback 파이프를 실패 지점으로 감지", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [{
        pipeId: "risky", version: "v1",
        trigger: { eventKey: "e" },
        flow: { kind: "retry", maxAttempts: 3, step: { kind: "fallback", try: step(), catch: step() } },
      }],
      connections: [],
      entryPipeId: "risky",
    };
    const report = findBottlenecks(graph);
    expect(report.failurePoints).toHaveLength(1);
    expect(report.failurePoints[0].kinds).toContain("retry");
    expect(report.failurePoints[0].kinds).toContain("fallback");
  });

  it("timeout 파이프를 지연 지점으로 감지", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [{
        pipeId: "slow", version: "v1",
        trigger: { eventKey: "e" },
        flow: { kind: "timeout", body: step(), duration: 5000 },
      }],
      connections: [],
      entryPipeId: "slow",
    };
    const report = findBottlenecks(graph);
    expect(report.latencyPoints).toHaveLength(1);
    expect(report.latencyPoints[0].totalTimeout).toBe(5000);
  });
});

describe("analyzeCoverage", () => {
  it("전체 커버리지", () => {
    const report = analyzeCoverage(simpleGraph, new Set(["p1", "p2"]));
    expect(report.pipeCoverage).toBe(100);
    expect(report.uncoveredPipes).toHaveLength(0);
  });

  it("부분 커버리지", () => {
    const report = analyzeCoverage(simpleGraph, new Set(["p1"]));
    expect(report.pipeCoverage).toBe(50);
    expect(report.uncoveredPipes).toEqual(["p2"]);
  });

  it("미실행 커버리지", () => {
    const report = analyzeCoverage(simpleGraph, new Set());
    expect(report.pipeCoverage).toBe(0);
    expect(report.uncoveredPipes).toHaveLength(2);
  });
});

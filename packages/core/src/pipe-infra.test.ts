import { describe, it, expect } from "vitest";
import { serializePipeSpec, deserializePipeSpec, serializePipeGraph, deserializePipeGraph } from "./pipe-serialize.js";
import { MemoryPipeGraphStore, MemoryPipeSpecStore } from "./pipe-store.js";
import { analyzePipeComplexity, findBottlenecks, analyzeCoverage } from "./pipe-analyze.js";
import { validatePipeSpec, validatePipeGraph } from "./pipe-validate.js";
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

// ── 검증 규칙 ─────────────────────────────────────────

describe("validatePipeSpec — 숫자 범위 검증", () => {
  const wrap = (flow: PipeFlow): PipeSpec => ({
    pipeId: "t", version: "v1",
    trigger: { eventKey: "e" },
    flow,
  });

  it("retry.backoff < 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "retry", maxAttempts: 3, backoff: -1, step: step() }));
    const w = issues.find(i => i.message.includes("backoff"));
    expect(w).toBeDefined();
    expect(w!.severity).toBe("warning");
  });

  it("retry.backoff = 0 → 경고 없음", () => {
    const issues = validatePipeSpec(wrap({ kind: "retry", maxAttempts: 3, backoff: 0, step: step() }));
    expect(issues.find(i => i.message.includes("backoff"))).toBeUndefined();
  });

  it("circuit-breaker.cooldown ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "circuit-breaker", failureThreshold: 3, cooldown: 0, step: step() }));
    const w = issues.find(i => i.message.includes("cooldown"));
    expect(w).toBeDefined();
    expect(w!.severity).toBe("warning");
  });

  it("throttle.rate ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "throttle", rate: 0, interval: 1000, step: step() }));
    expect(issues.find(i => i.message.includes("rate"))).toBeDefined();
  });

  it("throttle.interval ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "throttle", rate: 10, interval: -1, step: step() }));
    expect(issues.find(i => i.message.includes("interval"))).toBeDefined();
  });

  it("debounce.wait ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "debounce", wait: 0, step: step() }));
    expect(issues.find(i => i.message.includes("wait"))).toBeDefined();
  });

  it("window.size ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "window", type: "tumbling", size: 0, body: step() }));
    expect(issues.find(i => i.message.includes("size"))).toBeDefined();
  });

  it("window sliding + slide ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "window", type: "sliding", size: 10, slide: 0, body: step() }));
    expect(issues.find(i => i.message.includes("slide"))).toBeDefined();
  });

  it("window session + gap ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "window", type: "session", size: 10, gap: -1, body: step() }));
    expect(issues.find(i => i.message.includes("gap"))).toBeDefined();
  });

  it("dedup.ttl ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "dedup", keyField: "id", ttl: 0, step: step() }));
    expect(issues.find(i => i.message.includes("ttl"))).toBeDefined();
  });

  it("dedup.ttl 미설정 → 경고 없음", () => {
    const issues = validatePipeSpec(wrap({ kind: "dedup", keyField: "id", step: step() }));
    expect(issues.find(i => i.message.includes("ttl"))).toBeUndefined();
  });

  it("buffer.count ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "buffer", count: 0, body: step() }));
    expect(issues.find(i => i.message.includes("count"))).toBeDefined();
  });

  it("buffer.duration ≤ 0 → warning", () => {
    const issues = validatePipeSpec(wrap({ kind: "buffer", duration: -5, body: step() }));
    expect(issues.find(i => i.message.includes("duration"))).toBeDefined();
  });
});

describe("validatePipeSpec — 시맨틱 검증", () => {
  const wrap = (flow: PipeFlow): PipeSpec => ({
    pipeId: "t", version: "v1",
    trigger: { eventKey: "e" },
    flow,
  });

  it("correlation: requestEvent === responseEvent → 데드락 warning", () => {
    const issues = validatePipeSpec(wrap({
      kind: "correlation", requestEvent: "evt", responseEvent: "evt",
      correlationKey: "id", onMatch: step(),
    }));
    const w = issues.find(i => i.message.includes("데드락"));
    expect(w).toBeDefined();
    expect(w!.severity).toBe("warning");
  });

  it("correlation: requestEvent !== responseEvent → 경고 없음", () => {
    const issues = validatePipeSpec(wrap({
      kind: "correlation", requestEvent: "req", responseEvent: "res",
      correlationKey: "id", onMatch: step(),
    }));
    expect(issues.find(i => i.message.includes("데드락"))).toBeUndefined();
  });

  it("enrich.source 빈 문자열 → warning", () => {
    const issues = validatePipeSpec(wrap({
      kind: "enrich", source: "", mergeField: "data", step: step(),
    }));
    expect(issues.find(i => i.message.includes("enrich.source"))).toBeDefined();
  });

  it("map.collection 빈 문자열 → warning", () => {
    const issues = validatePipeSpec(wrap({
      kind: "map", collection: "", itemFlow: step(),
    }));
    expect(issues.find(i => i.message.includes("map.collection"))).toBeDefined();
  });

  it("split.splitBy 빈 문자열 → warning", () => {
    const issues = validatePipeSpec(wrap({
      kind: "split", splitBy: "", itemFlow: step(),
    }));
    expect(issues.find(i => i.message.includes("split.splitBy"))).toBeDefined();
  });
});

describe("validatePipeGraph — 빈 배열 연결 검증", () => {
  it("from 빈 배열 → warning", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [simplePipe],
      connections: [{ from: [] as string[], to: "p1", kind: "next" }],
      entryPipeId: "p1",
    };
    const issues = validatePipeGraph(graph);
    const w = issues.find(i => i.message.includes("from 배열이 비어있음"));
    expect(w).toBeDefined();
    expect(w!.severity).toBe("warning");
  });

  it("to 빈 배열 → warning", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [simplePipe],
      connections: [{ from: "p1", to: [] as string[], kind: "next" }],
      entryPipeId: "p1",
    };
    const issues = validatePipeGraph(graph);
    const w = issues.find(i => i.message.includes("to 배열이 비어있음"));
    expect(w).toBeDefined();
    expect(w!.severity).toBe("warning");
  });
});

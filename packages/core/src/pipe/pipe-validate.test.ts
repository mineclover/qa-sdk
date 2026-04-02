import { describe, it, expect } from "vitest";
import { validatePipeSpec, validatePipeGraph } from "./pipe-validate.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "../types/pipe-spec.js";
import { step, simplePipe } from "./__fixtures__/pipe-fixtures.js";

const wrap = (flow: PipeFlow): PipeSpec => ({
  pipeId: "t", version: "v1",
  trigger: { eventKey: "e" },
  flow,
});

// ── 숫자 범위 검증 ───────────────────────────────────────

describe("validatePipeSpec — 숫자 범위 검증", () => {
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

// ── 시맨틱 검증 ──────────────────────────────────────────

describe("validatePipeSpec — 시맨틱 검증", () => {
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

// ── 그래프 검증 ──────────────────────────────────────────

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

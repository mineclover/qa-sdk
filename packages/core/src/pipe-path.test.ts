import { describe, it, expect } from "vitest";
import { countPipePaths, countGraphPaths } from "./pipe-path.js";
import type { PipeFlow, PipeGraph } from "./types/pipe-spec.js";
import { step } from "./__fixtures__/pipe-fixtures.js";

describe("countPipePaths", () => {
  it("step → 1", () => {
    expect(countPipePaths(step())).toBe(1);
  });

  it("sequence([step, step]) → 1 (곱: 1×1)", () => {
    expect(countPipePaths({ kind: "sequence", steps: [step(), step()] })).toBe(1);
  });

  it("branch([step, step]) → 2 (합: 1+1)", () => {
    expect(countPipePaths({ kind: "branch", condition: "x", paths: [step(), step()] })).toBe(2);
  });

  it("optional(step) → 2 (있는 경로 + 없는 경로)", () => {
    expect(countPipePaths({ kind: "optional", step: step() })).toBe(2);
  });

  it("sequence([branch([step, step]), step]) → 2", () => {
    expect(countPipePaths({
      kind: "sequence",
      steps: [
        { kind: "branch", condition: "x", paths: [step(), step()] },
        step(),
      ],
    })).toBe(2);
  });

  it("parallel([step, step]) → 1 (곱: 1×1)", () => {
    expect(countPipePaths({ kind: "parallel", steps: [step(), step()] })).toBe(1);
  });

  it("race([step, step]) → 2 (합: 1+1)", () => {
    expect(countPipePaths({ kind: "race", steps: [step(), step()] })).toBe(2);
  });

  it("await → then의 경로 수", () => {
    expect(countPipePaths({
      kind: "await", condition: "ready", then: step(),
    })).toBe(1);
  });

  it("retry → step 경로 수 (재시도 횟수 무관)", () => {
    expect(countPipePaths({ kind: "retry", step: step(), maxAttempts: 5 })).toBe(1);
  });

  it("fallback → try + catch (합)", () => {
    expect(countPipePaths({ kind: "fallback", try: step(), catch: step() })).toBe(2);
  });

  it("compensate → forward + compensate (합)", () => {
    expect(countPipePaths({
      kind: "compensate", forward: step(), compensate: step(),
    })).toBe(2);
  });

  it("loop → body 경로 수 (반복 횟수 무관)", () => {
    expect(countPipePaths({ kind: "loop", body: step(), until: "done" })).toBe(1);
  });

  it("emit → 1", () => {
    expect(countPipePaths({ kind: "emit", eventKey: "notify" })).toBe(1);
  });

  it("finally → body 경로 수 (cleanup은 분기 아님)", () => {
    expect(countPipePaths({ kind: "finally", body: step(), cleanup: step() })).toBe(1);
  });

  it("timeout → body + onTimeout (합)", () => {
    expect(countPipePaths({
      kind: "timeout", body: step(), duration: 5000, onTimeout: step(),
    })).toBe(2);
  });

  it("timeout without onTimeout → body + 1", () => {
    expect(countPipePaths({ kind: "timeout", body: step(), duration: 5000 })).toBe(2);
  });

  it("feedback → body 경로 수", () => {
    expect(countPipePaths({
      kind: "feedback", body: step(), feedbackEvent: "fb", until: "converge",
    })).toBe(1);
  });

  it("map → itemFlow 경로 수", () => {
    expect(countPipePaths({ kind: "map", itemFlow: step(), collection: "items" })).toBe(1);
  });

  it("reduce → step 경로 수", () => {
    expect(countPipePaths({
      kind: "reduce", step: step(), initial: "0", accumulator: "sum",
    })).toBe(1);
  });

  it("buffer → body 경로 수", () => {
    expect(countPipePaths({ kind: "buffer", body: step(), count: 10 })).toBe(1);
  });

  it("filter → step + 1 (통과 + 소멸)", () => {
    expect(countPipePaths({ kind: "filter", condition: "x > 0", step: step() })).toBe(2);
  });

  it("circuit-breaker → step + 1 (정상 + 차단)", () => {
    expect(countPipePaths({
      kind: "circuit-breaker", step: step(), failureThreshold: 5, cooldown: 3000,
    })).toBe(2);
  });

  it("throttle → step 경로 수", () => {
    expect(countPipePaths({ kind: "throttle", step: step(), rate: 10, interval: 1000 })).toBe(1);
  });

  it("debounce → step 경로 수", () => {
    expect(countPipePaths({ kind: "debounce", step: step(), wait: 300 })).toBe(1);
  });

  it("split → itemFlow 경로 수", () => {
    expect(countPipePaths({ kind: "split", splitBy: "items", itemFlow: step() })).toBe(1);
  });

  it("enrich → step 경로 수", () => {
    expect(countPipePaths({
      kind: "enrich", source: "userService", mergeField: "user", step: step(),
    })).toBe(1);
  });

  it("tap → step 경로 수 (관측은 분기 아님)", () => {
    expect(countPipePaths({ kind: "tap", observe: step(), step: step() })).toBe(1);
  });

  it("resequence → step 경로 수", () => {
    expect(countPipePaths({
      kind: "resequence", orderBy: "seq", windowSize: 10, step: step(),
    })).toBe(1);
  });

  it("window → body 경로 수", () => {
    expect(countPipePaths({
      kind: "window", type: "tumbling", size: 1000, body: step(),
    })).toBe(1);
  });

  it("dedup → step + 1 (통과 + 중복소멸)", () => {
    expect(countPipePaths({ kind: "dedup", keyField: "id", step: step() })).toBe(2);
  });

  it("correlation → onMatch + onTimeout (합)", () => {
    expect(countPipePaths({
      kind: "correlation",
      requestEvent: "req", responseEvent: "res",
      correlationKey: "id", onMatch: step(), onTimeout: step(),
    })).toBe(2);
  });

  // 실전 시나리오
  it("주문 처리: 소비→관리→branch(생산|대기)→저장 → 2 경로", () => {
    const orderFlow: PipeFlow = {
      kind: "sequence",
      steps: [
        { kind: "step", facet: "소비" },
        { kind: "step", facet: "관리" },
        { kind: "branch", condition: "재고", paths: [
          { kind: "step", facet: "생산" },
          { kind: "step", facet: "생산" }, // 대기 알림
        ]},
        { kind: "step", facet: "저장" },
      ],
    };
    expect(countPipePaths(orderFlow)).toBe(2);
  });

  it("결제 처리: retry(관리, 3회) + fallback(PG_A, PG_B) → 2 경로", () => {
    const paymentFlow: PipeFlow = {
      kind: "retry",
      maxAttempts: 3,
      step: {
        kind: "fallback",
        try: { kind: "step", facet: "관리" },
        catch: { kind: "step", facet: "관리" },
      },
    };
    expect(countPipePaths(paymentFlow)).toBe(2);
  });
});

describe("countGraphPaths", () => {
  it("단일 파이프 그래프", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [{ pipeId: "p1", version: "v1", trigger: { eventKey: "e1" }, flow: step() }],
      connections: [],
      entryPipeId: "p1",
    };
    expect(countGraphPaths(graph)).toBe(1);
  });

  it("순차 연결 (next): A → B → 1×1=1", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        { pipeId: "a", version: "v1", trigger: { eventKey: "e1" }, flow: step() },
        { pipeId: "b", version: "v1", trigger: { eventKey: "e2" }, flow: step() },
      ],
      connections: [{ from: "a", to: "b", kind: "next" }],
      entryPipeId: "a",
    };
    expect(countGraphPaths(graph)).toBe(1);
  });

  it("조건부 연결 (conditional): A → B|C → 1×(1+1)=2", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        { pipeId: "a", version: "v1", trigger: { eventKey: "e1" }, flow: step() },
        { pipeId: "b", version: "v1", trigger: { eventKey: "e2" }, flow: step() },
        { pipeId: "c", version: "v1", trigger: { eventKey: "e3" }, flow: step() },
      ],
      connections: [
        { from: "a", to: "b", kind: "conditional", condition: "x" },
        { from: "a", to: "c", kind: "conditional", condition: "!x" },
      ],
      entryPipeId: "a",
    };
    expect(countGraphPaths(graph)).toBe(2);
  });

  it("fan-out + join: A → [B,C] → D", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        { pipeId: "a", version: "v1", trigger: { eventKey: "e1" }, flow: step() },
        { pipeId: "b", version: "v1", trigger: { eventKey: "e2" }, flow: step() },
        { pipeId: "c", version: "v1", trigger: { eventKey: "e3" }, flow: step() },
        { pipeId: "d", version: "v1", trigger: { eventKey: "e4" }, flow: step() },
      ],
      connections: [
        { from: "a", to: ["b", "c"], kind: "fan-out" },
        { from: ["b", "c"], to: "d", kind: "join" },
      ],
      entryPipeId: "a",
    };
    // a(1) × fan-out(b(1) × c(1)) = 1, then join → d(1) = 1
    expect(countGraphPaths(graph)).toBeGreaterThanOrEqual(1);
  });

  it("내부 분기 + 그래프 연결 복합", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        {
          pipeId: "order", version: "v1",
          trigger: { eventKey: "order_submit" },
          flow: {
            kind: "sequence",
            steps: [
              step("소비"),
              { kind: "branch", condition: "type", paths: [step("생산"), step("생산")] },
            ],
          },
        },
        { pipeId: "notify", version: "v1", trigger: { eventKey: "order_confirmed" }, flow: step("생산") },
      ],
      connections: [{ from: "order", to: "notify", kind: "next" }],
      entryPipeId: "order",
    };
    // order 내부 2경로 × notify 1경로 = 2
    expect(countGraphPaths(graph)).toBe(2);
  });
});

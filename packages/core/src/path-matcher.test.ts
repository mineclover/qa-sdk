import { describe, it, expect } from "vitest";
import { matchPath } from "./path-matcher.js";
import type { PipeGraph, PipeFlow, PipeSpec } from "./types/pipe-spec.js";
import type { RunResult, ExecutedStep } from "./types/pipe-runtime.js";

import { step } from "./__fixtures__/pipe-fixtures.js";

function makePipe(id: string, trigger: string, flow: PipeFlow, produces?: string[]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: trigger }, flow, produces };
}

function makeExecutedStep(pipeId: string, facet: string, status: ExecutedStep["status"] = "ok"): ExecutedStep {
  return {
    pipeId, flowPath: "flow", kind: "step", facet,
    input: null, output: null, status,
    duration: 1, timestamp: new Date().toISOString(),
  };
}

function makeRunResult(steps: ExecutedStep[], status: RunResult["status"] = "complete"): RunResult {
  return {
    steps, producedEvents: [], errors: [],
    finalContext: {}, duration: 10, status,
  };
}

describe("matchPath", () => {
  it("전체 매칭 성공 → pass", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("a", "start", step("소비")), makePipe("b", "e2", step("생산"))],
      connections: [{ from: "a", to: "b", kind: "next" }],
      entryPipeId: "a",
    };

    const result = makeRunResult([
      makeExecutedStep("a", "소비"),
      makeExecutedStep("b", "생산"),
    ]);

    const match = matchPath(result, graph);
    expect(match.verdict).toBe("pass");
    expect(match.matchedPipes).toEqual(["a", "b"]);
    expect(match.missingPipes).toHaveLength(0);
    expect(match.facetTrace).toEqual(["소비", "생산"]);
  });

  it("일부 미실행 → warn (커버리지 ≥ 50%)", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [
        makePipe("a", "start", step("소비")),
        makePipe("b", "e2", step("관리")),
        makePipe("c", "e3", step("저장")),
      ],
      connections: [
        { from: "a", to: "b", kind: "next" },
        { from: "b", to: "c", kind: "next" },
      ],
      entryPipeId: "a",
    };

    const result = makeRunResult([
      makeExecutedStep("a", "소비"),
      makeExecutedStep("b", "관리"),
      // c 미실행
    ]);

    const match = matchPath(result, graph);
    expect(match.verdict).toBe("warn");
    expect(match.missingPipes).toContain("c");
  });

  it("대부분 미실행 → fail (커버리지 < 50%)", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [
        makePipe("a", "start", step("소비")),
        makePipe("b", "e2", step("관리")),
        makePipe("c", "e3", step("저장")),
        makePipe("d", "e4", step("생산")),
      ],
      connections: [
        { from: "a", to: "b", kind: "next" },
        { from: "b", to: "c", kind: "next" },
        { from: "c", to: "d", kind: "next" },
      ],
      entryPipeId: "a",
    };

    const result = makeRunResult([makeExecutedStep("a", "소비")]);
    const match = matchPath(result, graph);
    expect(match.verdict).toBe("fail");
  });

  it("에러 step → fail", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("a", "start", step("소비"))],
      connections: [], entryPipeId: "a",
    };

    const errorStep = makeExecutedStep("a", "소비", "error");
    errorStep.error = { code: "FAIL", message: "broken", retryable: false };
    const result = makeRunResult([errorStep]);

    const match = matchPath(result, graph);
    expect(match.verdict).toBe("fail");
    expect(match.errorSteps).toHaveLength(1);
    expect(match.reason).toContain("에러");
  });

  it("실행 취소 → fail", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("a", "start", step("소비"))],
      connections: [], entryPipeId: "a",
    };
    const result = makeRunResult([], "cancelled");
    expect(matchPath(result, graph).verdict).toBe("fail");
  });

  it("max-steps → fail", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("a", "start", step("소비"))],
      connections: [], entryPipeId: "a",
    };
    const result = makeRunResult([makeExecutedStep("a", "소비")], "max-steps");
    expect(matchPath(result, graph).verdict).toBe("fail");
  });

  it("produces → trigger 도달 가능 파이프 포함", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [
        makePipe("a", "start", step("소비"), ["order_done"]),
        makePipe("b", "order_done", step("생산")),
      ],
      connections: [],
      entryPipeId: "a",
    };

    // b가 실행되지 않으면 missing
    const result = makeRunResult([makeExecutedStep("a", "소비")]);
    const match = matchPath(result, graph);
    expect(match.missingPipes).toContain("b");
  });

  it("실전: 주문 → 결제 → 알림 전체 매칭", () => {
    const graph: PipeGraph = {
      graphId: "order", version: "v1",
      pipes: [
        makePipe("order", "submit", step("소비"), ["confirmed"]),
        makePipe("payment", "confirmed", step("관리"), ["paid"]),
        makePipe("notify", "paid", step("생산")),
      ],
      connections: [],
      entryPipeId: "order",
    };

    const result = makeRunResult([
      makeExecutedStep("order", "소비"),
      makeExecutedStep("payment", "관리"),
      makeExecutedStep("notify", "생산"),
    ]);

    const match = matchPath(result, graph);
    expect(match.verdict).toBe("pass");
    expect(match.matchedPipes).toEqual(["order", "payment", "notify"]);
    expect(match.facetTrace).toEqual(["소비", "관리", "생산"]);
    expect(match.reason).toBe("전체 파이프 매칭 성공");
  });
});

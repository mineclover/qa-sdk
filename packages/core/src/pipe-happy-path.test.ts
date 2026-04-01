import { describe, it, expect } from "vitest";
import { matchHappyPath, simulate } from "./pipe-simulate.js";
import type { SimulationResult, HappyPathMatch } from "./pipe-simulate.js";
import type { PipeGraph, PipeFlow } from "./types/pipe-spec.js";
import { step } from "./__fixtures__/pipe-fixtures.js";

/** SimulationResult를 직접 구성하는 헬퍼 (simulate 없이 matchHappyPath 단독 테스트) */
function fakeResult(pipeTrace: string[], facetTrace: string[] = []): SimulationResult {
  return {
    steps: [], pipeTrace, facetTrace,
    producedEvents: [], status: "complete", totalTime: 0, totalSteps: pipeTrace.length,
  };
}

// ── 기본 매칭 ────────────────────────────────────────────

describe("matchHappyPath — 기본", () => {
  it("완전 일치", () => {
    const m = matchHappyPath(fakeResult(["a", "b", "c"]), { expectedPipeTrace: ["a", "b", "c"] });
    expect(m.match).toBe(true);
    expect(m.pipeTraceMatch).toBe(true);
    expect(m.facetMatch).toBe(true);
    expect(m.divergedAtIndex).toBeNull();
  });

  it("순서 불일치", () => {
    const m = matchHappyPath(fakeResult(["a", "c", "b"]), { expectedPipeTrace: ["a", "b", "c"] });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(1);
    expect(m.expected).toBe("b");
    expect(m.actual).toBe("c");
  });

  it("실제보다 기대가 긴 경우 — 부족", () => {
    const m = matchHappyPath(fakeResult(["a", "b"]), { expectedPipeTrace: ["a", "b", "c"] });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(2);
    expect(m.expected).toBe("c");
    expect(m.actual).toBeNull();
  });

  it("기대보다 실제가 긴 경우 — 초과", () => {
    const m = matchHappyPath(fakeResult(["a", "b", "c", "d"]), { expectedPipeTrace: ["a", "b", "c"] });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(3);
    expect(m.expected).toBeNull();
    expect(m.actual).toBe("d");
  });
});

// ── 엣지 케이스 ──────────────────────────────────────────

describe("matchHappyPath — 엣지 케이스", () => {
  it("양쪽 빈 트레이스 → 일치", () => {
    const m = matchHappyPath(fakeResult([]), { expectedPipeTrace: [] });
    expect(m.match).toBe(true);
  });

  it("실제 비어있고 기대 있음 → 불일치", () => {
    const m = matchHappyPath(fakeResult([]), { expectedPipeTrace: ["a"] });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(0);
    expect(m.expected).toBe("a");
    expect(m.actual).toBeNull();
  });

  it("실제 있고 기대 비어있음 → 불일치", () => {
    const m = matchHappyPath(fakeResult(["a"]), { expectedPipeTrace: [] });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(0);
    expect(m.expected).toBeNull();
    expect(m.actual).toBe("a");
  });

  it("단일 원소 일치", () => {
    const m = matchHappyPath(fakeResult(["x"]), { expectedPipeTrace: ["x"] });
    expect(m.match).toBe(true);
  });

  it("단일 원소 불일치", () => {
    const m = matchHappyPath(fakeResult(["x"]), { expectedPipeTrace: ["y"] });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(0);
  });

  it("긴 트레이스 (50 원소) 일치", () => {
    const trace = Array.from({ length: 50 }, (_, i) => `pipe_${i}`);
    const m = matchHappyPath(fakeResult(trace), { expectedPipeTrace: [...trace] });
    expect(m.match).toBe(true);
  });

  it("긴 트레이스 마지막 원소만 다름", () => {
    const trace = Array.from({ length: 50 }, (_, i) => `pipe_${i}`);
    const expected = [...trace];
    expected[49] = "pipe_WRONG";
    const m = matchHappyPath(fakeResult(trace), { expectedPipeTrace: expected });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(49);
  });
});

// ── 패싯 검증 ────────────────────────────────────────────

describe("matchHappyPath — 패싯", () => {
  it("expectedFacets 미제공 → facetMatch 항상 true", () => {
    const m = matchHappyPath(
      fakeResult(["a", "b"], ["소비", "생산"]),
      { expectedPipeTrace: ["a", "b"] },
    );
    expect(m.facetMatch).toBe(true);
    expect(m.match).toBe(true);
  });

  it("파이프+패싯 모두 일치", () => {
    const m = matchHappyPath(
      fakeResult(["a", "b"], ["소비", "생산"]),
      { expectedPipeTrace: ["a", "b"], expectedFacets: ["소비", "생산"] },
    );
    expect(m.match).toBe(true);
    expect(m.pipeTraceMatch).toBe(true);
    expect(m.facetMatch).toBe(true);
  });

  it("파이프 일치 + 패싯 불일치 → divergedAtIndex는 패싯 기준", () => {
    const m = matchHappyPath(
      fakeResult(["a", "b", "c"], ["소비", "생산", "저장"]),
      { expectedPipeTrace: ["a", "b", "c"], expectedFacets: ["소비", "생산", "관리"] },
    );
    expect(m.match).toBe(false);
    expect(m.pipeTraceMatch).toBe(true);
    expect(m.facetMatch).toBe(false);
    expect(m.divergedAtIndex).toBe(2);
    expect(m.expected).toBe("관리");
    expect(m.actual).toBe("저장");
  });

  it("파이프 불일치 시 패싯은 무관 — divergedAtIndex는 파이프 기준", () => {
    const m = matchHappyPath(
      fakeResult(["a", "X"], ["소비", "생산"]),
      { expectedPipeTrace: ["a", "b"], expectedFacets: ["소비", "관리"] },
    );
    expect(m.match).toBe(false);
    expect(m.pipeTraceMatch).toBe(false);
    // 파이프가 먼저 불일치이므로 divergedAtIndex는 파이프 기준
    expect(m.divergedAtIndex).toBe(1);
    expect(m.expected).toBe("b");
    expect(m.actual).toBe("X");
  });

  it("빈 패싯 기대 + 빈 패싯 실제 → 일치", () => {
    const m = matchHappyPath(
      fakeResult(["a"], []),
      { expectedPipeTrace: ["a"], expectedFacets: [] },
    );
    expect(m.facetMatch).toBe(true);
  });
});

// ── simulate 연동 ────────────────────────────────────────

describe("matchHappyPath — simulate 연동", () => {
  const graph: PipeGraph = {
    graphId: "g1", version: "v1",
    pipes: [
      { pipeId: "validate", version: "v1", trigger: { eventKey: "start" }, flow: step("검증") },
      { pipeId: "charge", version: "v1", trigger: { eventKey: "t_charge" }, flow: step("결제") },
      { pipeId: "receipt", version: "v1", trigger: { eventKey: "t_receipt" }, flow: step("영수증") },
    ],
    connections: [
      { from: "validate", to: "charge", kind: "next" },
      { from: "charge", to: "receipt", kind: "next" },
    ],
    entryPipeId: "validate",
  };

  it("실제 simulate 결과와 happy path 일치", () => {
    const result = simulate({ graph, initialEvent: { eventKey: "start" } });
    const m = matchHappyPath(result, {
      expectedPipeTrace: ["validate", "charge", "receipt"],
      expectedFacets: ["검증", "결제", "영수증"],
    });
    expect(m.match).toBe(true);
  });

  it("실제 simulate 결과와 happy path 불일치", () => {
    const result = simulate({ graph, initialEvent: { eventKey: "start" } });
    const m = matchHappyPath(result, {
      expectedPipeTrace: ["validate", "receipt"],
    });
    expect(m.match).toBe(false);
    expect(m.divergedAtIndex).toBe(1);
  });
});

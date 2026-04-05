import { describe, it, expect } from "vitest";
import { annotateSimPhases, FACET_PHASE_DEFAULTS } from "./sim-phase-bridge.js";
import type { SimulationResult } from "./pipe-simulate.js";
import type { TestPhase } from "../types/test-tracking.js";

function makeSim(steps: Array<{
  pipeId: string; facet?: string; phase?: TestPhase; eventKey?: string;
}>): SimulationResult {
  return {
    steps: steps.map((s, i) => ({
      pipeId: s.pipeId,
      flowPath: `flow.steps[${i}]`,
      kind: "step",
      facet: s.facet,
      phase: s.phase,
      eventKey: s.eventKey,
      timestamp: i * 100,
      status: "executed" as const,
    })),
    pipeTrace: steps.map(s => s.pipeId),
    facetTrace: steps.filter(s => s.facet).map(s => s.facet!),
    producedEvents: [],
    status: "complete",
    totalTime: steps.length * 100,
    totalSteps: steps.length,
  };
}

describe("annotateSimPhases", () => {
  it("facet 기본 매핑 — 정의→arrange, 소비→act, 생산→observe", () => {
    const sim = makeSim([
      { pipeId: "p1", facet: "정의" },
      { pipeId: "p2", facet: "소비" },
      { pipeId: "p3", facet: "생산" },
    ]);
    const result = annotateSimPhases(sim);

    expect(result.phaseTrace).toEqual(["arrange", "act", "observe"]);
    expect(result.steps[0].phaseSource).toBe("facet-map");
    expect(result.steps[1].phaseSource).toBe("facet-map");
    expect(result.steps[2].phaseSource).toBe("facet-map");
  });

  it("저장→fixture, 관리→act", () => {
    const sim = makeSim([
      { pipeId: "p1", facet: "저장" },
      { pipeId: "p2", facet: "관리" },
    ]);
    const result = annotateSimPhases(sim);
    expect(result.phaseTrace).toEqual(["fixture", "act"]);
  });

  it("명시 phase 우선 — PipeStep.testPhase > facet 매핑", () => {
    const sim = makeSim([
      { pipeId: "p1", facet: "소비", phase: "precondition" },
      { pipeId: "p2", facet: "생산", phase: "assert-primary" },
    ]);
    const result = annotateSimPhases(sim);

    expect(result.phaseTrace).toEqual(["precondition", "assert-primary"]);
    expect(result.steps[0].phaseSource).toBe("explicit");
    expect(result.steps[1].phaseSource).toBe("explicit");
  });

  it("facet 없음 → default (act)", () => {
    const sim = makeSim([
      { pipeId: "p1" },
    ]);
    const result = annotateSimPhases(sim);

    expect(result.phaseTrace).toEqual(["act"]);
    expect(result.steps[0].phaseSource).toBe("default");
  });

  it("제어 노드(branch, parallel) 제외 — step kind만 annotate", () => {
    const sim: SimulationResult = {
      steps: [
        { pipeId: "p1", flowPath: "flow", kind: "branch", timestamp: 0, status: "executed" },
        { pipeId: "p1", flowPath: "flow.paths[0]", kind: "step", facet: "소비", timestamp: 100, status: "executed" },
        { pipeId: "p1", flowPath: "flow.steps[1]", kind: "parallel", timestamp: 200, status: "executed" },
      ],
      pipeTrace: ["p1"], facetTrace: ["소비"],
      producedEvents: [], status: "complete", totalTime: 200, totalSteps: 3,
    };
    const result = annotateSimPhases(sim);

    // branch, parallel은 제외, step만
    expect(result.steps).toHaveLength(1);
    expect(result.phaseTrace).toEqual(["act"]);
  });

  it("커버리지 — covered/uncovered/rate", () => {
    const sim = makeSim([
      { pipeId: "p1", facet: "정의" },     // arrange
      { pipeId: "p2", facet: "소비" },     // act
      { pipeId: "p3", facet: "생산" },     // observe
    ]);
    const result = annotateSimPhases(sim);

    expect(result.coverage.covered).toContain("arrange");
    expect(result.coverage.covered).toContain("act");
    expect(result.coverage.covered).toContain("observe");
    expect(result.coverage.uncovered).toContain("precondition");
    expect(result.coverage.uncovered).toContain("assert-primary");
    expect(result.coverage.uncovered).toContain("teardown");
    expect(result.coverage.rate).toBe(Math.round((3 / 11) * 100));
  });

  it("커스텀 매핑 — 기본 매핑 덮어쓰기", () => {
    const sim = makeSim([
      { pipeId: "p1", facet: "소비" },
    ]);
    // 소비를 observe로 재매핑
    const result = annotateSimPhases(sim, { "소비": "observe" });

    expect(result.phaseTrace).toEqual(["observe"]);
    expect(result.steps[0].phaseSource).toBe("facet-map");
  });

  it("커스텀 매핑 — 기본에 없는 novel facet 추가", () => {
    const sim = makeSim([
      { pipeId: "p1", facet: "검증" },
    ]);
    // "검증"은 기본 매핑에 없음 → customMap으로 추가
    const result = annotateSimPhases(sim, { "검증": "assert-primary" });

    expect(result.phaseTrace).toEqual(["assert-primary"]);
    expect(result.steps[0].phaseSource).toBe("facet-map");
  });

  it("빈 시뮬레이션 → 빈 결과", () => {
    const sim: SimulationResult = {
      steps: [], pipeTrace: [], facetTrace: [],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 0,
    };
    const result = annotateSimPhases(sim);

    expect(result.steps).toHaveLength(0);
    expect(result.phaseTrace).toHaveLength(0);
    expect(result.coverage.covered).toHaveLength(0);
    expect(result.coverage.rate).toBe(0);
  });

  it("잘못된 phase 값 → facet 매핑으로 fallback", () => {
    const sim = makeSim([
      { pipeId: "p1", facet: "소비", phase: "invalid-phase" as TestPhase },
    ]);
    const result = annotateSimPhases(sim);

    expect(result.phaseTrace).toEqual(["act"]); // facet 매핑 fallback
    expect(result.steps[0].phaseSource).toBe("facet-map");
  });

  it("전체 파이프라인 시나리오 — 정의→저장→소비→관리→생산", () => {
    const sim = makeSim([
      { pipeId: "init", facet: "정의" },
      { pipeId: "load", facet: "저장" },
      { pipeId: "process", facet: "소비" },
      { pipeId: "transform", facet: "관리" },
      { pipeId: "output", facet: "생산" },
    ]);
    const result = annotateSimPhases(sim);

    expect(result.phaseTrace).toEqual(["arrange", "fixture", "act", "act", "observe"]);
    expect(result.coverage.covered).toHaveLength(4); // arrange, fixture, act, observe
  });
});

describe("FACET_PHASE_DEFAULTS", () => {
  it("5개 facet 매핑 테이블 노출", () => {
    expect(FACET_PHASE_DEFAULTS["정의"]).toBe("arrange");
    expect(FACET_PHASE_DEFAULTS["저장"]).toBe("fixture");
    expect(FACET_PHASE_DEFAULTS["소비"]).toBe("act");
    expect(FACET_PHASE_DEFAULTS["관리"]).toBe("act");
    expect(FACET_PHASE_DEFAULTS["생산"]).toBe("observe");
  });
});

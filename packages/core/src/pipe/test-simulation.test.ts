/**
 * TestRegistry 시뮬레이션 비교 — compareWithSimulation + drift 감지
 */

import { describe, it, expect } from "vitest";
import { TestRegistry } from "./test-tracking.js";
import type { SimulationResult } from "./pipe-simulate.js";

describe("compareWithSimulation", () => {
  it("시뮬 결과와 happy path 일치 → drift 없음", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: ["validate", "charge", "receipt"],
      facetTrace: ["검증", "결제", "영수증"],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 3,
    };
    const { drift, match } = reg.compareWithSimulation("happy-order", {
      expectedPipeTrace: ["validate", "charge", "receipt"],
    }, simResult);
    expect(drift).toBe(false);
    expect(match.match).toBe(true);
  });

  it("시뮬 결과와 happy path 불일치 → drift 감지", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: ["validate", "refund"],
      facetTrace: ["검증", "환불"],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 2,
    };
    const { drift, match, scenarioId } = reg.compareWithSimulation("happy-order", {
      expectedPipeTrace: ["validate", "charge", "receipt"],
    }, simResult);
    expect(drift).toBe(true);
    expect(match.divergedAtIndex).toBe(1);
    expect(scenarioId).toBe("happy-order");
  });

  it("패싯 불일치만으로도 drift", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: ["a", "b"],
      facetTrace: ["소비", "저장"],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 2,
    };
    const { drift, match } = reg.compareWithSimulation("s1", {
      expectedPipeTrace: ["a", "b"],
      expectedFacets: ["소비", "생산"],
    }, simResult);
    expect(drift).toBe(true);
    expect(match.pipeTraceMatch).toBe(true);
    expect(match.facetMatch).toBe(false);
  });

  it("빈 트레이스 양쪽 → drift 없음", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: [], facetTrace: [],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 0,
    };
    const { drift } = reg.compareWithSimulation("empty", {
      expectedPipeTrace: [],
    }, simResult);
    expect(drift).toBe(false);
  });

  it("max-steps-reached 상태여도 비교는 수행", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: ["a", "b"], facetTrace: [],
      producedEvents: [], status: "max-steps-reached", totalTime: 0, totalSteps: 2,
    };
    const { drift, match } = reg.compareWithSimulation("s1", {
      expectedPipeTrace: ["a", "b"],
    }, simResult);
    expect(drift).toBe(false);
    expect(match.match).toBe(true);
  });

  it("같은 scenarioId로 여러 번 호출 — 멱등", () => {
    const reg = new TestRegistry();
    const simResult: SimulationResult = {
      steps: [], pipeTrace: ["a"], facetTrace: [],
      producedEvents: [], status: "complete", totalTime: 0, totalSteps: 1,
    };
    const r1 = reg.compareWithSimulation("s1", { expectedPipeTrace: ["a"] }, simResult);
    const r2 = reg.compareWithSimulation("s1", { expectedPipeTrace: ["a"] }, simResult);
    expect(r1.drift).toBe(r2.drift);
    expect(r1.match.match).toBe(r2.match.match);
  });
});

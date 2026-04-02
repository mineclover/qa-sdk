import { describe, it, expect } from "vitest";
import { computeVerdictV2 } from "./verdict-v2.js";
import type { VerdictReportV2 } from "./verdict-v2.js";
import type { MatchResult } from "./path-matcher.js";
import type { PipeGraph } from "./types/pipe-spec.js";
import type { GateResult, GateVerdict } from "./pipe-gate.js";
import { step } from "./__fixtures__/pipe-fixtures.js";

// ── 헬퍼 ──────────────────────────────────────────────

function makeGraph(pipeIds: string[], scope?: string): PipeGraph {
  return {
    graphId: "g1",
    version: "1.0.0",
    pipes: pipeIds.map(id => ({
      pipeId: id,
      version: "1.0.0",
      trigger: { eventKey: `${id}_trigger` },
      flow: step("소비"),
      scope,
    })),
    connections: pipeIds.length > 1
      ? pipeIds.slice(0, -1).map((id, i) => ({ from: id, to: pipeIds[i + 1], kind: "next" as const }))
      : [],
    entryPipeId: pipeIds[0] ?? "",
  };
}

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    matchedPipes: ["a", "b", "c"],
    unexpectedSteps: [],
    missingPipes: [],
    facetTrace: ["소비", "관리", "저장"],
    errorSteps: [],
    verdict: "pass",
    reason: "전체 파이프 매칭 성공",
    ...overrides,
  };
}

function makeGate(verdict: GateVerdict, gateId = "gate1"): GateResult {
  return {
    gateId,
    level: "graph",
    target: "g1",
    pass: verdict === "pass",
    verdict,
    results: [],
    subIssues: verdict === "review" ? [{ gateId, level: "pipe", failedCriteria: ["복잡도 높음"] }] : [],
    metrics: {},
  };
}

// ── pass 판정 ────────────────────────────────────────

describe("pass 판정", () => {
  it("전체 매칭 성공 → pass", () => {
    const match = makeMatch();
    const graph = makeGraph(["a", "b", "c"]);
    const report = computeVerdictV2(match, graph);

    expect(report.verdict).toBe("pass");
    expect(report.pipeCoverage.rate).toBe(100);
    expect(report.errorCount).toBe(0);
  });

  it("게이트 전체 통과 → pass", () => {
    const match = makeMatch();
    const graph = makeGraph(["a", "b", "c"]);
    const gates = [makeGate("pass", "g1"), makeGate("pass", "g2")];
    const report = computeVerdictV2(match, graph, gates);

    expect(report.verdict).toBe("pass");
    expect(report.reasons).toContain("전체 매칭 + 게이트 통과");
  });

  it("graphId와 scope 포함", () => {
    const match = makeMatch();
    const graph = makeGraph(["a", "b", "c"], "feature");
    const report = computeVerdictV2(match, graph);

    expect(report.graphId).toBe("g1");
    expect(report.scope).toBe("feature");
  });
});

// ── fail 판정 ────────────────────────────────────────

describe("fail 판정", () => {
  it("PathMatcher verdict=fail → fail 전파", () => {
    const match = makeMatch({
      verdict: "fail",
      reason: "파이프 커버리지 30%",
      matchedPipes: ["a"],
      missingPipes: ["b", "c"],
    });
    const graph = makeGraph(["a", "b", "c"]);
    const report = computeVerdictV2(match, graph);

    expect(report.verdict).toBe("fail");
  });

  it("에러 step → fail", () => {
    const match = makeMatch({
      errorSteps: [{
        pipeId: "a", flowPath: "0", kind: "step",
        input: {}, output: {}, status: "error",
        error: { code: "TIMEOUT", message: "시간 초과", retryable: false },
        duration: 5000, timestamp: "2026-01-01T00:00:00Z",
      }],
      verdict: "fail",
      reason: "에러 1건",
    });
    const graph = makeGraph(["a", "b", "c"]);
    const report = computeVerdictV2(match, graph);

    expect(report.verdict).toBe("fail");
    expect(report.errorCount).toBe(1);
  });

  it("PathMatcher fail → fail 전파 (커버리지 포함)", () => {
    const match = makeMatch({
      matchedPipes: ["a"],
      missingPipes: ["b", "c", "d"],
      verdict: "fail",
      reason: "파이프 커버리지 25% — 미실행: b, c, d",
    });
    const graph = makeGraph(["a", "b", "c", "d"]);
    const report = computeVerdictV2(match, graph);

    expect(report.verdict).toBe("fail");
    expect(report.pipeCoverage.rate).toBe(25);
  });

  it("게이트 fail → fail", () => {
    const match = makeMatch();
    const graph = makeGraph(["a", "b", "c"]);
    const gates = [makeGate("pass"), makeGate("fail", "critical-gate")];
    const report = computeVerdictV2(match, graph, gates);

    expect(report.verdict).toBe("fail");
    expect(report.reasons.some(r => r.includes("critical-gate"))).toBe(true);
  });
});

// ── review 판정 ──────────────────────────────────────

describe("review 판정", () => {
  it("미실행 파이프 (커버리지 ≥ 50%) → review", () => {
    const match = makeMatch({
      matchedPipes: ["a", "b"],
      missingPipes: ["c"],
      verdict: "warn",
      reason: "커버리지 67%",
    });
    const graph = makeGraph(["a", "b", "c"]);
    const report = computeVerdictV2(match, graph);

    expect(report.verdict).toBe("review");
    expect(report.pipeCoverage.rate).toBe(67);
  });

  it("unexpected steps → review", () => {
    const match = makeMatch({
      unexpectedSteps: [{
        pipeId: "x", flowPath: "0", kind: "step",
        input: {}, output: {}, status: "ok",
        duration: 10, timestamp: "2026-01-01T00:00:00Z",
      }],
      verdict: "warn",
      reason: "예상치 못한 step 1건",
    });
    const graph = makeGraph(["a", "b", "c"]);
    const report = computeVerdictV2(match, graph);

    expect(report.verdict).toBe("review");
  });

  it("게이트 review → review", () => {
    const match = makeMatch();
    const graph = makeGraph(["a", "b", "c"]);
    const gates = [makeGate("pass"), makeGate("review", "complexity-gate")];
    const report = computeVerdictV2(match, graph, gates);

    expect(report.verdict).toBe("review");
  });
});

// ── 패싯 커버리지 ────────────────────────────────────

describe("패싯 커버리지", () => {
  it("실행된 패싯이 전체에 대한 비율로 계산", () => {
    const match = makeMatch({
      facetTrace: ["소비"],
    });
    const graph: PipeGraph = {
      graphId: "g1",
      version: "1.0.0",
      pipes: [
        { pipeId: "a", version: "1.0.0", trigger: { eventKey: "e" }, flow: step("소비") },
        { pipeId: "b", version: "1.0.0", trigger: { eventKey: "e" }, flow: step("관리") },
        { pipeId: "c", version: "1.0.0", trigger: { eventKey: "e" }, flow: step("저장") },
      ],
      connections: [],
      entryPipeId: "a",
    };
    const report = computeVerdictV2(match, graph);

    expect(report.facetCoverage.total).toBe(3);
    expect(report.facetCoverage.covered).toBe(1);
    expect(report.facetCoverage.uncoveredFacets).toContain("관리");
    expect(report.facetCoverage.uncoveredFacets).toContain("저장");
  });
});

// ── 요약 ─────────────────────────────────────────────

describe("요약", () => {
  it("summary에 판정·커버리지·에러 수 포함", () => {
    const match = makeMatch();
    const graph = makeGraph(["a", "b", "c"]);
    const report = computeVerdictV2(match, graph);

    expect(report.summary).toContain("PASS");
    expect(report.summary).toContain("100%");
  });

  it("computedAt ISO 타임스탬프", () => {
    const match = makeMatch();
    const graph = makeGraph(["a", "b", "c"]);
    const report = computeVerdictV2(match, graph);

    expect(report.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

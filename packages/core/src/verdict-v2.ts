/**
 * VerdictReport v2 — PipeGraph 기반 판정
 *
 * PathMatcher의 MatchResult + PipeGate의 GateResult를 결합하여
 * scope×aspect 검증 전략 기반 최종 판정을 생성한다.
 *
 * v1(ScenarioSpec 6상태) → v2(PipeGraph 3상태: pass/fail/review)
 */

import type { PipeGraph } from "./types/pipe-spec.js";
import type { MatchResult } from "./path-matcher.js";
import type { GateResult } from "./pipe-gate.js";
import { hasReviewItems } from "./pipe-gate.js";
import { getChildFlows } from "./pipe-analyze.js";

// ── 타입 ─────────────────────────────────────────────

/** v2 판정: 3종 */
export type VerdictV2 = "pass" | "fail" | "review";

/** 패싯 커버리지 */
export interface FacetCoverage {
  /** 전체 패싯 수 */
  total: number;
  /** 커버된 패싯 수 */
  covered: number;
  /** 커버리지율 (0~100) */
  rate: number;
  /** 커버 안 된 패싯 목록 */
  uncoveredFacets: string[];
}

/** v2 판정 리포트 */
export interface VerdictReportV2 {
  /** PipeGraph ID */
  graphId: string;
  /** 최종 판정 */
  verdict: VerdictV2;
  /** scope (PipeGraph 컨텍스트) */
  scope?: string;
  /** aspect (PipeGraph 컨텍스트) */
  aspect?: string;

  /** PathMatcher 매칭 결과 */
  match: MatchResult;
  /** PipeGate 평가 결과 (제공 시) */
  gateResults: GateResult[];

  /** 파이프 커버리지 */
  pipeCoverage: {
    matched: number;
    missing: number;
    total: number;
    rate: number;
  };
  /** 패싯 커버리지 */
  facetCoverage: FacetCoverage;
  /** 에러 수 */
  errorCount: number;

  /** 판정 사유 */
  reasons: string[];
  /** 요약 문장 */
  summary: string;
  /** 판정 시각 */
  computedAt: string;
}

// ── 판정 함수 ────────────────────────────────────────

/**
 * PathMatcher 결과 + PipeGate 결과로 VerdictReport v2를 생성한다.
 *
 * 판정 규칙:
 *   fail: 실행 에러 / 파이프 커버리지 < 50% / 게이트 fail
 *   review: 일부 미실행 / 게이트 review / unexpected steps
 *   pass: 전체 매칭 + 게이트 통과
 */
export function computeVerdictV2(
  match: MatchResult,
  graph: PipeGraph,
  gateResults: GateResult[] = [],
): VerdictReportV2 {
  const facetCoverage = computeFacetCoverage(match, graph);
  const reasons: string[] = [];

  // 판정: PathMatcher verdict 수용 + 게이트 오버레이
  const verdict = determineVerdict(match, gateResults, reasons);

  // scope/aspect: 그래프 전체에서 가장 빈번한 것 또는 첫 파이프
  const firstPipe = graph.pipes[0];

  // 파이프 커버리지 (표시용 — 판정에는 PathMatcher 결과 사용)
  const matched = match.matchedPipes.length;
  const missing = match.missingPipes.length;
  const total = matched + missing;

  return {
    graphId: graph.graphId,
    verdict,
    scope: firstPipe?.scope,
    aspect: firstPipe?.aspect,
    match,
    gateResults,
    pipeCoverage: {
      matched,
      missing,
      total,
      rate: total > 0 ? Math.round((matched / total) * 100) : 0,
    },
    facetCoverage,
    errorCount: match.errorSteps.length,
    reasons,
    summary: buildSummary(verdict, match, facetCoverage, gateResults),
    computedAt: new Date().toISOString(),
  };
}

// ── 판정 결정 ────────────────────────────────────────

function determineVerdict(
  match: MatchResult,
  gateResults: GateResult[],
  reasons: string[],
): VerdictV2 {
  // 1. PathMatcher fail → fail (커버리지, 에러 등 PathMatcher가 판단)
  if (match.verdict === "fail") {
    reasons.push(match.reason);
    return "fail";
  }

  // 2. 게이트 fail → fail
  if (gateResults.length > 0 && gateResults.some(g => g.verdict === "fail")) {
    const failedGates = gateResults.filter(g => g.verdict === "fail");
    reasons.push(`게이트 실패 ${failedGates.length}건: ${failedGates.map(g => g.gateId).join(", ")}`);
    return "fail";
  }

  // 3. PathMatcher warn/degraded → review
  if (match.verdict === "warn" || match.verdict === "degraded") {
    reasons.push(match.reason);
    return "review";
  }

  // 4. 게이트 review → review
  if (gateResults.length > 0 && hasReviewItems(gateResults)) {
    reasons.push("게이트 review 항목 존재");
    return "review";
  }

  // 5. pass
  if (gateResults.length > 0) {
    reasons.push("전체 매칭 + 게이트 통과");
  } else {
    reasons.push("전체 매칭 성공");
  }
  return "pass";
}

// ── 패싯 커버리지 ────────────────────────────────────

function computeFacetCoverage(match: MatchResult, graph: PipeGraph): FacetCoverage {
  // 그래프에서 사용되는 전체 패싯 수집
  const allFacets = new Set<string>();
  for (const pipe of graph.pipes) {
    collectFacets(pipe.flow, allFacets);
  }

  // 실행된 패싯
  const coveredFacets = new Set(match.facetTrace);

  const uncovered = [...allFacets].filter(f => !coveredFacets.has(f));
  const total = allFacets.size;
  const covered = total - uncovered.length;

  return {
    total,
    covered,
    rate: total > 0 ? Math.round((covered / total) * 100) : 100,
    uncoveredFacets: uncovered,
  };
}

function collectFacets(flow: import("./types/pipe-spec.js").PipeFlow, out: Set<string>): void {
  if (flow.kind === "step" && flow.facet) {
    out.add(flow.facet);
    return;
  }
  for (const child of getChildFlows(flow)) {
    collectFacets(child, out);
  }
}

// ── 요약 문장 ────────────────────────────────────────

function buildSummary(
  verdict: VerdictV2,
  match: MatchResult,
  facetCoverage: FacetCoverage,
  gateResults: GateResult[],
): string {
  const parts: string[] = [];
  const matched = match.matchedPipes.length;
  const total = matched + match.missingPipes.length;
  const pipeRate = total > 0 ? Math.round((matched / total) * 100) : 100;

  parts.push(`판정: ${verdict.toUpperCase()}`);
  parts.push(`파이프 ${pipeRate}%`);

  if (facetCoverage.total > 0) {
    parts.push(`패싯 ${facetCoverage.rate}%`);
  }

  if (match.errorSteps.length > 0) {
    parts.push(`에러 ${match.errorSteps.length}건`);
  }

  if (gateResults.length > 0) {
    const gatePass = gateResults.filter(g => g.verdict === "pass").length;
    parts.push(`게이트 ${gatePass}/${gateResults.length}`);
  }

  return parts.join(" · ");
}

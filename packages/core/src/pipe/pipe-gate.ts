/**
 * PipeGraph 퀄리티 게이트 — 스펙 정의 + 자동 평가
 *
 * 각 게이트는 독립적으로 평가된다. 레벨(pipe/facet/scenario/graph)은
 * 분류 태그이며, 결과 합성은 하지 않는다.
 */

import type { PipeSpec, PipeGraph, PipeFlow } from "../types/pipe-spec.js";
import type { PipeConcern, PipeRole, PipeConcernMap, PipeImpactAnalysis } from "./pipe-interpret.js";
import { extractPipeConcerns, propagatePipeConcerns, analyzePipeImpact, classifyPipeRole } from "./pipe-interpret.js";
import { countGraphPaths } from "./pipe-path.js";
import { analyzePipeComplexity } from "./pipe-analyze.js";
import { normalizeEndpointPipeIds } from "./pipe-endpoint.js";

// ── 타입 정의 ─────────────────────────────────────────

/** 게이트 평가 레벨 (분류 태그) */
export type GateLevel = "pipe" | "facet" | "scenario" | "graph";

/** 게이트 기준 */
export type GateCriterion =
  | { type: "concern-present"; values: PipeConcern[] }
  | { type: "concern-absent"; values: PipeConcern[] }
  | { type: "role-is"; value: PipeRole }
  | { type: "blast-radius-max"; value: number }
  | { type: "path-coverage-min"; value: number }
  | { type: "no-isolated-pipes" }
  | { type: "max-complexity"; value: number }
  | { type: "all-pipes-have-concerns" }
  | { type: "no-unhandled-resilience" };

/** 게이트 스펙 */
export interface PipeGateSpec {
  /** 게이트 ID */
  id: string;
  /** 분류 레벨 */
  level: GateLevel;
  /** 평가 대상 (pipeId 또는 graphId) */
  target: string;
  /** 설명 */
  description?: string;
  /** 평가 기준 */
  criteria: GateCriterion[];
}

/** 기준 평가 결과 */
export interface CriterionResult {
  criterion: GateCriterion;
  pass: boolean;
  message: string;
  /** 측정된 실제값 */
  actual?: unknown;
}

/** 게이트 판정 */
export type GateVerdict = "pass" | "fail" | "review";

/** 하위 게이트 이슈 (review 판정 근거) */
export interface SubGateIssue {
  /** 이슈를 가진 게이트 ID */
  gateId: string;
  /** 이슈 레벨 */
  level: GateLevel;
  /** 실패한 기준 요약 */
  failedCriteria: string[];
}

/** 게이트 평가 결과 */
export interface GateResult {
  gateId: string;
  level: GateLevel;
  target: string;
  pass: boolean;
  /** 최종 판정: pass / fail / review (자신은 pass인데 하위 이슈 있음) */
  verdict: GateVerdict;
  results: CriterionResult[];
  /** 검토 필요한 하위 이슈 (verdict=review일 때) */
  subIssues: SubGateIssue[];
  /** 게이트 평가에 사용된 메트릭 */
  metrics: {
    concernCount?: number;
    blastRadius?: number;
    pathCoverage?: number;
    complexity?: number;
    isolatedPipes?: string[];
  };
}

// ── 게이트 평가 ───────────────────────────────────────

/**
 * 게이트 스펙을 PipeGraph에 대해 평가한다.
 *
 * @param spec 게이트 스펙
 * @param graph 평가 대상 그래프
 * @param executedPipeIds 시뮬레이션에서 실행된 파이프 (path-coverage-min용)
 * @param executedPathCount 실제 실행된 경로 수 (미제공 시 executedPipeIds.size 근사치 사용)
 */
export function evaluateGate(
  spec: PipeGateSpec,
  graph: PipeGraph,
  executedPipeIds?: Set<string>,
  executedPathCount?: number,
): GateResult {
  const results: CriterionResult[] = [];
  const metrics: GateResult["metrics"] = {};

  // 미리 계산 (필요할 때만)
  let _concernMap: PipeConcernMap | undefined;
  const getConcernMap = () => _concernMap ??= propagatePipeConcerns(graph);

  let _impact: PipeImpactAnalysis | undefined;
  const getImpact = () => _impact ??= analyzePipeImpact(graph, spec.target);

  const targetPipe = graph.pipes.find(p => p.pipeId === spec.target);

  for (const criterion of spec.criteria) {
    results.push(evaluateCriterion(criterion, graph, targetPipe, getConcernMap, getImpact, executedPipeIds, executedPathCount, metrics));
  }

  const pass = results.every(r => r.pass);
  return {
    gateId: spec.id,
    level: spec.level,
    target: spec.target,
    pass,
    verdict: pass ? "pass" : "fail",
    results,
    subIssues: [],
    metrics,
  };
}

/** 개별 기준 평가 */
function evaluateCriterion(
  criterion: GateCriterion,
  graph: PipeGraph,
  targetPipe: PipeSpec | undefined,
  getConcernMap: () => PipeConcernMap,
  getImpact: () => PipeImpactAnalysis,
  executedPipeIds: Set<string> | undefined,
  executedPathCount: number | undefined,
  metrics: GateResult["metrics"],
): CriterionResult {
  switch (criterion.type) {
    case "concern-present": {
      if (!targetPipe) {
        // graph 레벨: 그래프 전체에서 해당 concern이 존재하는지
        const map = getConcernMap();
        const allConcerns = new Set<PipeConcern>();
        for (const [, entry] of map) entry.all.forEach(c => allConcerns.add(c));
        const missing = criterion.values.filter(c => !allConcerns.has(c));
        metrics.concernCount = allConcerns.size;
        return {
          criterion, pass: missing.length === 0,
          message: missing.length === 0 ? "모든 관심사 존재" : `미존재: ${missing.join(", ")}`,
          actual: [...allConcerns],
        };
      }
      const concerns = extractPipeConcerns(targetPipe);
      const missing = criterion.values.filter(c => !concerns.includes(c));
      return {
        criterion, pass: missing.length === 0,
        message: missing.length === 0 ? "모든 관심사 존재" : `미존재: ${missing.join(", ")}`,
        actual: concerns,
      };
    }

    case "concern-absent": {
      if (!targetPipe) return { criterion, pass: true, message: "graph 레벨 — 스킵" };
      const concerns = extractPipeConcerns(targetPipe);
      const present = criterion.values.filter(c => concerns.includes(c));
      return {
        criterion, pass: present.length === 0,
        message: present.length === 0 ? "금지 관심사 없음" : `존재하면 안 됨: ${present.join(", ")}`,
        actual: concerns,
      };
    }

    case "role-is": {
      if (!targetPipe) return { criterion, pass: false, message: `파이프 미발견` };
      const role = classifyPipeRole(targetPipe);
      return {
        criterion, pass: role === criterion.value,
        message: role === criterion.value ? `역할 일치: ${role}` : `기대: ${criterion.value}, 실제: ${role}`,
        actual: role,
      };
    }

    case "blast-radius-max": {
      const impact = getImpact();
      metrics.blastRadius = impact.blastRadius;
      return {
        criterion, pass: impact.blastRadius <= criterion.value,
        message: `blastRadius=${impact.blastRadius} (최대: ${criterion.value})`,
        actual: impact.blastRadius,
      };
    }

    case "path-coverage-min": {
      if (executedPathCount == null) {
        // 경로 커버리지는 실제 실행 경로 수가 필수. 근사치 사용 안 함
        metrics.pathCoverage = undefined;
        return {
          criterion, pass: false,
          message: "executedPathCount 미제공 — 경로 커버리지 계산 불가",
          actual: undefined,
        };
      }
      const totalPaths = countGraphPaths(graph);
      const coverage = totalPaths > 0 ? executedPathCount / totalPaths : 0;
      metrics.pathCoverage = coverage;
      return {
        criterion, pass: coverage >= criterion.value,
        message: `pathCoverage=${(coverage * 100).toFixed(0)}% (최소: ${(criterion.value * 100).toFixed(0)}%)`,
        actual: coverage,
      };
    }

    case "no-isolated-pipes": {
      const connected = new Set<string>();
      for (const conn of graph.connections) {
        const froms = normalizeEndpointPipeIds(conn.from);
        const tos = normalizeEndpointPipeIds(conn.to);
        froms.forEach(f => connected.add(f));
        tos.forEach(t => connected.add(t));
      }
      const isolated = graph.pipes.filter(p => !connected.has(p.pipeId)).map(p => p.pipeId);
      // 단일 파이프 그래프는 고립이 아님
      if (graph.pipes.length === 1) {
        return { criterion, pass: true, message: "단일 파이프 그래프", actual: [] };
      }
      metrics.isolatedPipes = isolated;
      return {
        criterion, pass: isolated.length === 0,
        message: isolated.length === 0 ? "고립 파이프 없음" : `고립: ${isolated.join(", ")}`,
        actual: isolated,
      };
    }

    case "max-complexity": {
      const complexity = analyzePipeComplexity(graph);
      metrics.complexity = complexity.totalPaths;
      return {
        criterion, pass: complexity.totalPaths <= criterion.value,
        message: `totalPaths=${complexity.totalPaths} (최대: ${criterion.value})`,
        actual: complexity.totalPaths,
      };
    }

    case "all-pipes-have-concerns": {
      const map = getConcernMap();
      const noConcern = graph.pipes.filter(p => {
        const entry = map.get(p.pipeId);
        return !entry || entry.all.length === 0;
      }).map(p => p.pipeId);
      return {
        criterion, pass: noConcern.length === 0,
        message: noConcern.length === 0 ? "모든 파이프에 관심사 있음" : `관심사 없음: ${noConcern.join(", ")}`,
        actual: noConcern,
      };
    }

    case "no-unhandled-resilience": {
      // resilience 관심사가 있는 파이프는 retry/circuit-breaker/fallback이 있어야 함
      const map = getConcernMap();
      const unhandled: string[] = [];
      for (const pipe of graph.pipes) {
        const entry = map.get(pipe.pipeId);
        if (!entry?.all.includes("resilience")) continue;
        // 직접 resilience가 있으면 이미 처리됨 (retry/fallback/circuit-breaker 보유)
        if (entry.direct.includes("resilience")) continue;
        // 상속된 resilience만 있고 자체 내결함 패턴 없음 → 미처리
        unhandled.push(pipe.pipeId);
      }
      return {
        criterion, pass: unhandled.length === 0,
        message: unhandled.length === 0 ? "모든 resilience 처리됨" : `미처리: ${unhandled.join(", ")}`,
        actual: unhandled,
      };
    }
  }
}

// ── 배치 평가 ─────────────────────────────────────────

/** 레벨 우선순위 (낮은 수 = 하위) */
const LEVEL_ORDER: Record<GateLevel, number> = {
  pipe: 0,
  facet: 1,
  scenario: 2,
  graph: 3,
};

/**
 * 여러 게이트를 한번에 평가한다.
 *
 * 평가 후 레벨 간 review 판정:
 *   - 상위 레벨 게이트가 pass인데, 하위 레벨 게이트 중 fail이 있으면
 *     상위 게이트의 verdict를 "review"로 변경하고 subIssues에 하위 이슈 수집.
 */
export function evaluateGates(
  specs: PipeGateSpec[],
  graph: PipeGraph,
  executedPipeIds?: Set<string>,
  executedPathCount?: number,
): GateResult[] {
  const results = specs.map(spec => evaluateGate(spec, graph, executedPipeIds, executedPathCount));

  // 하위 레벨 실패 수집
  const failedByLevel = new Map<GateLevel, SubGateIssue[]>();
  for (const r of results) {
    if (!r.pass) {
      const issues = failedByLevel.get(r.level) ?? [];
      issues.push({
        gateId: r.gateId,
        level: r.level,
        failedCriteria: r.results.filter(c => !c.pass).map(c => c.message),
      });
      failedByLevel.set(r.level, issues);
    }
  }

  // 상위 레벨 pass 게이트에 review 판정
  for (const r of results) {
    if (!r.pass) continue; // 이미 fail

    const myOrder = LEVEL_ORDER[r.level];
    const subIssues: SubGateIssue[] = [];

    for (const [level, issues] of failedByLevel) {
      if (LEVEL_ORDER[level] < myOrder) {
        subIssues.push(...issues);
      }
    }

    if (subIssues.length > 0) {
      r.verdict = "review";
      (r.subIssues as SubGateIssue[]) = subIssues;
    }
  }

  return results;
}

/** 전체 게이트 통과 여부 (AND) */
export function allGatesPass(results: GateResult[]): boolean {
  return results.every(r => r.pass);
}

/** review 필요 여부 — pass인데 하위 이슈 있음 */
export function hasReviewItems(results: GateResult[]): boolean {
  return results.some(r => r.verdict === "review");
}

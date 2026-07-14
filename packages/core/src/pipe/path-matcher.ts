// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * PathMatcher — 실행 결과 ↔ PipeGraph 매칭
 *
 * PipeRunner의 RunResult를 PipeGraph와 매칭하여
 * 어떤 경로가 실행되었는지, 기대와 일치하는지 판정한다.
 * 기존 VerdictReport(ScenarioSpec 기반)를 대체.
 */

import type { PipeGraph, PipeSpec } from '../types/pipe-spec.js';
import type { RunResult, ExecutedStep } from '../types/pipe-runtime.js';
import { normalizeEndpointPipeIds } from './pipe-endpoint.js';

// ── 매칭 결과 ────────────────────────────────────────

export interface MatchResult {
  /** 매칭된 파이프 경로 */
  matchedPipes: string[];
  /** 실행됐지만 그래프에 없는 step */
  unexpectedSteps: ExecutedStep[];
  /** 그래프에 있지만 실행 안 된 파이프 */
  missingPipes: string[];
  /** 실행된 패싯 순서 */
  facetTrace: string[];
  /** 에러 발생 step */
  errorSteps: ExecutedStep[];
  /** 최종 판정 */
  verdict: 'pass' | 'fail' | 'warn' | 'degraded';
  /** 판정 사유 */
  reason: string;
}

// ── PathMatcher ──────────────────────────────────────

/** 실행 결과와 PipeGraph를 매칭하여 판정 */
export function matchPath(result: RunResult, graph: PipeGraph): MatchResult {
  const graphPipeIds = new Set(graph.pipes.map((p) => p.pipeId));
  const executedPipeIds = new Set(
    result.steps.filter((s) => s.kind === 'step').map((s) => s.pipeId),
  );

  // 매칭된 파이프
  const matchedPipes = [...executedPipeIds].filter((id) => graphPipeIds.has(id));

  // 그래프에 없는 step (unexpected)
  const unexpectedSteps = result.steps.filter(
    (s) => s.kind === 'step' && !graphPipeIds.has(s.pipeId),
  );

  // 실행 안 된 파이프 (missing) — entry에서 도달 가능한 것만
  const reachable = getReachablePipes(graph);
  const missingPipes = [...reachable].filter((id) => !executedPipeIds.has(id));

  // 패싯 순서
  const facetTrace = result.steps.filter((s) => s.kind === 'step' && s.facet).map((s) => s.facet!);

  // 에러 step
  const errorSteps = result.steps.filter((s) => s.status === 'error');

  // 판정
  const { verdict, reason } = computeVerdict({
    status: result.status,
    matchedPipes,
    missingPipes,
    unexpectedSteps,
    errorSteps,
    totalGraphPipes: reachable.size,
  });

  return {
    matchedPipes,
    unexpectedSteps,
    missingPipes,
    facetTrace,
    errorSteps,
    verdict,
    reason,
  };
}

// ── 판정 규칙 ────────────────────────────────────────

function computeVerdict(input: {
  status: RunResult['status'];
  matchedPipes: string[];
  missingPipes: string[];
  unexpectedSteps: ExecutedStep[];
  errorSteps: ExecutedStep[];
  totalGraphPipes: number;
}): { verdict: MatchResult['verdict']; reason: string } {
  const { status, matchedPipes, missingPipes, unexpectedSteps, errorSteps, totalGraphPipes } =
    input;

  // 실행 자체가 실패
  if (status === 'error') {
    return {
      verdict: 'fail',
      reason: `실행 에러: ${errorSteps.length}건 — ${errorSteps.map((s) => `${s.pipeId}/${s.flowPath}`).join(', ')}`,
    };
  }

  if (status === 'cancelled') {
    return { verdict: 'fail', reason: '실행 취소됨' };
  }

  if (status === 'max-steps') {
    return { verdict: 'fail', reason: '최대 스텝 초과 (무한 루프 의심)' };
  }

  // 에러 step이 있으면
  if (errorSteps.length > 0) {
    return {
      verdict: 'fail',
      reason: `에러 ${errorSteps.length}건: ${errorSteps.map((s) => s.error?.code ?? 'UNKNOWN').join(', ')}`,
    };
  }

  // 도달 가능한 파이프 중 미실행
  if (missingPipes.length > 0) {
    const coverage =
      totalGraphPipes > 0 ? Math.round((matchedPipes.length / totalGraphPipes) * 100) : 0;

    if (coverage < 50) {
      return {
        verdict: 'fail',
        reason: `파이프 커버리지 ${coverage}% — 미실행: ${missingPipes.join(', ')}`,
      };
    }

    return {
      verdict: 'warn',
      reason: `파이프 커버리지 ${coverage}% — 미실행: ${missingPipes.join(', ')}`,
    };
  }

  // 예상치 못한 step
  if (unexpectedSteps.length > 0) {
    return {
      verdict: 'warn',
      reason: `예상치 못한 step ${unexpectedSteps.length}건`,
    };
  }

  return { verdict: 'pass', reason: '전체 파이프 매칭 성공' };
}

// ── 헬퍼 ─────────────────────────────────────────────

function getReachablePipes(graph: PipeGraph): Set<string> {
  const reachable = new Set<string>();

  function walk(pipeId: string): void {
    if (reachable.has(pipeId)) return;
    reachable.add(pipeId);

    // connections에서 나가는 연결 탐색
    for (const conn of graph.connections) {
      const froms = normalizeEndpointPipeIds(conn.from);
      if (froms.includes(pipeId)) {
        const tos = normalizeEndpointPipeIds(conn.to);
        for (const to of tos) walk(to);
      }
    }

    // produces → trigger 매칭으로 도달 가능한 파이프
    const pipe = graph.pipes.find((p) => p.pipeId === pipeId);
    if (pipe?.produces) {
      for (const eventKey of pipe.produces) {
        for (const p of graph.pipes) {
          if (p.trigger.eventKey === eventKey) walk(p.pipeId);
        }
      }
    }
  }

  walk(graph.entryPipeId);
  return reachable;
}

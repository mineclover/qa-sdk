/**
 * PipeGraph 분석 — 복잡도 메트릭, 커버리지, 병목 감지
 */

import type { PipeFlow, PipeSpec, PipeGraph } from "./types/pipe-spec.js";
import { countPipePaths, countGraphPaths } from "./pipe-path.js";

// ── 복잡도 메트릭 ────────────────────────────────────

export interface PipeComplexity {
  /** 그래프 ID */
  graphId: string;
  /** 파이프 노드 수 */
  pipeCount: number;
  /** 연결 수 */
  connectionCount: number;
  /** 전체 도달 가능 경로 수 */
  totalPaths: number;
  /** 파이프별 내부 경로 수 */
  pathsPerPipe: Record<string, number>;
  /** 가장 복잡한 파이프 (내부 경로 수 최대) */
  mostComplexPipe: { pipeId: string; paths: number } | null;
  /** 최대 흐름 중첩 깊이 */
  maxFlowDepth: number;
  /** 파이프별 흐름 중첩 깊이 */
  depthPerPipe: Record<string, number>;
  /** 사용된 흐름 제어 종류 */
  usedFlowKinds: string[];
  /** 사용된 연결 종류 */
  usedConnectionKinds: string[];
}

/** 그래프 복잡도 분석 */
export function analyzePipeComplexity(graph: PipeGraph): PipeComplexity {
  const pathsPerPipe: Record<string, number> = {};
  const depthPerPipe: Record<string, number> = {};
  const flowKinds = new Set<string>();

  let maxPaths = 0;
  let mostComplexPipe: { pipeId: string; paths: number } | null = null;
  let maxDepth = 0;

  for (const pipe of graph.pipes) {
    const paths = countPipePaths(pipe.flow);
    pathsPerPipe[pipe.pipeId] = paths;
    if (paths > maxPaths) {
      maxPaths = paths;
      mostComplexPipe = { pipeId: pipe.pipeId, paths };
    }

    const depth = measureFlowDepth(pipe.flow);
    depthPerPipe[pipe.pipeId] = depth;
    if (depth > maxDepth) maxDepth = depth;

    collectFlowKinds(pipe.flow, flowKinds);
  }

  const connectionKinds = new Set(graph.connections.map(c => c.kind));

  return {
    graphId: graph.graphId,
    pipeCount: graph.pipes.length,
    connectionCount: graph.connections.length,
    totalPaths: countGraphPaths(graph),
    pathsPerPipe,
    mostComplexPipe,
    maxFlowDepth: maxDepth,
    depthPerPipe,
    usedFlowKinds: [...flowKinds],
    usedConnectionKinds: [...connectionKinds],
  };
}

// ── 병목 감지 ─────────────────────────────────────────

export interface BottleneckReport {
  /** fan-in이 높은 파이프 (많은 곳에서 연결 들어옴) */
  highFanIn: Array<{ pipeId: string; fanIn: number }>;
  /** fan-out이 높은 파이프 (많은 곳으로 연결 나감) */
  highFanOut: Array<{ pipeId: string; fanOut: number }>;
  /** retry/circuit-breaker가 있는 파이프 (실패 가능 지점) */
  failurePoints: Array<{ pipeId: string; kinds: string[] }>;
  /** timeout이 있는 파이프 (지연 가능 지점) */
  latencyPoints: Array<{ pipeId: string; totalTimeout: number }>;
  /** 경로 수가 임계값 이상인 파이프 */
  complexPipes: Array<{ pipeId: string; paths: number }>;
}

/** 병목 감지 (임계값: fan-in/out ≥ 3, 경로 ≥ 5) */
export function findBottlenecks(
  graph: PipeGraph,
  thresholds?: { fanIn?: number; fanOut?: number; paths?: number },
): BottleneckReport {
  const fanInThreshold = thresholds?.fanIn ?? 3;
  const fanOutThreshold = thresholds?.fanOut ?? 3;
  const pathThreshold = thresholds?.paths ?? 5;

  // fan-in/fan-out 계산
  const fanInCount: Record<string, number> = {};
  const fanOutCount: Record<string, number> = {};
  for (const pipe of graph.pipes) {
    fanInCount[pipe.pipeId] = 0;
    fanOutCount[pipe.pipeId] = 0;
  }

  for (const conn of graph.connections) {
    const froms = Array.isArray(conn.from) ? conn.from : [conn.from];
    const tos = Array.isArray(conn.to) ? conn.to : [conn.to];
    for (const f of froms) fanOutCount[f] = (fanOutCount[f] ?? 0) + tos.length;
    for (const t of tos) fanInCount[t] = (fanInCount[t] ?? 0) + froms.length;
  }

  const highFanIn = Object.entries(fanInCount)
    .filter(([, count]) => count >= fanInThreshold)
    .map(([pipeId, fanIn]) => ({ pipeId, fanIn }));

  const highFanOut = Object.entries(fanOutCount)
    .filter(([, count]) => count >= fanOutThreshold)
    .map(([pipeId, fanOut]) => ({ pipeId, fanOut }));

  // 실패/지연 가능 지점
  const failurePoints: BottleneckReport["failurePoints"] = [];
  const latencyPoints: BottleneckReport["latencyPoints"] = [];
  const complexPipes: BottleneckReport["complexPipes"] = [];

  for (const pipe of graph.pipes) {
    const failureKinds = collectFailureKinds(pipe.flow);
    if (failureKinds.length > 0) {
      failurePoints.push({ pipeId: pipe.pipeId, kinds: failureKinds });
    }

    const totalTimeout = collectTotalTimeout(pipe.flow);
    if (totalTimeout > 0) {
      latencyPoints.push({ pipeId: pipe.pipeId, totalTimeout });
    }

    const paths = countPipePaths(pipe.flow);
    if (paths >= pathThreshold) {
      complexPipes.push({ pipeId: pipe.pipeId, paths });
    }
  }

  return { highFanIn, highFanOut, failurePoints, latencyPoints, complexPipes };
}

// ── 커버리지 분석 ─────────────────────────────────────

export interface CoverageReport {
  /** 전체 파이프 수 */
  totalPipes: number;
  /** 실행된 파이프 수 */
  executedPipes: number;
  /** 파이프 커버리지 (%) */
  pipeCoverage: number;
  /** 전체 경로 수 */
  totalPaths: number;
  /** 실행된 경로 수 */
  executedPaths: number;
  /** 경로 커버리지 (%) */
  pathCoverage: number;
  /** 미실행 파이프 목록 */
  uncoveredPipes: string[];
}

/** 커버리지 분석 (실행된 pipeId 집합 기준) */
export function analyzeCoverage(
  graph: PipeGraph,
  executedPipeIds: Set<string>,
  executedPathCount?: number,
): CoverageReport {
  const totalPipes = graph.pipes.length;
  const executedPipes = graph.pipes.filter(p => executedPipeIds.has(p.pipeId)).length;
  const uncoveredPipes = graph.pipes
    .filter(p => !executedPipeIds.has(p.pipeId))
    .map(p => p.pipeId);

  const totalPaths = countGraphPaths(graph);
  const executedPaths = executedPathCount ?? executedPipes; // 근사치

  return {
    totalPipes,
    executedPipes,
    pipeCoverage: totalPipes > 0 ? Math.round((executedPipes / totalPipes) * 100) : 0,
    totalPaths,
    executedPaths,
    pathCoverage: totalPaths > 0 ? Math.round((executedPaths / totalPaths) * 100) : 0,
    uncoveredPipes,
  };
}

// ── 내부 헬퍼 ─────────────────────────────────────────

function measureFlowDepth(flow: PipeFlow, depth = 1): number {
  const children = getChildFlows(flow);
  if (children.length === 0) return depth;
  return Math.max(...children.map(c => measureFlowDepth(c, depth + 1)));
}

function collectFlowKinds(flow: PipeFlow, kinds: Set<string>): void {
  kinds.add(flow.kind);
  for (const child of getChildFlows(flow)) collectFlowKinds(child, kinds);
}

function collectFailureKinds(flow: PipeFlow): string[] {
  const kinds: string[] = [];
  function walk(f: PipeFlow): void {
    if (f.kind === "retry" || f.kind === "fallback" || f.kind === "circuit-breaker" || f.kind === "compensate") {
      kinds.push(f.kind);
    }
    for (const child of getChildFlows(f)) walk(child);
  }
  walk(flow);
  return kinds;
}

function collectTotalTimeout(flow: PipeFlow): number {
  let total = 0;
  function walk(f: PipeFlow): void {
    if (f.kind === "step" && f.timeout) total += f.timeout;
    if (f.kind === "timeout") total += f.duration;
    if (f.kind === "await" && f.timeout) total += f.timeout;
    for (const child of getChildFlows(f)) walk(child);
  }
  walk(flow);
  return total;
}

export function getChildFlows(flow: PipeFlow): PipeFlow[] {
  switch (flow.kind) {
    case "step": case "emit": return [];
    case "sequence": case "parallel": case "race": return flow.steps;
    case "branch": return flow.paths;
    case "optional": case "retry": case "throttle": case "debounce":
    case "circuit-breaker": case "filter": case "dedup":
    case "resequence": return [flow.step];
    case "loop": case "buffer": case "window": case "feedback": return [flow.body];
    case "map": case "split": return [flow.itemFlow];
    case "reduce": case "enrich": return [flow.step];
    case "fallback": return [flow.try, flow.catch];
    case "compensate": return [flow.forward, flow.compensate];
    case "finally": return [flow.body, flow.cleanup];
    case "await": return [flow.then];
    case "timeout": return flow.onTimeout ? [flow.body, flow.onTimeout] : [flow.body];
    case "tap": return [flow.observe, flow.step];
    case "correlation": return flow.onTimeout ? [flow.onMatch, flow.onTimeout] : [flow.onMatch];
    default: return [];
  }
}

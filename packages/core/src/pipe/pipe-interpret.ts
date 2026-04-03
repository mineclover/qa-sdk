/**
 * PipeGraph 해석 — 관심사 추출/전파 + 영향 분석 + 역할 분류
 *
 * definition-catalog의 BFS 알고리즘 패턴을 차용하되,
 * PipeGraph 도메인의 고유 용어(PipeConcern, ConnectionKind)를 사용한다.
 */

import type {
  PipeSpec, PipeGraph, ConnectionKind, PipeFlow,
} from "../types/pipe-spec.js";
import { getChildFlows } from "./pipe-flow-utils.js";
import { normalize } from "./pipe-fold.js";
import { resolvePorts } from "./pipe-port.js";

// ── 타입 정의 ─────────────────────────────────────────

/** 파이프 흐름 패턴에서 추론되는 8종 관심사 */
export type PipeConcern =
  | "resilience"      // retry, circuit-breaker, fallback
  | "latency"         // timeout, await, step.timeout
  | "concurrency"     // parallel, race
  | "data-mutation"   // accesses mode:"write"|"readwrite"
  | "data-read"       // accesses mode:"read"|"readwrite"
  | "async-coupling"  // emit, correlation
  | "data-filtering"  // dedup, filter
  | "observability";  // tap

/** 전파를 통해 상속된 관심사 */
export interface InheritedPipeConcern {
  readonly concern: PipeConcern;
  /** 출처 파이프 ID */
  readonly from: string;
  /** 전파 연결 종류 */
  readonly via: ConnectionKind;
  /** 전파 경로 */
  readonly path: readonly string[];
}

/** 파이프의 effective 관심사 */
export interface PipeConcernEntry {
  readonly direct: readonly PipeConcern[];
  readonly inherited: readonly InheritedPipeConcern[];
  /** direct ∪ inherited */
  readonly all: readonly PipeConcern[];
}

/** 그래프 전체 관심사 맵 */
export type PipeConcernMap = Map<string, PipeConcernEntry>;

/** 영향받는 파이프 */
export interface ImpactedPipe {
  readonly pipeId: string;
  readonly via: ConnectionKind;
  readonly path: readonly string[];
  readonly direction: "downstream" | "upstream";
  readonly depth: number;
}

/** 변경 영향 분석 결과 */
export interface PipeImpactAnalysis {
  readonly sourceId: string;
  readonly impacted: readonly ImpactedPipe[];
  readonly blastRadius: number;
  readonly byConcern: Readonly<Record<PipeConcern, number>>;
}

/** 파이프 역할 */
export type PipeRole =
  | "producer"     // 출력 포트 또는 emit 중심
  | "consumer"     // 입력 위주 소비
  | "transformer"  // 입력+출력 포트 공존
  | "router"       // branch 중심, 데이터 포트 없음
  | "observer";    // tap 중심, 출력 포트 없음

// ── 전파 규칙 ─────────────────────────────────────────

type PropagateDirection = "downstream" | "upstream" | "bidirectional";

interface PipePropagationRule {
  readonly connectionKind: ConnectionKind;
  readonly direction: PropagateDirection;
  readonly propagates: readonly PipeConcern[];
}

/** ConnectionKind별 관심사 전파 규칙 */
export const PIPE_PROPAGATION_RULES: readonly PipePropagationRule[] = [
  { connectionKind: "next",       direction: "downstream",    propagates: ["resilience", "latency", "data-mutation"] },
  { connectionKind: "conditional", direction: "downstream",   propagates: ["latency"] },
  { connectionKind: "event",      direction: "downstream",    propagates: ["async-coupling"] },
  { connectionKind: "error",      direction: "downstream",    propagates: ["resilience"] },
  { connectionKind: "compensate", direction: "bidirectional", propagates: ["resilience", "data-mutation"] },
  { connectionKind: "fan-out",    direction: "downstream",    propagates: ["concurrency", "latency"] },
  { connectionKind: "join",       direction: "downstream",    propagates: ["concurrency", "latency"] },
  { connectionKind: "feedback",   direction: "upstream",      propagates: ["latency"] },
];

// 룩업 인덱스
const PROPAGATION_INDEX = new Map<ConnectionKind, { direction: PropagateDirection; concerns: Set<PipeConcern> }>();
for (const rule of PIPE_PROPAGATION_RULES) {
  PROPAGATION_INDEX.set(rule.connectionKind, {
    direction: rule.direction,
    concerns: new Set(rule.propagates),
  });
}

// ── 핵심 함수 ─────────────────────────────────────────

/**
 * 단일 파이프의 PipeFlow 트리에서 직접 관심사를 추출한다.
 */
export function extractPipeConcerns(pipe: PipeSpec): PipeConcern[] {
  const concerns = new Set<PipeConcern>();

  function walk(flow: PipeFlow): void {
    switch (flow.kind) {
      case "retry":
      case "circuit-breaker":
      case "fallback":
        concerns.add("resilience");
        break;
      case "timeout":
        concerns.add("latency");
        break;
      case "await":
        concerns.add("latency");
        break;
      case "parallel":
      case "race":
        concerns.add("concurrency");
        break;
      case "emit":
        concerns.add("async-coupling");
        break;
      case "correlation":
        concerns.add("async-coupling");
        break;
      case "dedup":
      case "filter":
        concerns.add("data-filtering");
        break;
      case "tap":
        concerns.add("observability");
        break;
      case "transition-scope":
        if (flow.compensate) concerns.add("resilience");
        break;
      case "step":
        // step 레벨 timeout
        if (flow.timeout) concerns.add("latency");
        // dataContract.accesses
        if (flow.dataContract?.accesses) {
          for (const access of flow.dataContract.accesses) {
            if (access.mode === "write" || access.mode === "readwrite") {
              concerns.add("data-mutation");
            }
            if (access.mode === "read" || access.mode === "readwrite") {
              concerns.add("data-read");
            }
          }
        }
        break;
    }

    for (const child of getChildFlows(flow)) walk(child);
  }

  walk(pipe.flow);
  return [...concerns];
}

/**
 * 모든 파이프의 effective 관심사를 BFS로 계산한다.
 */
export function propagatePipeConcerns(graph: PipeGraph): PipeConcernMap {
  // Phase 1: 직접 관심사 추출
  const directMap = new Map<string, PipeConcern[]>();
  for (const pipe of graph.pipes) {
    directMap.set(pipe.pipeId, extractPipeConcerns(pipe));
  }

  // Phase 2: 인접 리스트 구축
  // adjacency[pipeId] = [{ neighbor, kind, adjDirection }]
  //   adjDirection: "incoming" = neighbor→this, "outgoing" = this→neighbor
  type AdjEntry = { neighbor: string; kind: ConnectionKind; adjDirection: "incoming" | "outgoing" };
  const adjacency = new Map<string, AdjEntry[]>();

  for (const pipe of graph.pipes) {
    adjacency.set(pipe.pipeId, []);
  }

  for (const conn of graph.connections) {
    const froms = normalize(conn.from);
    const tos = normalize(conn.to);
    for (const f of froms) {
      for (const t of tos) {
        adjacency.get(f)?.push({ neighbor: t, kind: conn.kind, adjDirection: "outgoing" });
        adjacency.get(t)?.push({ neighbor: f, kind: conn.kind, adjDirection: "incoming" });
      }
    }
  }

  // Phase 3: 각 파이프에서 역방향 BFS — 자신에게 도달하는 관심사 수집
  const resultMap: PipeConcernMap = new Map();

  for (const pipe of graph.pipes) {
    const inherited: InheritedPipeConcern[] = [];
    const visited = new Set<string>([pipe.pipeId]);

    // 초기 큐: 인접 파이프들
    type QueueItem = {
      pipeId: string;
      path: string[];
      viaKind: ConnectionKind;
      propagatable: Set<PipeConcern>;
    };
    const queue: QueueItem[] = [];

    for (const adj of adjacency.get(pipe.pipeId) ?? []) {
      const rule = PROPAGATION_INDEX.get(adj.kind);
      if (!rule) continue;

      // 전파 방향 매칭:
      //   downstream 규칙: 현재 파이프가 to (incoming 연결)일 때 source에서 전파
      //   upstream 규칙: 현재 파이프가 from (outgoing 연결)일 때 target에서 전파
      //   bidirectional: 양방향
      if (shouldPropagate(rule.direction, adj.adjDirection)) {
        queue.push({
          pipeId: adj.neighbor,
          path: [pipe.pipeId, adj.neighbor],
          viaKind: adj.kind,
          propagatable: new Set(rule.concerns),
        });
      }
    }

    // BFS
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const { pipeId: srcId, path, viaKind, propagatable } = current;
      if (visited.has(srcId)) continue;
      visited.add(srcId);

      // srcId의 직접 관심사 중 전파 가능한 것만 상속
      const srcDirect = directMap.get(srcId) ?? [];
      for (const concern of srcDirect) {
        if (propagatable.has(concern)) {
          inherited.push({ concern, from: srcId, via: viaKind, path: [...path] });
        }
      }

      // 전이적 전파: srcId의 이웃으로 더 탐색
      for (const nextAdj of adjacency.get(srcId) ?? []) {
        if (visited.has(nextAdj.neighbor)) continue;
        const nextRule = PROPAGATION_INDEX.get(nextAdj.kind);
        if (!nextRule) continue;
        if (!shouldPropagate(nextRule.direction, nextAdj.adjDirection)) continue;

        // 관심사 교집합 — 체인 전파 시 좁아짐
        const nextPropagatable = new Set<PipeConcern>();
        for (const c of propagatable) {
          if (nextRule.concerns.has(c)) nextPropagatable.add(c);
        }
        if (nextPropagatable.size === 0) continue;

        queue.push({
          pipeId: nextAdj.neighbor,
          path: [...path, nextAdj.neighbor],
          viaKind: nextAdj.kind,
          propagatable: nextPropagatable,
        });
      }
    }

    const direct = directMap.get(pipe.pipeId) ?? [];
    const allConcerns = [...new Set([...direct, ...inherited.map(i => i.concern)])];
    resultMap.set(pipe.pipeId, { direct, inherited, all: allConcerns });
  }

  return resultMap;
}

/** 전파 방향 매칭
 *
 * 모든 연결에서 concern은 화살표 방향(from→to)으로 전파된다.
 * direction 필드는 메인 데이터 흐름 대비 전파 방향을 기술하는 메타데이터:
 *   - "downstream" (next, conditional 등): 데이터 흐름과 같은 방향
 *   - "upstream" (feedback): 데이터 흐름 역방향 (하지만 화살표 방향으로 전파)
 *   - "bidirectional" (compensate): 양방향
 *
 * 수신 파이프 관점에서:
 *   - incoming 연결(from→this) → 항상 전파 (화살표 따라 도달)
 *   - outgoing 연결(this→to) → bidirectional만 전파 (역방향 도달)
 */
function shouldPropagate(
  ruleDirection: PropagateDirection,
  adjDirection: "incoming" | "outgoing",
): boolean {
  if (ruleDirection === "bidirectional") return true;
  // downstream/upstream 모두: concern은 화살표(from→to) 따라 전파
  // 수신자 관점에서는 incoming 연결에서만 도달
  return adjDirection === "incoming";
}

/**
 * 변경된 파이프에서 BFS로 영향 범위를 계산한다.
 */
export function analyzePipeImpact(
  graph: PipeGraph,
  pipeId: string,
): PipeImpactAnalysis {
  const pipeSet = new Set(graph.pipes.map(p => p.pipeId));
  const emptyConcern: Record<PipeConcern, number> = {
    "resilience": 0, "latency": 0, "concurrency": 0,
    "data-mutation": 0, "data-read": 0, "async-coupling": 0,
    "data-filtering": 0, "observability": 0,
  };

  if (!pipeSet.has(pipeId)) {
    return { sourceId: pipeId, impacted: [], blastRadius: 0, byConcern: emptyConcern };
  }

  // 관심사 맵 (byConcern 집계용)
  const concernMap = propagatePipeConcerns(graph);

  // 인접 리스트
  const outAdj = new Map<string, Array<{ neighbor: string; kind: ConnectionKind }>>();
  const inAdj = new Map<string, Array<{ neighbor: string; kind: ConnectionKind }>>();
  for (const p of graph.pipes) {
    outAdj.set(p.pipeId, []);
    inAdj.set(p.pipeId, []);
  }
  for (const conn of graph.connections) {
    const froms = normalize(conn.from);
    const tos = normalize(conn.to);
    for (const f of froms) {
      for (const t of tos) {
        outAdj.get(f)?.push({ neighbor: t, kind: conn.kind });
        inAdj.get(t)?.push({ neighbor: f, kind: conn.kind });
      }
    }
  }

  // BFS
  const impacted: ImpactedPipe[] = [];
  const visited = new Set<string>([pipeId]);

  type QueueItem = {
    pipeId: string;
    via: ConnectionKind;
    path: string[];
    direction: "downstream" | "upstream";
    depth: number;
  };
  const queue: QueueItem[] = [];

  // 초기: downstream (outgoing)
  for (const adj of outAdj.get(pipeId) ?? []) {
    queue.push({
      pipeId: adj.neighbor, via: adj.kind,
      path: [pipeId, adj.neighbor], direction: "downstream", depth: 1,
    });
  }

  // 초기: upstream (compensate, feedback의 incoming)
  for (const adj of inAdj.get(pipeId) ?? []) {
    if (adj.kind === "compensate" || adj.kind === "feedback") {
      queue.push({
        pipeId: adj.neighbor, via: adj.kind,
        path: [pipeId, adj.neighbor], direction: "upstream", depth: 1,
      });
    }
  }

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    if (visited.has(item.pipeId)) continue;
    visited.add(item.pipeId);

    impacted.push({
      pipeId: item.pipeId,
      via: item.via,
      path: item.path,
      direction: item.direction,
      depth: item.depth,
    });

    // 전이: downstream 연결 따라감
    for (const adj of outAdj.get(item.pipeId) ?? []) {
      if (!visited.has(adj.neighbor)) {
        queue.push({
          pipeId: adj.neighbor, via: adj.kind,
          path: [...item.path, adj.neighbor], direction: "downstream", depth: item.depth + 1,
        });
      }
    }

    // compensate: 역방향도 탐색
    for (const adj of inAdj.get(item.pipeId) ?? []) {
      if (adj.kind === "compensate" && !visited.has(adj.neighbor)) {
        queue.push({
          pipeId: adj.neighbor, via: adj.kind,
          path: [...item.path, adj.neighbor], direction: "upstream", depth: item.depth + 1,
        });
      }
    }
  }

  // byConcern 집계
  const byConcern = { ...emptyConcern };
  for (const imp of impacted) {
    const entry = concernMap.get(imp.pipeId);
    if (entry) {
      for (const c of entry.all) byConcern[c]++;
    }
  }

  return { sourceId: pipeId, impacted, blastRadius: impacted.length, byConcern };
}

/**
 * 파이프의 입출력 포트 구성을 우선으로, 필요 시 flow.kind를 fallback으로 사용해 역할을 추론한다.
 */
export function classifyPipeRole(pipe: PipeSpec): PipeRole {
  const ports = resolvePorts(pipe);
  const hasInputPort = ports.some(port => port.direction === "in");
  const hasOutputPort = ports.some(port => port.direction === "out");
  const hasAnyPort = ports.length > 0;
  const hasLegacyProduces = (pipe.produces?.length ?? 0) > 0;
  const hasTap = flowContainsKind(pipe.flow, "tap");
  const hasBranch = flowContainsKind(pipe.flow, "branch");
  const hasEmit = flowContainsKind(pipe.flow, "emit");

  // Port shape is the primary signal: bidirectional data flow implies transformation.
  if (hasInputPort && hasOutputPort) return "transformer";

  // Output-only pipes behave as producers regardless of flow kind.
  if (hasOutputPort) return "producer";

  // Fallback to the legacy flow-kind heuristics when port metadata is absent or input-only.
  if (hasTap && !hasLegacyProduces && !hasEmit) return "observer";

  if (hasBranch && !hasAnyPort) return "router";

  if (hasLegacyProduces) return "transformer";

  if (hasEmit) return "producer";

  return "consumer";
}

/** PipeFlow 트리에 특정 kind가 포함되어 있는지 확인 */
function flowContainsKind(flow: PipeFlow, targetKind: string): boolean {
  if (flow.kind === targetKind) return true;
  return getChildFlows(flow).some(child => flowContainsKind(child, targetKind));
}

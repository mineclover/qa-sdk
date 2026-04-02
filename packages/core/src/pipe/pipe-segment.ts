/**
 * PipeGraph → PathSegment 자동 도출
 *
 * PipeGraph의 connection 구조에서 이벤트 분기 토폴로지를 분석하여
 * PathSegment[]를 생성한다.
 *
 * 도출된 세그먼트는 **제안(proposal)**이다.
 * consumes는 파이프 체인의 pipeId 목록으로 채워지며,
 * 소비자가 실제 axis label로 교체해야 한다.
 */

import type { PipeGraph, PipeSpec, PipeConnection } from "../types/pipe-spec.js";
import type { PathSegment, EventTransition, BranchRoute } from "../catalog/catalog.types.js";
import { chainSegments } from "../catalog/path-summation.js";
import { normalizeEndpointPipeIds } from "./pipe-endpoint.js";

/** 도출 결과 */
export interface DetectedSegments {
  /** 도출된 세그먼트 (consumes는 pipeId 기반 제안값) */
  segments: PathSegment[];
  /** 감지 근거 */
  reasons: SegmentReason[];
}

export interface SegmentReason {
  segmentId: string;
  kind: "conditional-branch" | "event-transition" | "fan-out" | "linear-chain";
  pipeIds: string[];
  condition?: string;
}

/**
 * PipeGraph에서 PathSegment[]를 자동 도출한다.
 *
 * 전략:
 * 1. entryPipe에서 시작하여 connection을 따라감
 * 2. conditional 분기 → 각 분기별 별도 세그먼트
 * 3. event connection → transition 설정
 * 4. fan-out → 병렬 세그먼트
 * 5. 단순 next 체인 → 하나의 세그먼트
 */
export function detectPathSegments(graph: PipeGraph): DetectedSegments {
  if (graph.pipes.length === 0) return { segments: [], reasons: [] };

  const reasons: SegmentReason[] = [];
  const pipeMap = new Map(graph.pipes.map(p => [p.pipeId, p]));

  // outgoing connections 인덱스
  const outgoing = new Map<string, PipeConnection[]>();
  for (const pipe of graph.pipes) {
    outgoing.set(pipe.pipeId, []);
  }
  for (const conn of graph.connections) {
    const froms = normalizeEndpointPipeIds(conn.from);
    for (const f of froms) {
      outgoing.get(f)?.push(conn);
    }
  }

  const rawSegments: Array<{
    segmentId: string;
    consumes: string[];
    shape: number[];
    transition?: EventTransition;
    routes?: BranchRoute[];
  }> = [];
  const visited = new Set<string>();

  /** next 체인 따라가며 연속 파이프 수집 */
  function walkChain(startId: string): string[] {
    const chain: string[] = [];
    let current = startId;

    while (current && !visited.has(current)) {
      visited.add(current);
      chain.push(current);

      const conns = outgoing.get(current) ?? [];
      const nextConns = conns.filter(c => c.kind === "next");

      if (nextConns.length === 1) {
        const tos = normalizeEndpointPipeIds(nextConns[0].to);
        if (tos.length === 1 && !visited.has(tos[0])) {
          current = tos[0];
          continue;
        }
      }
      break;
    }

    return chain;
  }

  function processNode(pipeId: string): void {
    if (visited.has(pipeId) || !pipeMap.has(pipeId)) return;

    const conns = outgoing.get(pipeId) ?? [];

    // conditional 분기 → 각 분기별 세그먼트
    const conditionals = conns.filter(c => c.kind === "conditional");
    if (conditionals.length > 0) {
      visited.add(pipeId);

      for (const cond of conditionals) {
        const tos = normalizeEndpointPipeIds(cond.to);
        for (const to of tos) {
          const branchChain = walkChain(to);
          const segId = `branch_${pipeId}_${to}`;

          // 분기 체인의 마지막에서 event 전이 확인
          const lastId = branchChain[branchChain.length - 1];
          const transition = findEventTransition(lastId, outgoing, pipeMap);

          rawSegments.push({
            segmentId: segId,
            consumes: [pipeId, ...branchChain],
            shape: [pipeId, ...branchChain].map(() => 2),
            ...(transition ? { transition } : {}),
          });

          reasons.push({
            segmentId: segId,
            kind: "conditional-branch",
            pipeIds: [pipeId, ...branchChain],
            condition: cond.condition,
          });

          // 체인 끝 이후 연결 처리
          processNextConnections(lastId, outgoing);
        }
      }

      // 비-conditional 연결도 처리
      for (const c of conns) {
        if (c.kind !== "conditional" && c.kind !== "feedback") {
          const tos = normalizeEndpointPipeIds(c.to);
          for (const to of tos) processNode(to);
        }
      }
      return;
    }

    // fan-out → 병렬 세그먼트
    const fanouts = conns.filter(c => c.kind === "fan-out");
    if (fanouts.length > 0) {
      visited.add(pipeId);

      for (const fo of fanouts) {
        const tos = normalizeEndpointPipeIds(fo.to);
        for (const to of tos) {
          const chain = walkChain(to);
          const segId = `fanout_${pipeId}_${to}`;

          rawSegments.push({
            segmentId: segId,
            consumes: chain,
            shape: chain.map(() => 2),
          });

          reasons.push({
            segmentId: segId,
            kind: "fan-out",
            pipeIds: [pipeId, ...chain],
          });
        }
      }
      return;
    }

    // 단순 체인
    const chain = walkChain(pipeId);
    if (chain.length > 0) {
      const segId = chain.length === 1 ? chain[0] : `chain_${chain[0]}`;
      const lastId = chain[chain.length - 1];
      const transition = findEventTransition(lastId, outgoing, pipeMap);

      rawSegments.push({
        segmentId: segId,
        consumes: chain,
        shape: chain.map(() => 2),
        ...(transition ? { transition } : {}),
      });

      reasons.push({
        segmentId: segId,
        kind: "linear-chain",
        pipeIds: chain,
      });

      processNextConnections(lastId, outgoing);
    }
  }

  function processNextConnections(
    lastId: string,
    out: Map<string, PipeConnection[]>,
  ): void {
    const conns = out.get(lastId) ?? [];
    for (const c of conns) {
      if (c.kind === "feedback") continue;
      const tos = normalizeEndpointPipeIds(c.to);
      for (const to of tos) processNode(to);
    }
  }

  processNode(graph.entryPipeId);

  return {
    segments: rawSegments.length > 0 ? chainSegments(rawSegments) : [],
    reasons,
  };
}

/** 체인 끝에서 event connection → transition 추출 */
function findEventTransition(
  pipeId: string,
  outgoing: Map<string, PipeConnection[]>,
  pipeMap: Map<string, PipeSpec>,
): EventTransition | undefined {
  const conns = outgoing.get(pipeId) ?? [];
  for (const c of conns) {
    if (c.kind === "event") {
      const tos = normalizeEndpointPipeIds(c.to);
      const toPipe = pipeMap.get(tos[0]);
      if (toPipe) {
        return { eventKey: toPipe.trigger.eventKey };
      }
    }
  }
  // produces로 암묵적 전이
  const pipe = pipeMap.get(pipeId);
  if (pipe?.produces?.length) {
    return { eventKey: pipe.produces[0] };
  }
  return undefined;
}

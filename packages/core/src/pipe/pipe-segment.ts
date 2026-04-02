/**
 * PipeGraph → PathSegment 자동 도출
 *
 * PipeGraph의 connection 구조에서 이벤트 분기 토폴로지를 분석하여
 * PathSegment[]를 생성한다.
 *
 * 규칙:
 *   - conditional connection → 분기 세그먼트 분리
 *   - event connection → transition 설정
 *   - fan-out → 병렬 세그먼트
 *   - next 체인 → 단일 세그먼트
 */

import type { PipeGraph, PipeSpec, PipeConnection } from "../types/pipe-spec.js";
import type { PathSegment } from "../catalog/catalog.types.js";
import { chainSegments } from "../catalog/path-summation.js";

/** 도출 결과 */
export interface DetectedSegments {
  /** 도출된 세그먼트 목록 */
  segments: PathSegment[];
  /** 감지 근거 */
  reasons: SegmentReason[];
}

export interface SegmentReason {
  segmentId: string;
  /** 감지 방식 */
  kind: "conditional-branch" | "event-transition" | "fan-out" | "linear-chain";
  /** 관련 connection */
  fromPipeId: string;
  toPipeIds: string[];
}

/**
 * PipeGraph에서 PathSegment[]를 자동 도출한다.
 *
 * 전략:
 * 1. entryPipe에서 시작하여 connection을 따라감
 * 2. conditional 분기 → 각 분기별 별도 세그먼트
 * 3. event connection → transition 설정
 * 4. fan-out → 병렬 세그먼트
 * 5. 단순 next 체인 → 하나의 세그먼트로 묶음
 */
export function detectPathSegments(graph: PipeGraph): DetectedSegments {
  const reasons: SegmentReason[] = [];
  const pipeMap = new Map(graph.pipes.map(p => [p.pipeId, p]));

  // outgoing connections 인덱스
  const outgoing = new Map<string, PipeConnection[]>();
  for (const pipe of graph.pipes) {
    outgoing.set(pipe.pipeId, []);
  }
  for (const conn of graph.connections) {
    const froms = Array.isArray(conn.from) ? conn.from : [conn.from];
    for (const f of froms) {
      outgoing.get(f)?.push(conn);
    }
  }

  const rawSegments: Array<Omit<PathSegment, "addressOffset" | "size">> = [];
  const visited = new Set<string>();

  function walkChain(startId: string): string[] {
    const chain: string[] = [];
    let current = startId;

    while (true) {
      if (visited.has(current)) break;
      visited.add(current);
      chain.push(current);

      const conns = outgoing.get(current) ?? [];
      // 단순 next 1개만 있으면 체인 계속
      if (conns.length === 1 && conns[0].kind === "next") {
        const tos = Array.isArray(conns[0].to) ? conns[0].to : [conns[0].to];
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
    if (visited.has(pipeId)) return;

    const conns = outgoing.get(pipeId) ?? [];
    const pipe = pipeMap.get(pipeId);
    if (!pipe) return;

    // conditional 분기 → 각 분기별 세그먼트
    const conditionals = conns.filter(c => c.kind === "conditional");
    if (conditionals.length > 0) {
      const chain = walkChain(pipeId);
      const consumes = collectScopes(chain, pipeMap);

      for (const cond of conditionals) {
        const tos = Array.isArray(cond.to) ? cond.to : [cond.to];
        for (const to of tos) {
          const branchChain = walkChain(to);
          const branchConsumes = collectScopes(branchChain, pipeMap);
          const allConsumes = [...new Set([...consumes, ...branchConsumes])];

          const segId = `${pipeId}_to_${to}`;
          rawSegments.push({
            segmentId: segId,
            consumes: allConsumes,
            shape: allConsumes.map(() => 2), // 분기별 2값 (경로 존재/비존재)
            ...(cond.condition ? {} : {}),
          });

          reasons.push({
            segmentId: segId,
            kind: "conditional-branch",
            fromPipeId: pipeId,
            toPipeIds: [to],
          });

          processNode(to);
        }
      }

      // event 전이
      const events = conns.filter(c => c.kind === "event");
      for (const ev of events) {
        const tos = Array.isArray(ev.to) ? ev.to : [ev.to];
        const toPipe = pipeMap.get(tos[0]);
        if (toPipe) {
          // 마지막 세그먼트에 transition 추가
          const lastSeg = rawSegments[rawSegments.length - 1];
          if (lastSeg) {
            (lastSeg as { transition?: { eventKey: string } }).transition = {
              eventKey: toPipe.trigger.eventKey,
            };
          }
        }
      }

      return;
    }

    // fan-out → 병렬 세그먼트
    const fanouts = conns.filter(c => c.kind === "fan-out");
    if (fanouts.length > 0) {
      visited.add(pipeId);
      for (const fo of fanouts) {
        const tos = Array.isArray(fo.to) ? fo.to : [fo.to];
        for (const to of tos) {
          const chain = walkChain(to);
          const consumes = collectScopes(chain, pipeMap);

          const segId = `fanout_${pipeId}_${to}`;
          rawSegments.push({
            segmentId: segId,
            consumes: consumes.length > 0 ? consumes : [pipeId],
            shape: consumes.length > 0 ? consumes.map(() => 2) : [2],
          });

          reasons.push({
            segmentId: segId,
            kind: "fan-out",
            fromPipeId: pipeId,
            toPipeIds: [to],
          });
        }
      }
      return;
    }

    // 단순 체인 → 하나의 세그먼트
    const chain = walkChain(pipeId);
    if (chain.length > 0) {
      const consumes = collectScopes(chain, pipeMap);
      const segId = chain.length === 1 ? chain[0] : `chain_${chain[0]}`;

      rawSegments.push({
        segmentId: segId,
        consumes: consumes.length > 0 ? consumes : chain,
        shape: consumes.length > 0 ? consumes.map(() => 2) : chain.map(() => 2),
      });

      reasons.push({
        segmentId: segId,
        kind: "linear-chain",
        fromPipeId: chain[0],
        toPipeIds: chain.slice(1),
      });

      // 체인 끝에서 event 전이
      const lastPipeId = chain[chain.length - 1];
      const lastConns = outgoing.get(lastPipeId) ?? [];
      const eventConns = lastConns.filter(c => c.kind === "event");
      for (const ev of eventConns) {
        const tos = Array.isArray(ev.to) ? ev.to : [ev.to];
        const toPipe = pipeMap.get(tos[0]);
        if (toPipe) {
          const lastSeg = rawSegments[rawSegments.length - 1];
          if (lastSeg) {
            (lastSeg as { transition?: { eventKey: string } }).transition = {
              eventKey: toPipe.trigger.eventKey,
            };
          }
        }
        processNode(tos[0]);
      }

      // next 이후 연결 처리
      for (const conn of lastConns) {
        if (conn.kind !== "event" && conn.kind !== "feedback") {
          const tos = Array.isArray(conn.to) ? conn.to : [conn.to];
          for (const to of tos) processNode(to);
        }
      }
    }
  }

  processNode(graph.entryPipeId);

  return {
    segments: rawSegments.length > 0 ? chainSegments(rawSegments) : [],
    reasons,
  };
}

/** 파이프 목록에서 scope를 수집 (scope가 없으면 pipeId 사용) */
function collectScopes(pipeIds: string[], pipeMap: Map<string, PipeSpec>): string[] {
  const scopes = new Set<string>();
  for (const id of pipeIds) {
    const pipe = pipeMap.get(id);
    if (pipe?.scope) scopes.add(pipe.scope);
  }
  return [...scopes];
}

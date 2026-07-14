// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 분기 경로 수 계산 — PipeFlow에서 도달 가능한 경로 수를 계산한다.
 *
 * 전곱이 아닌 경로 합산 모델:
 *   sequence → 곱 (순차 도달)
 *   branch → 합 (조건부)
 *   optional → +1 (있는 경로 + 없는 경로)
 */

import type { PipeFlow, PipeGraph } from '../types/pipe-spec.js';
import { normalizeEndpointPipeIds } from './pipe-endpoint.js';

/** 단일 파이프의 내부 흐름에서 도달 가능한 경로 수 */
export function countPipePaths(flow: PipeFlow): number {
  switch (flow.kind) {
    // 기본
    case 'step':
      return 1;
    case 'sequence':
      return flow.steps.reduce((acc, s) => acc * countPipePaths(s), 1);

    // 분기
    case 'branch':
      return flow.paths.reduce((acc, p) => acc + countPipePaths(p), 0);
    case 'optional':
      return countPipePaths(flow.step) + 1;

    // 동시성
    case 'parallel':
      return flow.steps.reduce((acc, s) => acc * countPipePaths(s), 1);
    case 'race':
      return flow.steps.reduce((acc, s) => acc + countPipePaths(s), 0);
    case 'await':
      return countPipePaths(flow.then);

    // 내결함
    case 'retry':
      return countPipePaths(flow.step);
    case 'fallback':
      return countPipePaths(flow.try) + countPipePaths(flow.catch);

    // 반복
    case 'loop':
      return countPipePaths(flow.body);

    // 트랜잭션
    case 'compensate':
      return countPipePaths(flow.forward) + countPipePaths(flow.compensate);
    case 'transition-scope':
      return countPipePaths(flow.body) + (flow.compensate ? countPipePaths(flow.compensate) : 0);

    // 비동기
    case 'emit':
      return 1;

    // 정리
    case 'finally':
      return countPipePaths(flow.body);

    // 시간
    case 'timeout':
      return countPipePaths(flow.body) + (flow.onTimeout ? countPipePaths(flow.onTimeout) : 1);

    // 제어
    case 'feedback':
      return countPipePaths(flow.body);

    // 배치
    case 'map':
      return countPipePaths(flow.itemFlow);
    case 'reduce':
      return countPipePaths(flow.step);
    case 'buffer':
      return countPipePaths(flow.body);
    case 'filter':
      return countPipePaths(flow.step) + 1;

    // 안정화
    case 'circuit-breaker':
      return countPipePaths(flow.step) + 1;
    case 'throttle':
      return countPipePaths(flow.step);
    case 'debounce':
      return countPipePaths(flow.step);

    // 데이터 변환
    case 'split':
      return countPipePaths(flow.itemFlow);
    case 'enrich':
      return countPipePaths(flow.step);

    // 관측
    case 'tap':
      return countPipePaths(flow.step);

    // 스트리밍
    case 'resequence':
      return countPipePaths(flow.step);
    case 'window':
      return countPipePaths(flow.body);

    // 상태
    case 'dedup':
      return countPipePaths(flow.step) + 1;
    case 'correlation':
      return countPipePaths(flow.onMatch) + (flow.onTimeout ? countPipePaths(flow.onTimeout) : 1);

    default:
      return 1;
  }
}

/** 그래프 전체 경로 수 (entryPipeId부터 도달 가능한 모든 경로) */
export function countGraphPaths(graph: PipeGraph): number {
  const pipeMap = new Map(graph.pipes.map((p) => [p.pipeId, p]));
  const visited = new Set<string>();

  function walk(pipeId: string): number {
    if (visited.has(pipeId)) return 1; // 순환 방지
    visited.add(pipeId);

    const pipe = pipeMap.get(pipeId);
    if (!pipe) return 0;

    const internalPaths = countPipePaths(pipe.flow);

    // 이 파이프에서 나가는 연결들
    const outgoing = graph.connections.filter((c) => {
      const froms = normalizeEndpointPipeIds(c.from);
      return froms.includes(pipeId);
    });

    if (outgoing.length === 0) return internalPaths;

    let totalOutgoing = 0;
    for (const conn of outgoing) {
      const tos = normalizeEndpointPipeIds(conn.to);

      switch (conn.kind) {
        case 'next':
        case 'event':
        case 'fan-out': {
          // 곱: 순차/이벤트 체인/동시 시작
          let product = 1;
          for (const to of tos) product *= walk(to);
          totalOutgoing += product;
          break;
        }
        case 'conditional':
        case 'error':
        case 'compensate':
        case 'feedback': {
          // 합: 조건부/에러/보상/피드백
          for (const to of tos) totalOutgoing += walk(to);
          break;
        }
        case 'join': {
          // join은 from[] → to: 합류점이므로 to의 경로만
          for (const to of tos) totalOutgoing += walk(to);
          break;
        }
      }
    }

    visited.delete(pipeId);
    return internalPaths * (totalOutgoing || 1);
  }

  return walk(graph.entryPipeId);
}

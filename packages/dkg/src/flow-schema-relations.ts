// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * FlowSchemaNode 관계 파생 유틸.
 *
 * US-003에서는 새 엣지 타입을 만들지 않고, 기존 DKG 엣지 타입을 재사용한다.
 * - flow-schema ─composes→ axis
 * - flow-schema ─observes→ prefix
 * - flow-schema ─contains→ domain
 * - flow-schema ─references→ flow-schema (subFlow)
 */

import type { DkgEdge } from './dkg.types.js';

export interface FlowSchemaRelationInput {
  readonly flowSchemaId: string;
  readonly axisIds?: readonly string[];
  readonly observedPrefixIds?: readonly string[];
  readonly domainId?: string;
  readonly subFlowIds?: readonly string[];
}

/**
 * FlowSchemaNode에 연결할 표준 DKG 엣지를 생성한다.
 *
 * contains는 스토리 정의를 따라 flow-schema → domain 방향을 사용한다.
 */
export function deriveFlowSchemaEdges(input: FlowSchemaRelationInput): DkgEdge[] {
  const edges: DkgEdge[] = [];
  const seen = new Set<string>();

  const push = (type: DkgEdge['type'], to: string): void => {
    const key = `${type}:${input.flowSchemaId}:${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ type, from: input.flowSchemaId, to });
  };

  for (const axisId of input.axisIds ?? []) {
    push('composes', axisId);
  }

  for (const prefixId of input.observedPrefixIds ?? []) {
    push('observes', prefixId);
  }

  if (input.domainId) {
    push('contains', input.domainId);
  }

  for (const subFlowId of input.subFlowIds ?? []) {
    if (subFlowId !== input.flowSchemaId) {
      push('references', subFlowId);
    }
  }

  return edges;
}

export interface GraphEdgeWriter {
  addEdge(type: DkgEdge['type'], from: string, to: string, meta?: Record<string, unknown>): void;
}

/**
 * FlowSchemaNode 관계 엣지를 그래프에 직접 연결한다.
 * 반환값은 실제로 추가한 엣지 목록이다.
 */
export function attachFlowSchemaEdges(
  graph: GraphEdgeWriter,
  input: FlowSchemaRelationInput,
): DkgEdge[] {
  const edges = deriveFlowSchemaEdges(input);
  for (const edge of edges) {
    graph.addEdge(edge.type, edge.from, edge.to, edge.meta ? { ...edge.meta } : undefined);
  }
  return edges;
}

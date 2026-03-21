/**
 * GraphPort — schema 레이어가 DKG에 직접 의존하지 않도록 하는 최소 인터페이스.
 *
 * schema/category-rules.ts가 GraphRegistry 대신 이 인터페이스를 사용한다.
 * dkg → schema 역방향 의존 해소.
 */

export interface PrefixLike {
  readonly kind: "prefix";
  readonly id: string;
  readonly dimLabels: readonly string[];
  readonly category?: string;
}

/** 그래프 노드의 최소 공통 형태 */
export type GraphNodeLike = { readonly kind: string; readonly id: string };

export interface GraphPort {
  getNode(id: string): GraphNodeLike | undefined;
  getNodesByKind(kind: string): GraphNodeLike[];
  edgesFrom(id: string, type?: string): readonly { type: string; from: string; to: string; meta?: Record<string, unknown> }[];
  neighbors(id: string, type: string): string[];
}

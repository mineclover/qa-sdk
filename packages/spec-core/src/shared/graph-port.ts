/**
 * GraphPort — DKG 그래프의 추상 인터페이스.
 *
 * schema, convergence 등 하위 레이어가 GraphRegistry에 직접 의존하지 않도록 한다.
 * GraphRegistry가 이 인터페이스를 구현(implement)한다.
 */

export interface PrefixLike {
  readonly kind: "prefix";
  readonly id: string;
  readonly dimLabels: readonly string[];
  readonly category?: string;
}

/** 그래프 노드의 최소 공통 형태 */
export type GraphNodeLike = { readonly kind: string; readonly id: string };

/** 그래프 엣지 형태 */
export type GraphEdgeLike = { readonly type: string; readonly from: string; readonly to: string; readonly meta?: Record<string, unknown> };

export interface GraphPort {
  // ── 읽기: 노드 ──
  getNode(id: string): GraphNodeLike | undefined;
  getNodeOrThrow(id: string): GraphNodeLike;
  getNodesByKind(kind: string): GraphNodeLike[];
  getNodesByKind<K extends string>(kind: K): GraphNodeLike[];
  getAllNodes(): GraphNodeLike[];
  findNodes(kind: string, predicate?: (node: any) => boolean): any[];

  // ── 읽기: 엣지 ──
  edgesFrom(id: string, type?: string): readonly GraphEdgeLike[];
  edgesTo(id: string, type?: string): readonly GraphEdgeLike[];
  neighbors(id: string, type: string): string[];

  // ── 읽기: 복합 질의 ──
  intentLinksFor(targetId: string): Array<{ id: string; intent: string; invariant?: string }>;
  cascadeFromAxis(axisId: string): Array<{ id: string; reason: "composes" | "references"; distance: number }>;
  getPrefixesByCategory(category: string): GraphNodeLike[];
  groupPrefixesByCategory(): Record<string, GraphNodeLike[]>;

  // ── 쓰기 ──
  addNode(node: GraphNodeLike): void;
  addEdge(type: string, from: string, to: string, meta?: Record<string, unknown>): void;
}

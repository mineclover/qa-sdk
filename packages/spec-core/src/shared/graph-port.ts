/**
 * GraphPort — DKG 그래프의 추상 인터페이스 (의존성 역전).
 *
 * 3단 추상화:
 *   GraphPort (shared/)     → convergence/schema 레이어가 사용. GraphNodeLike 반환.
 *   GraphRegistryPort       → 서비스(ingest/registry)가 동적 import 시 사용. 최소 2메서드.
 *   GraphRegistry (dkg/)    → CLI/skills가 직접 사용. DkgNode 15종 구체 타입 반환.
 *
 * GraphPort는 DkgNode를 import하지 않는다.
 * convergence 함수들은 kind/id만으로 그래프를 질의하고,
 * 구체 필드(title, rationale 등)가 필요하면 GraphRegistry를 직접 사용한다.
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
  cascadeFromPrefix(prefixId: string): {
    domains: Array<{ id: string; affectedPrefixes: string[] }>;
    consumers: Array<{ id: string; via: string }>;
  };
  activeConstraints(targetId: string): Array<{ constraintId: string; rule: string }>;
  getPrefixesByCategory(category: string): GraphNodeLike[];
  groupPrefixesByCategory(): Record<string, GraphNodeLike[]>;

  // ── 읽기: 통계 ──
  readonly nodeCount: number;
  readonly edgeCount: number;

  // ── 쓰기 ──
  addNode(node: GraphNodeLike): void;
  addEdge(type: string, from: string, to: string, meta?: Record<string, unknown>): void;
}

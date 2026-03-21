/**
 * spec-core Port Interfaces — registry-service가 spec-core를 소비할 때 사용하는 인터페이스.
 *
 * 관측 기반 설계 (2026-03-21):
 *   GraphRegistry proto: constructor, addNode, replaceNode, getNode, getNodeOrThrow,
 *     hasNode, getNodesByKind, getAllNodes, nodeCount, addEdge, edgesFrom, edgesTo,
 *     edgeCount, neighbors, reverseNeighbors, transitiveNeighbors, cascadeFromAxis,
 *     cascadeFromPrefix, activeConstraints, intentLinksFor, findNodes,
 *     getPrefixesByCategory, groupPrefixesByCategory
 *   GraphRegistry own: nodes, forward, reverse
 *
 *   Catalog keys: id, name, axes, prefixes, tables
 *   Axis keys: id, name, versions
 *   MetricValue keys: id, name, value, status, detail, target, measuredAt
 */

// ── DKG Node ────────────────────────────────────────────

export interface DkgNodePort {
  readonly kind: string;
  readonly id: string;
  readonly name?: string;
  [key: string]: unknown;
}

// ── Edge ────────────────────────────────────────────────

export interface DkgEdgePort {
  readonly type: string;
  readonly from: string;
  readonly to: string;
  readonly meta?: Record<string, unknown>;
}

// ── GraphRegistry ───────────────────────────────────────

export interface GraphRegistryPort {
  // read
  getAllNodes(): DkgNodePort[];
  getNodesByKind(kind: string): DkgNodePort[];
  getNode(id: string): DkgNodePort | undefined;
  getNodeOrThrow(id: string): DkgNodePort;
  hasNode(id: string): boolean;
  findNodes(kind: string, predicate: (node: DkgNodePort) => boolean): DkgNodePort[];
  getPrefixesByCategory(category: string): DkgNodePort[];
  groupPrefixesByCategory(): Map<string, DkgNodePort[]>;

  // edges
  edgesFrom(nodeId: string, type: string): DkgEdgePort[];
  edgesTo(nodeId: string, type: string): DkgEdgePort[];
  neighbors(nodeId: string, type: string): string[];
  reverseNeighbors(nodeId: string, type: string): string[];
  transitiveNeighbors(nodeId: string, type: string, maxDepth?: number): string[];
  activeConstraints(): DkgNodePort[];
  intentLinksFor(prefixId: string): DkgNodePort[];

  // cascade
  cascadeFromAxis(axisId: string): { prefixes: string[]; domains: string[]; dsls: string[] };
  cascadeFromPrefix(prefixId: string): { domains: string[]; consumers: string[]; dsls: string[] };

  // write
  addNode(node: DkgNodePort): void;
  replaceNode(node: DkgNodePort): void;
  addEdge(type: string, from: string, to: string, meta?: Record<string, unknown>): void;

  // counts
  readonly nodeCount: number;
  readonly edgeCount: number;
}

// ── MetricValue ─────────────────────────────────────────

export interface MetricValuePort {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly status: "ok" | "warning" | "critical";
  readonly detail?: string;
  readonly target?: string;
  readonly measuredAt: string;
}

// ── ObservationNode ─────────────────────────────────────

export interface ObservationNodePort {
  readonly kind: "observation";
  readonly id: string;
  readonly date: string;
  readonly source: string;
  readonly subjects: readonly string[];
  readonly finding: string;
  readonly suggestion?: { kind: string; rule: string };
  readonly intent?: string;
  readonly resolution?: { decisionId: string; outcome: string; note?: string };
}

// ── DkgSqliteStore ──────────────────────────────────────

export interface DkgSqliteStorePort {
  loadGraph(): GraphRegistryPort;
  saveGraph(graph: GraphRegistryPort, source: string): { nodesWritten: number; edgesWritten: number };
  saveNodes(
    nodes: readonly DkgNodePort[],
    edges: readonly DkgEdgePort[],
    source: string,
  ): void;
  saveUsageSnapshotWithObservations(usage: unknown, observations: readonly DkgNodePort[]): { snapshotId: number };
  setMeta(key: string, value: string): void;
  getMeta?(key: string): string | null;
  updateNode?(node: DkgNodePort): void;
  close?(): void;
}

export interface DkgSqliteStoreConstructor {
  new (path: string, catalogId?: string): DkgSqliteStorePort;
}

// ── Analysis Module (동적 import 결과) ──────────────────

export interface AnalysisModulePort {
  bootstrapDkg(options: { catalog: unknown; config: unknown; date?: string }): GraphRegistryPort;
  collectMetrics(catalog: CatalogPort, graph: GraphRegistryPort, usage: unknown | null): MetricValuePort[];
  metricsToObservations(metrics: readonly MetricValuePort[], options?: { date?: string }): ObservationNodePort[];
}

// ── Propagation Module (동적 import 결과) ────────────────

export interface PropagationModulePort {
  checkActivationReadiness(graph: GraphRegistryPort, prefixId: string, options?: {
    mode?: "strict" | "warn";
    schemaCheck?: boolean;
  }): {
    allowed: boolean;
    diagnostics: readonly { level: string; source: string; id: string; message: string }[];
    constraintViolations: number;
  };
}

// ── Store Module (동적 import 결과) ─────────────────────

export interface StoreModulePort {
  DkgSqliteStore: DkgSqliteStoreConstructor;
}

// ── Catalog (관측 기반: keys = id, name, axes, prefixes, tables) ──

export interface CatalogPort {
  readonly id?: string;
  readonly name?: string;
  readonly axes: Record<string, {
    readonly id: string;
    readonly name: string;
    readonly versions: Record<string, { entries?: readonly string[]; capacity?: number; ko?: Record<string, string> }>;
  }>;
  readonly prefixes: Record<string, {
    readonly id: string;
    readonly name: string;
    readonly labels: readonly string[];
    readonly dims?: Record<string, unknown>;
    readonly versions?: readonly unknown[];
    readonly meta?: Record<string, unknown>;
  }>;
  readonly tables?: Record<string, unknown>;
}

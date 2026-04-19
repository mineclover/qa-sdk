// @def.boundary registry-system
// @def.doc registry-system

/**
 * spec-core Port Interfaces — registry-service가 spec-core를 소비할 때 사용하는 인터페이스.
 *
 * 3단 추상화에서 서비스 레벨:
 *   GraphPort (spec-core/shared)    → convergence/schema 내부용
 *   GraphRegistryPort (여기)        → 서비스 동적 import용
 *   GraphRegistry (spec-core/dkg)   → CLI/skills 직접 사용
 *
 * 관측 기반 설계 (2026-03-21):
 *   Catalog keys: id, name, axes, prefixes, tables
 *   Axis keys: id, name, versions
 *   MetricValue keys: id, name, value, status, detail, target, measuredAt
 */

// ── DKG Node ────────────────────────────────────────────

export interface DkgNodePort {
  readonly kind: string;
  readonly id: string;
  readonly name?: string;
  readonly category?: string;
  readonly lifecycle?: string;
  readonly resolution?: { decisionId: string; outcome: string; note?: string };
  readonly title?: string;
  readonly type?: string;
  readonly targets?: readonly string[];
  readonly finding?: string;
  readonly source?: string;
  readonly subjects?: readonly string[];
  readonly date?: string;
  readonly prefix?: string;
  readonly subjectId?: string;
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly impact?: string;
  readonly consumedPrefixes?: readonly string[];
  readonly role?: string;
}

// ── Edge ────────────────────────────────────────────────

export interface DkgEdgePort {
  readonly type: string;
  readonly from: string;
  readonly to: string;
  readonly meta?: {
    readonly dimKind?: string;
    readonly label?: string;
    readonly column?: string;
    readonly fk?: boolean;
    readonly sharedAxes?: readonly string[];
  };
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
  groupPrefixesByCategory(): Record<string, DkgNodePort[]>;

  // edges
  edgesFrom(nodeId: string, type?: string): readonly DkgEdgePort[];
  edgesTo(nodeId: string, type?: string): readonly DkgEdgePort[];
  neighbors(nodeId: string, type: string): string[];
  reverseNeighbors(nodeId: string, type: string): string[];
  transitiveNeighbors(nodeId: string, type: string, direction?: "forward" | "reverse"): Array<{ id: string; distance: number }>;
  activeConstraints(targetId: string): Array<{ constraintId: string; rule: string }>;
  intentLinksFor(prefixId: string): Array<{ id: string; intent: string; invariant?: string }>;

  // cascade
  cascadeFromAxis(axisId: string): Array<{ id: string; reason: "composes" | "references"; distance: number }>;
  cascadeFromPrefix(prefixId: string): {
    domains: Array<{ id: string; affectedPrefixes: string[] }>;
    consumers: Array<{ id: string; via: string }>;
  };

  // write
  addNode(node: DkgNodePort): void;
  replaceNode(node: DkgNodePort): void;
  addEdge(type: string, from: string, to: string, meta?: DkgEdgePort["meta"]): void;

  // table column refs
  getTableColumnRefs(tableId: string): Array<{
    column: string;
    targetId: string;
    refKind: "column_axis" | "prefix_ref" | "fk";
  }>;

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
  readonly measuredAt?: string;
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
  saveUsageSnapshotWithObservations(usage: UsageDataPort, observations: readonly DkgNodePort[]): { snapshotId: number };
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
  bootstrapDkg(options: {
    catalog: CatalogPort;
    config: DkgConfigPort;
    date?: string;
    transitionSpecs?: readonly TransitionSpecPort[];
  }): GraphRegistryPort;
  collectMetrics(catalog: CatalogPort, graph: GraphRegistryPort, usage: UsageDataPort | null): MetricValuePort[];
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
    readonly dims?: Record<string, {
      readonly kind: "axis" | "prefix_ref" | "table_ref";
      readonly axisId?: string;
      readonly prefixId?: string;
      readonly table?: string;
    }>;
    readonly versions?: readonly {
      readonly version: string;
      readonly axisVersions?: Record<string, string>;
      readonly refEntries?: Record<string, { readonly values: readonly number[]; readonly refVersion: string }>;
    }[];
    readonly meta?: {
      readonly category?: string;
      readonly layer?: number;
      readonly visualShape?: string;
      readonly heightRatio?: number;
      readonly detailKind?: string;
    };
  }>;
  readonly tables?: Record<string, {
    readonly table: string;
    readonly columns: Record<string, {
      readonly kind: "scalar" | "prefix_ref" | "table_ref" | "axis_ref";
      readonly type?: string;
      readonly prefixId?: string;
      readonly table?: string;
      readonly axisId?: string;
    }>;
  }>;
}

export interface DkgConfigPort {
  readonly domains: readonly object[];
  readonly consumers: readonly object[];
  readonly constraints: readonly object[];
  readonly dslBundles: readonly object[];
  readonly intentLinks: readonly object[];
  readonly skills: readonly object[];
  readonly specs?: readonly object[];
  readonly decisions?: readonly object[];
  readonly reviewPairs?: readonly { readonly a: string; readonly b: string; readonly reason: string }[];
}

export interface TransitionSpecPort {
  readonly id?: string;
  readonly transition: string;
  readonly version?: string;
}

export interface UsageDataPort {
  readonly collectionPeriod?: { readonly from: string; readonly to: string };
  readonly entryUsages: readonly object[];
  readonly addressUsages: readonly object[];
  readonly coOccurrences: readonly object[];
  readonly versionUsages: readonly object[];
}

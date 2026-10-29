// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * spec-core Port Interfaces — ingest-server가 spec-core를 동적 import할 때 사용하는 타입.
 *
 * spec-core는 optional peer dependency이므로 정적 import 불가.
 * 동적 import 결과에 대한 최소 구조적 인터페이스를 정의한다.
 *
 * 3단 추상화에서 최하위 레벨:
 *   GraphPort (spec-core/shared)  → convergence/schema 내부용
 *   GraphRegistryPort (여기)      → 서비스 동적 import용 (최소 2메서드)
 *   GraphRegistry (spec-core/dkg) → CLI/skills 직접 사용
 */

// ── GraphRegistry (최소 읽기 인터페이스) ─────────────────

export interface DkgNodePort {
  readonly kind: string;
  readonly id: string;
  readonly name?: string;
  [key: string]: unknown;
}

export interface GraphRegistryPort {
  getAllNodes(): DkgNodePort[];
  getNodesByKind(kind: string): DkgNodePort[];
}

// ── DkgSqliteStore ──────────────────────────────────────

export interface DkgSqliteStorePort {
  loadGraph(): GraphRegistryPort;
  saveGraph(
    graph: GraphRegistryPort,
    source: string,
  ): { nodesWritten: number; edgesWritten: number };
  saveUsageSnapshotWithObservations(
    usage: unknown,
    observations: readonly unknown[],
  ): { snapshotId: number; observationsWritten: number };
  stats(): {
    nodes: number;
    edges: number;
    snapshots: number;
    versionUsages: number;
    bootstrapNodes: number;
    manualNodes: number;
    bootstrapEdges: number;
    manualEdges: number;
  };
  close(): void;
}

export interface DkgSqliteStoreConstructor {
  new (path: string, catalogId?: string): DkgSqliteStorePort;
}

// ── 동적 import 모듈 타입 ───────────────────────────────

/** `import("dkg-store")` 결과의 최소 인터페이스 */
export interface StoreModulePort {
  DkgSqliteStore: DkgSqliteStoreConstructor;
}

/** `import("demo-snapshot")` 결과의 최소 인터페이스 */
export interface DemoSnapshotModulePort {
  DEMO_CATALOG: unknown;
  DEMO_DKG_CONFIG: unknown;
}

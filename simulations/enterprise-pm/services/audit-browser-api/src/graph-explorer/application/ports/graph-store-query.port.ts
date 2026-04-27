// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain query port — authorization-ontology 도메인의 graph store read 표면.
 *
 * graph-explorer 는 BFF 슬라이스이므로 자기 aggregate 가 없다. 이 port 는 외부
 * (authorization-ontology) 도메인의 read API 만 노출한다. retention prune 은
 * read 가 아닌 maintenance command 이므로 housekeeping 어댑터에 별도 위치.
 */
import type {
  AuthorizationGraphDiff,
  AuthorizationGraphSnapshotRecord,
} from "authorization-ontology";

export interface GraphRetentionPruneResult {
  readonly graphId: string;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly deletedSnapshotIds: readonly string[];
  readonly keptSnapshotIds: readonly string[];
}

export interface GraphRetentionPruneAllResult {
  readonly keepLatest: number;
  readonly graphIds: readonly string[];
  readonly graphCount: number;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly deletedSnapshotIds: readonly string[];
  readonly graphs: readonly GraphRetentionPruneResult[];
}

export abstract class GraphStoreQueryPort {
  abstract latest(graphId: string): Promise<AuthorizationGraphSnapshotRecord | null>;

  abstract list(graphId: string): Promise<readonly AuthorizationGraphSnapshotRecord[]>;

  abstract getSnapshot(snapshotId: string): Promise<AuthorizationGraphSnapshotRecord | null>;

  abstract graphIds(): Promise<readonly string[]>;

  abstract diff(
    fromSnapshotId: string,
    toSnapshotId: string,
  ): Promise<AuthorizationGraphDiff | null>;

  abstract prune(graphId: string, keepLatest: number): Promise<GraphRetentionPruneResult>;

  abstract pruneAll(keepLatest: number): Promise<GraphRetentionPruneAllResult>;
}

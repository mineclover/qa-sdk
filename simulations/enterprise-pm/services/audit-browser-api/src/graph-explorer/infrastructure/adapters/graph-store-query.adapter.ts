// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import {
  listAuthorizationGraphIds,
  pruneAllAuthorizationGraphSnapshots,
  pruneAuthorizationGraphSnapshots,
} from "@qa-sdk/sim-authorization-graph-provider";
import type {
  AuthorizationGraphDiff,
  AuthorizationGraphSnapshotRecord,
  AuthorizationGraphStore,
} from "authorization-ontology";
import { diffAuthorizationGraphSnapshots } from "authorization-ontology";
import {
  GraphStoreQueryPort,
  type GraphRetentionPruneAllResult,
  type GraphRetentionPruneResult,
} from "../../application/ports/graph-store-query.port.js";

/**
 * GraphStoreQueryPort 의 어댑터.
 *
 * authorization-ontology 의 AuthorizationGraphStore 를 그대로 위임. graph-explorer
 * 는 BFF 슬라이스이므로 자체 read store 를 갖지 않는다.
 */
export class GraphStoreQueryAdapter extends GraphStoreQueryPort {
  constructor(private readonly store: AuthorizationGraphStore) {
    super();
  }

  async latest(graphId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    const snapshots = await this.store.listSnapshots({ graphId });
    return snapshots[snapshots.length - 1] ?? null;
  }

  async list(graphId: string): Promise<readonly AuthorizationGraphSnapshotRecord[]> {
    return this.store.listSnapshots({ graphId });
  }

  async getSnapshot(snapshotId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    return this.store.getSnapshot(snapshotId);
  }

  async graphIds(): Promise<readonly string[]> {
    return listAuthorizationGraphIds(this.store);
  }

  async diff(
    fromSnapshotId: string,
    toSnapshotId: string,
  ): Promise<AuthorizationGraphDiff | null> {
    return diffAuthorizationGraphSnapshots(this.store, fromSnapshotId, toSnapshotId);
  }

  async prune(graphId: string, keepLatest: number): Promise<GraphRetentionPruneResult> {
    return pruneAuthorizationGraphSnapshots(this.store, { graphId, keepLatest });
  }

  async pruneAll(keepLatest: number): Promise<GraphRetentionPruneAllResult> {
    return pruneAllAuthorizationGraphSnapshots(this.store, { keepLatest });
  }
}

// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { Inject, Injectable } from "@nestjs/common";
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

export const AUTHORIZATION_GRAPH_STORE = Symbol("AUTHORIZATION_GRAPH_STORE");

@Injectable()
export class GraphExplorerService {
  constructor(
    @Inject(AUTHORIZATION_GRAPH_STORE)
    private readonly store: AuthorizationGraphStore,
  ) {}

  async latest(graphId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    const snapshots = await this.store.listSnapshots({ graphId });
    return snapshots[snapshots.length - 1] ?? null;
  }

  async getSnapshot(snapshotId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    return this.store.getSnapshot(snapshotId);
  }

  async list(graphId: string): Promise<AuthorizationGraphSnapshotRecord[]> {
    return this.store.listSnapshots({ graphId });
  }

  async graphIds(): Promise<string[]> {
    return listAuthorizationGraphIds(this.store);
  }

  async diff(
    fromSnapshotId: string,
    toSnapshotId: string,
  ): Promise<AuthorizationGraphDiff | null> {
    return diffAuthorizationGraphSnapshots(this.store, fromSnapshotId, toSnapshotId);
  }

  async prune(graphId: string, keepLatest: number) {
    return pruneAuthorizationGraphSnapshots(this.store, { graphId, keepLatest });
  }

  async pruneAll(keepLatest: number) {
    return pruneAllAuthorizationGraphSnapshots(this.store, { keepLatest });
  }
}

// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { Inject, Injectable } from "@nestjs/common";
import type {
  AuthorizationGraphSnapshotRecord,
  AuthorizationGraphStore,
} from "authorization-ontology";

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
}

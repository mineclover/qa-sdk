// @def.boundary sim-audit-browser-api
// @def.doc authorization-graph-store

import { Controller, Delete, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { GraphExplorerService } from "./graph-explorer.service.js";

@Controller("audit/graphs")
export class GraphExplorerController {
  constructor(
    @Inject(GraphExplorerService) private readonly svc: GraphExplorerService,
  ) {}

  @Get("catalog")
  async catalog() {
    const graphIds = await this.svc.graphIds();
    return {
      count: graphIds.length,
      graphIds,
    };
  }

  @Delete("prune/:keepLatest")
  async pruneAll(@Param("keepLatest") keepLatest: string) {
    const parsedKeepLatest = Number.parseInt(keepLatest, 10);
    if (!Number.isFinite(parsedKeepLatest) || parsedKeepLatest < 0) {
      throw new NotFoundException({ error: "invalid_keep_latest", keepLatest });
    }
    return this.svc.pruneAll(parsedKeepLatest);
  }

  @Get(":graphId/latest")
  async latest(@Param("graphId") graphId: string) {
    const snapshot = await this.svc.latest(graphId);
    if (!snapshot) {
      throw new NotFoundException({ error: "graph_not_found", graphId });
    }
    return snapshot;
  }

  @Get(":graphId")
  async list(@Param("graphId") graphId: string) {
    const snapshots = await this.svc.list(graphId);
    return {
      graphId,
      count: snapshots.length,
      snapshots,
    };
  }

  @Get("snapshots/:snapshotId")
  async snapshot(@Param("snapshotId") snapshotId: string) {
    const snapshot = await this.svc.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new NotFoundException({ error: "snapshot_not_found", snapshotId });
    }
    return snapshot;
  }

  @Get("diff/:fromSnapshotId/:toSnapshotId")
  async diff(
    @Param("fromSnapshotId") fromSnapshotId: string,
    @Param("toSnapshotId") toSnapshotId: string,
  ) {
    const diff = await this.svc.diff(fromSnapshotId, toSnapshotId);
    if (!diff) {
      throw new NotFoundException({
        error: "graph_diff_not_found",
        fromSnapshotId,
        toSnapshotId,
      });
    }
    return diff;
  }

  @Delete(":graphId/prune/:keepLatest")
  async prune(
    @Param("graphId") graphId: string,
    @Param("keepLatest") keepLatest: string,
  ) {
    const parsedKeepLatest = Number.parseInt(keepLatest, 10);
    if (!Number.isFinite(parsedKeepLatest) || parsedKeepLatest < 0) {
      throw new NotFoundException({ error: "invalid_keep_latest", keepLatest });
    }
    return this.svc.prune(graphId, parsedKeepLatest);
  }
}
